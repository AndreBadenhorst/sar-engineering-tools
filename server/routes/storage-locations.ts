import { Router, type Request, type Response } from "express";
import { db } from "../db";
import { storageLocations } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

// GET /api/storage-locations
router.get("/", async (_req: Request, res: Response) => {
  const all = await db.select().from(storageLocations)
    .where(eq(storageLocations.active, true))
    .orderBy(storageLocations.warehouse, storageLocations.shelf, storageLocations.bin);
  res.json(all);
});

// GET /api/storage-locations/:id
router.get("/:id", async (req: Request, res: Response) => {
  const loc = await db.select().from(storageLocations).where(eq(storageLocations.id, Number(req.params.id)));
  if (!loc.length) return res.status(404).json({ message: "Not found" });
  res.json(loc[0]);
});

// POST /api/storage-locations
router.post("/", async (req: Request, res: Response) => {
  const { warehouse, shelf, bin, label } = req.body;
  if (!warehouse) return res.status(400).json({ message: "warehouse is required" });

  const displayLabel = label || [warehouse, shelf, bin].filter(Boolean).join(" / ");
  const result = await db.insert(storageLocations).values({
    warehouse,
    shelf: shelf || null,
    bin: bin || null,
    label: displayLabel,
  }).returning();

  res.status(201).json(result[0]);
});

// PUT /api/storage-locations/:id
router.put("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { warehouse, shelf, bin, label, active } = req.body;

  const result = await db.update(storageLocations)
    .set({
      ...(warehouse !== undefined && { warehouse }),
      ...(shelf !== undefined && { shelf }),
      ...(bin !== undefined && { bin }),
      ...(label !== undefined && { label }),
      ...(active !== undefined && { active }),
    })
    .where(eq(storageLocations.id, id))
    .returning();

  if (!result.length) return res.status(404).json({ message: "Not found" });
  res.json(result[0]);
});

export default router;
