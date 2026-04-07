/**
 * Add capacity_changelog table for audit trail
 * Safe to run multiple times.
 * Usage: npx tsx server/migrate-changelog.ts
 */
import Database from "better-sqlite3";
import path from "path";

const dbPath = path.resolve(import.meta.dirname, "..", "data", "sar-tools.db");
const db = new Database(dbPath);

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS capacity_changelog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER,
      team_member_id INTEGER,
      date TEXT,
      action TEXT NOT NULL CHECK(action IN ('create','update','delete')),
      field TEXT,
      old_value TEXT,
      new_value TEXT,
      summary TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  console.log("capacity_changelog table ready");
} catch (e: any) {
  console.log("Table may already exist:", e.message);
}

// Add index for quick lookups by date range
try {
  db.exec(`CREATE INDEX IF NOT EXISTS idx_changelog_created ON capacity_changelog(created_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_changelog_entry ON capacity_changelog(entry_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_changelog_member ON capacity_changelog(team_member_id)`);
  console.log("Indexes ready");
} catch (e: any) {
  console.log("Index issue:", e.message);
}

db.close();
console.log("Done!");
