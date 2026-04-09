import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Server,
  Monitor,
  Database,
  Layers,
  Package,
  Palette,
  Route,
  BarChart3,
  Calendar,
  FolderKanban,
  ScanBarcode,
  Train,
  ArrowDown,
  ArrowRight,
  ArrowLeftRight,
} from "lucide-react";

// ── Package info ─────────────────────────────────────────────
const STACK = {
  frontend: [
    { name: "React", version: "18.3", desc: "UI library" },
    { name: "TypeScript", version: "5.6", desc: "Type safety" },
    { name: "Vite", version: "7.3", desc: "Build tool & dev server" },
    { name: "Tailwind CSS", version: "3.4", desc: "Utility-first styling" },
    { name: "shadcn/ui", version: "—", desc: "Radix-based component library" },
    { name: "wouter", version: "3.3", desc: "Hash-based routing" },
    { name: "TanStack Query", version: "5.60", desc: "Server state & caching" },
    { name: "date-fns", version: "3.6", desc: "Date utilities" },
    { name: "Lucide React", version: "0.453", desc: "Icon set" },
    { name: "Framer Motion", version: "11.13", desc: "Animations" },
    { name: "Recharts", version: "2.15", desc: "Charts" },
  ],
  backend: [
    { name: "Express", version: "5.0", desc: "HTTP server" },
    { name: "Drizzle ORM", version: "0.45", desc: "Type-safe SQL" },
    { name: "better-sqlite3", version: "12.8", desc: "SQLite driver" },
    { name: "tsx", version: "4.20", desc: "TypeScript runner" },
    { name: "cross-env", version: "10.1", desc: "Cross-platform env" },
  ],
  data: [
    { name: "xlsx", version: "0.18", desc: "Excel import/export" },
    { name: "Zod", version: "3.24", desc: "Schema validation" },
    { name: "React Hook Form", version: "7.55", desc: "Form management" },
  ],
};

const MODULES = [
  {
    name: "Capacity Planner",
    icon: Calendar,
    desc: "Weekly team scheduling — assign people to projects by day with activity, location, night shift, and comment tracking. Full audit trail.",
    tables: ["capacity_entries", "capacity_changelog", "holidays", "locations"],
    status: "active" as const,
  },
  {
    name: "Project List",
    icon: FolderKanban,
    desc: "View and manage projects synced from QuickBooks Desktop. Filter by status, type, and search.",
    tables: ["projects"],
    status: "active" as const,
  },
  {
    name: "Inventory Manager",
    icon: Package,
    desc: "Parts catalog, storage locations, stock levels with reorder alerts.",
    tables: ["parts", "storage_locations", "inventory_levels"],
    status: "active" as const,
  },
  {
    name: "Stock Booking",
    icon: ScanBarcode,
    desc: "Mobile-friendly book-in/book-out with project cost tracking.",
    tables: ["stock_transactions"],
    status: "active" as const,
  },
  {
    name: "Railcut Sizing",
    icon: Train,
    desc: "Simulate monorail power section current draw and check against fuse trip curves.",
    tables: [],
    status: "active" as const,
  },
];

export default function About() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">About</h2>
        <p className="text-muted-foreground mt-1">
          SAR Intranet - Codex - internal platform for SAR Automation LP
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">Built by Badenhorst Inc.</p>
      </div>

      {/* ── Architecture Diagram ────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5" />
            System Architecture
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="font-mono text-xs leading-relaxed">
            {/* Visual architecture */}
            <div className="grid grid-cols-1 gap-4">
              {/* Browser layer */}
              <div className="border border-blue-500/30 rounded-lg p-4 bg-blue-500/5">
                <div className="flex items-center gap-2 mb-3">
                  <Monitor className="h-4 w-4 text-blue-400" />
                  <span className="text-sm font-bold text-blue-400">BROWSER (Client)</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Box label="React 18 + TSX" color="blue" sub="Component tree" />
                  <Box label="TanStack Query" color="blue" sub="API cache layer" />
                  <Box label="wouter #hash" color="blue" sub="Client routing" />
                  <Box label="Tailwind + shadcn" color="blue" sub="Dark theme UI" />
                  <Box label="date-fns" color="blue" sub="Date formatting" />
                  <Box label="Recharts" color="blue" sub="Data visualization" />
                </div>
              </div>

              {/* Arrow */}
              <div className="flex justify-center">
                <div className="flex flex-col items-center text-muted-foreground/50">
                  <ArrowLeftRight className="h-5 w-5" />
                  <span className="text-[10px]">REST API (JSON)</span>
                </div>
              </div>

              {/* Server layer */}
              <div className="border border-emerald-500/30 rounded-lg p-4 bg-emerald-500/5">
                <div className="flex items-center gap-2 mb-3">
                  <Server className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm font-bold text-emerald-400">SERVER (Node.js)</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Box label="Express 5" color="emerald" sub="HTTP + middleware" />
                  <Box label="TypeScript" color="emerald" sub="Type-safe server" />
                  <Box label="Vite 7 (dev)" color="emerald" sub="HMR + bundling" />
                </div>
                <div className="mt-3 text-[10px] text-muted-foreground">
                  <span className="font-bold">API Routes:</span>{" "}
                  /api/capacity · /api/team-members · /api/projects · /api/activities ·
                  /api/locations · /api/holidays · /api/parts · /api/inventory ·
                  /api/storage-locations
                </div>
              </div>

              {/* Arrow */}
              <div className="flex justify-center">
                <div className="flex flex-col items-center text-muted-foreground/50">
                  <ArrowLeftRight className="h-5 w-5" />
                  <span className="text-[10px]">Drizzle ORM (sync)</span>
                </div>
              </div>

              {/* Database layer */}
              <div className="border border-amber-500/30 rounded-lg p-4 bg-amber-500/5">
                <div className="flex items-center gap-2 mb-3">
                  <Database className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-bold text-amber-400">DATABASE (SQLite)</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    "team_members", "projects", "activities",
                    "capacity_entries", "capacity_changelog",
                    "holidays", "locations",
                    "parts", "storage_locations",
                    "inventory_levels", "stock_transactions",
                    "purchase_orders",
                  ].map((t) => (
                    <div key={t} className="text-[10px] px-1.5 py-1 bg-amber-500/10 rounded text-amber-300/80 text-center truncate" title={t}>
                      {t}
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-[10px] text-muted-foreground">
                  <span className="font-bold">File:</span> data/sar-tools.db · WAL mode · better-sqlite3 (synchronous)
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Modules ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Route className="h-5 w-5" />
            Modules
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <div key={mod.name} className="flex gap-3 p-3 rounded-lg border bg-card hover:bg-muted/20 transition-colors">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{mod.name}</span>
                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                      {mod.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{mod.desc}</p>
                  {mod.tables.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {mod.tables.map((t) => (
                        <Badge key={t} variant="secondary" className="text-[9px] px-1 py-0 font-mono">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ── Tech Stack ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StackCard
          title="Frontend"
          icon={<Monitor className="h-4 w-4" />}
          items={STACK.frontend}
          color="blue"
        />
        <StackCard
          title="Backend"
          icon={<Server className="h-4 w-4" />}
          items={STACK.backend}
          color="emerald"
        />
        <StackCard
          title="Data & Forms"
          icon={<Database className="h-4 w-4" />}
          items={STACK.data}
          color="amber"
        />
      </div>

      {/* ── Design Decisions ────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Design Decisions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <Decision q="Why SQLite?" a="Single-file DB, zero config, perfect for on-prem intranet. WAL mode allows concurrent reads." />
            <Decision q="Why hash routing?" a="Required for iframe embedding compatibility — /#/tools/..." />
            <Decision q="Why Drizzle?" a="Type-safe SQL with zero overhead. Synchronous better-sqlite3 driver for fast transactions." />
            <Decision q="Why no auth?" a="Internal tool on local network. Authentication planned when needed." />
            <Decision q="Why dark-only?" a="Engineering aesthetic. Reduces eye strain for all-day use." />
            <Decision q="Date format?" a="Store YYYY-MM-DD (ISO), display MM/DD/YYYY (US locale)." />
            <Decision q="Financial values?" a="Stored as cents (integers). No floating-point money." />
            <Decision q="QB integration?" a="QuickBooks Desktop is the source of truth. Projects sync via Excel export + seed scripts." />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────

function Box({ label, color, sub }: { label: string; color: string; sub: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-500/10 border-blue-500/20 text-blue-300",
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-300",
    amber: "bg-amber-500/10 border-amber-500/20 text-amber-300",
  };
  return (
    <div className={`rounded border px-2 py-1.5 text-center ${colors[color]}`}>
      <div className="text-[11px] font-bold">{label}</div>
      <div className="text-[9px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function StackCard({
  title,
  icon,
  items,
  color,
}: {
  title: string;
  icon: React.ReactNode;
  items: { name: string; version: string; desc: string }[];
  color: string;
}) {
  const borderColor: Record<string, string> = {
    blue: "border-blue-500/20",
    emerald: "border-emerald-500/20",
    amber: "border-amber-500/20",
  };
  return (
    <Card className={borderColor[color]}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {items.map((item) => (
          <div key={item.name} className="flex items-center justify-between text-xs py-0.5">
            <div>
              <span className="font-medium">{item.name}</span>
              <span className="text-muted-foreground ml-1.5">{item.desc}</span>
            </div>
            <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono shrink-0 ml-2">
              {item.version}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Decision({ q, a }: { q: string; a: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-muted/30">
      <div className="font-medium text-xs">{q}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{a}</div>
    </div>
  );
}
