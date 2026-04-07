import { Router, type Request, type Response } from "express";
import { db } from "../db";
import { projects } from "@shared/schema";
import { eq, and, or, like, sql } from "drizzle-orm";

const router = Router();

// GET /api/projects
router.get("/", async (_req: Request, res: Response) => {
  const all = await db.select().from(projects).orderBy(projects.number);
  res.json(all);
});

// GET /api/projects/search?q=term&active=true|false
router.get("/search", async (req: Request, res: Response) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json([]);

  const activeOnly = req.query.active !== "false"; // default: only active
  const pattern = `%${q}%`;

  const searchCondition = or(
    like(projects.number, pattern),
    like(projects.customer, pattern),
    like(projects.description, pattern),
  );

  const results = await db.select().from(projects)
    .where(activeOnly ? and(searchCondition, eq(projects.active, true)) : searchCondition)
    .limit(20);

  res.json(results);
});

// GET /api/projects/:id
router.get("/:id", async (req: Request, res: Response) => {
  const project = await db.select().from(projects).where(eq(projects.id, Number(req.params.id)));
  if (!project.length) return res.status(404).json({ message: "Not found" });
  res.json(project[0]);
});

// POST /api/projects
router.post("/", async (req: Request, res: Response) => {
  const {
    number, customer, description, poNumber, contact, rep,
    balance, estimateTotal, jobStatus, jobType, customerType,
    endLocationState, startDate, projectedEnd, endDate,
    source, active,
  } = req.body;
  if (!number) return res.status(400).json({ message: "Project number is required" });

  const result = await db.insert(projects).values({
    number,
    customer: customer || null,
    description: description || null,
    poNumber: poNumber || null,
    contact: contact || null,
    rep: rep || null,
    balance: balance ?? null,
    estimateTotal: estimateTotal ?? null,
    jobStatus: jobStatus || null,
    jobType: jobType || null,
    customerType: customerType || null,
    endLocationState: endLocationState || null,
    startDate: startDate || null,
    projectedEnd: projectedEnd || null,
    endDate: endDate || null,
    source: source || "manual",
    active: active !== undefined ? active : true,
  }).returning();

  res.status(201).json(result[0]);
});

// PUT /api/projects/:id
router.put("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const {
    number, customer, description, poNumber, contact, rep,
    balance, estimateTotal, jobStatus, jobType, customerType,
    endLocationState, startDate, projectedEnd, endDate,
    source, active,
  } = req.body;

  const result = await db.update(projects)
    .set({
      ...(number !== undefined && { number }),
      ...(customer !== undefined && { customer }),
      ...(description !== undefined && { description }),
      ...(poNumber !== undefined && { poNumber }),
      ...(contact !== undefined && { contact }),
      ...(rep !== undefined && { rep }),
      ...(balance !== undefined && { balance }),
      ...(estimateTotal !== undefined && { estimateTotal }),
      ...(jobStatus !== undefined && { jobStatus }),
      ...(jobType !== undefined && { jobType }),
      ...(customerType !== undefined && { customerType }),
      ...(endLocationState !== undefined && { endLocationState }),
      ...(startDate !== undefined && { startDate }),
      ...(projectedEnd !== undefined && { projectedEnd }),
      ...(endDate !== undefined && { endDate }),
      ...(source !== undefined && { source }),
      ...(active !== undefined && { active }),
      updatedAt: sql`datetime('now')`,
    })
    .where(eq(projects.id, id))
    .returning();

  if (!result.length) return res.status(404).json({ message: "Not found" });
  res.json(result[0]);
});

export default router;
