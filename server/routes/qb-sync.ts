/**
 * QB Sync API routes — view sync status and logs.
 *
 * GET /api/qb-sync/status   — last sync time, record counts
 * GET /api/qb-sync/log      — recent sync log entries
 */
import { Router, type Request, type Response } from "express";
import Database from "better-sqlite3";
import path from "path";

const router = Router();

function getDb() {
  const dbPath = path.resolve(import.meta.dirname, "..", "..", "data", "sar-tools.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  return db;
}

// GET /api/qb-sync/status
router.get("/status", (_req: Request, res: Response) => {
  const db = getDb();
  try {
    // Check if qb_sync_log table exists
    const tableExists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='qb_sync_log'")
      .get();

    if (!tableExists) {
      return res.json({
        configured: false,
        message: "QB sync not set up yet. Run: npx tsx server/migrate-qb-sync.ts",
      });
    }

    const lastSync = db
      .prepare("SELECT * FROM qb_sync_log ORDER BY id DESC LIMIT 1")
      .get() as any;

    const totalSyncs = (
      db.prepare("SELECT COUNT(*) as count FROM qb_sync_log").get() as any
    )?.count || 0;

    const successfulSyncs = (
      db.prepare("SELECT COUNT(*) as count FROM qb_sync_log WHERE status = 'success'").get() as any
    )?.count || 0;

    const qbProjects = (
      db.prepare("SELECT COUNT(*) as count FROM projects WHERE source = 'qb_sync'").get() as any
    )?.count || 0;

    res.json({
      configured: true,
      lastSync: lastSync || null,
      stats: {
        totalSyncs,
        successfulSyncs,
        qbSyncedProjects: qbProjects,
      },
    });
  } finally {
    db.close();
  }
});

// GET /api/qb-sync/log?limit=20
router.get("/log", (req: Request, res: Response) => {
  const db = getDb();
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);

    const tableExists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='qb_sync_log'")
      .get();

    if (!tableExists) {
      return res.json({ logs: [] });
    }

    const logs = db
      .prepare("SELECT * FROM qb_sync_log ORDER BY id DESC LIMIT ?")
      .all(limit);

    res.json({ logs });
  } finally {
    db.close();
  }
});

export default router;
