# CLAUDE.md — SAR Engineering Tools

## Project Overview

**SAR Group Engineering Tools** — an internal web platform for SAR Automation LP engineers. Started as a monorail sizing calculator, now a growing mini-ERP covering engineering tools, capacity planning, project tracking, and inventory management.

### Active Modules

1. **EHB Railcut Power Section Sizing** — Physics simulation for monorail carrier current draw and fuse trip assessment
2. **Capacity Planner** — Weekly team allocation grid with night shift, holidays, export, changelog
3. **Projects** — Project list synced from QuickBooks Desktop (QB) with financial tracking
4. **Inventory** — Parts catalog with multi-location stock levels
5. **Book Stock** — Book-in/out transaction interface with project attribution

---

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite 7 + Tailwind CSS v3 + shadcn/ui
- **Backend**: Express 5 + Node.js
- **Database**: SQLite (better-sqlite3) + Drizzle ORM — synchronous transactions only
- **Charts**: Chart.js + react-chartjs-2, Recharts
- **Routing**: wouter with hash-based routing (`useHashLocation`)
- **State**: React Query (TanStack Query) for server state, React useState for local
- **Build**: Vite builds to `dist/public/`, esbuild for server

### Key Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (Express + Vite HMR on port 5000)
npm run build        # Production build → dist/
npm start            # Serve production build
npm run check        # TypeScript type check
```

---

## Architecture

### File Structure

```
client/src/
  pages/
    home.tsx                         # Tool launcher dashboard
    railcut-sizing.tsx               # Monorail sizing tool
    capacity-planner.tsx             # Capacity planner (filters, week nav, grid)
    project-list.tsx                 # QB project list with financials
    inventory.tsx                    # Parts inventory
    stock-booking.tsx                # Book-in/out interface
    not-found.tsx                    # 404
  components/
    layout/
      app-sidebar.tsx                # Collapsible sidebar navigation
      app-header.tsx                 # Page header
    tools/
      monorail/                      # 8 monorail tool components
      capacity/
        weekly-grid.tsx              # Core grid: project, activity, night shift, comment per cell
        week-selector.tsx            # Week navigation (<<, <, >, >>, Today, zoom)
        project-autocomplete.tsx     # Fuzzy search project picker
        team-member-dialog.tsx       # Add/edit team members
        changelog-panel.tsx          # Sheet panel with audit trail
        export-clipboard.tsx         # HTML table export for Outlook
    ui/                              # shadcn/ui primitives (DO NOT EDIT)
  hooks/
    use-capacity.ts                  # Capacity queries, mutations, types
    use-inventory.ts                 # Inventory queries, mutations
  lib/
    monorail-engine.ts               # Physics simulation engine (~560 lines)
    data/
      fuse-data.ts                   # Littelfuse KLKR030 Class CC 30A fuse curves
      drive-curves.ts                # SEW Movimot motor constants
    tools-registry.ts                # Tool definitions for sidebar/routing
    queryClient.ts                   # TanStack Query setup (staleTime: Infinity)
    utils.ts                         # cn() helper

server/
  index.ts                           # Express entry point
  db.ts                              # SQLite connection (WAL mode, foreign keys on)
  routes.ts                          # Route mount file
  routes/
    capacity.ts                      # Capacity CRUD + changelog + bulk upsert
    projects.ts                      # Project CRUD (QB fields)
    team-members.ts                  # Team member CRUD
    activities.ts                    # Activity types CRUD
    parts.ts                         # Parts catalog CRUD
    inventory.ts                     # Book-in/out transactions
    storage-locations.ts             # Warehouse location CRUD
  seed.ts                            # Initial seed: team members + activities
  seed-projects-qb.ts               # Import projects from QB Excel export
  seed-capacity-test.ts              # Test data for capacity planner
  migrate-projects.ts                # Add QB financial fields to projects
  migrate-changelog.ts               # Add capacity_changelog table

shared/
  schema.ts                          # Drizzle ORM schema (ALL tables defined here)
  holidays.ts                        # US + German holiday calculator (Easter-based)

data/
  sar-tools.db                       # SQLite database (gitignored)
```

### Path Aliases
- `@/` → `client/src/`
- `@shared/` → `shared/`
- `@assets/` → `attached_assets/`

Configured in `vite.config.ts` and `tsconfig.json`.

---

## Database Schema

All tables defined in `shared/schema.ts`. Key tables:

| Table | Purpose |
|-------|---------|
| team_members | Engineers + external contractors (name, role, company, isExternal) |
| projects | QB jobs (number, customer, balance, estimateTotal, jobStatus, dates) |
| activities | Work types (Commissioning, Software Prep, Installation, etc.) |
| capacity_entries | Daily assignments (member × date → project, activity, comment, nightShift) |
| capacity_changelog | Audit trail (action, field, oldValue, newValue, summary) |
| parts | Inventory parts (partNumber, name, category, cost in cents) |
| inventory_levels | Stock per part per location (qtyOnHand, reorderPoint) |
| stock_transactions | Immutable ledger (book_in/book_out/adjustment, qty, project) |
| storage_locations | Warehouse/shelf/bin hierarchy |
| purchase_orders + lines | PO tracking (schema ready, UI not built yet) |

### Financial values stored in cents (integer) to avoid float issues.

### Migrations

Run in order for a fresh DB:
```bash
npx tsx server/seed.ts                # Team members + activities
npx tsx server/migrate-projects.ts    # QB columns on projects table
npx tsx server/seed-projects-qb.ts    # Import 1014 projects from Excel
npx tsx server/migrate-changelog.ts   # Changelog table + indexes
```

---

## Capacity Planner Details

### Grid Architecture
- One row per team member, one column per day (Mon-Sun)
- Each cell contains: project autocomplete, project description, activity picker, comment (click-to-edit), night shift toggle (moon icon)
- Alternating row backgrounds for readability
- Sticky left column with member names + fill-week button

### Key Features
- **Fill Week**: Copy Monday's data to Tue-Fri (skip non-empty cells)
- **Night Shift**: Boolean per cell, indigo tint when active, moon icon toggle
- **Holidays**: US federal + German public holidays auto-calculated from year. Color-coded dots (blue=US, amber=DE, rose=both). Easter-based holidays use Gregorian algorithm.
- **Today Highlight**: Subtle blue tint on today's column
- **Changelog**: Field-level audit trail (project, activity, comment, nightShift changes with old→new values)
- **Export**: Generate HTML table, copy to clipboard, paste into Outlook
- **Unsaved Warning**: AlertDialog blocks week navigation if grid has dirty cells

### Custom Components (replaced Radix for performance)
- `ActivityPicker` — Lightweight dropdown (replaced 119 Radix Selects)
- `CommentCell` — Click-to-edit inline input
- `ProjectAutocomplete` — Fuzzy search with debounce

---

## Railcut Sizing Tool — Physics Model

### Carrier Motion
- Carriers on overhead monorail with pitch = carrier_length + gap
- Number in section = floor(railLength / pitch) — always derived
- Acceleration: distance = ½ × a × t², then constant speed

### Current Model (SEW Movimot)
- Running current = P / (√3 × V × PF)
- Peak (inrush) = 1.6 × running current (SEW Movimot 160% current limit)
- Ramp-down from peak to running takes same duration as accelTime

### Fuse Trip (Miner's Cumulative Damage)
- At each timestep: damage += dt / fuseTripTime(I)
- Trip when cumulative damage ≥ 1.0
- NOT simple peak comparison — sustained moderate overcurrent is detected

### Fuse Data: Littelfuse KLKR030 Class CC 30A
14 anchor points from datasheet. Log-log interpolation between. Beyond 520A: adiabatic I²t = 1720 A²s.

---

## Hard Rules

1. **EXIT-FIRST departure** in Scenario 2 — rightmost carrier leaves first
2. **Brush is FIXED** on carrier at configurable offset from front bumper
3. **Carriers-in-section is DERIVED** from floor(railLength / pitch)
4. **RAMP_DOWN_TIME = accelTime** — always equal
5. **Fuse data from datasheet ONLY** — no made-up interpolation
6. **Cumulative damage model required** — simple peak comparison is wrong
7. **All data sources must be verifiable** with clickable references
8. **Drives are SEW Movimot** — 160% current limit per Doc 21214190
9. **Financial values in cents** (integer) — no floats for money
10. **Projects: active-only search** in capacity planner autocomplete
11. **QB is the source of truth** for projects — source field tracks origin
12. **Dates: store YYYY-MM-DD, display MM/DD/YYYY** — US locale. All user-facing dates must be formatted MM/DD/YYYY. Database and API always use ISO YYYY-MM-DD internally.

---

## API Patterns

- All mutations return the created/updated record via `.returning()`
- Bulk upsert: entries with `id` → UPDATE, entries with `teamMemberId + date` → INSERT
- Changelog: logged server-side on every mutation, not client-side
- React Query: `staleTime: Infinity` by default, manual invalidation after mutations
- Query key format: `["/api/path", "?params"]` — joined with `/` by default queryFn

---

## Branding & UI

- Dark-only theme (HSL variables in index.css)
- SAR Group logo at `attached_assets/sar-group-logo.jpg`
- Engineering aesthetic — clean, data-dense
- shadcn/ui components in `client/src/components/ui/` — do not edit these directly

---

## Development Notes

- Hash routing required (`/#/tools/...`) for iframe compatibility
- SQLite in WAL mode for concurrent reads
- better-sqlite3 is synchronous — do NOT use `db.transaction()` with async/await
- The `.claude/launch.json` configures the dev server for Claude Code preview
- Database is gitignored — rebuild from seed scripts on fresh clone
