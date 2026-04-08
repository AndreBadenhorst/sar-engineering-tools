/**
 * QB Sync Service — upserts parsed QB data into SQLite.
 *
 * This replaces the old seed-projects-qb.ts script.
 * Instead of reading an Excel file, it receives parsed QB response objects
 * and upserts them into the projects table via Drizzle ORM.
 */
import { db } from "../db";
import { projects } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import type { QBCustomerJob } from "./qb-response-parser";
import { log } from "../index";

/** Convert dollars to cents (integer storage) */
function dollarsToCents(val: number | null): number | null {
  if (val == null) return null;
  return Math.round(val * 100);
}

/** Map QB JobStatus to our simplified status */
function mapJobStatus(qbStatus: string | null): "In progress" | "Finished" | "Cancelled" | null {
  if (!qbStatus) return null;
  switch (qbStatus) {
    case "In progress":
    case "Awarded":
    case "Pending":
      return "In progress";
    case "Closed":
    case "Not awarded":
      return "Finished";
    case "Cancelled":
      return "Cancelled";
    default:
      return null;
  }
}

export interface SyncResult {
  totalRecords: number;
  jobsOnly: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

/**
 * Sync an array of parsed QB Customer/Job records into the projects table.
 *
 * Logic:
 *   1. Only sync Jobs (sub-customers with ":" in FullName) — skip parent customers
 *   2. Look up by qb_list_id first (immutable), fall back to project number
 *   3. Upsert: update if exists, insert if new
 */
export async function syncCustomerJobs(jobs: QBCustomerJob[]): Promise<SyncResult> {
  const result: SyncResult = {
    totalRecords: jobs.length,
    jobsOnly: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  // Filter to jobs only (sub-customers with ":" in name)
  const jobsOnly = jobs.filter((j) => j.isJob);
  result.jobsOnly = jobsOnly.length;

  log(`QB Sync: Processing ${jobsOnly.length} jobs out of ${jobs.length} total records`, "qb-sync");

  const raw = db.$client; // better-sqlite3 instance for transactions

  const upsertTransaction = raw.transaction(() => {
    for (const job of jobsOnly) {
      try {
        const jobStatus = mapJobStatus(job.jobStatus);
        const active = jobStatus === "In progress" ? 1 : 0;

        // Try to find existing project by QB ListID first, then by number
        const existing = raw
          .prepare("SELECT id, qb_list_id FROM projects WHERE qb_list_id = ? OR number = ? LIMIT 1")
          .get(job.listId, job.number) as { id: number; qb_list_id: string | null } | undefined;

        if (existing) {
          // Update existing project
          raw.prepare(`
            UPDATE projects SET
              customer = ?,
              description = ?,
              rep = ?,
              balance = ?,
              estimate_total = estimate_total,
              job_status = ?,
              job_type = ?,
              customer_type = ?,
              start_date = ?,
              projected_end = ?,
              end_date = ?,
              qb_list_id = ?,
              source = 'qb_sync',
              active = ?,
              updated_at = datetime('now')
            WHERE id = ?
          `).run(
            job.customer,
            job.description,
            job.rep,
            dollarsToCents(job.balance),
            jobStatus,
            job.jobType,
            job.customerType,
            job.startDate,
            job.projectedEnd,
            job.endDate,
            job.listId,
            active,
            existing.id,
          );
          result.updated++;
        } else {
          // Insert new project
          raw.prepare(`
            INSERT INTO projects (
              number, customer, description, rep,
              balance, job_status, job_type, customer_type,
              start_date, projected_end, end_date,
              qb_list_id, source, active,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'qb_sync', ?, datetime('now'), datetime('now'))
          `).run(
            job.number,
            job.customer,
            job.description,
            job.rep,
            dollarsToCents(job.balance),
            jobStatus,
            job.jobType,
            job.customerType,
            job.startDate,
            job.projectedEnd,
            job.endDate,
            job.listId,
            active,
          );
          result.created++;
        }
      } catch (err: any) {
        result.errors.push(`${job.fullName}: ${err.message}`);
        result.skipped++;
      }
    }
  });

  upsertTransaction();

  log(
    `QB Sync complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped` +
      (result.errors.length ? ` (${result.errors.length} errors)` : ""),
    "qb-sync",
  );

  return result;
}
