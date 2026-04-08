/**
 * Migration: Add QB sync support
 * - Adds qb_list_id column to projects table (QB's immutable record ID)
 * - Creates qb_sync_log table (tracks every sync run)
 *
 * Safe to run multiple times (idempotent).
 * Usage: npx tsx server/migrate-qb-sync.ts
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dataDir = path.resolve(import.meta.dirname, "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "sar-tools.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

// ── Add qb_list_id to projects ──────────────────────────────
const projectCols = db.prepare("PRAGMA table_info(projects)").all() as { name: string }[];
if (!projectCols.some((c) => c.name === "qb_list_id")) {
  db.exec(`ALTER TABLE projects ADD COLUMN qb_list_id TEXT`);
  console.log("Added qb_list_id to projects table");
} else {
  console.log("qb_list_id already exists on projects");
}

// ── Create qb_sync_log table ────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS qb_sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at TEXT,
    entity_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    records_synced INTEGER DEFAULT 0,
    records_created INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    error_message TEXT,
    raw_request TEXT,
    raw_response_preview TEXT
  )
`);
console.log("qb_sync_log table ready");

db.close();
console.log("QB sync migration complete.");
