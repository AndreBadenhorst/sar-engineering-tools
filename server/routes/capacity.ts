import { Router, type Request, type Response } from "express";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "../db";
import {
  activities,
  capacityChangelog,
  capacityEntries,
  locations,
  projects,
  teamMembers,
} from "@shared/schema";
import {
  capacityBulkSchema,
  capacityCreateSchema,
  capacityUpdateSchema,
  formatZodError,
  positiveIdParamSchema,
} from "../validation";

const router = Router();

type DbClient = Pick<typeof db, "select" | "insert" | "update" | "delete">;

function sendValidationError(res: Response, details: string[]) {
  return res.status(400).json({
    message: "Invalid request",
    details,
  });
}

function getMemberNames(client: DbClient, memberIds: number[]) {
  const uniqueIds = [...new Set(memberIds)];
  if (!uniqueIds.length) return new Map<number, string>();

  const rows = client
    .select({ id: teamMembers.id, name: teamMembers.name })
    .from(teamMembers)
    .where(inArray(teamMembers.id, uniqueIds))
    .all();

  return new Map(rows.map((row) => [row.id, row.name]));
}

function createNameResolver(client: DbClient) {
  const projectCache = new Map<number, string | null>();
  const activityCache = new Map<number, string | null>();
  const locationCache = new Map<number, string | null>();

  function getProjectNumber(projectId: number | null | undefined) {
    if (!projectId) return null;
    if (projectCache.has(projectId)) return projectCache.get(projectId) ?? null;

    const row = client
      .select({ number: projects.number })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1)
      .get();

    const projectNumber = row?.number ?? null;
    projectCache.set(projectId, projectNumber);
    return projectNumber;
  }

  function getActivityName(activityId: number | null | undefined) {
    if (!activityId) return null;
    if (activityCache.has(activityId)) return activityCache.get(activityId) ?? null;

    const row = client
      .select({ name: activities.name })
      .from(activities)
      .where(eq(activities.id, activityId))
      .limit(1)
      .get();

    const activityName = row?.name ?? null;
    activityCache.set(activityId, activityName);
    return activityName;
  }

  function getLocationName(locationId: number | null | undefined) {
    if (!locationId) return null;
    if (locationCache.has(locationId)) return locationCache.get(locationId) ?? null;

    const row = client
      .select({ name: locations.name })
      .from(locations)
      .where(eq(locations.id, locationId))
      .limit(1)
      .get();

    const locationName = row?.name ?? null;
    locationCache.set(locationId, locationName);
    return locationName;
  }

  return {
    resolve(projectId: number | null | undefined, activityId: number | null | undefined, locationId?: number | null) {
      return {
        projectNumber: getProjectNumber(projectId),
        activityName: getActivityName(activityId),
        locationName: getLocationName(locationId),
      };
    },
  };
}

function logChange(
  client: DbClient,
  params: {
    entryId: number | null;
    teamMemberId: number | null;
    date: string | null;
    action: "create" | "update" | "delete";
    field?: string;
    oldValue?: string | null;
    newValue?: string | null;
    summary: string;
  },
) {
  client.insert(capacityChangelog).values({
    entryId: params.entryId,
    teamMemberId: params.teamMemberId,
    date: params.date,
    action: params.action,
    field: params.field ?? null,
    oldValue: params.oldValue ?? null,
    newValue: params.newValue ?? null,
    summary: params.summary,
  });
}

function createSummary(
  memberName: string,
  date: string,
  names: { projectNumber: string | null; activityName: string | null; locationName: string | null },
) {
  return `Created entry for ${memberName} on ${date}${names.projectNumber ? ` - ${names.projectNumber}` : ""}${names.activityName ? ` / ${names.activityName}` : ""}${names.locationName ? ` @ ${names.locationName}` : ""}`;
}

function createDeleteSummary(
  memberName: string,
  date: string,
  projectNumber: string | null,
) {
  return `Deleted ${memberName} on ${date}${projectNumber ? ` - ${projectNumber}` : ""}`;
}

function logEntryDiffs(
  client: DbClient,
  resolver: ReturnType<typeof createNameResolver>,
  memberName: string,
  previous: {
    id: number;
    teamMemberId: number;
    projectId: number | null;
    activityId: number | null;
    locationId: number | null;
    comment: string | null;
    nightShift: boolean;
    date: string;
  },
  next: {
    id: number;
    projectId: number | null;
    activityId: number | null;
    locationId: number | null;
    comment: string | null;
    nightShift: boolean;
  },
) {
  if (previous.projectId !== next.projectId) {
    const oldNames = resolver.resolve(previous.projectId, null, null);
    const newNames = resolver.resolve(next.projectId, null, null);
    logChange(client, {
      entryId: next.id,
      teamMemberId: previous.teamMemberId,
      date: previous.date,
      action: "update",
      field: "project",
      oldValue: oldNames.projectNumber,
      newValue: newNames.projectNumber,
      summary: `${memberName} ${previous.date} - project: ${oldNames.projectNumber || "-"} -> ${newNames.projectNumber || "-"}`,
    });
  }

  if (previous.activityId !== next.activityId) {
    const oldNames = resolver.resolve(null, previous.activityId, null);
    const newNames = resolver.resolve(null, next.activityId, null);
    logChange(client, {
      entryId: next.id,
      teamMemberId: previous.teamMemberId,
      date: previous.date,
      action: "update",
      field: "activity",
      oldValue: oldNames.activityName,
      newValue: newNames.activityName,
      summary: `${memberName} ${previous.date} - activity: ${oldNames.activityName || "-"} -> ${newNames.activityName || "-"}`,
    });
  }

  if (previous.locationId !== next.locationId) {
    const oldNames = resolver.resolve(null, null, previous.locationId);
    const newNames = resolver.resolve(null, null, next.locationId);
    logChange(client, {
      entryId: next.id,
      teamMemberId: previous.teamMemberId,
      date: previous.date,
      action: "update",
      field: "location",
      oldValue: oldNames.locationName,
      newValue: newNames.locationName,
      summary: `${memberName} ${previous.date} - location: ${oldNames.locationName || "-"} -> ${newNames.locationName || "-"}`,
    });
  }

  if (previous.comment !== next.comment) {
    logChange(client, {
      entryId: next.id,
      teamMemberId: previous.teamMemberId,
      date: previous.date,
      action: "update",
      field: "comment",
      oldValue: previous.comment,
      newValue: next.comment,
      summary: `${memberName} ${previous.date} - comment updated`,
    });
  }

  if (previous.nightShift !== next.nightShift) {
    logChange(client, {
      entryId: next.id,
      teamMemberId: previous.teamMemberId,
      date: previous.date,
      action: "update",
      field: "nightShift",
      oldValue: previous.nightShift ? "yes" : "no",
      newValue: next.nightShift ? "yes" : "no",
      summary: `${memberName} ${previous.date} - night shift: ${previous.nightShift ? "yes" : "no"} -> ${next.nightShift ? "yes" : "no"}`,
    });
  }
}

router.get("/", async (req: Request, res: Response) => {
  const weekParam = String(req.query.week || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekParam)) {
    return res.status(400).json({ message: "week query param required (YYYY-MM-DD)" });
  }

  const date = new Date(`${weekParam}T00:00:00`);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const weekStart = monday.toISOString().split("T")[0];
  const weekEnd = sunday.toISOString().split("T")[0];

  const entries = db
    .select({
      id: capacityEntries.id,
      teamMemberId: capacityEntries.teamMemberId,
      projectId: capacityEntries.projectId,
      activityId: capacityEntries.activityId,
      locationId: capacityEntries.locationId,
      date: capacityEntries.date,
      comment: capacityEntries.comment,
      nightShift: capacityEntries.nightShift,
      teamMemberName: teamMembers.name,
      projectNumber: projects.number,
      projectDescription: projects.description,
      activityName: activities.name,
      locationName: locations.name,
    })
    .from(capacityEntries)
    .leftJoin(teamMembers, eq(capacityEntries.teamMemberId, teamMembers.id))
    .leftJoin(projects, eq(capacityEntries.projectId, projects.id))
    .leftJoin(activities, eq(capacityEntries.activityId, activities.id))
    .leftJoin(locations, eq(capacityEntries.locationId, locations.id))
    .where(and(gte(capacityEntries.date, weekStart), lte(capacityEntries.date, weekEnd)));

  const members = db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.active, true))
    .orderBy(teamMembers.name);

  res.json({ weekStart, weekEnd, entries, teamMembers: members });
});

router.post("/", async (req: Request, res: Response) => {
  const parsed = capacityCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendValidationError(res, formatZodError(parsed.error));
  }

  const payload = parsed.data;
  const entry = db.transaction((tx) => {
    const inserted = tx
      .insert(capacityEntries)
      .values({
        teamMemberId: payload.teamMemberId,
        projectId: payload.projectId,
        activityId: payload.activityId,
        locationId: payload.locationId,
        date: payload.date,
        comment: payload.comment,
        nightShift: payload.nightShift,
      })
      .returning()
      .get();

    const memberNames = getMemberNames(tx, [payload.teamMemberId]);
    const resolver = createNameResolver(tx);
    const memberName = memberNames.get(payload.teamMemberId) || `#${payload.teamMemberId}`;

    logChange(tx, {
      entryId: inserted.id,
      teamMemberId: payload.teamMemberId,
      date: payload.date,
      action: "create",
      summary: createSummary(memberName, payload.date, resolver.resolve(inserted.projectId, inserted.activityId, inserted.locationId)),
    });

    return inserted;
  });

  res.status(201).json(entry);
});

router.put("/bulk", async (req: Request, res: Response) => {
  const parsed = capacityBulkSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendValidationError(res, formatZodError(parsed.error));
  }

  try {
    const result = db.transaction((tx) => {
      const resolver = createNameResolver(tx);
      const memberNames = getMemberNames(
        tx,
        parsed.data.entries.map((entry) => entry.teamMemberId),
      );
      const savedEntries: Array<{ id: number; teamMemberId: number; date: string }> = [];

      for (const entry of parsed.data.entries) {
        if (entry.id) {
          const previous = tx
            .select()
            .from(capacityEntries)
            .where(eq(capacityEntries.id, entry.id))
            .limit(1)
            .get();

          if (!previous) {
            throw new Error(`Capacity entry ${entry.id} not found`);
          }

          const updated = tx
            .update(capacityEntries)
            .set({
              projectId: entry.projectId,
              activityId: entry.activityId,
              locationId: entry.locationId,
              comment: entry.comment,
              nightShift: entry.nightShift,
              updatedAt: sql`datetime('now')`,
            })
            .where(eq(capacityEntries.id, entry.id))
            .returning()
            .get();

          const memberName = memberNames.get(previous.teamMemberId) || `#${previous.teamMemberId}`;
          logEntryDiffs(
            tx,
            resolver,
            memberName,
            {
              id: previous.id,
              teamMemberId: previous.teamMemberId,
              projectId: previous.projectId,
              activityId: previous.activityId,
              locationId: previous.locationId,
              comment: previous.comment,
              nightShift: !!previous.nightShift,
              date: previous.date,
            },
            {
              id: updated.id,
              projectId: updated.projectId,
              activityId: updated.activityId,
              locationId: updated.locationId,
              comment: updated.comment,
              nightShift: !!updated.nightShift,
            },
          );

          savedEntries.push({
            id: updated.id,
            teamMemberId: updated.teamMemberId,
            date: updated.date,
          });
          continue;
        }

        const inserted = tx
          .insert(capacityEntries)
          .values({
            teamMemberId: entry.teamMemberId,
            projectId: entry.projectId,
            activityId: entry.activityId,
            locationId: entry.locationId,
            date: entry.date,
            comment: entry.comment,
            nightShift: entry.nightShift,
          })
          .returning()
          .get();

        const memberName = memberNames.get(entry.teamMemberId) || `#${entry.teamMemberId}`;
        logChange(tx, {
          entryId: inserted.id,
          teamMemberId: entry.teamMemberId,
          date: entry.date,
          action: "create",
          summary: createSummary(memberName, entry.date, resolver.resolve(inserted.projectId, inserted.activityId, inserted.locationId)),
        });

        savedEntries.push({
          id: inserted.id,
          teamMemberId: inserted.teamMemberId,
          date: inserted.date,
        });
      }

      return {
        saved: savedEntries.length,
        entries: savedEntries,
      };
    });

    res.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return res.status(404).json({ message: error.message });
    }
    throw error;
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  const parsedId = positiveIdParamSchema.safeParse({ id: Number(req.params.id) });
  if (!parsedId.success) {
    return sendValidationError(res, formatZodError(parsedId.error));
  }

  const parsedBody = capacityUpdateSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return sendValidationError(res, formatZodError(parsedBody.error));
  }

  const id = parsedId.data.id;
  const payload = parsedBody.data;

  const updated = db.transaction((tx) => {
    const previous = tx
      .select()
      .from(capacityEntries)
      .where(eq(capacityEntries.id, id))
      .limit(1)
      .get();

    if (!previous) {
      return null;
    }

    const next = tx
      .update(capacityEntries)
      .set({
        ...(payload.projectId !== undefined && { projectId: payload.projectId }),
        ...(payload.activityId !== undefined && { activityId: payload.activityId }),
        ...(payload.locationId !== undefined && { locationId: payload.locationId }),
        ...(payload.comment !== undefined && { comment: payload.comment }),
        ...(payload.nightShift !== undefined && { nightShift: payload.nightShift }),
        updatedAt: sql`datetime('now')`,
      })
      .where(eq(capacityEntries.id, id))
      .returning()
      .get();

    const memberName =
      getMemberNames(tx, [previous.teamMemberId]).get(previous.teamMemberId) ||
      `#${previous.teamMemberId}`;
    logEntryDiffs(
      tx,
      createNameResolver(tx),
      memberName,
      {
        id: previous.id,
        teamMemberId: previous.teamMemberId,
        projectId: previous.projectId,
        activityId: previous.activityId,
        locationId: previous.locationId,
        comment: previous.comment,
        nightShift: !!previous.nightShift,
        date: previous.date,
      },
      {
        id: next.id,
        projectId: next.projectId,
        activityId: next.activityId,
        locationId: next.locationId,
        comment: next.comment,
        nightShift: !!next.nightShift,
      },
    );

    return next;
  });

  if (!updated) {
    return res.status(404).json({ message: "Not found" });
  }

  res.json(updated);
});

router.delete("/:id", async (req: Request, res: Response) => {
  const parsedId = positiveIdParamSchema.safeParse({ id: Number(req.params.id) });
  if (!parsedId.success) {
    return sendValidationError(res, formatZodError(parsedId.error));
  }

  db.transaction((tx) => {
    const existing = tx
      .select()
      .from(capacityEntries)
      .where(eq(capacityEntries.id, parsedId.data.id))
      .limit(1)
      .get();

    if (!existing) {
      return;
    }

    const memberName =
      getMemberNames(tx, [existing.teamMemberId]).get(existing.teamMemberId) ||
      `#${existing.teamMemberId}`;
    const projectNumber = createNameResolver(tx).resolve(existing.projectId, null, null).projectNumber;

    logChange(tx, {
      entryId: existing.id,
      teamMemberId: existing.teamMemberId,
      date: existing.date,
      action: "delete",
      summary: createDeleteSummary(memberName, existing.date, projectNumber),
    });

    tx.delete(capacityEntries).where(eq(capacityEntries.id, parsedId.data.id));
  });

  res.json({ success: true });
});

router.get("/changelog", async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;

  const logs = db
    .select()
    .from(capacityChangelog)
    .orderBy(desc(capacityChangelog.createdAt))
    .limit(limit)
    .offset(offset);

  const total = db
    .select({ count: sql<number>`count(*)` })
    .from(capacityChangelog)
    .get();

  res.json({ logs, total: total?.count ?? 0, limit, offset });
});

export default router;
