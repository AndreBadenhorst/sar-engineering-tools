/**
 * Seed script: imports team members and activities from CW Planning Excel.
 * Projects will be imported separately when user provides the project list Excel.
 *
 * Usage: npx tsx server/seed.ts
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../shared/schema";
import path from "path";
import fs from "fs";
import XLSX from "xlsx";

// ── Database setup ────────────────────────────────────────────
const dataDir = path.resolve(import.meta.dirname, "..", "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, "sar-tools.db");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });

// ── Read Excel ────────────────────────────────────────────────
const excelPath = path.resolve(import.meta.dirname, "..", "..", "..", "CW Planning v0.1.xlsm");
if (!fs.existsSync(excelPath)) {
  console.error(`Excel file not found: ${excelPath}`);
  console.error("Place the file at:", excelPath);
  process.exit(1);
}

const wb = XLSX.readFile(excelPath);

// ── Seed Activities from TASKS sheet ──────────────────────────
function seedActivities() {
  const ws = wb.Sheets["TASKS"];
  if (!ws) {
    console.warn("TASKS sheet not found, skipping activities seed");
    return;
  }

  const data: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const activityNames: string[] = [];

  for (const row of data) {
    const name = row[0]?.toString().trim();
    if (name && name !== "TASKS") {
      activityNames.push(name);
    }
  }

  console.log(`Found ${activityNames.length} activities`);

  for (let i = 0; i < activityNames.length; i++) {
    db.insert(schema.activities)
      .values({ name: activityNames[i], sortOrder: i + 1 })
      .onConflictDoNothing()
      .run();
  }

  console.log("Activities seeded.");
}

// ── Seed Team Members from CW sheet ──────────────────────────
function seedTeamMembers() {
  const ws = wb.Sheets["CW"];
  if (!ws) {
    console.warn("CW sheet not found, skipping team members seed");
    return;
  }

  // Team member names are in column C (index 2), every 4 rows starting at row 14 (0-indexed: 13)
  // Match external members by checking if name contains these patterns
  const externalPatterns: { pattern: RegExp; company: string }[] = [
    { pattern: /^Guest Software$/i, company: "Guest Software" },
    { pattern: /^ISG/i, company: "ISG" },
  ];

  const members: { name: string; isExternal: boolean; company: string | null }[] = [];

  for (let r = 13; r < 112; r += 4) {
    const addr = XLSX.utils.encode_cell({ r, c: 2 });
    const cell = ws[addr];
    if (cell && cell.v) {
      const rawName = String(cell.v).trim();
      if (!rawName) continue;

      // Clean up multiline names like "ISG1\n(Vladimir)" or "ISG1\r\n(Vladimir)"
      const displayName = rawName.replace(/[\r\n]+/g, " ").trim();
      const match = externalPatterns.find((p) => p.pattern.test(displayName));
      const isExternal = !!match;
      const company = match?.company || null;

      members.push({ name: displayName, isExternal, company });
    }
  }

  console.log(`Found ${members.length} team members`);

  for (const m of members) {
    db.insert(schema.teamMembers)
      .values({
        name: m.name,
        source: "manual",
        isExternal: m.isExternal,
        company: m.company,
        active: true,
      })
      .onConflictDoNothing()
      .run();
  }

  console.log("Team members seeded.");
}

// ── Seed Projects from Sales List + GmbH & GUN sheets ────────
function seedProjects() {
  // Sales List - Projects
  const salesWs = wb.Sheets["Sales List - Projects"];
  if (salesWs) {
    const data: any[][] = XLSX.utils.sheet_to_json(salesWs, { header: 1 });
    let count = 0;

    // Skip header rows (first 4 rows are special: --, Unassigned, Vacation, Training + header row)
    for (let i = 4; i < data.length; i++) {
      const row = data[i];
      const number = row[0]?.toString().trim();
      if (!number) continue;

      db.insert(schema.projects)
        .values({
          number,
          customer: row[1]?.toString().trim() || null,
          description: row[4]?.toString().trim() || null,
          poNumber: row[2]?.toString().trim() || null,
          contact: row[5]?.toString().trim() || null,
          rep: row[6]?.toString().trim() || null,
          source: "sales_list",
          active: true,
        })
        .onConflictDoNothing()
        .run();
      count++;
    }
    console.log(`Seeded ${count} projects from Sales List`);
  }

  // GmbH & GUN
  const gmbhWs = wb.Sheets["GmbH & GUN"];
  if (gmbhWs) {
    const data: any[][] = XLSX.utils.sheet_to_json(gmbhWs, { header: 1 });
    let count = 0;

    // Skip header row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const number = row[0]?.toString().trim();
      if (!number || number === "Project No.") continue;

      db.insert(schema.projects)
        .values({
          number,
          customer: row[1]?.toString().trim() || null,
          description: row[5]?.toString().trim() || null,
          poNumber: row[2]?.toString().trim() || null,
          contact: row[6]?.toString().trim() || null,
          rep: row[7]?.toString().trim() || null,
          source: "gmbh_gun",
          active: true,
        })
        .onConflictDoNothing()
        .run();
      count++;
    }
    console.log(`Seeded ${count} projects from GmbH & GUN`);
  }

  // Also add special entries
  const specials = [
    { number: "--", description: "No project / day off" },
    { number: "Unassigned", description: "Unassigned work" },
    { number: "Vacation", description: "Vacation" },
    { number: "Training", description: "Training" },
  ];
  for (const s of specials) {
    db.insert(schema.projects)
      .values({ number: s.number, description: s.description, source: "manual", active: true })
      .onConflictDoNothing()
      .run();
  }
  console.log("Special project entries added.");
}

// ── Run ──────────────────────────────────────────────────────
console.log("Starting seed...");
seedActivities();
seedTeamMembers();
seedProjects();
console.log("Seed complete!");

sqlite.close();
