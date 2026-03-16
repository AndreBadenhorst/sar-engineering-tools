# CLAUDE.md — SAR Engineering Tools

## Project Overview

This is the **SAR Group Engineering Tools** web application — a browser-based suite of engineering calculators for monorail (EHB) power section design. Built for SAR Group engineers to simulate carrier current draw through monorail feed sections and verify fuse protection sizing.

Currently one tool is active: **EHB Railcut Power Section Sizing**.

### What it Does

The Railcut Sizing tool models a monorail system where overhead carriers (each driven by a SEW Movimot geared motor) travel along a conductor rail divided into power sections. Each section is protected by a fuse. The tool simulates the total current drawn from a single power section under two scenarios:

1. **Scenario 1 — Full Speed Flow**: Carriers stream continuously at constant speed through the section. Current oscillates as carriers enter/exit.
2. **Scenario 2 — Sequential Pull-Off**: All carriers start parked in the section and depart one-by-one, starting from the carrier closest to the EXIT. Each carrier follows 1 second after the previous one.

The tool evaluates whether the fuse will trip under each scenario using **Miner's cumulative damage rule** (not just peak current comparison).

---

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite 7 + Tailwind CSS v3 + shadcn/ui
- **Backend**: Express 5 (minimal — the app is client-side only, backend serves static files)
- **Charts**: Chart.js + react-chartjs-2, Recharts
- **Routing**: wouter with hash-based routing (`useHashLocation`)
- **Build**: Vite builds to `dist/public/`
- **No database** — all computation is client-side, no persistence needed

### Key Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (Express + Vite HMR on same port)
npm run build        # Production build → dist/public/
npm run start        # Serve production build
```

---

## Architecture

### File Structure

```
sar-tools/
├── client/
│   ├── index.html
│   └── src/
│       ├── App.tsx                         # Root: hash router, sidebar, dark mode
│       ├── main.tsx                        # Entry point
│       ├── index.css                       # Tailwind + custom dark theme (HSL vars)
│       ├── pages/
│       │   ├── home.tsx                    # Landing page with tool cards
│       │   ├── railcut-sizing.tsx          # Main tool page — wires params to engine
│       │   └── not-found.tsx
│       ├── components/
│       │   ├── layout/
│       │   │   ├── app-sidebar.tsx         # Navigation sidebar
│       │   │   └── app-header.tsx          # Page header
│       │   ├── tools/monorail/
│       │   │   ├── input-panel.tsx         # Parameter inputs (left panel)
│       │   │   ├── results-table.tsx       # Scenario results + fuse trip status
│       │   │   ├── time-current-chart.tsx  # I(t) waveform chart for both scenarios
│       │   │   ├── fuse-trip-chart.tsx     # Log-log fuse TCC overlay chart
│       │   │   ├── rail-animation.tsx      # Canvas-based carrier animation
│       │   │   ├── average-summary.tsx     # Running average comparison
│       │   │   ├── data-sources.tsx        # Engineering reference citations
│       │   │   └── export-button.tsx       # PNG export of results
│       │   ├── ui/                         # shadcn/ui primitives (DO NOT EDIT)
│       │   └── PerplexityAttribution.tsx
│       ├── lib/
│       │   ├── monorail-engine.ts          # ★ CORE: simulation engine
│       │   ├── data/
│       │   │   ├── fuse-data.ts            # ★ Littelfuse KLKR030 Class CC 30A fuse curves
│       │   │   └── drive-curves.ts         # SEW Movimot drive constants
│       │   ├── tools-registry.ts           # Tool definitions for sidebar/routing
│       │   ├── queryClient.ts              # TanStack Query setup
│       │   └── utils.ts                    # cn() helper
│       └── hooks/
│           ├── use-toast.ts
│           └── use-mobile.tsx
├── server/
│   ├── index.ts                            # Express server entry
│   ├── routes.ts                           # API routes (minimal)
│   ├── storage.ts                          # In-memory storage interface
│   ├── static.ts                           # Static file serving
│   └── vite.ts                             # Vite dev middleware
├── shared/
│   └── schema.ts                           # Drizzle schema (unused currently)
├── attached_assets/
│   └── sar-group-logo.jpg                  # SAR Group branding logo
├── package.json
├── vite.config.ts                          # Path aliases: @, @shared, @assets
├── tailwind.config.ts
├── tsconfig.json
└── CLAUDE.md                               # ← You are here
```

### Critical Files (Read These First)

1. **`client/src/lib/monorail-engine.ts`** — The simulation engine. Contains all physics: carrier motion, current models, scenario simulations, fuse trip evaluation, and canvas drawing. ~560 lines.
2. **`client/src/lib/data/fuse-data.ts`** — Littelfuse KLKR030 30A Class CC fuse data. Anchor points from the datasheet, log-log interpolation, I²t clearing, and Miner's damage model. ~250 lines.
3. **`client/src/lib/data/drive-curves.ts`** — SEW Movimot constants (1.6× inrush multiplier). ~47 lines.
4. **`client/src/pages/railcut-sizing.tsx`** — Main page that wires parameters to the engine and renders all sub-components.

---

## Physics & Engineering Model

### Carrier Motion

- Carriers are rectangular bodies on an overhead monorail rail
- **Pitch** = carrier length + gap between carriers
- **Number of carriers in a section** = floor(rail section length / pitch) — purely derived, never a user input
- During acceleration: distance = ½ × a × t² (constant acceleration)
- After acceleration: distance = accel_distance + speed × (t − accel_time)
- Acceleration = speed / acceleration_time (linear ramp)

### Brush (Current Collector) Model

- Each carrier has a **brush** (Vahle SA-KDS2/40 current collector) that picks up power from the conductor rail
- The brush is **FIXED** on the carrier body at a configurable offset from the front bumper
- **Default**: carrier_length − 500mm (brush is 500mm from the back of the carrier)
- A carrier draws current from whichever power section its **brush** is in — NOT whichever section its body is in
- This means a carrier can straddle a section boundary (body in one, brush in the next)
- The brush offset is a critical parameter — it changes which section supplies power during transitions

### Current Model (SEW Movimot)

- Running current = P / (√3 × V × PF)
- Peak (inrush) current during acceleration = 1.6 × running current (SEW Movimot 160% current limit)
- After acceleration completes, current ramps DOWN from peak to running over the **same duration** as the acceleration time (NOT instantaneous)
- This ramp-down time matching acceleration time is a deliberate design choice, not a bug

### Scenario 1: Full Speed Flow

- Infinite stream of carriers at pitch spacing, all moving at constant speed
- Count how many brushes are inside the section at each timestep
- Current = count × running_current (no peak current — all at steady state)
- Oscillates as carriers enter/exit, between floor(L/pitch) and floor(L/pitch)+1

### Scenario 2: Sequential Pull-Off (EXIT-FIRST)

- **EXIT-FIRST DEPARTURE ORDER IS MANDATORY**: The carrier closest to the exit (rightmost, index numCarriers−1) departs first at t=0. Each subsequent carrier behind it follows 1 second later. The leftmost carrier departs last.
- This is NOT first-in-first-out. It is specifically exit-first to model real-world monorail operation.
- During acceleration each carrier draws peak current (1.6× running)
- After acceleration, ramp-down from peak to running over accelTime_s seconds
- Carrier contributes to section current only while its brush is within [0, railLength_m]

### Fuse Trip Assessment

**The fuse model uses Miner's cumulative damage rule — NOT simple peak comparison.**

- At each simulation timestep: `damage += dt / fuseTripTime(I)`
- If current ≤ fuse rating → no damage (tripTime = Infinity)
- Trip occurs when cumulative damage ≥ 1.0
- No cooling modeled — damage only accumulates (conservative)
- If simulation (120s) ends before trip, extrapolate: projectedTripTime = simDuration / totalDamage

This is critical because:
- A sustained current slightly above rating will blow the fuse even if peak current looks fine
- Example: running at 35A continuously with a 30A fuse — the peak is only 35A but the fuse WILL blow because of cumulative thermal damage

### Fuse Data: Littelfuse KLKR030 Class CC 30A

**ONLY use data from the Littelfuse KLKR030 datasheet. No made-up interpolation.**

The tool uses 14 anchor points read directly from the KLKR series datasheet time-current curves:

| Current (A) | Melt Time (s) | Multiple of In |
|---|---|---|
| 30 | ∞ | 1.00× |
| 40 | 1000 | 1.33× |
| 50 | 80 | 1.67× |
| 60 | 35 | 2.00× |
| 70 | 15 | 2.33× |
| 78 | 10 | 2.60× |
| 90 | 5 | 3.00× |
| 100 | 2.5 | 3.33× |
| 130 | 1.0 | 4.33× |
| 150 | 0.5 | 5.00× |
| 200 | 0.15 | 6.67× |
| 250 | 0.1 | 8.33× |
| 300 | 0.05 | 10.0× |
| 400 | 0.03 | 13.3× |
| 520 | 0.01 | 17.3× |

- Between anchors: **log-log interpolation** (standard for fuse TCC charts)
- Beyond 520A: adiabatic region using published **clearing I²t = 1720 A²s**
- Cross-referenced against Mersen 107086 ATMR 30A curves

### Data Source URLs (MUST be verifiable by the engineer)

- Littelfuse KLKR030 product page: https://www.littelfuse.com/products/fuses-overcurrent-protection/fuses/ul-class-fuses/class-cc-fuses/klkr/klkr030
- Littelfuse KLKR datasheet PDF: https://www.littelfuse.com/assetdocs/klkr-classcc-fuse-datasheet-final?assetguid=4443e5f6-97ee-4206-9abe-9e155371a03e
- Mersen 107086 PDF: https://www.mersen.com/sites/default/files/medias/PIM/files/107086.pdf
- SEW Movimot operating instructions (Doc 21214190): https://download.sew-eurodrive.com/download/pdf/21214190.pdf
- SEW Movimot compact instructions (Doc 21326592): https://download.sew-eurodrive.com/download/pdf/21326592.pdf

### UL 248-1 Table 4 Requirements

- 0–30A fuses must clear within 60 min at 1.35×In
- 0–30A fuses must clear within 4 min at 2.0×In

---

## Default Parameters

```typescript
const DEFAULT_PARAMS: MonorailParams = {
  voltage: 480,           // V (3-phase)
  power_kW: 2.2,          // kW per carrier
  carrierLength_mm: 2519, // mm
  gap_mm: 500,            // mm between carriers
  speed_ms: 2.0,          // m/s
  accelTime_s: 6,         // seconds
  powerFactor: 0.90,
  railLength_m: 32,       // metres
  fuseRating_A: 30,       // Amps (Class CC KLKR030)
  brushOffset_mm: 2019,   // carrierLength - 500 = 2519 - 500
  totalSystemCarriers: 40, // across full system
};
```

---

## UI Components

### Input Panel (`input-panel.tsx`)
Left sidebar with all parameters. Fuse rating is a dropdown with a single option (30A Class CC KLKR030). Derived values shown below inputs (pitch, carriers in section, running current, peak current, brush offset, total system current).

### Results Table (`results-table.tsx`)
Shows per-scenario: peak current, average current, fuse trip status (SAFE/WARNING/TRIP), trip time, accumulated damage, projected trip time. References KLKR030 in the fuse column.

### Time-Current Chart (`time-current-chart.tsx`)
Chart.js line chart showing I(t) waveform for both scenarios over the 120s simulation. Shows running average overlaid.

### Fuse Trip Chart (`fuse-trip-chart.tsx`)
Log-log fuse TCC (time-current characteristic) chart with the KLKR030 curve and scenario operating points plotted. Label reads "CC 30A (KLKR030)".

### Average Summary (`average-summary.tsx`)
Shows running average analysis — average current vs fuse rating, damage rate interpretation.

### Rail Animation (`rail-animation.tsx`)
Canvas-based real-time animation of carriers moving through the section. Carrier colours: red=accelerating, blue=running, grey=stopped. Yellow triangle marker shows brush position. Carriers dim when brush is outside the section.

### Export Button (`export-button.tsx`)
PNG export of results area using html2canvas.

### Data Sources (`data-sources.tsx`)
Engineering references section at bottom of page. All data sources with clickable links to original documents. **Every data point must be traceable to its source.**

---

## Hard Rules (From the Client)

These are non-negotiable requirements from the project owner:

1. **EXIT-FIRST departure in Scenario 2**: The rightmost carrier (closest to exit) always leaves first. This is NOT negotiable.

2. **Brush is FIXED on the carrier**: The brush does not move relative to the carrier body. It is mounted at a fixed offset from the front bumper. Never animate or move the brush independently.

3. **Carriers-in-section is DERIVED**: `numCarriers = floor(railLength / pitch)`. This is never a user input — it would be redundant given rail section length.

4. **RAMP_DOWN_TIME must match accelTime**: After acceleration, current ramps down from peak to running over the same duration as the acceleration time. These must always be equal.

5. **Fuse curve data must come ONLY from the datasheet**: No made-up interpolation points. Only the anchor values read from the Littelfuse KLKR030 time-current curves. The IEC gate values from the previous gG fuse implementation were removed.

6. **Cumulative damage model is required**: Simple peak-current comparison is wrong. The Miner's rule damage accumulation catches cases where sustained moderate overcurrent blows the fuse even though peak looks acceptable. If running at 35A with tiny peaks to 40A, it must still detect the 35A will blow a 30A fuse over time.

7. **All data sources must be verifiable**: Every engineering data point must link to its source document. The engineer must be able to click through and verify. Trip curve sources, drive data, fuse specifications — all must have clickable references.

8. **Do not change the app without discussing findings first**: Any proposed change to fuse data, physics model, or engineering logic must be presented and approved before implementation.

9. **Drives are SEW Movimot**: Always reference drives as "SEW Movimot" with the correct model data. 160% current limit per Doc 21214190.

---

## Simulation Constants

```typescript
const SIM_DURATION = 120;  // seconds — total simulation window
const TIME_STEP = 0.25;    // seconds — simulation timestep
const INRUSH_MULTIPLIER = 1.6;  // SEW Movimot 160% current limit
const CLEARING_I2T = 1720;      // A²s — published by Littelfuse
```

---

## Branding

- Logo: SAR Group logo at `attached_assets/sar-group-logo.jpg`
- Dark theme by default (forced via `document.documentElement.classList.add('dark')`)
- Colour palette: dark slate/navy backgrounds, teal accents
- The tool was previously called "Monorail Power Section Sizing Tool" — renamed to "EHB Railcut Power Section Sizing" per client

---

## Future Tools (Planned)

The `tools-registry.ts` has a placeholder for a Cable Sizing Calculator. The sidebar and routing are designed to support multiple tools — each gets a card on the home page and a route at `/tools/{tool-id}`.

---

## Development Notes

### Path Aliases
- `@/` → `client/src/`
- `@shared/` → `shared/`
- `@assets/` → `attached_assets/`

Configured in both `vite.config.ts` and `tsconfig.json`.

### Hash Routing
The app uses `useHashLocation` from wouter. Routes are `/#/`, `/#/tools/railcut-sizing`, etc. This is required for deployment in sandboxed iframes.

### No localStorage/sessionStorage
The sandboxed iframe environment blocks localStorage. All state is React state. No persistence needed.

### Build Output
`npm run build` produces `dist/public/` with static HTML/JS/CSS. No server needed for deployment — can be served from any static host.

### Standalone Package
There is a `build-standalone.py` script in the workspace root that packages the built output with an `index.html` for standalone distribution.
