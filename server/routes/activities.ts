import { Router, type Request, type Response } from "express";
import { db } from "../db";
import { activities } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

// GET /api/activities
router.get("/", async (_req: Request, res: Response) => {
  const all = await db.select().from(activities).orderBy(activities.sortOrder);
  res.json(all);
});

// POST /api/activities
router.post("/", async (req: Request, res: Response) => {
  const { name, sortOrder } = req.body;
  if (!name) return res.status(400).json({ message: "Name is required" });

  const result = await db.insert(activities).values({
    name,
    sortOrder: sortOrder ?? 0,
  }).returning();

  res.status(201).json(result[0]);
});

// PUT /api/activities/:id
router.put("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { name, sortOrder } = req.body;

  const result = await db.update(activities)
    .set({
      ...(name !== undefined && { name }),
      ...(sortOrder !== undefined && { sortOrder }),
    })
    .where(eq(activities.id, id))
    .returning();

  if (!result.length) return res.status(404).json({ message: "Not found" });
  res.json(result[0]);
});

// DELETE /api/activities/:id
router.delete("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await db.delete(activities).where(eq(activities.id, id));
  res.json({ success: true });
});

export default router;
