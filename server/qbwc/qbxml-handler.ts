/**
 * qbXML Handler — the core integration between QBWC and our app.
 *
 * quickbooks-js calls these methods during each sync cycle:
 *   1. fetchRequests()  → return array of qbXML request strings
 *   2. handleResponse() → receive QB's XML response, parse & sync
 *   3. didReceiveError() → handle errors
 *
 * The handler also logs every sync run to the qb_sync_log table.
 */
import { buildCustomerQueryRq } from "./qbxml-templates";
import { parseCustomerQueryResponse } from "./qb-response-parser";
import { syncCustomerJobs, type SyncResult } from "./qb-sync-service";
import { log } from "../index";
import Database from "better-sqlite3";
import path from "path";

// Direct DB access for sync log (lightweight, no Drizzle overhead)
function getDb() {
  const dbPath = path.resolve(import.meta.dirname, "..", "..", "data", "sar-tools.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  return db;
}

let currentSyncLogId: number | null = null;

/**
 * Log the start of a sync run.
 */
function logSyncStart(entityType: string, requestXml: string): number {
  const db = getDb();
  try {
    const result = db.prepare(`
      INSERT INTO qb_sync_log (entity_type, status, raw_request)
      VALUES (?, 'running', ?)
    `).run(entityType, requestXml.slice(0, 500));
    return Number(result.lastInsertRowid);
  } finally {
    db.close();
  }
}

/**
 * Log the completion of a sync run.
 */
function logSyncComplete(logId: number, syncResult: SyncResult, responsePreview: string) {
  const db = getDb();
  try {
    db.prepare(`
      UPDATE qb_sync_log SET
        finished_at = datetime('now'),
        status = ?,
        records_synced = ?,
        records_created = ?,
        records_updated = ?,
        error_message = ?,
        raw_response_preview = ?
      WHERE id = ?
    `).run(
      syncResult.errors.length > 0 ? "partial" : "success",
      syncResult.jobsOnly,
      syncResult.created,
      syncResult.updated,
      syncResult.errors.length > 0 ? syncResult.errors.join("; ") : null,
      responsePreview.slice(0, 1000),
      logId,
    );
  } finally {
    db.close();
  }
}

/**
 * Log a sync error.
 */
function logSyncError(logId: number | null, errorMessage: string) {
  if (!logId) return;
  const db = getDb();
  try {
    db.prepare(`
      UPDATE qb_sync_log SET
        finished_at = datetime('now'),
        status = 'error',
        error_message = ?
      WHERE id = ?
    `).run(errorMessage, logId);
  } finally {
    db.close();
  }
}

// ══════════════════════════════════════════════════════════════
// QBWC Handler Interface (required by quickbooks-js)
// ══════════════════════════════════════════════════════════════

export const qbxmlHandler = {
  /**
   * Called by QBWC to get the list of qbXML requests to process.
   * Returns an array of XML strings via callback.
   */
  fetchRequests(callback: (err: Error | null, requests: string[]) => void) {
    log("QB Web Connector: fetchRequests called — building query queue", "qb-sync");

    try {
      // For now, just query all Customer:Job records.
      // Phase 2 will add FromModifiedDate for incremental sync.
      const requests = [buildCustomerQueryRq()];

      // Log the sync start
      currentSyncLogId = logSyncStart("CustomerQuery", requests[0]);

      callback(null, requests);
    } catch (err: any) {
      log(`QB fetchRequests error: ${err.message}`, "qb-sync");
      callback(err, []);
    }
  },

  /**
   * Called by QBWC with QB's XML response after executing a request.
   */
  handleResponse(response: string) {
    log("QB Web Connector: handleResponse called", "qb-sync");

    try {
      // Parse the XML response
      const { jobs, statusCode, statusMessage } = parseCustomerQueryResponse(response);

      if (statusCode !== "0") {
        log(`QB query returned status ${statusCode}: ${statusMessage}`, "qb-sync");
        logSyncError(currentSyncLogId, `QB status ${statusCode}: ${statusMessage}`);
        return;
      }

      log(`QB returned ${jobs.length} Customer/Job records — syncing to database...`, "qb-sync");

      // Sync to database (synchronous — better-sqlite3 transactions)
      const syncResult = syncCustomerJobs(jobs) as any;
      // syncCustomerJobs is async but uses sync better-sqlite3 under the hood.
      // The quickbooks-js handler is sync, so we call it directly and it works
      // because the transaction is synchronous.

      // Actually, syncCustomerJobs returns a Promise. Let's handle it:
      if (syncResult && typeof syncResult.then === "function") {
        syncResult.then((result: any) => {
          logSyncComplete(currentSyncLogId!, result, response.slice(0, 1000));
        }).catch((err: any) => {
          logSyncError(currentSyncLogId, err.message);
        });
      } else {
        logSyncComplete(currentSyncLogId!, syncResult, response.slice(0, 1000));
      }
    } catch (err: any) {
      log(`QB handleResponse error: ${err.message}`, "qb-sync");
      logSyncError(currentSyncLogId, err.message);
    }
  },

  /**
   * Called when QBWC encounters an error communicating with QB.
   */
  didReceiveError(error: string) {
    log(`QB Web Connector ERROR: ${error}`, "qb-sync");
    logSyncError(currentSyncLogId, error);
  },
};
