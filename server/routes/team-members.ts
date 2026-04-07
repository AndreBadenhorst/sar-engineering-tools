import { Router, type Request, type Response } from "express";
import { db } from "../db";
import { teamMembers } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

const router = Router();

// GET /api/team-members
router.get("/", async (_req: Request, res: Response) => {
  const members = await db.select().from(teamMembers).orderBy(teamMembers.name);
  res.json(members);
});

// GET /api/team-members/:id
router.get("/:id", async (req: Request, res: Response) => {
  const member = await db.select().from(teamMembers).where(eq(teamMembers.id, Number(req.params.id)));
  if (!member.length) return res.status(404).json({ message: "Not found" });
  res.json(member[0]);
});

// POST /api/team-members
router.post("/", async (req: Request, res: Response) => {
  const { name, email, role, department, source, isExternal, company } = req.body;
  if (!name) return res.status(400).json({ message: "Name is required" });

  const result = await db.insert(teamMembers).values({
    name,
    email: email || null,
    role: role || null,
    department: department || null,
    source: source || "manual",
    isExternal: isExternal || false,
    company: company || null,
  }).returning();

  res.status(201).json(result[0]);
});

// PUT /api/team-members/:id
router.put("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { name, email, role, department, source, isExternal, company, active } = req.body;

  const result = await db.update(teamMembers)
    .set({
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email }),
      ...(role !== undefined && { role }),
      ...(department !== undefined && { department }),
      ...(source !== undefined && { source }),
      ...(isExternal !== undefined && { isExternal }),
      ...(company !== undefined && { company }),
      ...(active !== undefined && { active }),
      updatedAt: sql`datetime('now')`,
    })
    .where(eq(teamMembers.id, id))
    .returning();

  if (!result.length) return res.status(404).json({ message: "Not found" });
  res.json(result[0]);
});

// DELETE /api/team-members/:id (soft delete — sets active=false)
router.delete("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const result = await db.update(teamMembers)
    .set({ active: false, updatedAt: sql`datetime('now')` })
    .where(eq(teamMembers.id, id))
    .returning();

  if (!result.length) return res.status(404).json({ message: "Not found" });
  res.json(result[0]);
});

export default router;
