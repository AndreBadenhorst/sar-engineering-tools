import { Router, type Request, type Response } from "express";
import { db } from "../db";
import { parts, inventoryLevels, storageLocations } from "@shared/schema";
import { eq, and, or, like, sql } from "drizzle-orm";

const router = Router();

// ── Helper: build search keywords from part data ──────────────
function buildSearchKeywords(data: {
  partNumber: string;
  name: string;
  description?: string | null;
  category?: string | null;
  preferredVendor?: string | null;
  manufacturer?: string | null;
  manufacturerPartNumber?: string | null;
}): string {
  const pieces = [
    data.partNumber,
    data.partNumber.replace(/[-_.]/g, " "), // variant without separators
    data.partNumber.replace(/[-_.]/g, ""),
    data.name,
    data.description || "",
    data.category || "",
    data.preferredVendor || "",
    data.manufacturer || "",
    data.manufacturerPartNumber || "",
  ];
  return pieces
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// ── Simple Levenshtein distance ───────────────────────────────
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// GET /api/parts — list all parts
router.get("/", async (req: Request, res: Response) => {
  const activeOnly = req.query.active !== "false";
  const category = req.query.category ? String(req.query.category) : null;

  let conditions: any[] = [];
  if (activeOnly) conditions.push(eq(parts.active, true));
  if (category) conditions.push(eq(parts.category, category));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const all = await db.select().from(parts).where(where).orderBy(parts.partNumber);
  res.json(all);
});

// GET /api/parts/categories — unique category list
router.get("/categories", async (_req: Request, res: Response) => {
  const rows = await db
    .selectDistinct({ category: parts.category })
    .from(parts)
    .where(and(eq(parts.active, true), sql`${parts.category} IS NOT NULL`))
    .orderBy(parts.category);
  res.json(rows.map((r) => r.category).filter(Boolean));
});

// GET /api/parts/search?q=term — fuzzy + keyword search
router.get("/search", async (req: Request, res: Response) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({ exact: null, matches: [], suggestions: [] });

  const qLower = q.toLowerCase();

  // 1. Exact part number match
  const exact = await db
    .select()
    .from(parts)
    .where(and(eq(parts.partNumber, q), eq(parts.active, true)))
    .limit(1);

  // 2. LIKE matches on part number, name, description, keywords
  const pattern = `%${q}%`;
  const likeMatches = await db
    .select()
    .from(parts)
    .where(
      and(
        or(
          like(parts.partNumber, pattern),
          like(parts.name, pattern),
          like(parts.description, pattern),
          like(parts.searchKeywords, pattern),
        ),
        eq(parts.active, true),
      )
    )
    .limit(30);

  // 3. Levenshtein fuzzy match on part numbers (for typos)
  let suggestions: typeof likeMatches = [];
  if (likeMatches.length < 5 && q.length >= 3) {
    // Load active part numbers and compute distance
    const allParts = await db
      .select({ id: parts.id, partNumber: parts.partNumber, name: parts.name })
      .from(parts)
      .where(eq(parts.active, true));

    const scored = allParts
      .map((p) => ({
        ...p,
        dist: levenshtein(qLower, p.partNumber.toLowerCase()),
      }))
      .filter((p) => p.dist <= Math.max(3, Math.floor(q.length * 0.4)))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 10);

    if (scored.length > 0) {
      const fuzzyIds = scored.map((s) => s.id);
      const fuzzyResults = await db
        .select()
        .from(parts)
        .where(sql`${parts.id} IN (${sql.join(fuzzyIds.map((id) => sql`${id}`), sql`, `)})`);
      // Exclude already-found matches
      const matchIds = new Set(likeMatches.map((m) => m.id));
      suggestions = fuzzyResults.filter((p) => !matchIds.has(p.id));
    }
  }

  // 4. Category-based suggestions if we have matches
  if (likeMatches.length > 0 && likeMatches.length < 10) {
    const categories = Array.from(new Set(likeMatches.map((m) => m.category).filter(Boolean)));
    if (categories.length > 0) {
      const catSuggestions = await db
        .select()
        .from(parts)
        .where(
          and(
            sql`${parts.category} IN (${sql.join(categories.map((c) => sql`${c}`), sql`, `)})`,
            eq(parts.active, true),
          )
        )
        .limit(10);

      const existingIds = new Set([
        ...likeMatches.map((m) => m.id),
        ...suggestions.map((s) => s.id),
      ]);
      const catOnly = catSuggestions.filter((p) => !existingIds.has(p.id));
      suggestions = [...suggestions, ...catOnly].slice(0, 10);
    }
  }

  res.json({
    exact: exact[0] || null,
    matches: likeMatches,
    suggestions,
  });
});

// GET /api/parts/:id — single part with inventory levels
router.get("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const part = await db.select().from(parts).where(eq(parts.id, id));
  if (!part.length) return res.status(404).json({ message: "Not found" });

  const levels = await db
    .select({
      id: inventoryLevels.id,
      locationId: inventoryLevels.locationId,
      warehouse: storageLocations.warehouse,
      shelf: storageLocations.shelf,
      bin: storageLocations.bin,
      label: storageLocations.label,
      qtyOnHand: inventoryLevels.qtyOnHand,
      reorderPoint: inventoryLevels.reorderPoint,
      reorderQty: inventoryLevels.reorderQty,
    })
    .from(inventoryLevels)
    .leftJoin(storageLocations, eq(inventoryLevels.locationId, storageLocations.id))
    .where(eq(inventoryLevels.partId, id));

  res.json({ ...part[0], inventory: levels });
});

// POST /api/parts
router.post("/", async (req: Request, res: Response) => {
  const {
    partNumber, name, description, category, unitOfMeasure,
    preferredVendor, manufacturer, manufacturerPartNumber, cost, source, active,
  } = req.body;
  if (!partNumber || !name) {
    return res.status(400).json({ message: "partNumber and name are required" });
  }

  const searchKeywords = buildSearchKeywords({
    partNumber, name, description, category, preferredVendor,
    manufacturer, manufacturerPartNumber,
  });

  const result = await db.insert(parts).values({
    partNumber,
    name,
    description: description || null,
    category: category || null,
    unitOfMeasure: unitOfMeasure || null,
    preferredVendor: preferredVendor || null,
    manufacturer: manufacturer || null,
    manufacturerPartNumber: manufacturerPartNumber || null,
    cost: cost != null ? cost : null,
    source: source || "manual",
    active: active !== undefined ? active : true,
    searchKeywords,
  }).returning();

  res.status(201).json(result[0]);
});

// PUT /api/parts/:id
router.put("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const {
    partNumber, name, description, category, unitOfMeasure,
    preferredVendor, manufacturer, manufacturerPartNumber, cost, source, active,
  } = req.body;

  // Rebuild search keywords if relevant fields changed
  let searchKeywords: string | undefined;
  if (partNumber || name || description !== undefined || category !== undefined ||
      preferredVendor !== undefined || manufacturer !== undefined || manufacturerPartNumber !== undefined) {
    // Fetch current to merge
    const current = await db.select().from(parts).where(eq(parts.id, id));
    if (!current.length) return res.status(404).json({ message: "Not found" });
    const c = current[0];
    searchKeywords = buildSearchKeywords({
      partNumber: partNumber ?? c.partNumber,
      name: name ?? c.name,
      description: description !== undefined ? description : c.description,
      category: category !== undefined ? category : c.category,
      preferredVendor: preferredVendor !== undefined ? preferredVendor : c.preferredVendor,
      manufacturer: manufacturer !== undefined ? manufacturer : c.manufacturer,
      manufacturerPartNumber: manufacturerPartNumber !== undefined ? manufacturerPartNumber : c.manufacturerPartNumber,
    });
  }

  const result = await db
    .update(parts)
    .set({
      ...(partNumber !== undefined && { partNumber }),
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(category !== undefined && { category }),
      ...(unitOfMeasure !== undefined && { unitOfMeasure }),
      ...(preferredVendor !== undefined && { preferredVendor }),
      ...(manufacturer !== undefined && { manufacturer }),
      ...(manufacturerPartNumber !== undefined && { manufacturerPartNumber }),
      ...(cost !== undefined && { cost }),
      ...(source !== undefined && { source }),
      ...(active !== undefined && { active }),
      ...(searchKeywords !== undefined && { searchKeywords }),
      updatedAt: sql`datetime('now')`,
    })
    .where(eq(parts.id, id))
    .returning();

  if (!result.length) return res.status(404).json({ message: "Not found" });
  res.json(result[0]);
});

// DELETE /api/parts/:id — soft delete
router.delete("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const result = await db
    .update(parts)
    .set({ active: false, updatedAt: sql`datetime('now')` })
    .where(eq(parts.id, id))
    .returning();
  if (!result.length) return res.status(404).json({ message: "Not found" });
  res.json(result[0]);
});

export default router;
