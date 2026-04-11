import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ── Job Function enum ────────────────────────────────────────
export const JOB_FUNCTIONS = [
  "Controls Engineer",
  "Hardware Planner",
  "Technician",
  "Site Manager",
  "Project Manager",
] as const;
export type JobFunction = (typeof JOB_FUNCTIONS)[number];

// ── Team Members ──────────────────────────────────────────────
export const teamMembers = sqliteTable("team_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email"),
  role: text("role"),
  jobFunction: text("job_function"),
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
  source: text("source", { enum: ["qb_sync", "manual", "sales_list", "gmbh_gun"] }).notNull().default("manual"),
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

// ── Holidays (editable — US Federal, German, Company) ────────
export const holidays = sqliteTable("holidays", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),                  // YYYY-MM-DD
  name: text("name").notNull(),                  // English name
  nameLocal: text("name_local"),                 // Local name (e.g. German)
  category: text("category", { enum: ["us_federal", "german", "company"] }).notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ── Work Locations (job sites, customer offices, etc.) ───────
export const locations = sqliteTable("locations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),         // e.g. "Dallas TX", "SAR Office", "Customer Site"
  shortCode: text("short_code"),                 // optional short label e.g. "DAL", "HQ"
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ── Capacity Entries ──────────────────────────────────────────
export const capacityEntries = sqliteTable("capacity_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teamMemberId: integer("team_member_id").notNull().references(() => teamMembers.id, { onDelete: "cascade" }),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  activityId: integer("activity_id").references(() => activities.id, { onDelete: "set null" }),
  locationId: integer("location_id").references(() => locations.id, { onDelete: "set null" }),
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

// ── Parts (master catalog — source of truth for SAR) ──────────
export const parts = sqliteTable("parts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  partNumber: text("part_number").notNull().unique(),  // SAR convention: PREFIX.mfr-part e.g. "SIE.7KM3220-0BA01-1DA0"
  name: text("name").notNull(),                        // short description
  description: text("description"),                    // extended description
  category: text("category"),                          // e.g. "Electrical", "Mechanical", "Cable", "Fastener"
  unitOfMeasure: text("unit_of_measure"),               // "EA", "$/m", "/m", "BOX", etc.
  // ── Vendor / Manufacturer ────────────────────
  preferredVendor: text("preferred_vendor"),            // supplier name (Wesco, McNaughton-McKay, etc.)
  manufacturer: text("manufacturer"),                  // mfr name (Siemens, Rittal, etc.)
  manufacturerPartNumber: text("manufacturer_part_number"), // raw mfr part without SAR prefix
  // ── Identification ────────────────────────────
  ean: text("ean"),                                    // EAN / barcode number (ProCoS: EANNR)
  // ── Classification ────────────────────────────
  partType: text("part_type", { enum: ["purchased", "manufactured", "sub_assembly", "raw_material", "service", "consumable"] }).default("purchased"),
  // ── Pricing / Costing ───────────────────────
  cost: integer("cost"),                               // default/standard cost in cents
  lastCost: integer("last_cost"),                      // most recent purchase cost in cents
  averageCost: integer("average_cost"),                // running average cost in cents
  // ── Purchasing ──────────────────────────────
  supplierPartNumber: text("supplier_part_number"),    // vendor's own part # (goes on POs)
  leadTimeDays: integer("lead_time_days"),             // purchasing lead time in days
  moq: integer("moq"),                                // minimum order quantity
  orderMultiple: integer("order_multiple"),            // pack size / order multiple
  safetyStock: integer("safety_stock"),                // min stock level before reorder
  reorderQty: integer("reorder_qty"),                  // default reorder quantity
  // ── Engineering ─────────────────────────────
  drawingNumber: text("drawing_number"),               // engineering drawing reference
  revision: text("revision"),                          // current revision (A, B, 01, etc.)
  weight: real("weight"),                              // weight value
  weightUom: text("weight_uom"),                       // kg, lb, g
  // ── Install times (for calc sheet labor estimates) ──
  installMinPerMeter: real("install_min_per_meter"),         // min/m — cable install rate
  installMinPerConnection: real("install_min_per_connection"), // min/connection — termination rate
  // ── Metadata ─────────────────────────────────
  priceUpdatedAt: text("price_updated_at"),            // date of last price update (YYYY-MM-DD)
  datasheetUrl: text("datasheet_url"),                 // link to spec/datasheet
  comments: text("comments"),                          // general notes
  countryOfOrigin: text("country_of_origin"),          // for customs (DE, US, CN, etc.)
  hsCode: text("hs_code"),                             // harmonized system tariff code
  inspectionRequired: integer("inspection_required", { mode: "boolean" }).default(false),
  lotTracked: integer("lot_tracked", { mode: "boolean" }).default(false),
  serialTracked: integer("serial_tracked", { mode: "boolean" }).default(false),
  shelfLifeDays: integer("shelf_life_days"),           // expiry tracking for adhesives, paste, etc.
  // ── QB integration (future) ──────────────────
  qbListId: text("qb_list_id"),                        // QB Desktop Item ListID (immutable)
  // ── System ───────────────────────────────────
  source: text("source", { enum: ["manual", "calc_sheet", "qb_sync"] }).notNull().default("manual"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  searchKeywords: text("search_keywords"),              // denormalized for fuzzy search
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// ── Part Prices (customer-specific pricing) ──────────────────
// Flexible: any number of customers, no schema change to add one
export const partPrices = sqliteTable("part_prices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  partId: integer("part_id").notNull().references(() => parts.id, { onDelete: "cascade" }),
  customerName: text("customer_name").notNull(),       // "BMW", "GM", "Volvo", "GENERAL", "Default"
  price: integer("price"),                             // cents
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [
  uniqueIndex("part_prices_part_customer").on(table.partId, table.customerName),
]);

// ── Storage Locations (warehouse / shelf / bin) ───────────────
export const storageLocations = sqliteTable("storage_locations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  warehouse: text("warehouse").notNull(),     // e.g. "Main", "SAR-DE"
  shelf: text("shelf"),                       // e.g. "A1", "B3"
  bin: text("bin"),                           // e.g. "01", "12"
  label: text("label"),                       // display alias
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

// ── Inventory Levels (qty per part per location, optionally per project) ──
// projectId = NULL means free/unallocated stock (ProCoS: "Freies Lager")
// projectId = N means stock allocated to that project/order
export const inventoryLevels = sqliteTable("inventory_levels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  partId: integer("part_id").notNull().references(() => parts.id, { onDelete: "cascade" }),
  locationId: integer("location_id").notNull().references(() => storageLocations.id, { onDelete: "cascade" }),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }), // null = free stock
  qtyOnHand: integer("qty_on_hand").notNull().default(0),
  reorderPoint: integer("reorder_point"),
  reorderQty: integer("reorder_qty"),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [
  uniqueIndex("inventory_levels_part_location").on(table.partId, table.locationId),
]);

// ── Stock Transactions (immutable audit log) ──────────────────
// Every book-in/out ties to a project for cost tracking (ProCoS: Lagerbewegungen)
export const stockTransactions = sqliteTable("stock_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  partId: integer("part_id").notNull().references(() => parts.id, { onDelete: "cascade" }),
  locationId: integer("location_id").notNull().references(() => storageLocations.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["book_in", "book_out", "adjustment", "transfer"] }).notNull(),
  qty: integer("qty").notNull(),              // positive = in, negative = out
  reason: text("reason"),                     // "project use", "received from vendor", "cycle count"
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),       // target project
  sourceProjectId: integer("source_project_id").references(() => projects.id, { onDelete: "set null" }), // for transfers between projects
  performedBy: integer("performed_by").references(() => teamMembers.id, { onDelete: "set null" }),
  notes: text("notes"),
  qtyAfter: integer("qty_after"),             // snapshot of stock after this transaction
  // ── ProCoS-aligned fields ───────────────────
  beistellung: integer("beistellung", { mode: "boolean" }).default(false), // customer-furnished material
  deliveryNote: text("delivery_note"),        // Lieferschein reference
  documentNumber: text("document_number"),    // Belegnummer
  serialNumber: text("serial_number"),        // per-movement serial tracking
  poLineId: integer("po_line_id").references(() => purchaseOrderLines.id, { onDelete: "set null" }), // links receipt to PO line
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ══════════════════════════════════════════════════════════════
// FUTURE: SHOPPING CART / PURCHASE ORDERS
// Schema only — routes + UI built later
// ══════════════════════════════════════════════════════════════

// ── Purchase Orders (ProCoS: Bestellungen) ───────────────────
// Status flow: draft → submitted → confirmed → partial → received → cancelled
// Maps to ProCoS: Disponiert → Bestellt → Bestätigt → Teilgeliefert → Geliefert → Storniert
export const purchaseOrders = sqliteTable("purchase_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  poNumber: text("po_number"),
  vendor: text("vendor"),
  status: text("status", { enum: ["draft", "submitted", "confirmed", "partial", "received", "cancelled"] }).notNull().default("draft"),
  requestedBy: integer("requested_by").references(() => teamMembers.id, { onDelete: "set null" }),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  notes: text("notes"),
  totalCost: integer("total_cost"),           // cents — sum of line costs
  deliveryAddress: text("delivery_address"),   // Lieferadresse
  submittedAt: text("submitted_at"),
  confirmedAt: text("confirmed_at"),           // AB+Datum — vendor confirmation date
  expectedDelivery: text("expected_delivery"), // Lieferdatum — YYYY-MM-DD
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
  qtyConfirmed: integer("qty_confirmed"),     // vendor-confirmed quantity (may differ from ordered)
  qtyReceived: integer("qty_received").notNull().default(0),
  unitCost: integer("unit_cost"),             // cents
  expectedDelivery: text("expected_delivery"), // per-line delivery date YYYY-MM-DD
  notes: text("notes"),
});
