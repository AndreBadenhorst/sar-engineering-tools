import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ── Team Members ──────────────────────────────────────────────
export const teamMembers = sqliteTable("team_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email"),
  role: text("role"),
  department: text("department"),
  source: text("source", { enum: ["manual", "exchange"] }).notNull().default("manual"),
  isExternal: integer("is_external", { mode: "boolean" }).notNull().default(false),
  company: text("company"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ── Projects (mirrors QB Job structure) ──────────────────────
export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  number: text("number").notNull(),
  customer: text("customer"),
  description: text("description"),        // QB "Job Description"
  poNumber: text("po_number"),
  contact: text("contact"),
  rep: text("rep"),                         // QB "Rep"
  // ── QB financial fields ──────────────────
  balance: integer("balance"),              // cents — outstanding balance
  estimateTotal: integer("estimate_total"), // cents — total estimate/contract value
  // ── QB job metadata ──────────────────────
  jobStatus: text("job_status", { enum: ["In progress", "Finished", "Cancelled"] }),
  jobType: text("job_type"),               // "Open", "Closed"
  customerType: text("customer_type"),     // e.g. "SC:2024", "FT:2025"
  endLocationState: text("end_location_state"),
  startDate: text("start_date"),           // YYYY-MM-DD
  projectedEnd: text("projected_end"),     // YYYY-MM-DD
  endDate: text("end_date"),               // YYYY-MM-DD
  // ── system fields ────────────────────────
  source: text("source", { enum: ["qb_sync", "manual"] }).notNull().default("manual"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ── Activities ────────────────────────────────────────────────
export const activities = sqliteTable("activities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ── Capacity Entries ──────────────────────────────────────────
export const capacityEntries = sqliteTable("capacity_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamMemberId: integer("team_member_id").notNull().references(() => teamMembers.id, { onDelete: "cascade" }),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  activityId: integer("activity_id").references(() => activities.id, { onDelete: "set null" }),
  date: text("date").notNull(), // YYYY-MM-DD
  comment: text("comment"),
  nightShift: integer("night_shift", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ── Capacity Changelog (audit trail) ─────────────────────────
export const capacityChangelog = sqliteTable("capacity_changelog", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  entryId: integer("entry_id"),                   // capacity_entries.id (null if deleted)
  teamMemberId: integer("team_member_id"),
  date: text("date"),                              // the capacity date affected
  action: text("action", { enum: ["create", "update", "delete"] }).notNull(),
  field: text("field"),                            // which field changed (null for create/delete)
  oldValue: text("old_value"),
  newValue: text("new_value"),
  summary: text("summary"),                        // human-readable "Changed project from X to Y"
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ══════════════════════════════════════════════════════════════
// INVENTORY MODULE
// ══════════════════════════════════════════════════════════════

// ── Parts (maps to QB Non-Inventory Part) ─────────────────────
export const parts = sqliteTable("parts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  partNumber: text("part_number").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),                // e.g. "Electrical", "Mechanical", "Fastener"
  unitOfMeasure: text("unit_of_measure"),     // "EA", "FT", "BOX", etc.
  preferredVendor: text("preferred_vendor"),
  manufacturer: text("manufacturer"),
  manufacturerPartNumber: text("manufacturer_part_number"),
  cost: integer("cost"),                      // cost in cents (avoid float issues)
  source: text("source", { enum: ["manual", "qb_sync"] }).notNull().default("manual"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  searchKeywords: text("search_keywords"),    // denormalized blob for fuzzy search
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ── Storage Locations (warehouse / shelf / bin) ───────────────
export const storageLocations = sqliteTable("storage_locations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  warehouse: text("warehouse").notNull(),     // e.g. "Main", "SAR-DE"
  shelf: text("shelf"),                       // e.g. "A1", "B3"
  bin: text("bin"),                           // e.g. "01", "12"
  label: text("label"),                       // display alias
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

// ── Inventory Levels (qty per part per location) ──────────────
export const inventoryLevels = sqliteTable("inventory_levels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  partId: integer("part_id").notNull().references(() => parts.id, { onDelete: "cascade" }),
  locationId: integer("location_id").notNull().references(() => storageLocations.id, { onDelete: "cascade" }),
  qtyOnHand: integer("qty_on_hand").notNull().default(0),
  reorderPoint: integer("reorder_point"),
  reorderQty: integer("reorder_qty"),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [
  uniqueIndex("inventory_levels_part_location").on(table.partId, table.locationId),
]);

// ── Stock Transactions (immutable audit log) ──────────────────
// Every book-in/out ties to a project for cost tracking
export const stockTransactions = sqliteTable("stock_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  partId: integer("part_id").notNull().references(() => parts.id, { onDelete: "cascade" }),
  locationId: integer("location_id").notNull().references(() => storageLocations.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["book_in", "book_out", "adjustment"] }).notNull(),
  qty: integer("qty").notNull(),              // positive = in, negative = out
  reason: text("reason"),                     // "project use", "received from vendor", "cycle count"
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  performedBy: integer("performed_by").references(() => teamMembers.id, { onDelete: "set null" }),
  notes: text("notes"),
  qtyAfter: integer("qty_after"),             // snapshot of stock after this transaction
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ══════════════════════════════════════════════════════════════
// FUTURE: SHOPPING CART / PURCHASE ORDERS
// Schema only — routes + UI built later
// ══════════════════════════════════════════════════════════════

// ── Purchase Orders ───────────────────────────────────────────
export const purchaseOrders = sqliteTable("purchase_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  poNumber: text("po_number"),
  vendor: text("vendor"),
  status: text("status", { enum: ["draft", "submitted", "partial", "received", "cancelled"] }).notNull().default("draft"),
  requestedBy: integer("requested_by").references(() => teamMembers.id, { onDelete: "set null" }),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  notes: text("notes"),
  totalCost: integer("total_cost"),           // cents — sum of line costs
  submittedAt: text("submitted_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ── Purchase Order Lines ──────────────────────────────────────
export const purchaseOrderLines = sqliteTable("purchase_order_lines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  purchaseOrderId: integer("purchase_order_id").notNull().references(() => purchaseOrders.id, { onDelete: "cascade" }),
  partId: integer("part_id").notNull().references(() => parts.id, { onDelete: "cascade" }),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  qtyOrdered: integer("qty_ordered").notNull(),
  qtyReceived: integer("qty_received").notNull().default(0),
  unitCost: integer("unit_cost"),             // cents
  notes: text("notes"),
});
