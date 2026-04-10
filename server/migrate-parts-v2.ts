/**
 * Migration: Upgrade parts table with calc-sheet-compatible fields + create part_prices table.
 *
 * Adds:
 *   - parts: install_min_per_meter, install_min_per_connection, price_updated_at,
 *            datasheet_url, comments, qb_list_id
 *   - parts: source enum now includes 'calc_sheet'
 *   - part_prices table (customer-specific pricing)
 *
 * Run: npx tsx server/migrate-parts-v2.ts
 */
import Database from "better-sqlite3";
import path from "path";

const dbPath = path.resolve(import.meta.dirname, "..", "data", "sar-tools.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

console.log("Migrating parts table + creating part_prices...");

db.transaction(() => {
  // ── Add new columns to parts ──────────────────────────────
  const existingCols = db.prepare("PRAGMA table_info(parts)").all() as { name: string }[];
  const colNames = new Set(existingCols.map((c) => c.name));

  if (!colNames.has("install_min_per_meter")) {
    db.exec("ALTER TABLE parts ADD COLUMN install_min_per_meter REAL");
    console.log("  + parts.install_min_per_meter");
  }
  if (!colNames.has("install_min_per_connection")) {
    db.exec("ALTER TABLE parts ADD COLUMN install_min_per_connection REAL");
    console.log("  + parts.install_min_per_connection");
  }
  if (!colNames.has("price_updated_at")) {
    db.exec("ALTER TABLE parts ADD COLUMN price_updated_at TEXT");
    console.log("  + parts.price_updated_at");
  }
  if (!colNames.has("datasheet_url")) {
    db.exec("ALTER TABLE parts ADD COLUMN datasheet_url TEXT");
    console.log("  + parts.datasheet_url");
  }
  if (!colNames.has("comments")) {
    db.exec("ALTER TABLE parts ADD COLUMN comments TEXT");
    console.log("  + parts.comments");
  }
  if (!colNames.has("qb_list_id")) {
    db.exec("ALTER TABLE parts ADD COLUMN qb_list_id TEXT");
    console.log("  + parts.qb_list_id");
  }

  // ── Create part_prices table ──────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS part_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_id INTEGER NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
      customer_name TEXT NOT NULL,
      price INTEGER,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(part_id, customer_name)
    )
  `);
  console.log("  + part_prices table created");

  // ── Index for fast lookups ────────────────────────────────
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_part_prices_part_id ON part_prices(part_id)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_parts_manufacturer ON parts(manufacturer)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_parts_category ON parts(category)
  `);
  console.log("  + indexes created");
})();

db.close();
console.log("Migration complete.");
