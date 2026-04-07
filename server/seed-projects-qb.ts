/**
 * Import projects from QuickBooks report Excel.
 * Parses "Customer:ProjectNumber" format from the Customer column.
 * Imports all financial data (balance, estimate total) and job metadata.
 *
 * Usage: npx tsx server/seed-projects-qb.ts
 */
import Database from "better-sqlite3";
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

// ── Read Excel ────────────────────────────────────────────────
const altPath = "C:/Users/aba.SAR/Downloads/Report_from_SAR_Automation_LP.xlsx";
const excelPath = path.resolve(import.meta.dirname, "..", "..", "..", "Report_from_SAR_Automation_LP.xlsx");
const filePath = fs.existsSync(excelPath) ? excelPath : fs.existsSync(altPath) ? altPath : null;

if (!filePath) {
  console.error("Excel file not found at:", excelPath);
  console.error("Also tried:", altPath);
  process.exit(1);
}

console.log("Reading:", filePath);
const wb = XLSX.readFile(filePath);
const ws = wb.Sheets[wb.SheetNames[0]];
const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

// ── Helpers ──────────────────────────────────────────────────
/** Convert Excel serial date to YYYY-MM-DD string */
function excelDateToISO(serial: number | null | undefined): string | null {
  if (!serial || typeof serial !== "number") return null;
  // Excel epoch: 1900-01-01 (with the Lotus 1-2-3 leap year bug)
  const epoch = new Date(1899, 11, 30); // Dec 30, 1899
  const d = new Date(epoch.getTime() + serial * 86400000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Convert dollar amount to cents (integer) */
function dollarsToCents(val: number | null | undefined): number | null {
  if (val == null || typeof val !== "number") return null;
  return Math.round(val * 100);
}

// ── Column mapping (0-indexed) ───────────────────────────────
//   2: Customer (format "CustomerName:ProjectNumber")
//   4: Balance
//   6: Estimate Total
//   8: Job Description
//  10: Rep
//  12: End Location State
//  14: Job Status ("In progress", "Finished", "Cancelled")
//  16: Start Date (Excel serial)
//  18: Projected End (Excel serial)
//  20: Customer Type
//  22: End Date (Excel serial)
//  24: Job Type ("Open", "Closed")

let imported = 0;
let updated = 0;
let skipped = 0;

const existingStmt = sqlite.prepare("SELECT id FROM projects WHERE number = ?");

const insertStmt = sqlite.prepare(
  `INSERT INTO projects (
    number, customer, description, rep, balance, estimate_total,
    job_status, job_type, customer_type, end_location_state,
    start_date, projected_end, end_date,
    source, active, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'qb_sync', ?, datetime('now'), datetime('now'))`
);

const updateStmt = sqlite.prepare(
  `UPDATE projects SET
    customer = ?, description = ?, rep = ?,
    balance = ?, estimate_total = ?,
    job_status = ?, job_type = ?, customer_type = ?, end_location_state = ?,
    start_date = ?, projected_end = ?, end_date = ?,
    source = 'qb_sync', active = ?, updated_at = datetime('now')
  WHERE number = ?`
);

const transaction = sqlite.transaction(() => {
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (!row) continue;

    const col2 = String(row[2] || "").trim();
    if (!col2 || !col2.includes(":")) {
      skipped++;
      continue; // Skip parent/customer-only rows
    }

    // Parse "CustomerName:ProjectNumber"
    const colonIdx = col2.lastIndexOf(":");
    const customer = col2.substring(0, colonIdx).trim();
    const number = col2.substring(colonIdx + 1).trim();

    if (!number) {
      skipped++;
      continue;
    }

    const description = row[8] ? String(row[8]).trim() : null;
    const rep = row[10] ? String(row[10]).trim() : null;
    const balance = dollarsToCents(row[4]);
    const estimateTotal = dollarsToCents(row[6]);
    const jobStatus = row[14] ? String(row[14]).trim() : null;
    const jobType = row[24] ? String(row[24]).trim() : null;
    const customerType = row[20] ? String(row[20]).trim() : null;
    const endLocationState = row[12] ? String(row[12]).trim() : null;
    const startDate = excelDateToISO(row[16]);
    const projectedEnd = excelDateToISO(row[18]);
    const endDate = excelDateToISO(row[22]);

    // "In progress" = active, everything else = inactive
    const active = jobStatus === "In progress" ? 1 : 0;

    const existing = existingStmt.get(number) as any;
    if (existing) {
      updateStmt.run(
        customer, description, rep,
        balance, estimateTotal,
        jobStatus, jobType, customerType, endLocationState,
        startDate, projectedEnd, endDate,
        active, number
      );
      updated++;
    } else {
      insertStmt.run(
        number, customer, description, rep,
        balance, estimateTotal,
        jobStatus, jobType, customerType, endLocationState,
        startDate, projectedEnd, endDate,
        active
      );
      imported++;
    }
  }
});

transaction();

console.log(`Done! Imported: ${imported}, Updated: ${updated}, Skipped: ${skipped}`);
console.log(`Total projects in DB: ${(sqlite.prepare("SELECT COUNT(*) as c FROM projects").get() as any).c}`);

sqlite.close();
