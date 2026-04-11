/**
 * Migration v3: Add ERP-standard fields to parts table.
 *
 * Adds:
 *   - Classification: part_type
 *   - Costing: last_cost, average_cost
 *   - Purchasing: supplier_part_number, lead_time_days, moq, order_multiple,
 *                 safety_stock, reorder_qty
 *   - Engineering: drawing_number, revision, weight, weight_uom
 *   - Compliance: country_of_origin, hs_code
 *   - Tracking: inspection_required, lot_tracked, serial_tracked, shelf_life_days
 *
 * Run: npx tsx server/migrate-parts-v3.ts
 */
import Database from "better-sqlite3";
import path from "path";

const dbPath = path.resolve(import.meta.dirname, "..", "data", "sar-tools.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

console.log("Migrating parts table — adding ERP-standard fields...");

db.transaction(() => {
  const existingCols = db.prepare("PRAGMA table_info(parts)").all() as { name: string }[];
  const colNames = new Set(existingCols.map((c) => c.name));

  const columns: [string, string][] = [
    // Classification
    ["part_type", "TEXT DEFAULT 'purchased'"],
    // Costing
    ["last_cost", "INTEGER"],
    ["average_cost", "INTEGER"],
    // Purchasing
    ["supplier_part_number", "TEXT"],
    ["lead_time_days", "INTEGER"],
    ["moq", "INTEGER"],
    ["order_multiple", "INTEGER"],
    ["safety_stock", "INTEGER"],
    ["reorder_qty", "INTEGER"],
    // Engineering
    ["drawing_number", "TEXT"],
    ["revision", "TEXT"],
    ["weight", "REAL"],
    ["weight_uom", "TEXT"],
    // Compliance
    ["country_of_origin", "TEXT"],
    ["hs_code", "TEXT"],
    // Tracking
    ["inspection_required", "INTEGER DEFAULT 0"],
    ["lot_tracked", "INTEGER DEFAULT 0"],
    ["serial_tracked", "INTEGER DEFAULT 0"],
    ["shelf_life_days", "INTEGER"],
  ];

  let added = 0;
  for (const [col, type] of columns) {
    if (!colNames.has(col)) {
      db.exec(`ALTER TABLE parts ADD COLUMN ${col} ${type}`);
      console.log(`  + parts.${col}`);
      added++;
    } else {
      console.log(`  ~ parts.${col} already exists`);
    }
  }

  // Auto-classify raw materials (cables sold by meter)
  const cableResult = db.prepare(`
    UPDATE parts SET part_type = 'raw_material'
    WHERE part_type = 'purchased'
      AND (unit_of_measure LIKE '%/m%' OR unit_of_measure LIKE '$/m')
  `).run();
  console.log(`  → Classified ${cableResult.changes} cable/meter items as raw_material`);

  console.log(`\nDone — ${added} columns added.`);
})();

db.close();
