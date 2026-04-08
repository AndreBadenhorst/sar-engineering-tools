/**
 * Migration: Add job_function column to team_members table.
 * Runs on startup — safe to re-run (checks before altering).
 */
import { db } from "./db";

export function migrateJobFunction() {
  const raw = db.$client;

  // Check if column already exists
  const cols = raw.prepare("PRAGMA table_info(team_members)").all() as { name: string }[];
  if (cols.some((c) => c.name === "job_function")) return;

  raw.exec(`ALTER TABLE team_members ADD COLUMN job_function TEXT`);
  console.log("[migrate] Added job_function column to team_members");
}
