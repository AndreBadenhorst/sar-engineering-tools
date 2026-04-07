/**
 * Seed capacity planner with realistic test data for CW15-16 (Apr 6-17, 2026)
 * Usage: npx tsx server/seed-capacity-test.ts
 */
import Database from "better-sqlite3";
import path from "path";

const dbPath = path.resolve(import.meta.dirname, "..", "data", "sar-tools.db");
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

// Clear existing
db.prepare("DELETE FROM capacity_entries").run();
console.log("Cleared existing entries");

const insert = db.prepare(
  `INSERT INTO capacity_entries (team_member_id, project_id, activity_id, date, comment, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
);

const cw15 = ["2026-04-06", "2026-04-07", "2026-04-08", "2026-04-09", "2026-04-10"];
const cw16 = ["2026-04-13", "2026-04-14", "2026-04-15", "2026-04-16", "2026-04-17"];

function fillWeek(memberId: number, projectId: number | null, activityId: number | null, days: string[], comment?: string) {
  for (const d of days) {
    insert.run(memberId, projectId, activityId, d, comment || null);
  }
}

function fillDays(memberId: number, projectId: number | null, activityId: number | null, days: string[], indices: number[], comment?: string) {
  for (const i of indices) {
    insert.run(memberId, projectId, activityId, days[i], comment || null);
  }
}

// Team member IDs:
// 11=Anton, 9=Chris, 1=Houston, 2=Jonathan, 14=Jonny, 13=Korey,
// 3=Richard, 4=Saurin, 5=Taylor, 10=Terrance, 12=Thomas, 6=Travis, 7=Zach
// External: 8=Guest Software, 15=ISG1 Vladimir, 16=ISG2 Maksim

// Project IDs:
// 953=11576.000 GSC Support, 961=11579.000 TDC 2026
// 963=11579.100 TX-31, 964=11579.200 TX-65, 965=11579.300 TX-210, 966=11579.400 TX-413
// 664=11392.100 Conveyors, 665=11392.200 Stacker
// 894=11559.000 B-45, 968=11580.000 BL8 Update
// 481=11329.000 ROFA Gen Assembly
// 910=G1029.000 Tesla, 949=G1029.001 Programming, 959=G1029.002 Program Tesla
// 925=11571.000 Tooth on Tooth, 927=11572.000 Band 63
// 928=11570.000 BL8 Lift, 973=11585.000 Conti VEM
// 982=11586.000 Monorail Step 1
// 838=11440.000 Bastian RGV

// Activities: 1=SoftwarePrep, 2=Commissioning, 4=HW Planning, 5=Install Planning
// 6=Ordering, 7=Workshop, 8=Cabinet, 9=Installation, 11=SiteSuper, 14=Travel

const tx = db.transaction(() => {
  // ═══════ CW15 (Apr 6-10) ═══════

  // Anton Mosert (11) — BMW TDC projects, rotating sub-projects
  fillDays(11, 961, 2, cw15, [0, 1]);        // Mon-Tue: 11579.000 TDC, Commissioning
  fillDays(11, 963, 2, cw15, [2, 3]);        // Wed-Thu: 11579.100 TX-31, Commissioning
  fillDays(11, 964, 2, cw15, [4]);           // Fri: 11579.200 TX-65, Commissioning

  // Chris Ludlow (9) — SCIVIC Conveyors, Software Prep
  fillWeek(9, 664, 1, cw15);

  // Houston Hodge (1) — BMW BL8 projects
  fillDays(1, 928, 7, cw15, [0, 1, 2]);      // Mon-Wed: 11570.000 BL8 Lift, Workshop Assembly
  fillDays(1, 968, 1, cw15, [3, 4]);         // Thu-Fri: 11580.000 BL8 Update, Software Prep

  // Jonathan Bartney (2) — ROFA site commissioning
  fillWeek(2, 481, 2, cw15);                 // 11329.000 ROFA, Commissioning

  // Jonny Vasquez (14) — Cabinet Building for SCIVIC
  fillDays(14, 664, 8, cw15, [0, 1, 2, 3]); // Mon-Thu: 11392.100 Conveyors, Cabinet
  fillDays(14, 665, 8, cw15, [4]);           // Fri: 11392.200 Stacker, Cabinet

  // Korey Styles (13) — Monorail installation
  fillWeek(13, 982, 9, cw15);               // 11586.000 Monorail Step 1, Installation

  // Richard Cherry (3) — Tesla project, HW then SW
  fillDays(3, 910, 4, cw15, [0, 1, 2]);     // Mon-Wed: G1029.000 Tesla, HW Planning
  fillDays(3, 949, 1, cw15, [3, 4]);        // Thu-Fri: G1029.001 Programming, Software Prep

  // Saurin Christian (4) — B-45 commissioning
  fillWeek(4, 894, 2, cw15);                // 11559.000 B-45, Commissioning

  // Taylor Horst (5) — BMW projects
  fillDays(5, 925, 1, cw15, [0, 1]);        // Mon-Tue: 11571.000 Tooth on Tooth, Software
  fillDays(5, 927, 1, cw15, [2, 3, 4]);     // Wed-Fri: 11572.000 Band 63, Software

  // Terrance Caldwell (10) — ROFA site supervision
  fillWeek(10, 481, 11, cw15);              // 11329.000 ROFA, Site Supervision

  // Thomas Vogel (12) — GmbH Tesla, Friday off
  fillDays(12, 959, 1, cw15, [0, 1, 2, 3]); // Mon-Thu: G1029.002 Tesla, Software
  insert.run(12, null, null, cw15[4], "Day off / Feiertag");

  // Travis Dillon (6) — Conti VEM Support
  fillWeek(6, 973, 5, cw15);                // 11585.000 Conti VEM, Installation Planning

  // Zach Shaarda (7) — Bastian RGV, ordering then workshop
  fillDays(7, 838, 6, cw15, [0, 1]);        // Mon-Tue: Ordering
  fillDays(7, 838, 7, cw15, [2, 3, 4]);     // Wed-Fri: Workshop Assembly

  // ISG1 Vladimir (15) — SCIVIC Software
  fillWeek(15, 664, 1, cw15);               // 11392.100 Conveyors, Software

  // ISG2 Maksim (16) — SCIVIC Stacker Software
  fillWeek(16, 665, 1, cw15);               // 11392.200 Stacker, Software

  // Guest Software (8) — no project yet
  fillWeek(8, null, null, cw15, "Awaiting project assignment");

  // ═══════ CW16 (Apr 13-17) ═══════

  // Anton — continues TX-210
  fillWeek(11, 965, 2, cw16);               // 11579.300 TX-210

  // Chris — continues conveyors
  fillWeek(9, 664, 1, cw16);

  // Houston — BL8 Update continues
  fillWeek(1, 968, 1, cw16);

  // Jonathan — still ROFA
  fillWeek(2, 481, 2, cw16);

  // Jonny — switches to stacker
  fillWeek(14, 665, 8, cw16);

  // Korey — monorail continues
  fillWeek(13, 982, 9, cw16);

  // Richard — Tesla programming
  fillWeek(3, 949, 1, cw16);

  // Saurin — B-45 continues
  fillWeek(4, 894, 2, cw16);

  // Taylor — pending assignment
  fillWeek(5, null, null, cw16, "TBD - pending project assignment from RS");

  // Terrance — still ROFA
  fillWeek(10, 481, 11, cw16);

  // Thomas — Tesla continues
  fillWeek(12, 959, 1, cw16);

  // Travis — Conti continues
  fillWeek(6, 973, 5, cw16);

  // Zach — travel then install
  insert.run(7, 838, 14, cw16[0], "Travel to site");
  fillDays(7, 838, 9, cw16, [1, 2, 3, 4]);  // Installation

  // ISG1 — continues
  fillWeek(15, 664, 1, cw16);

  // ISG2 — continues
  fillWeek(16, 665, 1, cw16);

  // Guest — still waiting
  fillWeek(8, null, null, cw16, "Awaiting project assignment - check with AB");
});

tx();

const count = (db.prepare("SELECT COUNT(*) as c FROM capacity_entries").get() as any).c;
console.log(`Done! Inserted ${count} capacity entries across CW15-16`);
db.close();
