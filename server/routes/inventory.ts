import { Router, type Request, type Response } from "express";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../db";
import {
  inventoryLevels,
  parts,
  projects,
  stockTransactions,
  storageLocations,
  teamMembers,
} from "@shared/schema";
import {
  formatZodError,
  inventoryAdjustSchema,
  inventoryBookInSchema,
  inventoryBookOutSchema,
  inventoryTransactionsQuerySchema,
  positiveIdParamSchema,
} from "../validation";

const router = Router();

type DbClient = Pick<typeof db, "select" | "insert" | "update">;

function sendValidationError(res: Response, details: string[]) {
  return res.status(400).json({
    message: "Invalid request",
    details,
  });
}

function getInventoryLevel(client: DbClient, partId: number, locationId: number) {
  return (
    client
      .select()
      .from(inventoryLevels)
      .where(and(eq(inventoryLevels.partId, partId), eq(inventoryLevels.locationId, locationId)))
      .get() ??
    null
  );
}

router.get("/", async (_req: Request, res: Response) => {
  const rows = db
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

router.get("/low-stock", async (_req: Request, res: Response) => {
  const rows = db
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
      ),
    )
    .orderBy(parts.partNumber);

  res.json(rows);
});

router.get("/transactions", async (req: Request, res: Response) => {
  const parsed = inventoryTransactionsQuerySchema.safeParse({
    partId: req.query.partId ? Number(req.query.partId) : undefined,
    type: req.query.type || undefined,
    from: req.query.from || undefined,
    to: req.query.to || undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  if (!parsed.success) {
    return sendValidationError(res, formatZodError(parsed.error));
  }

  const { partId, type, from, to, limit } = parsed.data;
  const conditions: any[] = [];
  if (partId) conditions.push(eq(stockTransactions.partId, partId));
  if (type) conditions.push(eq(stockTransactions.type, type));
  if (from) conditions.push(gte(stockTransactions.createdAt, `${from} 00:00:00`));
  if (to) conditions.push(lte(stockTransactions.createdAt, `${to} 23:59:59`));

  const rows = db
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

router.get("/project-costs/:projectId", async (req: Request, res: Response) => {
  const parsed = positiveIdParamSchema.safeParse({ id: Number(req.params.projectId) });
  if (!parsed.success) {
    return sendValidationError(res, formatZodError(parsed.error));
  }

  const rows = db
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
    .where(eq(stockTransactions.projectId, parsed.data.id))
    .groupBy(stockTransactions.partId)
    .orderBy(parts.partNumber);

  res.json(rows);
});

router.post("/book-in", async (req: Request, res: Response) => {
  const parsed = inventoryBookInSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendValidationError(res, formatZodError(parsed.error));
  }

  const result = db.transaction((tx) => {
    const existing = getInventoryLevel(tx, parsed.data.partId, parsed.data.locationId);
    let newQty = parsed.data.qty;

    if (existing) {
      newQty = existing.qtyOnHand + parsed.data.qty;
      tx
        .update(inventoryLevels)
        .set({ qtyOnHand: newQty, updatedAt: sql`datetime('now')` })
        .where(eq(inventoryLevels.id, existing.id));
    } else {
      tx.insert(inventoryLevels).values({
        partId: parsed.data.partId,
        locationId: parsed.data.locationId,
        qtyOnHand: newQty,
      });
    }

    const transaction = tx
      .insert(stockTransactions)
      .values({
        partId: parsed.data.partId,
        locationId: parsed.data.locationId,
        type: "book_in",
        qty: parsed.data.qty,
        reason: parsed.data.reason || "received from vendor",
        projectId: parsed.data.projectId,
        performedBy: parsed.data.performedBy,
        notes: parsed.data.notes,
        qtyAfter: newQty,
      })
      .returning()
      .get();

    return { transaction, qtyAfter: newQty };
  });

  res.status(201).json(result);
});

router.post("/book-out", async (req: Request, res: Response) => {
  const parsed = inventoryBookOutSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendValidationError(res, formatZodError(parsed.error));
  }

  try {
    const result = db.transaction((tx) => {
      const existing = getInventoryLevel(tx, parsed.data.partId, parsed.data.locationId);
      if (!existing || existing.qtyOnHand < parsed.data.qty) {
        throw new Error(
          `Insufficient stock. Available: ${existing ? existing.qtyOnHand : 0}`,
        );
      }

      let newQty = existing.qtyOnHand - parsed.data.qty;
      const discrepancy =
        parsed.data.shelfQtyRemaining != null && newQty !== parsed.data.shelfQtyRemaining;

      tx.insert(stockTransactions).values({
        partId: parsed.data.partId,
        locationId: parsed.data.locationId,
        type: "book_out",
        qty: -parsed.data.qty,
        reason: parsed.data.reason || "project use",
        projectId: parsed.data.projectId,
        performedBy: parsed.data.performedBy,
        notes: parsed.data.notes,
        qtyAfter: newQty,
      });

      if (parsed.data.shelfQtyRemaining != null && discrepancy) {
        const adjustment = parsed.data.shelfQtyRemaining - newQty;
        newQty = parsed.data.shelfQtyRemaining;

        tx.insert(stockTransactions).values({
          partId: parsed.data.partId,
          locationId: parsed.data.locationId,
          type: "adjustment",
          qty: adjustment,
          reason: "cycle count correction (book-out discrepancy)",
          performedBy: parsed.data.performedBy,
          notes: `System expected ${existing.qtyOnHand - parsed.data.qty}, shelf count was ${parsed.data.shelfQtyRemaining}`,
          qtyAfter: newQty,
        });
      }

      tx
        .update(inventoryLevels)
        .set({ qtyOnHand: newQty, updatedAt: sql`datetime('now')` })
        .where(eq(inventoryLevels.id, existing.id));

      return {
        qtyAfter: newQty,
        discrepancy,
        lowStock: existing.reorderPoint != null && newQty <= existing.reorderPoint,
        reorderPoint: existing.reorderPoint,
        reorderQty: existing.reorderQty,
      };
    });

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Insufficient stock")) {
      return res.status(400).json({ message: error.message });
    }
    throw error;
  }
});

router.post("/adjust", async (req: Request, res: Response) => {
  const parsed = inventoryAdjustSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendValidationError(res, formatZodError(parsed.error));
  }

  const result = db.transaction((tx) => {
    const existing = getInventoryLevel(tx, parsed.data.partId, parsed.data.locationId);
    const oldQty = existing?.qtyOnHand ?? 0;
    const delta = parsed.data.newQty - oldQty;

    if (existing) {
      tx
        .update(inventoryLevels)
        .set({ qtyOnHand: parsed.data.newQty, updatedAt: sql`datetime('now')` })
        .where(eq(inventoryLevels.id, existing.id));
    } else {
      tx.insert(inventoryLevels).values({
        partId: parsed.data.partId,
        locationId: parsed.data.locationId,
        qtyOnHand: parsed.data.newQty,
      });
    }

    const transaction = tx
      .insert(stockTransactions)
      .values({
        partId: parsed.data.partId,
        locationId: parsed.data.locationId,
        type: "adjustment",
        qty: delta,
        reason: parsed.data.reason || "cycle count",
        performedBy: parsed.data.performedBy,
        notes: parsed.data.notes || `Adjusted from ${oldQty} to ${parsed.data.newQty}`,
        qtyAfter: parsed.data.newQty,
      })
      .returning()
      .get();

    return {
      transaction,
      oldQty,
      qtyAfter: parsed.data.newQty,
    };
  });

  res.status(201).json(result);
});

export default router;
