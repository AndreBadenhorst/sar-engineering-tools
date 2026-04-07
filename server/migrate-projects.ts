/**
 * Migration: Add QB financial/metadata columns to projects table.
 * Safe to run multiple times — uses IF NOT EXISTS pattern via try/catch.
 *
 * Usage: npx tsx server/migrate-projects.ts
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dataDir = path.resolve(import.meta.dirname, "..", "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, "sar-tools.db");
const sqlite = new Database(dbPath);

const columns = [
  { name: "balance", type: "INTEGER" },
  { name: "estimate_total", type: "INTEGER" },
  { name: "job_status", type: "TEXT" },
  { name: "job_type", type: "TEXT" },
  { name: "customer_type", type: "TEXT" },
  { name: "end_location_state", type: "TEXT" },
  { name: "start_date", type: "TEXT" },
  { name: "projected_end", type: "TEXT" },
  { name: "end_date", type: "TEXT" },
];

for (const col of columns) {
  try {
    sqlite.exec(`ALTER TABLE projects ADD COLUMN ${col.name} ${col.type}`);
    console.log(`Added column: ${col.name}`);
  } catch (e: any) {
    if (e.message.includes("duplicate column")) {
      console.log(`Column already exists: ${col.name}`);
    } else {
      throw e;
    }
  }
}

// Update old source values to 'qb_sync'
const result = sqlite.prepare(
  `UPDATE projects SET source = 'qb_sync' WHERE source NOT IN ('qb_sync', 'manual')`
).run();
console.log(`Updated ${result.changes} projects source to 'qb_sync'`);

console.log("Migration complete!");
sqlite.close();
