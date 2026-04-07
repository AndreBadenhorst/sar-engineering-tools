# SAR Engineering Tools

Internal engineering platform for **SAR Automation LP** — a browser-based suite of tools for monorail power section design, team capacity planning, project tracking, and inventory management.

## Quick Start

```bash
npm install
npm run dev          # Start dev server on http://localhost:5000
npm run build        # Production build → dist/
npm start            # Run production server
```

## Modules

| Module | Route | Description |
|--------|-------|-------------|
| **Railcut Sizing** | `/#/tools/railcut-sizing` | EHB monorail power section sizing with physics simulation |
| **Capacity Planner** | `/#/tools/capacity-planner` | Weekly team allocation grid with night shift, holidays, changelog |
| **Projects** | `/#/tools/projects` | Project list synced from QuickBooks Desktop |
| **Inventory** | `/#/tools/inventory` | Parts catalog with stock levels and locations |
| **Book Stock** | `/#/tools/book-stock` | Book-in / book-out stock transactions |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite 7 |
| Styling | Tailwind CSS 3, shadcn/ui (dark theme) |
| Backend | Express 5, Node.js |
| Database | SQLite (better-sqlite3) + Drizzle ORM |
| Routing | wouter (hash-based) |
| Charts | Chart.js, Recharts |

## Project Structure

```
client/src/
  pages/                    # Route-level page components
  components/
    layout/                 # Sidebar, header
    tools/
      monorail/             # Railcut sizing tool components
      capacity/             # Capacity planner components
    ui/                     # shadcn/ui primitives (do not edit)
  hooks/                    # React Query hooks
  lib/
    monorail-engine.ts      # Physics simulation engine
    data/                   # Fuse curves, drive constants

server/
  index.ts                  # Express entry point
  db.ts                     # SQLite connection
  routes/                   # REST API endpoints
  seed.ts                   # Initial data seed
  migrate-*.ts              # Schema migrations

shared/
  schema.ts                 # Drizzle ORM schema (all tables)
  holidays.ts               # US + German holiday calculator

data/
  sar-tools.db              # SQLite database (gitignored)
```

## Database

SQLite database stored at `data/sar-tools.db`. Tables:

- **team_members** — Engineers and external contractors
- **projects** — Jobs from QuickBooks (number, balance, estimate, status)
- **activities** — Work activity types (Commissioning, Software Prep, etc.)
- **capacity_entries** — Daily assignments per team member (project, activity, night shift)
- **capacity_changelog** — Audit trail of all capacity changes
- **parts** — Inventory parts catalog
- **inventory_levels** — Stock quantities per location
- **stock_transactions** — Immutable book-in/out ledger
- **storage_locations** — Warehouse/shelf/bin locations
- **purchase_orders** / **purchase_order_lines** — PO tracking (schema ready)

### Migrations

```bash
npx tsx server/seed.ts                # Seed team members + activities
npx tsx server/seed-projects-qb.ts    # Import projects from QB Excel
npx tsx server/migrate-projects.ts    # Add QB fields to projects table
npx tsx server/migrate-changelog.ts   # Add changelog table
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/capacity?week=YYYY-MM-DD` | Week's entries + team members |
| PUT | `/api/capacity/bulk` | Upsert multiple entries |
| GET | `/api/capacity/changelog` | Audit log with pagination |
| GET | `/api/projects` | All projects (filterable) |
| POST/PUT | `/api/projects` | Create/update projects |
| GET | `/api/team-members` | Active team members |
| GET | `/api/activities` | Activity types |
| GET | `/api/parts` | Parts catalog |
| POST | `/api/inventory/book-in` | Book stock in |
| POST | `/api/inventory/book-out` | Book stock out |
| GET | `/api/storage-locations` | Warehouse locations |

## Key Features

### Railcut Sizing Tool
- Physics simulation of monorail carrier current draw
- SEW Movimot motor model with 1.6x inrush multiplier
- Fuse trip assessment via Miner's cumulative damage rule
- Two scenarios: Full Speed Flow and Sequential Pull-Off
- Interactive charts and PDF-ready results

### Capacity Planner
- Weekly grid view (1, 2, or 4 week zoom)
- Project autocomplete from QB database
- Night shift toggle per cell (moon icon)
- Fill Week: copy Monday to Tue-Fri in one click
- US + German holiday indicators (color-coded by country)
- Today column highlighting
- Unsaved changes warning on navigation
- Full changelog (audit trail of every edit)
- Export to clipboard (HTML table for Outlook paste)

### Inventory
- Parts catalog with QB sync structure
- Multi-location stock tracking
- Book-in/out with project cost attribution
- Transaction audit log

## Environment

- **Node.js** 18+ required
- **Platform**: Windows (SAR office), runs on any OS
- **Port**: 5000 (configurable)
- No external services required — fully self-contained

## Backup & Version Control

This project uses Git with GitHub as the remote:

```bash
git add -A
git commit -m "Description of changes"
git push origin master
```

See [BACKUP.md](BACKUP.md) for detailed backup procedures.
