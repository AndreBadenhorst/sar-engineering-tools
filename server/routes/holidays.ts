import { Router, type Request, type Response } from "express";
import { db } from "../db";
import { holidays } from "@shared/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

const router = Router();

// GET /api/holidays — list all holidays, optionally filter by year or category
router.get("/", async (req: Request, res: Response) => {
  const { year, category } = req.query;

  let query = db.select().from(holidays).$dynamic();

  if (year) {
    const y = String(year);
    query = query.where(
      and(
        gte(holidays.date, `${y}-01-01`),
        lte(holidays.date, `${y}-12-31`),
      )
    );
  }

  if (category && ["us_federal", "german", "company"].includes(String(category))) {
    // Need to add category filter on top of year filter
    const rows = await db.select().from(holidays).where(
      category && year
        ? and(
            eq(holidays.category, String(category) as any),
            gte(holidays.date, `${String(year)}-01-01`),
            lte(holidays.date, `${String(year)}-12-31`),
          )
        : eq(holidays.category, String(category) as any)
    ).orderBy(holidays.date);
    return res.json(rows);
  }

  const rows = year
    ? await db.select().from(holidays).where(
        and(
          gte(holidays.date, `${String(year)}-01-01`),
          lte(holidays.date, `${String(year)}-12-31`),
        )
      ).orderBy(holidays.date)
    : await db.select().from(holidays).orderBy(holidays.date);

  res.json(rows);
});

// POST /api/holidays — create a new holiday
router.post("/", async (req: Request, res: Response) => {
  const { date, name, nameLocal, category } = req.body;
  if (!date || !name || !category) {
    return res.status(400).json({ message: "date, name, and category are required" });
  }
  if (!["us_federal", "german", "company"].includes(category)) {
    return res.status(400).json({ message: "category must be us_federal, german, or company" });
  }

  const result = await db.insert(holidays).values({
    date,
    name: name.trim(),
    nameLocal: nameLocal?.trim() || null,
    category,
  }).returning();

  res.status(201).json(result[0]);
});

// PUT /api/holidays/:id — update a holiday
router.put("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { date, name, nameLocal, category, active } = req.body;

  const result = await db.update(holidays)
    .set({
      ...(date !== undefined && { date }),
      ...(name !== undefined && { name: name.trim() }),
      ...(nameLocal !== undefined && { nameLocal: nameLocal?.trim() || null }),
      ...(category !== undefined && { category }),
      ...(active !== undefined && { active }),
    })
    .where(eq(holidays.id, id))
    .returning();

  if (!result.length) return res.status(404).json({ message: "Not found" });
  res.json(result[0]);
});

// DELETE /api/holidays/:id — delete a holiday
router.delete("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const existing = await db.select().from(holidays).where(eq(holidays.id, id)).limit(1);
  if (!existing.length) return res.status(404).json({ message: "Not found" });

  await db.delete(holidays).where(eq(holidays.id, id));
  res.json({ success: true });
});

export default router;
