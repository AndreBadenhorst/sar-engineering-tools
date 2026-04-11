/**
 * Migration v4: ProCoS alignment — add EAN, per-project inventory,
 * expanded stock transaction fields, and PO enhancements.
 *
 * Adds:
 *   Parts:
 *     - ean (EAN / barcode number)
 *   Inventory Levels:
 *     - project_id (per-project stock allocation; NULL = free stock)
 *   Stock Transactions:
 *     - source_project_id, beistellung, delivery_note,
 *       document_number, serial_number, po_line_id
 *     - type enum gains "transfer"
 *   Purchase Orders:
 *     - status enum gains "confirmed"
 *     - delivery_address, confirmed_at, expected_delivery
 *   Purchase Order Lines:
 *     - qty_confirmed, expected_delivery
 *
 * Run: npx tsx server/migrate-v4-procos.ts
 */
import Database from "better-sqlite3";
import path from "path";

const dbPath = path.resolve(import.meta.dirname, "..", "data", "sar-tools.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function tableColumns(table: string): Set<string> {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return new Set(cols.map((c) => c.name));
}

function addColumns(table: string, columns: [string, string][]) {
  const existing = tableColumns(table);
  let added = 0;
  for (const [col, type] of columns) {
    if (!existing.has(col)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
      console.log(`  + ${table}.${col}`);
      added++;
    } else {
      console.log(`  ~ ${table}.${col} already exists`);
    }
  }
  return added;
}

console.log("Migration v4: ProCoS alignment\n");

let totalAdded = 0;

db.transaction(() => {
  // ── Parts: EAN/barcode ─────────────────────────
  console.log("Parts:");
  totalAdded += addColumns("parts", [
    ["ean", "TEXT"],
  ]);

  // ── Inventory Levels: per-project allocation ───
  console.log("\nInventory Levels:");
  totalAdded += addColumns("inventory_levels", [
    ["project_id", "INTEGER REFERENCES projects(id) ON DELETE SET NULL"],
  ]);

  // ── Stock Transactions: ProCoS Lagerbewegungen fields ──
  console.log("\nStock Transactions:");
  totalAdded += addColumns("stock_transactions", [
    ["source_project_id", "INTEGER REFERENCES projects(id) ON DELETE SET NULL"],
    ["beistellung", "INTEGER DEFAULT 0"],
    ["delivery_note", "TEXT"],
    ["document_number", "TEXT"],
    ["serial_number", "TEXT"],
    ["po_line_id", "INTEGER REFERENCES purchase_order_lines(id) ON DELETE SET NULL"],
  ]);

  // ── Purchase Orders: confirmed status + delivery fields ──
  console.log("\nPurchase Orders:");
  totalAdded += addColumns("purchase_orders", [
    ["delivery_address", "TEXT"],
    ["confirmed_at", "TEXT"],
    ["expected_delivery", "TEXT"],
  ]);

  // ── Purchase Order Lines: confirmation + delivery ──
  console.log("\nPurchase Order Lines:");
  totalAdded += addColumns("purchase_order_lines", [
    ["qty_confirmed", "INTEGER"],
    ["expected_delivery", "TEXT"],
  ]);

  console.log(`\nDone — ${totalAdded} columns added across 5 tables.`);
})();

db.close();
