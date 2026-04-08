/**
 * Migration: Create holidays table and seed from calculator
 * Run: npx tsx server/migrate-holidays.ts
 */
import Database from "better-sqlite3";
import path from "path";
import { getHolidays } from "../shared/holidays";

const DB_PATH = path.join(process.cwd(), "data", "sar-tools.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

console.log("=== Migration: Create holidays table ===\n");

// 1. Create holidays table
const hasTable = db.prepare(
  `SELECT name FROM sqlite_master WHERE type='table' AND name='holidays'`
).get();

if (!hasTable) {
  db.exec(`
    CREATE TABLE holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      name_local TEXT,
      category TEXT NOT NULL CHECK(category IN ('us_federal', 'german', 'company')),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_holidays_date ON holidays(date);
    CREATE INDEX idx_holidays_category ON holidays(category);
  `);
  console.log("[OK] Created holidays table with indexes");
} else {
  console.log("[SKIP] holidays table already exists");
}

// 2. Seed holidays for current year and next year
const count = db.prepare(`SELECT COUNT(*) as cnt FROM holidays`).get() as any;
if (count.cnt === 0) {
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear + 1];
  const allHolidays = getHolidays(years);

  const insert = db.prepare(
    `INSERT INTO holidays (date, name, name_local, category) VALUES (?, ?, ?, ?)`
  );

  let usCount = 0;
  let deCount = 0;

  const insertMany = db.transaction(() => {
    for (const h of allHolidays) {
      if (h.country === "US" || h.country === "BOTH") {
        insert.run(h.date, h.name, null, "us_federal");
        usCount++;
      }
      if (h.country === "DE" || h.country === "BOTH") {
        // For German holidays, avoid duplicate if already inserted as US
        if (h.country === "BOTH") {
          // Already inserted as US above, skip DE duplicate for same date
          continue;
        }
        insert.run(h.date, h.name, h.nameDE || null, "german");
        deCount++;
      }
    }
  });
  insertMany();

  // For holidays that are BOTH, we need separate entries for each category
  // Let me re-do this properly
  db.exec(`DELETE FROM holidays`);
  usCount = 0;
  deCount = 0;

  const insertAll = db.transaction(() => {
    for (const h of allHolidays) {
      if (h.country === "US") {
        insert.run(h.date, h.name, null, "us_federal");
        usCount++;
      } else if (h.country === "DE") {
        insert.run(h.date, h.name, h.nameDE || null, "german");
        deCount++;
      } else if (h.country === "BOTH") {
        // Insert as both categories
        insert.run(h.date, h.name, null, "us_federal");
        usCount++;
        insert.run(h.date, h.name, h.nameDE || null, "german");
        deCount++;
      }
    }
  });
  insertAll();

  // Add some sample company holidays
  const companyHolidays = [
    [`${currentYear}-12-24`, "Christmas Eve (Company)", null],
    [`${currentYear}-12-31`, "New Year's Eve (Company)", null],
    [`${currentYear + 1}-12-24`, "Christmas Eve (Company)", null],
    [`${currentYear + 1}-12-31`, "New Year's Eve (Company)", null],
  ];
  let compCount = 0;
  for (const [date, name, local] of companyHolidays) {
    insert.run(date, name, local, "company");
    compCount++;
  }

  console.log(`[OK] Seeded ${usCount} US Federal, ${deCount} German, ${compCount} Company holidays for ${years.join(", ")}`);
} else {
  console.log(`[SKIP] holidays already has ${count.cnt} entries`);
}

console.log("\n=== Migration complete ===");
db.close();
