import { Router, type Request, type Response } from "express";
import { db } from "../db";
import { capacityEntries, capacityChangelog, teamMembers, projects, activities } from "@shared/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

const router = Router();

// ── Helper: resolve display names for changelog ──────────────
async function resolveNames(projectId: number | null, activityId: number | null) {
  let projectNumber: string | null = null;
  let activityName: string | null = null;

  if (projectId) {
    const p = await db.select({ number: projects.number }).from(projects).where(eq(projects.id, projectId)).limit(1);
    if (p.length) projectNumber = p[0].number;
  }
  if (activityId) {
    const a = await db.select({ name: activities.name }).from(activities).where(eq(activities.id, activityId)).limit(1);
    if (a.length) activityName = a[0].name;
  }
  return { projectNumber, activityName };
}

// ── Helper: log a change ─────────────────────────────────────
async function logChange(params: {
  entryId: number | null;
  teamMemberId: number | null;
  date: string | null;
  action: "create" | "update" | "delete";
  field?: string;
  oldValue?: string | null;
  newValue?: string | null;
  summary: string;
}) {
  await db.insert(capacityChangelog).values({
    entryId: params.entryId,
    teamMemberId: params.teamMemberId,
    date: params.date,
    action: params.action,
    field: params.field || null,
    oldValue: params.oldValue || null,
    newValue: params.newValue || null,
    summary: params.summary,
  });
}

// GET /api/capacity?week=YYYY-MM-DD
router.get("/", async (req: Request, res: Response) => {
  const weekParam = String(req.query.week || "");
  if (!weekParam) return res.status(400).json({ message: "week query param required (YYYY-MM-DD)" });

  const date = new Date(weekParam + "T00:00:00");
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const weekStart = monday.toISOString().split("T")[0];
  const weekEnd = sunday.toISOString().split("T")[0];

  const entries = await db
    .select({
      id: capacityEntries.id,
      teamMemberId: capacityEntries.teamMemberId,
      projectId: capacityEntries.projectId,
      activityId: capacityEntries.activityId,
      date: capacityEntries.date,
      comment: capacityEntries.comment,
      nightShift: capacityEntries.nightShift,
      teamMemberName: teamMembers.name,
      projectNumber: projects.number,
      projectDescription: projects.description,
      activityName: activities.name,
    })
    .from(capacityEntries)
    .leftJoin(teamMembers, eq(capacityEntries.teamMemberId, teamMembers.id))
    .leftJoin(projects, eq(capacityEntries.projectId, projects.id))
    .leftJoin(activities, eq(capacityEntries.activityId, activities.id))
    .where(
      and(
        gte(capacityEntries.date, weekStart),
        lte(capacityEntries.date, weekEnd),
      )
    );

  const members = await db.select().from(teamMembers)
    .where(eq(teamMembers.active, true))
    .orderBy(teamMembers.name);

  res.json({ weekStart, weekEnd, entries, teamMembers: members });
});

// POST /api/capacity
router.post("/", async (req: Request, res: Response) => {
  const { teamMemberId, projectId, activityId, date, comment, nightShift } = req.body;
  if (!teamMemberId || !date) {
    return res.status(400).json({ message: "teamMemberId and date are required" });
  }

  const result = await db.insert(capacityEntries).values({
    teamMemberId,
    projectId: projectId || null,
    activityId: activityId || null,
    date,
    comment: comment || null,
    nightShift: nightShift || false,
  }).returning();

  const entry = result[0];
  const names = await resolveNames(entry.projectId, entry.activityId);
  const memberRow = await db.select({ name: teamMembers.name }).from(teamMembers).where(eq(teamMembers.id, teamMemberId)).limit(1);
  const memberName = memberRow[0]?.name || `#${teamMemberId}`;

  await logChange({
    entryId: entry.id,
    teamMemberId,
    date,
    action: "create",
    summary: `Created entry for ${memberName} on ${date}${names.projectNumber ? ` — ${names.projectNumber}` : ""}${names.activityName ? ` / ${names.activityName}` : ""}`,
  });

  res.status(201).json(entry);
});

// PUT /api/capacity/bulk
router.put("/bulk", async (req: Request, res: Response) => {
  const { entries } = req.body;
  if (!Array.isArray(entries)) {
    return res.status(400).json({ message: "entries array is required" });
  }

  // Pre-fetch member names for changelog
  const memberIds = [...new Set(entries.map((e: any) => e.teamMemberId).filter(Boolean))];
  const memberNames = new Map<number, string>();
  if (memberIds.length) {
    const members = await db.select({ id: teamMembers.id, name: teamMembers.name }).from(teamMembers);
    for (const m of members) memberNames.set(m.id, m.name);
  }

  const results = [];
  for (const entry of entries) {
    if (entry.id) {
      // Fetch old values for diff
      const oldRows = await db.select().from(capacityEntries).where(eq(capacityEntries.id, entry.id)).limit(1);
      const old = oldRows[0];

      // Update existing
      const updated = await db.update(capacityEntries)
        .set({
          projectId: entry.projectId || null,
          activityId: entry.activityId || null,
          comment: entry.comment || null,
          nightShift: entry.nightShift ?? false,
          updatedAt: sql`datetime('now')`,
        })
        .where(eq(capacityEntries.id, entry.id))
        .returning();

      if (updated.length) {
        results.push(updated[0]);

        // Log field-level diffs
        if (old) {
          const memberName = memberNames.get(old.teamMemberId) || `#${old.teamMemberId}`;
          const changes: string[] = [];

          if ((entry.projectId || null) !== old.projectId) {
            const oldNames = await resolveNames(old.projectId, null);
            const newNames = await resolveNames(entry.projectId || null, null);
            changes.push(`project: ${oldNames.projectNumber || "—"} → ${newNames.projectNumber || "—"}`);
            await logChange({
              entryId: entry.id,
              teamMemberId: old.teamMemberId,
              date: old.date,
              action: "update",
              field: "project",
              oldValue: oldNames.projectNumber,
              newValue: newNames.projectNumber,
              summary: `${memberName} ${old.date} — project: ${oldNames.projectNumber || "—"} → ${newNames.projectNumber || "—"}`,
            });
          }

          if ((entry.activityId || null) !== old.activityId) {
            const oldNames = await resolveNames(null, old.activityId);
            const newNames = await resolveNames(null, entry.activityId || null);
            changes.push(`activity: ${oldNames.activityName || "—"} → ${newNames.activityName || "—"}`);
            await logChange({
              entryId: entry.id,
              teamMemberId: old.teamMemberId,
              date: old.date,
              action: "update",
              field: "activity",
              oldValue: oldNames.activityName,
              newValue: newNames.activityName,
              summary: `${memberName} ${old.date} — activity: ${oldNames.activityName || "—"} → ${newNames.activityName || "—"}`,
            });
          }

          if ((entry.comment || null) !== old.comment) {
            await logChange({
              entryId: entry.id,
              teamMemberId: old.teamMemberId,
              date: old.date,
              action: "update",
              field: "comment",
              oldValue: old.comment,
              newValue: entry.comment || null,
              summary: `${memberName} ${old.date} — comment: "${old.comment || ""}" → "${entry.comment || ""}"`,
            });
          }

          const oldNight = !!old.nightShift;
          const newNight = !!(entry.nightShift ?? false);
          if (newNight !== oldNight) {
            await logChange({
              entryId: entry.id,
              teamMemberId: old.teamMemberId,
              date: old.date,
              action: "update",
              field: "nightShift",
              oldValue: oldNight ? "yes" : "no",
              newValue: newNight ? "yes" : "no",
              summary: `${memberName} ${old.date} — night shift: ${oldNight ? "yes" : "no"} → ${newNight ? "yes" : "no"}`,
            });
          }
        }
      }
    } else if (entry.teamMemberId && entry.date) {
      // Insert new
      const inserted = await db.insert(capacityEntries).values({
        teamMemberId: entry.teamMemberId,
        projectId: entry.projectId || null,
        activityId: entry.activityId || null,
        date: entry.date,
        comment: entry.comment || null,
        nightShift: entry.nightShift ?? false,
      }).returning();

      const newEntry = inserted[0];
      results.push(newEntry);

      const memberName = memberNames.get(entry.teamMemberId) || `#${entry.teamMemberId}`;
      const names = await resolveNames(entry.projectId || null, entry.activityId || null);

      await logChange({
        entryId: newEntry.id,
        teamMemberId: entry.teamMemberId,
        date: entry.date,
        action: "create",
        summary: `Created ${memberName} on ${entry.date}${names.projectNumber ? ` — ${names.projectNumber}` : ""}${names.activityName ? ` / ${names.activityName}` : ""}`,
      });
    }
  }

  res.json({ saved: results.length, entries: results });
});

// PUT /api/capacity/:id
router.put("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { projectId, activityId, comment, nightShift } = req.body;

  const oldRows = await db.select().from(capacityEntries).where(eq(capacityEntries.id, id)).limit(1);
  if (!oldRows.length) return res.status(404).json({ message: "Not found" });
  const old = oldRows[0];

  const result = await db.update(capacityEntries)
    .set({
      ...(projectId !== undefined && { projectId }),
      ...(activityId !== undefined && { activityId }),
      ...(comment !== undefined && { comment }),
      ...(nightShift !== undefined && { nightShift }),
      updatedAt: sql`datetime('now')`,
    })
    .where(eq(capacityEntries.id, id))
    .returning();

  if (!result.length) return res.status(404).json({ message: "Not found" });

  const memberRow = await db.select({ name: teamMembers.name }).from(teamMembers).where(eq(teamMembers.id, old.teamMemberId)).limit(1);
  const memberName = memberRow[0]?.name || `#${old.teamMemberId}`;

  if (projectId !== undefined && projectId !== old.projectId) {
    const oldNames = await resolveNames(old.projectId, null);
    const newNames = await resolveNames(projectId, null);
    await logChange({
      entryId: id, teamMemberId: old.teamMemberId, date: old.date, action: "update",
      field: "project", oldValue: oldNames.projectNumber, newValue: newNames.projectNumber,
      summary: `${memberName} ${old.date} — project: ${oldNames.projectNumber || "—"} → ${newNames.projectNumber || "—"}`,
    });
  }
  if (activityId !== undefined && activityId !== old.activityId) {
    const oldNames = await resolveNames(null, old.activityId);
    const newNames = await resolveNames(null, activityId);
    await logChange({
      entryId: id, teamMemberId: old.teamMemberId, date: old.date, action: "update",
      field: "activity", oldValue: oldNames.activityName, newValue: newNames.activityName,
      summary: `${memberName} ${old.date} — activity: ${oldNames.activityName || "—"} → ${newNames.activityName || "—"}`,
    });
  }
  if (comment !== undefined && comment !== old.comment) {
    await logChange({
      entryId: id, teamMemberId: old.teamMemberId, date: old.date, action: "update",
      field: "comment", oldValue: old.comment, newValue: comment,
      summary: `${memberName} ${old.date} — comment: "${old.comment || ""}" → "${comment || ""}"`,
    });
  }

  res.json(result[0]);
});

// DELETE /api/capacity/:id
router.delete("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  const oldRows = await db.select().from(capacityEntries).where(eq(capacityEntries.id, id)).limit(1);
  if (oldRows.length) {
    const old = oldRows[0];
    const memberRow = await db.select({ name: teamMembers.name }).from(teamMembers).where(eq(teamMembers.id, old.teamMemberId)).limit(1);
    const memberName = memberRow[0]?.name || `#${old.teamMemberId}`;
    const names = await resolveNames(old.projectId, old.activityId);

    await logChange({
      entryId: id, teamMemberId: old.teamMemberId, date: old.date, action: "delete",
      summary: `Deleted ${memberName} on ${old.date}${names.projectNumber ? ` — ${names.projectNumber}` : ""}`,
    });
  }

  await db.delete(capacityEntries).where(eq(capacityEntries.id, id));
  res.json({ success: true });
});

// ── Changelog endpoint ───────────────────────────────────────
// GET /api/capacity/changelog?limit=50&offset=0
router.get("/changelog", async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;

  const logs = await db
    .select()
    .from(capacityChangelog)
    .orderBy(desc(capacityChangelog.createdAt))
    .limit(limit)
    .offset(offset);

  const total = await db
    .select({ count: sql<number>`count(*)` })
    .from(capacityChangelog);

  res.json({ logs, total: total[0].count, limit, offset });
});

export default router;
