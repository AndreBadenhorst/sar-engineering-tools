import { Router, type Request, type Response } from "express";
import { db } from "../db";
import { locations } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

const router = Router();

// GET /api/locations — list all active locations
router.get("/", async (_req: Request, res: Response) => {
  const rows = await db.select().from(locations).orderBy(locations.name);
  res.json(rows);
});

// POST /api/locations — create a new location
router.post("/", async (req: Request, res: Response) => {
  const { name, shortCode } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: "name is required" });
  }

  try {
    const result = await db.insert(locations).values({
      name: name.trim(),
      shortCode: shortCode?.trim() || null,
    }).returning();
    res.status(201).json(result[0]);
  } catch (err: any) {
    if (err.message?.includes("UNIQUE")) {
      return res.status(409).json({ message: "Location already exists" });
    }
    throw err;
  }
});

// PUT /api/locations/:id — update a location
router.put("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { name, shortCode, active } = req.body;

  const result = await db.update(locations)
    .set({
      ...(name !== undefined && { name: name.trim() }),
      ...(shortCode !== undefined && { shortCode: shortCode?.trim() || null }),
      ...(active !== undefined && { active }),
    })
    .where(eq(locations.id, id))
    .returning();

  if (!result.length) return res.status(404).json({ message: "Not found" });
  res.json(result[0]);
});

// DELETE /api/locations/:id — delete a location (sets capacity_entries.location_id to null)
router.delete("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  // Check if location exists
  const existing = await db.select().from(locations).where(eq(locations.id, id)).limit(1);
  if (!existing.length) return res.status(404).json({ message: "Not found" });

  await db.delete(locations).where(eq(locations.id, id));
  res.json({ success: true });
});

export default router;
