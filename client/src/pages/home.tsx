import { useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  Package,
  Users,
  FolderKanban,
  BookOpen,
  CalendarDays,
  ScanBarcode,
  Train,
} from "lucide-react";
import { useTeamMembers, type Project } from "@/hooks/use-capacity";
import { useLowStock, useTransactions } from "@/hooks/use-inventory";
import { Badge } from "@/components/ui/badge";

// ── Quick-nav tiles ─────────────────────────────────────────
const NAV_ITEMS = [
  { label: "Capacity", icon: CalendarDays, path: "/tools/capacity-planner", color: "text-blue-400" },
  { label: "Projects", icon: FolderKanban, path: "/tools/project-list", color: "text-emerald-400" },
  { label: "Parts", icon: BookOpen, path: "/tools/parts-catalog", color: "text-violet-400" },
  { label: "Inventory", icon: Package, path: "/tools/inventory", color: "text-amber-400" },
  { label: "Book Stock", icon: ScanBarcode, path: "/tools/stock-booking", color: "text-cyan-400" },
  { label: "Railcut", icon: Train, path: "/tools/railcut-sizing", color: "text-rose-400" },
] as const;

function fmt$(cents: number | null): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

export default function Home() {
  const { data: teamMembers } = useTeamMembers();
  const { data: lowStock } = useLowStock();
  const { data: recentTx } = useTransactions({ limit: 8 });
  const { data: projects } = useQuery<Project[]>({ queryKey: ["/api/projects"] });

  const active = useMemo(() => (projects ?? []).filter((p) => p.active), [projects]);
  const team = useMemo(() => (teamMembers ?? []).filter((m) => m.active), [teamMembers]);
  const lowItems = lowStock ?? [];
  const outstanding = active.filter((p) => (p.balance ?? 0) > 0);
  const totalOutstanding = outstanding.reduce((s, p) => s + (p.balance ?? 0), 0);

  return (
    <div className="p-4 space-y-4 max-w-[1400px]">
      {/* ── KPI strip ──────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Active Team" value={team.length} sub={`${team.filter(m => !m.isExternal).length} internal`} />
        <KPI label="Active Projects" value={active.length} sub={`${outstanding.length} with balance`} />
        <KPI label="Outstanding" value={fmt$(totalOutstanding)} warn sub={`across ${outstanding.length} projects`} />
        <KPI label="Low Stock" value={lowItems.length} warn={lowItems.length > 0} sub={lowItems.length ? "locations below reorder" : "all clear"} />
      </div>

      {/* ── Navigation grid ────────────────────────────── */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {NAV_ITEMS.map((item) => (
          <Link key={item.path} href={item.path}>
            <div className="flex flex-col items-center gap-1.5 rounded-md border border-border/60 bg-card p-3 hover:bg-accent/50 transition-colors cursor-pointer">
              <item.icon className={`h-5 w-5 ${item.color}`} />
              <span className="text-xs font-medium">{item.label}</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        {/* ── Outstanding projects ────────────────────── */}
        <section className="rounded-md border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <h3 className="text-sm font-semibold">Projects with Balance</h3>
            <Link href="/tools/project-list" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y max-h-[320px] overflow-auto">
            {outstanding.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">No outstanding balances.</p>
            ) : (
              outstanding.slice(0, 10).map((p) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-2 hover:bg-muted/40 text-sm">
                  <div className="min-w-0">
                    <span className="font-mono text-xs text-muted-foreground mr-2">{p.number}</span>
                    <span className="truncate">{p.customer}</span>
                    {p.description && <span className="text-muted-foreground ml-1.5">— {p.description}</span>}
                  </div>
                  <span className="font-mono text-sm font-medium text-amber-500 whitespace-nowrap ml-3">{fmt$(p.balance)}</span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* ── Low stock ──────────────────────────────── */}
        <section className="rounded-md border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              {lowItems.length > 0 && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
              Low Stock Alerts
            </h3>
            <Link href="/tools/inventory" className="text-xs text-primary hover:underline flex items-center gap-1">
              Inventory <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y max-h-[320px] overflow-auto">
            {lowItems.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">All stock levels OK.</p>
            ) : (
              lowItems.slice(0, 10).map((item) => (
                <div key={item.id} className="flex items-center justify-between px-4 py-2 hover:bg-muted/40 text-sm">
                  <div className="min-w-0">
                    <span className="font-mono text-xs">{item.partNumber}</span>
                    <span className="text-muted-foreground ml-1.5 text-xs">{item.partName}</span>
                  </div>
                  <div className="flex items-center gap-2 whitespace-nowrap ml-3">
                    <span className="text-xs text-muted-foreground">reorder at {item.reorderPoint}</span>
                    <Badge variant="destructive" className="text-xs px-1.5 py-0">{item.qtyOnHand}</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* ── Recent stock activity ──────────────────────── */}
      <section className="rounded-md border bg-card">
        <div className="border-b px-4 py-2.5">
          <h3 className="text-sm font-semibold">Recent Stock Activity</h3>
        </div>
        <div className="divide-y max-h-[280px] overflow-auto">
          {(recentTx ?? []).length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">No stock movements recorded yet.</p>
          ) : (
            recentTx!.map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-2 hover:bg-muted/40 text-sm">
                <div className={`flex h-6 w-6 items-center justify-center rounded text-xs font-bold ${
                  tx.qty > 0 ? "bg-emerald-500/15 text-emerald-500" : "bg-rose-500/15 text-rose-500"
                }`}>
                  {tx.qty > 0 ? "+" : ""}{tx.qty}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-xs">{tx.partNumber}</span>
                  <span className="text-muted-foreground ml-1.5 text-xs">{tx.reason || tx.type}</span>
                  {tx.projectNumber && <span className="text-muted-foreground text-xs ml-1">· {tx.projectNumber}</span>}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNowStrict(new Date(tx.createdAt), { addSuffix: true })}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

// ── KPI card component ────────────────────────────────────
function KPI({ label, value, sub, warn }: { label: string; value: string | number; sub: string; warn?: boolean }) {
  return (
    <div className={`rounded-md border bg-card px-4 py-3 ${warn ? "border-amber-500/30" : ""}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold tracking-tight mt-0.5 ${warn ? "text-amber-500" : ""}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}
