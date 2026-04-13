import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Database,
  Server,
  Monitor,
  HardDrive,
  Network,
  FileText,
  FolderTree,
  Table2,
  Workflow,
  Shield,
  BookOpen,
} from "lucide-react";

// ── Schema reference data ───────────────────────────────────
const TABLES: TableDef[] = [
  {
    name: "team_members",
    module: "Core",
    desc: "All personnel — SAR employees and external subcontractors.",
    columns: [
      ["id", "PK", "Auto-increment"],
      ["name", "TEXT NOT NULL", "Full name"],
      ["email", "TEXT", "Email address"],
      ["role", "TEXT", "Job title"],
      ["job_function", "TEXT", "Controls Engineer, Technician, etc."],
      ["department", "TEXT", "Department"],
      ["source", "TEXT", "manual | exchange"],
      ["is_external", "BOOL", "Subcontractor flag"],
      ["company", "TEXT", "Company (for externals)"],
      ["active", "BOOL", "Soft-delete flag"],
    ],
  },
  {
    name: "projects",
    module: "Core",
    desc: "Projects synced from QuickBooks Desktop. Financial fields stored in cents.",
    columns: [
      ["id", "PK", "Auto-increment"],
      ["number", "TEXT NOT NULL", "Project number (e.g. SC-2024-001)"],
      ["customer", "TEXT", "Customer name"],
      ["description", "TEXT", "QB Job Description"],
      ["po_number", "TEXT", "Purchase order reference"],
      ["balance", "INT", "Outstanding balance (cents)"],
      ["estimate_total", "INT", "Contract value (cents)"],
      ["job_status", "TEXT", "In progress | Finished | Cancelled"],
      ["job_type", "TEXT", "Open | Closed"],
      ["start_date", "TEXT", "YYYY-MM-DD"],
      ["projected_end", "TEXT", "YYYY-MM-DD"],
      ["source", "TEXT", "qb_sync | manual | sales_list | gmbh_gun"],
    ],
  },
  {
    name: "activities",
    module: "Capacity",
    desc: "Work activity types (e.g. Assembly, Commissioning, Travel).",
    columns: [
      ["id", "PK", "Auto-increment"],
      ["name", "TEXT NOT NULL UNIQUE", "Activity name"],
      ["sort_order", "INT", "Display order"],
    ],
  },
  {
    name: "holidays",
    module: "Capacity",
    desc: "US Federal, German, and company holidays. Highlighted on the capacity grid.",
    columns: [
      ["id", "PK", "Auto-increment"],
      ["date", "TEXT NOT NULL", "YYYY-MM-DD"],
      ["name", "TEXT NOT NULL", "English name"],
      ["name_local", "TEXT", "Local name (German)"],
      ["category", "TEXT", "us_federal | german | company"],
      ["active", "BOOL", "Toggle on/off"],
    ],
  },
  {
    name: "locations",
    module: "Capacity",
    desc: "Work locations (job sites, offices). Not warehouse storage locations.",
    columns: [
      ["id", "PK", "Auto-increment"],
      ["name", "TEXT NOT NULL UNIQUE", "e.g. Dallas TX, SAR Office"],
      ["short_code", "TEXT", "Abbreviation (DAL, HQ)"],
      ["active", "BOOL", "Soft-delete flag"],
    ],
  },
  {
    name: "capacity_entries",
    module: "Capacity",
    desc: "One row per person per day. Links to project, activity, and location.",
    columns: [
      ["id", "PK", "Auto-increment"],
      ["team_member_id", "FK", "-> team_members.id (CASCADE)"],
      ["project_id", "FK", "-> projects.id (SET NULL)"],
      ["activity_id", "FK", "-> activities.id (SET NULL)"],
      ["location_id", "FK", "-> locations.id (SET NULL)"],
      ["date", "TEXT NOT NULL", "YYYY-MM-DD"],
      ["comment", "TEXT", "Free-text note"],
      ["night_shift", "BOOL", "Night shift flag"],
    ],
  },
  {
    name: "capacity_changelog",
    module: "Capacity",
    desc: "Immutable audit trail for all capacity changes.",
    columns: [
      ["id", "PK", "Auto-increment"],
      ["entry_id", "INT", "capacity_entries.id (null if deleted)"],
      ["team_member_id", "INT", "Who was affected"],
      ["date", "TEXT", "Which date was affected"],
      ["action", "TEXT", "create | update | delete"],
      ["field", "TEXT", "Which field changed"],
      ["old_value / new_value", "TEXT", "Before/after values"],
      ["summary", "TEXT", "Human-readable description"],
    ],
  },
  {
    name: "parts",
    module: "Inventory",
    desc: "Master parts catalog. Part numbers follow SAR convention: PREFIX.mfr-part (e.g. SIE.7KM3220-0BA01-1DA0).",
    columns: [
      ["id", "PK", "Auto-increment"],
      ["part_number", "TEXT NOT NULL UNIQUE", "SAR part number"],
      ["name", "TEXT NOT NULL", "Short description"],
      ["description", "TEXT", "Extended description"],
      ["category", "TEXT", "Electrical, Mechanical, Cable, Fastener, etc."],
      ["unit_of_measure", "TEXT", "EA, $/m, /m, BOX"],
      ["manufacturer", "TEXT", "Manufacturer name"],
      ["manufacturer_part_number", "TEXT", "Raw mfr part without prefix"],
      ["manufacturer_url", "TEXT", "Link to manufacturer product page"],
      ["preferred_vendor", "TEXT", "Supplier name"],
      ["supplier_part_number", "TEXT", "Vendor's own part number"],
      ["ean", "TEXT", "EAN / barcode"],
      ["part_type", "TEXT", "purchased | manufactured | sub_assembly | raw_material | service | consumable"],
      ["cost / last_cost / average_cost", "INT", "Pricing in cents"],
      ["lead_time_days", "INT", "Purchasing lead time"],
      ["moq", "INT", "Minimum order quantity"],
      ["country_of_origin", "TEXT", "ISO country code (DE, US, CN)"],
      ["hs_code", "TEXT", "International HS tariff code (6-digit)"],
      ["hts_code_us", "TEXT", "US Harmonized Tariff Schedule code"],
      ["ht_code_eu", "TEXT", "EU Combined Nomenclature tariff code"],
      ["datasheet_url", "TEXT", "Link to spec/datasheet PDF"],
      ["source", "TEXT", "manual | calc_sheet | qb_sync"],
    ],
  },
  {
    name: "part_prices",
    module: "Inventory",
    desc: "Customer-specific pricing. Unique constraint on (part_id, customer_name).",
    columns: [
      ["id", "PK", "Auto-increment"],
      ["part_id", "FK", "-> parts.id (CASCADE)"],
      ["customer_name", "TEXT NOT NULL", "e.g. BMW, GM, Default"],
      ["price", "INT", "Price in cents"],
    ],
  },
  {
    name: "storage_locations",
    module: "Inventory",
    desc: "Warehouse shelf/bin structure. Label format: Warehouse / Shelf / Bin.",
    columns: [
      ["id", "PK", "Auto-increment"],
      ["warehouse", "TEXT NOT NULL", "e.g. Main, SAR-DE"],
      ["shelf", "TEXT", "e.g. A1, B3"],
      ["bin", "TEXT", "e.g. 01, 12"],
      ["label", "TEXT", "Display alias"],
    ],
  },
  {
    name: "inventory_levels",
    module: "Inventory",
    desc: "Current stock per part per location. project_id NULL = free stock.",
    columns: [
      ["id", "PK", "Auto-increment"],
      ["part_id", "FK", "-> parts.id (CASCADE)"],
      ["location_id", "FK", "-> storage_locations.id (CASCADE)"],
      ["project_id", "FK", "-> projects.id (SET NULL) — null = free stock"],
      ["qty_on_hand", "INT NOT NULL", "Current quantity"],
      ["reorder_point", "INT", "Low-stock threshold"],
    ],
  },
  {
    name: "stock_transactions",
    module: "Inventory",
    desc: "Immutable audit log for all stock movements. Every movement ties to a project for cost tracking.",
    columns: [
      ["id", "PK", "Auto-increment"],
      ["part_id", "FK", "-> parts.id (CASCADE)"],
      ["location_id", "FK", "-> storage_locations.id (CASCADE)"],
      ["type", "TEXT", "book_in | book_out | adjustment | transfer"],
      ["qty", "INT NOT NULL", "Positive = in, negative = out"],
      ["reason", "TEXT", "project use, received from vendor, cycle count"],
      ["project_id", "FK", "Target project"],
      ["performed_by", "FK", "-> team_members.id"],
      ["qty_after", "INT", "Snapshot after transaction"],
      ["delivery_note", "TEXT", "Lieferschein reference"],
      ["po_line_id", "FK", "-> purchase_order_lines.id"],
    ],
  },
  {
    name: "purchase_orders",
    module: "Purchasing",
    desc: "Purchase orders. Status flow: draft -> submitted -> confirmed -> partial -> received -> cancelled.",
    columns: [
      ["id", "PK", "Auto-increment"],
      ["po_number", "TEXT", "PO reference number"],
      ["vendor", "TEXT", "Supplier name"],
      ["status", "TEXT", "draft | submitted | confirmed | partial | received | cancelled"],
      ["project_id", "FK", "-> projects.id"],
      ["total_cost", "INT", "Sum of line costs (cents)"],
      ["expected_delivery", "TEXT", "YYYY-MM-DD"],
    ],
  },
  {
    name: "purchase_order_lines",
    module: "Purchasing",
    desc: "Individual line items on a PO. Tracks ordered vs. confirmed vs. received quantities.",
    columns: [
      ["id", "PK", "Auto-increment"],
      ["purchase_order_id", "FK", "-> purchase_orders.id (CASCADE)"],
      ["part_id", "FK", "-> parts.id (CASCADE)"],
      ["qty_ordered", "INT NOT NULL", "Quantity ordered"],
      ["qty_confirmed", "INT", "Vendor-confirmed quantity"],
      ["qty_received", "INT", "Quantity received so far"],
      ["unit_cost", "INT", "Unit cost in cents"],
    ],
  },
];

const API_ROUTES = [
  { method: "GET", path: "/api/capacity", desc: "Weekly capacity grid data" },
  { method: "PUT", path: "/api/capacity", desc: "Upsert capacity entry (with changelog)" },
  { method: "DELETE", path: "/api/capacity", desc: "Delete capacity entry (with changelog)" },
  { method: "GET", path: "/api/capacity/changelog", desc: "Audit trail for capacity changes" },
  { method: "GET/POST/PUT/DELETE", path: "/api/team-members", desc: "CRUD for personnel" },
  { method: "GET/POST/PUT/DELETE", path: "/api/projects", desc: "CRUD for projects" },
  { method: "GET/POST/PUT/DELETE", path: "/api/activities", desc: "CRUD for activity types" },
  { method: "GET/POST/PUT/DELETE", path: "/api/locations", desc: "CRUD for work locations" },
  { method: "GET/POST/PUT", path: "/api/holidays", desc: "CRUD for holidays" },
  { method: "GET/POST/PUT/DELETE", path: "/api/parts", desc: "CRUD for parts catalog" },
  { method: "GET", path: "/api/parts/search", desc: "Fuzzy search parts by keyword" },
  { method: "PUT", path: "/api/parts/:id/prices", desc: "Upsert customer-specific pricing" },
  { method: "GET", path: "/api/inventory", desc: "Stock levels with part + location data" },
  { method: "GET", path: "/api/inventory/by-location/:id", desc: "Parts at a specific location" },
  { method: "POST", path: "/api/inventory/adjust", desc: "Book stock in/out (upsert + transaction log)" },
  { method: "GET/POST/PUT/DELETE", path: "/api/storage-locations", desc: "CRUD for warehouse bins" },
];

const FOLDER_STRUCTURE = `
sar-engineering-tools/
  client/
    src/
      components/       # Reusable UI components
        layout/         # Sidebar, header, footer
        tools/          # Tool-specific components
          capacity/     # Capacity grid, export, modals
          monorail/     # Railcut sizing components
        ui/             # shadcn/ui primitives
      hooks/            # TanStack Query hooks
      lib/              # Utilities, query client, tools registry
      pages/            # Route-level page components
    index.html          # SPA entry point
  server/
    routes/             # Express route handlers
    index.ts            # Server entry — Express + Vite middleware
    db.ts               # Drizzle ORM database connection
    seed.ts             # Data import scripts
  shared/
    schema.ts           # Drizzle ORM table definitions (single source of truth)
  data/
    sar-tools.db        # SQLite database file (WAL mode)
  drizzle.config.ts     # Drizzle Kit configuration
`.trim();

// ── Types ───────────────────────────────────────────────────
interface TableDef {
  name: string;
  module: string;
  desc: string;
  columns: [string, string, string][];
}

// ── Page Component ──────────────────────────────────────────
export default function Documentation() {
  const modules = [...new Set(TABLES.map((t) => t.module))];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Documentation</h2>
        <p className="text-muted-foreground mt-1">
          Technical reference for SAR Engineering Tools
        </p>
      </div>

      {/* Table of Contents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5" /> Contents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <a href="#overview" className="text-primary hover:underline">1. System Overview</a>
            <a href="#folder-structure" className="text-primary hover:underline">2. Folder Structure</a>
            <a href="#schema" className="text-primary hover:underline">3. Database Schema (14 tables)</a>
            <a href="#api" className="text-primary hover:underline">4. API Endpoints</a>
            <a href="#deployment" className="text-primary hover:underline">5. Deployment &amp; Backup</a>
            <a href="#conventions" className="text-primary hover:underline">6. Conventions &amp; Rules</a>
          </div>
        </CardContent>
      </Card>

      {/* 1. System Overview */}
      <Card id="overview">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Network className="h-5 w-5" /> 1. System Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            SAR Engineering Tools is an internal intranet application built for SAR Automation LP.
            It consolidates capacity planning, project tracking, parts catalog, inventory management,
            and engineering calculation tools into a single platform.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <InfoBox icon={<Monitor className="h-4 w-4" />} title="Frontend" items={[
              "React 18 + TypeScript",
              "Vite 7 (dev + build)",
              "Tailwind CSS 3 + shadcn/ui",
              "wouter (hash routing)",
              "TanStack Query 5",
            ]} />
            <InfoBox icon={<Server className="h-4 w-4" />} title="Backend" items={[
              "Express 5 (Node.js)",
              "Drizzle ORM (type-safe SQL)",
              "better-sqlite3 (sync driver)",
              "REST API (JSON)",
            ]} />
            <InfoBox icon={<Database className="h-4 w-4" />} title="Database" items={[
              "SQLite (single file)",
              "WAL mode (concurrent reads)",
              "14 tables across 4 modules",
              "File: data/sar-tools.db",
            ]} />
          </div>
        </CardContent>
      </Card>

      {/* 2. Folder Structure */}
      <Card id="folder-structure">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FolderTree className="h-5 w-5" /> 2. Folder Structure
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs font-mono bg-muted/30 rounded-lg p-4 overflow-auto whitespace-pre leading-relaxed">
            {FOLDER_STRUCTURE}
          </pre>
        </CardContent>
      </Card>

      {/* 3. Database Schema */}
      <Card id="schema">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Table2 className="h-5 w-5" /> 3. Database Schema
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            All tables defined in <code className="text-xs bg-muted px-1 py-0.5 rounded">shared/schema.ts</code> using Drizzle ORM.
            The database file is <code className="text-xs bg-muted px-1 py-0.5 rounded">data/sar-tools.db</code>.
          </p>

          {modules.map((mod) => (
            <div key={mod} className="space-y-4">
              <h3 className="text-sm font-bold text-primary border-b pb-1">{mod} Module</h3>
              {TABLES.filter((t) => t.module === mod).map((table) => (
                <div key={table.name} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-bold bg-muted px-1.5 py-0.5 rounded font-mono">{table.name}</code>
                    <span className="text-xs text-muted-foreground">{table.desc}</span>
                  </div>
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="text-left px-2 py-1 font-medium">Column</th>
                          <th className="text-left px-2 py-1 font-medium">Type</th>
                          <th className="text-left px-2 py-1 font-medium">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {table.columns.map(([col, type, desc], i) => (
                          <tr key={col} className={i % 2 === 1 ? "bg-muted/20" : ""}>
                            <td className="px-2 py-1 font-mono">{col}</td>
                            <td className="px-2 py-1 text-muted-foreground">{type}</td>
                            <td className="px-2 py-1 text-muted-foreground">{desc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 4. API Endpoints */}
      <Card id="api">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Workflow className="h-5 w-5" /> 4. API Endpoints
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            All endpoints return JSON. Base URL: <code className="text-xs bg-muted px-1 py-0.5 rounded">http://&lt;server&gt;:5000</code>
          </p>
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-2 py-1.5 font-medium">Method(s)</th>
                  <th className="text-left px-2 py-1.5 font-medium">Path</th>
                  <th className="text-left px-2 py-1.5 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {API_ROUTES.map((r, i) => (
                  <tr key={r.path + r.method} className={i % 2 === 1 ? "bg-muted/20" : ""}>
                    <td className="px-2 py-1 font-mono text-primary">{r.method}</td>
                    <td className="px-2 py-1 font-mono">{r.path}</td>
                    <td className="px-2 py-1 text-muted-foreground">{r.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 5. Deployment & Backup */}
      <Card id="deployment">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <HardDrive className="h-5 w-5" /> 5. Deployment &amp; Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h4 className="font-semibold mb-1">Development</h4>
            <pre className="text-xs font-mono bg-muted/30 rounded p-3">
{`npm install        # Install dependencies
npm run dev        # Start dev server (port 5000, HMR enabled)`}
            </pre>
          </div>
          <div>
            <h4 className="font-semibold mb-1">Production Build</h4>
            <pre className="text-xs font-mono bg-muted/30 rounded p-3">
{`npm run build      # Bundle client + server -> dist/
npm start          # Run production server`}
            </pre>
          </div>
          <div>
            <h4 className="font-semibold mb-1">Database Backup</h4>
            <pre className="text-xs font-mono bg-muted/30 rounded p-3">
{`# The database is a single file: data/sar-tools.db
# To backup, copy the file (plus WAL/SHM if present):
cp data/sar-tools.db  backups/sar-tools-$(date +%Y%m%d).db
cp data/sar-tools.db-wal  backups/  # if exists
cp data/sar-tools.db-shm  backups/  # if exists

# Or use SQLite's built-in backup (safe during writes):
sqlite3 data/sar-tools.db ".backup 'backups/sar-tools-backup.db'"`}
            </pre>
          </div>
          <div>
            <h4 className="font-semibold mb-1">Git Database Backup</h4>
            <p className="text-muted-foreground text-xs mb-2">
              A snapshot of the database is committed to the <code className="bg-muted px-1 py-0.5 rounded">data/</code> folder
              in the git repository for disaster recovery. Rebuild from seed scripts if needed.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 6. Conventions */}
      <Card id="conventions">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" /> 6. Conventions &amp; Rules
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <Convention title="Part Numbers" desc="PREFIX.mfr-part — prefix is 3-letter manufacturer code (SIE = Siemens, RIT = Rittal, BET = Bettermann)." />
            <Convention title="Money" desc="All financial values stored as integers in cents. Display with (value / 100).toFixed(2)." />
            <Convention title="Dates" desc="Stored as YYYY-MM-DD (ISO 8601). Displayed as MM/DD/YYYY (US locale)." />
            <Convention title="Soft Delete" desc="Records have an 'active' boolean. Delete sets active=false, never removes rows." />
            <Convention title="Audit Trail" desc="Capacity entries have a full changelog. Stock movements logged as immutable transactions." />
            <Convention title="Tariff Codes" desc="hs_code = international 6-digit. hts_code_us = US-specific. ht_code_eu = EU CN code." />
            <Convention title="Search" desc="Parts have a denormalized search_keywords column rebuilt on create/update for fast fuzzy matching." />
            <Convention title="QB Integration" desc="QuickBooks Desktop is AR/AP source of truth. Projects sync via Excel export. qb_list_id links parts." />
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground/50 text-center pb-4">
        Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────

function InfoBox({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-center gap-2 font-semibold text-sm mb-2">
        {icon} {title}
      </div>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item} className="text-xs text-muted-foreground">{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Convention({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-muted/30">
      <div className="font-medium text-xs">{title}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
    </div>
  );
}
