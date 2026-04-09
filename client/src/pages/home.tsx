import { type ReactNode, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  FolderKanban,
  Package,
  ReceiptText,
  Users,
  Wrench,
} from "lucide-react";
import { tools } from "@/lib/tools-registry";
import { useTeamMembers, type Project } from "@/hooks/use-capacity";
import { useLowStock, useTransactions } from "@/hooks/use-inventory";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type SnapshotCardProps = {
  title: string;
  value: string;
  description: string;
  icon: ReactNode;
  tone?: "default" | "warn";
};

function SnapshotCard({
  title,
  value,
  description,
  icon,
  tone = "default",
}: SnapshotCardProps) {
  return (
    <Card className={tone === "warn" ? "border-amber-500/30 bg-amber-500/[0.03]" : ""}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="space-y-1">
          <CardDescription>{title}</CardDescription>
          <CardTitle className="text-3xl tracking-tight">{value}</CardTitle>
        </div>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
            tone === "warn"
              ? "border-amber-500/30 bg-amber-500/10 text-amber-500"
              : "border-primary/20 bg-primary/10 text-primary"
          }`}
        >
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const { data: teamMembers } = useTeamMembers();
  const { data: lowStock } = useLowStock();
  const { data: recentTransactions } = useTransactions({ limit: 5 });
  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const activeProjects = useMemo(
    () => (projects ?? []).filter((project) => project.active),
    [projects],
  );
  const activeTeamMembers = useMemo(
    () => (teamMembers ?? []).filter((member) => member.active),
    [teamMembers],
  );
  const lowStockItems = lowStock ?? [];
  const activeTools = tools.filter((tool) => tool.status === "active");
  const powerTools = activeTools.filter((tool) => tool.category === "power").length;
  const operationsTools = activeTools.filter((tool) => tool.category !== "power").length;
  const outstandingProjects = activeProjects.filter((project) => (project.balance ?? 0) > 0);

  return (
    <div className="p-6">
      <section className="relative overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/[0.12] via-background to-background shadow-sm">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,_rgba(0,127,200,0.22),_transparent_55%)]" />
        <div className="relative grid gap-6 px-6 py-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-primary/25 bg-background/80 text-primary">
                Internal Platform
              </Badge>
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                {activeTools.length} active tools
              </Badge>
            </div>
            <div className="space-y-3">
              <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                SAR Intranet - Codex
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                One place for engineering calculations, capacity planning, project oversight,
                and inventory operations. The goal is quick decisions, less spreadsheet drift,
                and better visibility across the SAR workflow.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/tools/capacity-planner">
                  Open Capacity Planner
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/tools/inventory">Review Inventory</Link>
              </Button>
            </div>
          </div>

          <Card className="border-primary/15 bg-background/80 backdrop-blur">
            <CardHeader className="pb-4">
              <CardDescription>Operational Focus</CardDescription>
              <CardTitle className="text-xl">What deserves attention today</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Low-stock watchlist</p>
                    <p className="text-sm text-muted-foreground">
                      {lowStockItems.length === 0
                        ? "No immediate inventory alerts."
                        : `${lowStockItems.length} location${lowStockItems.length === 1 ? "" : "s"} below reorder point.`}
                    </p>
                  </div>
                  <Badge variant={lowStockItems.length > 0 ? "destructive" : "secondary"}>
                    {lowStockItems.length}
                  </Badge>
                </div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Projects with balance outstanding</p>
                    <p className="text-sm text-muted-foreground">
                      {outstandingProjects.length} active project{outstandingProjects.length === 1 ? "" : "s"} still carrying balance.
                    </p>
                  </div>
                  <Badge variant="outline">{outstandingProjects.length}</Badge>
                </div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Tool coverage</p>
                    <p className="text-sm text-muted-foreground">
                      {powerTools} power tools and {operationsTools} operations tools are live.
                    </p>
                  </div>
                  <Badge variant="outline">{activeTools.length}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SnapshotCard
          title="Active Team"
          value={String(activeTeamMembers.length)}
          description="People currently available in the shared planning pool."
          icon={<Users className="h-5 w-5" />}
        />
        <SnapshotCard
          title="Active Projects"
          value={String(activeProjects.length)}
          description="Jobs currently visible to planners and stock workflows."
          icon={<FolderKanban className="h-5 w-5" />}
        />
        <SnapshotCard
          title="Low Stock Alerts"
          value={String(lowStockItems.length)}
          description="Tracked locations at or below their reorder threshold."
          icon={<AlertTriangle className="h-5 w-5" />}
          tone={lowStockItems.length > 0 ? "warn" : "default"}
        />
        <SnapshotCard
          title="Recent Stock Events"
          value={String(recentTransactions?.length ?? 0)}
          description="Latest booked moves surfaced from inventory activity."
          icon={<ReceiptText className="h-5 w-5" />}
        />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.35fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardDescription>Quick Access</CardDescription>
            <CardTitle>Active tools</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {activeTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <Card key={tool.id} className="border-border/70 bg-muted/[0.18] shadow-none">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {tool.category}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg">{tool.name}</CardTitle>
                    <CardDescription>{tool.description}</CardDescription>
                  </CardHeader>
                  <CardFooter>
                    <Button asChild variant="ghost" className="px-0 text-primary hover:text-primary">
                      <Link href={tool.path}>
                        Open tool
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardDescription>Inventory Watchlist</CardDescription>
              <CardTitle>Parts needing attention</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lowStockItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                  No low-stock items right now.
                </div>
              ) : (
                lowStockItems.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-3 rounded-2xl border border-border/70 bg-muted/[0.18] p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.partNumber}</p>
                      <p className="truncate text-sm text-muted-foreground">{item.partName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.locationLabel || "Unlabeled location"} · reorder at {item.reorderPoint}
                      </p>
                    </div>
                    <Badge variant="destructive">{item.qtyOnHand}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Recent Activity</CardDescription>
              <CardTitle>Latest stock movements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(recentTransactions ?? []).length === 0 ? (
                <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                  No recent inventory events yet.
                </div>
              ) : (
                recentTransactions!.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/[0.18] p-3"
                  >
                    <div
                      className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl ${
                        transaction.qty > 0
                          ? "bg-emerald-500/12 text-emerald-500"
                          : "bg-rose-500/12 text-rose-500"
                      }`}
                    >
                      <Package className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate font-medium">{transaction.partNumber}</p>
                        <Badge variant="outline">{transaction.qty > 0 ? `+${transaction.qty}` : transaction.qty}</Badge>
                      </div>
                      <p className="truncate text-sm text-muted-foreground">
                        {transaction.reason || "Inventory update"} · {transaction.locationLabel || "Unlabeled location"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNowStrict(new Date(transaction.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardDescription>How the app is positioned</CardDescription>
            <CardTitle>Designed for operational clarity, not just navigation</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-muted/[0.18] p-4">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Wrench className="h-5 w-5" />
              </div>
              <p className="font-medium">Engineering</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Calculation tools stay close to the operational data they depend on.
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/[0.18] p-4">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CalendarDays className="h-5 w-5" />
              </div>
              <p className="font-medium">Planning</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Team capacity, locations, activities, and holidays are modeled together.
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/[0.18] p-4">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Package className="h-5 w-5" />
              </div>
              <p className="font-medium">Inventory</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Stock movement history and reorder visibility support daily execution.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Coverage</CardDescription>
            <CardTitle>Platform snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-muted/[0.18] p-4">
              <p className="text-sm font-medium">Tool categories</p>
              <div className="mt-3 flex items-center gap-3">
                <Badge variant="secondary">{powerTools} power</Badge>
                <Badge variant="outline">{operationsTools} operations</Badge>
              </div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/[0.18] p-4">
              <p className="text-sm font-medium">Shared data model</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Projects, team members, holidays, locations, and stock records are all connected.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
