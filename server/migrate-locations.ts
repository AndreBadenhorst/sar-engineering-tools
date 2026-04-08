/**
 * Migration: Add locations table + locationId to capacity_entries
 * Run: npx tsx server/migrate-locations.ts
 */
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "sar-tools.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

console.log("=== Migration: Add locations + capacity_entries.location_id ===\n");

// 1. Create locations table
const hasLocations = db.prepare(
  `SELECT name FROM sqlite_master WHERE type='table' AND name='locations'`
).get();

if (!hasLocations) {
  db.exec(`
    CREATE TABLE locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      short_code TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  console.log("[OK] Created locations table");
} else {
  console.log("[SKIP] locations table already exists");
}

// 2. Add location_id column to capacity_entries
const cols = db.prepare(`PRAGMA table_info(capacity_entries)`).all() as any[];
const hasLocationId = cols.some((c: any) => c.name === "location_id");

if (!hasLocationId) {
  db.exec(`ALTER TABLE capacity_entries ADD COLUMN location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL;`);
  console.log("[OK] Added location_id to capacity_entries");
} else {
  console.log("[SKIP] capacity_entries.location_id already exists");
}

// 3. Seed some default locations
const count = db.prepare(`SELECT COUNT(*) as cnt FROM locations`).get() as any;
if (count.cnt === 0) {
  const insert = db.prepare(`INSERT INTO locations (name, short_code) VALUES (?, ?)`);
  const defaults = [
    ["SAR Office", "HQ"],
    ["Customer Site", "CUST"],
    ["Remote / Home", "REM"],
    ["Travel", "TRV"],
  ];
  for (const [name, code] of defaults) {
    insert.run(name, code);
  }
  console.log(`[OK] Seeded ${defaults.length} default locations`);
} else {
  console.log(`[SKIP] locations already has ${count.cnt} entries`);
}

console.log("\n=== Migration complete ===");
db.close();
