import { Router, type Request, type Response } from "express";
import { db } from "../db";
import {
  inventoryLevels,
  stockTransactions,
  parts,
  storageLocations,
  projects,
  teamMembers,
} from "@shared/schema";
import { eq, and, lte, gte, sql, desc } from "drizzle-orm";

const router = Router();

// GET /api/inventory — all inventory levels with part + location info
router.get("/", async (_req: Request, res: Response) => {
  const rows = await db
    .select({
      id: inventoryLevels.id,
      partId: inventoryLevels.partId,
      partNumber: parts.partNumber,
      partName: parts.name,
      category: parts.category,
      unitOfMeasure: parts.unitOfMeasure,
      locationId: inventoryLevels.locationId,
      warehouse: storageLocations.warehouse,
      shelf: storageLocations.shelf,
      bin: storageLocations.bin,
      locationLabel: storageLocations.label,
      qtyOnHand: inventoryLevels.qtyOnHand,
      reorderPoint: inventoryLevels.reorderPoint,
      reorderQty: inventoryLevels.reorderQty,
    })
    .from(inventoryLevels)
    .innerJoin(parts, eq(inventoryLevels.partId, parts.id))
    .innerJoin(storageLocations, eq(inventoryLevels.locationId, storageLocations.id))
    .where(eq(parts.active, true))
    .orderBy(parts.partNumber);

  res.json(rows);
});

// GET /api/inventory/low-stock
router.get("/low-stock", async (_req: Request, res: Response) => {
  const rows = await db
    .select({
      id: inventoryLevels.id,
      partId: inventoryLevels.partId,
      partNumber: parts.partNumber,
      partName: parts.name,
      preferredVendor: parts.preferredVendor,
      locationId: inventoryLevels.locationId,
      locationLabel: storageLocations.label,
      qtyOnHand: inventoryLevels.qtyOnHand,
      reorderPoint: inventoryLevels.reorderPoint,
      reorderQty: inventoryLevels.reorderQty,
    })
    .from(inventoryLevels)
    .innerJoin(parts, eq(inventoryLevels.partId, parts.id))
    .innerJoin(storageLocations, eq(inventoryLevels.locationId, storageLocations.id))
    .where(
      and(
        eq(parts.active, true),
        sql`${inventoryLevels.reorderPoint} IS NOT NULL`,
        sql`${inventoryLevels.qtyOnHand} <= ${inventoryLevels.reorderPoint}`,
      )
    )
    .orderBy(parts.partNumber);

  res.json(rows);
});

// GET /api/inventory/transactions
router.get("/transactions", async (req: Request, res: Response) => {
  const partId = req.query.partId ? Number(req.query.partId) : null;
  const type = req.query.type ? String(req.query.type) : null;
  const from = req.query.from ? String(req.query.from) : null;
  const to = req.query.to ? String(req.query.to) : null;
  const limit = req.query.limit ? Number(req.query.limit) : 100;

  const conditions: any[] = [];
  if (partId) conditions.push(eq(stockTransactions.partId, partId));
  if (type) conditions.push(eq(stockTransactions.type, type as any));
  if (from) conditions.push(gte(stockTransactions.createdAt, from));
  if (to) conditions.push(lte(stockTransactions.createdAt, to));

  const rows = await db
    .select({
      id: stockTransactions.id,
      partId: stockTransactions.partId,
      partNumber: parts.partNumber,
      partName: parts.name,
      locationId: stockTransactions.locationId,
      locationLabel: storageLocations.label,
      type: stockTransactions.type,
      qty: stockTransactions.qty,
      reason: stockTransactions.reason,
      projectId: stockTransactions.projectId,
      projectNumber: projects.number,
      performedBy: stockTransactions.performedBy,
      performedByName: teamMembers.name,
      notes: stockTransactions.notes,
      qtyAfter: stockTransactions.qtyAfter,
      createdAt: stockTransactions.createdAt,
    })
    .from(stockTransactions)
    .innerJoin(parts, eq(stockTransactions.partId, parts.id))
    .innerJoin(storageLocations, eq(stockTransactions.locationId, storageLocations.id))
    .leftJoin(projects, eq(stockTransactions.projectId, projects.id))
    .leftJoin(teamMembers, eq(stockTransactions.performedBy, teamMembers.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(stockTransactions.createdAt))
    .limit(limit);

  res.json(rows);
});

// GET /api/inventory/project-costs/:projectId
router.get("/project-costs/:projectId", async (req: Request, res: Response) => {
  const projectId = Number(req.params.projectId);

  const rows = await db
    .select({
      partId: stockTransactions.partId,
      partNumber: parts.partNumber,
      partName: parts.name,
      unitCost: parts.cost,
      totalQty: sql<number>`SUM(${stockTransactions.qty})`,
      transactionCount: sql<number>`COUNT(*)`,
    })
    .from(stockTransactions)
    .innerJoin(parts, eq(stockTransactions.partId, parts.id))
    .where(eq(stockTransactions.projectId, projectId))
    .groupBy(stockTransactions.partId)
    .orderBy(parts.partNumber);

  res.json(rows);
});

// POST /api/inventory/book-in
router.post("/book-in", async (req: Request, res: Response) => {
  const { partId, locationId, qty, reason, projectId, performedBy, notes } = req.body;
  if (!partId || !locationId || !qty || qty <= 0) {
    return res.status(400).json({ message: "partId, locationId, and positive qty required" });
  }

  try {
    // Check existing level
    const existing = await db
      .select()
      .from(inventoryLevels)
      .where(and(eq(inventoryLevels.partId, partId), eq(inventoryLevels.locationId, locationId)));

    let newQty: number;
    if (existing.length > 0) {
      newQty = existing[0].qtyOnHand + qty;
      await db
        .update(inventoryLevels)
        .set({ qtyOnHand: newQty, updatedAt: sql`datetime('now')` })
        .where(eq(inventoryLevels.id, existing[0].id));
    } else {
      newQty = qty;
      await db.insert(inventoryLevels).values({
        partId,
        locationId,
        qtyOnHand: newQty,
      });
    }

    // Log transaction
    const txn = await db.insert(stockTransactions).values({
      partId,
      locationId,
      type: "book_in",
      qty: qty,
      reason: reason || "received from vendor",
      projectId: projectId || null,
      performedBy: performedBy || null,
      notes: notes || null,
      qtyAfter: newQty,
    }).returning();

    res.status(201).json({ transaction: txn[0], qtyAfter: newQty });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/inventory/book-out
router.post("/book-out", async (req: Request, res: Response) => {
  const { partId, locationId, qty, reason, projectId, performedBy, notes, shelfQtyRemaining } = req.body;
  if (!partId || !locationId || !qty || qty <= 0) {
    return res.status(400).json({ message: "partId, locationId, and positive qty required" });
  }

  try {
    const existing = await db
      .select()
      .from(inventoryLevels)
      .where(and(eq(inventoryLevels.partId, partId), eq(inventoryLevels.locationId, locationId)));

    if (!existing.length || existing[0].qtyOnHand < qty) {
      return res.status(400).json({
        message: `Insufficient stock. Available: ${existing.length ? existing[0].qtyOnHand : 0}`,
      });
    }

    let newQty = existing[0].qtyOnHand - qty;
    const discrepancy = shelfQtyRemaining != null ? newQty !== shelfQtyRemaining : false;

    // Log book-out
    await db.insert(stockTransactions).values({
      partId,
      locationId,
      type: "book_out",
      qty: -qty,
      reason: reason || "project use",
      projectId: projectId || null,
      performedBy: performedBy || null,
      notes: notes || null,
      qtyAfter: newQty,
    });

    // If shelf count differs, create adjustment
    if (shelfQtyRemaining != null && discrepancy) {
      const adjustment = shelfQtyRemaining - newQty;
      newQty = shelfQtyRemaining;
      await db.insert(stockTransactions).values({
        partId,
        locationId,
        type: "adjustment",
        qty: adjustment,
        reason: "cycle count correction (book-out discrepancy)",
        performedBy: performedBy || null,
        notes: `System expected ${existing[0].qtyOnHand - qty}, shelf count was ${shelfQtyRemaining}`,
        qtyAfter: newQty,
      });
    }

    // Update level
    await db
      .update(inventoryLevels)
      .set({ qtyOnHand: newQty, updatedAt: sql`datetime('now')` })
      .where(eq(inventoryLevels.id, existing[0].id));

    const lowStock =
      existing[0].reorderPoint != null && newQty <= existing[0].reorderPoint;

    res.status(201).json({
      qtyAfter: newQty,
      discrepancy,
      lowStock,
      reorderPoint: existing[0].reorderPoint,
      reorderQty: existing[0].reorderQty,
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/inventory/adjust
router.post("/adjust", async (req: Request, res: Response) => {
  const { partId, locationId, newQty, reason, performedBy, notes } = req.body;
  if (!partId || !locationId || newQty == null || newQty < 0) {
    return res.status(400).json({ message: "partId, locationId, and non-negative newQty required" });
  }

  try {
    const existing = await db
      .select()
      .from(inventoryLevels)
      .where(and(eq(inventoryLevels.partId, partId), eq(inventoryLevels.locationId, locationId)));

    const oldQty = existing.length > 0 ? existing[0].qtyOnHand : 0;
    const delta = newQty - oldQty;

    if (existing.length > 0) {
      await db
        .update(inventoryLevels)
        .set({ qtyOnHand: newQty, updatedAt: sql`datetime('now')` })
        .where(eq(inventoryLevels.id, existing[0].id));
    } else {
      await db.insert(inventoryLevels).values({
        partId,
        locationId,
        qtyOnHand: newQty,
      });
    }

    const txn = await db.insert(stockTransactions).values({
      partId,
      locationId,
      type: "adjustment",
      qty: delta,
      reason: reason || "cycle count",
      performedBy: performedBy || null,
      notes: notes || `Adjusted from ${oldQty} to ${newQty}`,
      qtyAfter: newQty,
    }).returning();

    res.status(201).json({ transaction: txn[0], oldQty, qtyAfter: newQty });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
