# SAR Engineering Tools — Architecture

## Overview

Multi-module engineering platform for SAR Automation LP. Full-stack: React + Express + SQLite.
Dark-only theme. Hash-based routing for iframe compatibility.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Railcut  │  │ Capacity │  │ Projects │  │Inventory │   │
│  │ Sizing   │  │ Planner  │  │   List   │  │  Module  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │              │              │              │         │
│  ┌────┴──────────────┴──────────────┴──────────────┴─────┐  │
│  │              React + TanStack Query                    │  │
│  └───────────────────────┬───────────────────────────────┘  │
└──────────────────────────┼──────────────────────────────────┘
                           │ HTTP (REST)
┌──────────────────────────┼──────────────────────────────────┐
│                     Express 5                                │
│  ┌────────────┐  ┌──────┴──────┐  ┌────────────────────┐   │
│  │   Vite     │  │  API Routes │  │  Static Files      │   │
│  │ (dev HMR)  │  │  /api/*     │  │  dist/public/      │   │
│  └────────────┘  └──────┬──────┘  └────────────────────┘   │
└──────────────────────────┼──────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────┐
│  SQLite (better-sqlite3) │  WAL mode, foreign keys on       │
│  ┌───────────┐ ┌────────┴──────┐ ┌──────────────────────┐  │
│  │ Projects  │ │   Capacity    │ │    Inventory         │  │
│  │ (QB sync) │ │ Entries+Log   │ │ Parts+Stock+Txns     │  │
│  └───────────┘ └───────────────┘ └──────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Module Breakdown

### 1. Railcut Sizing (client-only)
Pure client-side physics simulation. No API calls.
- `monorail-engine.ts` — Simulation core (motion, current, fuse damage)
- `fuse-data.ts` — Littelfuse KLKR030 curve data
- `drive-curves.ts` — SEW Movimot constants
- 8 React components for input, results, charts, animation

### 2. Capacity Planner (full-stack)
Weekly team allocation grid.
- `weekly-grid.tsx` — Core grid component (project, activity, night shift, comment per cell)
- `week-selector.tsx` — Navigation with zoom (1/2/4 weeks)
- `holidays.ts` — US + German holiday calculator (shared module)
- `capacity.ts` (server) — CRUD + bulk upsert + changelog
- Changelog tracks field-level diffs with old→new values

### 3. Projects (full-stack)
QB Desktop mirror.
- 1014 projects imported from Excel export
- Financial fields: balance, estimateTotal (cents)
- Job metadata: status, type, dates, rep, customerType
- Source tracking: qb_sync vs manual

### 4. Inventory (full-stack)
Parts catalog + stock management.
- Parts, storage locations, inventory levels
- Book-in/out transactions with project attribution
- Immutable transaction audit log

## Data Flow

```
QB Desktop → Excel Export → seed-projects-qb.ts → SQLite
                                                      ↕
Browser UI ← React Query ← Express API ← Drizzle ORM ←→ SQLite
```

## Key Design Decisions

1. **SQLite over PostgreSQL** — Single-user office tool, no cloud needed
2. **Drizzle ORM** — Type-safe, schema-first, works with better-sqlite3
3. **better-sqlite3 (synchronous)** — No async transaction issues
4. **shadcn/ui** — Consistent UI, dark theme, accessible
5. **Hash routing** — Required for iframe deployment
6. **Cents for money** — Integer arithmetic avoids float precision bugs
7. **Custom dropdowns over Radix Select** — Performance with 100+ instances
8. **Server-side changelog** — Audit trail can't be bypassed by client
9. **Holiday calculator over DB table** — Holidays are deterministic, no admin needed
10. **staleTime: Infinity** — Manual invalidation after mutations, no polling

## Routing

```
/#/                          → Home (tool launcher)
/#/tools/railcut-sizing      → EHB Monorail Sizing
/#/tools/capacity-planner    → Capacity Planner
/#/tools/projects            → Project List
/#/tools/inventory           → Inventory
/#/tools/book-stock          → Stock Booking
```

## API Routes

All mounted under `/api/`:

| Route File | Prefix | Tables |
|------------|--------|--------|
| capacity.ts | /api/capacity | capacity_entries, capacity_changelog |
| projects.ts | /api/projects | projects |
| team-members.ts | /api/team-members | team_members |
| activities.ts | /api/activities | activities |
| parts.ts | /api/parts | parts |
| inventory.ts | /api/inventory | inventory_levels, stock_transactions |
| storage-locations.ts | /api/storage-locations | storage_locations |
