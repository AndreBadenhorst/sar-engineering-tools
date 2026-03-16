# SAR Engineering Tools — Architecture

## Overview
Multi-tool engineering platform for SAR Automation LP. React + Vite + Tailwind + shadcn/ui.
Dark-only theme (engineering aesthetic). No backend needed — all calculations run client-side.

## Project Structure
```
client/src/
  pages/
    home.tsx              — Tool launcher / dashboard
    monorail-sizing.tsx   — EHB Monorail Power Section Sizing Tool
    not-found.tsx         — 404 page
  components/
    layout/
      app-sidebar.tsx     — Collapsible sidebar with tool navigation
      app-header.tsx      — Top bar with page title
    tools/
      monorail/           — All monorail tool components
  lib/
    data/
      fuse-data.ts        — IEC 60269-2 gG fuse gate values (shared)
      drive-curves.ts     — Siemens SINAMICS drive current profiles (shared)
    tools-registry.ts     — Registry of all available tools (id, name, icon, path, description)
```

## Key Design Decisions
1. **Dark-only theme** — no light mode toggle needed. The CSS vars in index.css are already dark.
2. **Client-side only** — backend routes can be minimal/empty. All calculations in JS.
3. **Sidebar navigation** — collapsible sidebar listing all tools, with icons.
4. **Shared data modules** — fuse data, drive curves, etc. live in lib/data/ and are imported by any tool that needs them.
5. **Tool registry pattern** — each tool registers itself in tools-registry.ts with metadata. The home page and sidebar read from this registry.

## Routing (hash-based)
- `/#/` — Home / tool launcher
- `/#/tools/monorail-sizing` — EHB Monorail tool
- Future tools get added as `/#/tools/<tool-id>`

## Home Page Design
Grid of tool cards. Each card shows: icon, tool name, short description, "Open" button.
Clean and minimal — the home page is a launchpad, not a dashboard.
