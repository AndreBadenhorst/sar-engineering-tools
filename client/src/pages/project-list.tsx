import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Project } from "@/hooks/use-capacity";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Filter, X, Loader2, DollarSign, AlertTriangle } from "lucide-react";

/** Format cents to dollar string */
function fmtMoney(cents: number | null): string {
  if (cents == null) return "—";
  const val = cents / 100;
  return val.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/** Format date string (YYYY-MM-DD) to short display */
function fmtDate(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
  } catch {
    return d;
  }
}

export default function ProjectList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [jobStatusFilter, setJobStatusFilter] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState("");
  const [repFilter, setRepFilter] = useState("");
  const [balanceFilter, setBalanceFilter] = useState<"all" | "outstanding" | "zero">("all");

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      const res = await apiRequest("PUT", `/api/projects/${id}`, { active });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
  });

  // Derive filter options from data
  const { reps, jobStatuses, jobTypes } = useMemo(() => {
    if (!projects) return { reps: [], jobStatuses: [], jobTypes: [] };
    const repSet = new Set<string>();
    const jsSet = new Set<string>();
    const jtSet = new Set<string>();
    for (const p of projects) {
      if (p.rep) repSet.add(p.rep);
      if (p.jobStatus) jsSet.add(p.jobStatus);
      if (p.jobType) jtSet.add(p.jobType);
    }
    return {
      reps: Array.from(repSet).sort(),
      jobStatuses: Array.from(jsSet).sort(),
      jobTypes: Array.from(jtSet).sort(),
    };
  }, [projects]);

  const filtered = useMemo(() => {
    if (!projects) return [];
    let list = projects;

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.number.toLowerCase().includes(q) ||
          (p.customer && p.customer.toLowerCase().includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          (p.rep && p.rep.toLowerCase().includes(q))
      );
    }

    if (statusFilter === "active") list = list.filter((p) => p.active);
    else if (statusFilter === "inactive") list = list.filter((p) => !p.active);

    if (jobStatusFilter) list = list.filter((p) => p.jobStatus === jobStatusFilter);
    if (jobTypeFilter) list = list.filter((p) => p.jobType === jobTypeFilter);
    if (repFilter) list = list.filter((p) => p.rep === repFilter);

    if (balanceFilter === "outstanding") list = list.filter((p) => p.balance && p.balance > 0);
    else if (balanceFilter === "zero") list = list.filter((p) => !p.balance || p.balance === 0);

    return list;
  }, [projects, search, statusFilter, jobStatusFilter, jobTypeFilter, repFilter, balanceFilter]);

  const hasFilters = search || statusFilter !== "all" || jobStatusFilter || jobTypeFilter || repFilter || balanceFilter !== "all";

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setJobStatusFilter("");
    setJobTypeFilter("");
    setRepFilter("");
    setBalanceFilter("all");
  }

  // Summary stats
  const activeCount = projects?.filter((p) => p.active).length ?? 0;
  const totalCount = projects?.length ?? 0;
  const totalBalance = useMemo(() => {
    if (!filtered) return 0;
    return filtered.reduce((sum, p) => sum + (p.balance || 0), 0);
  }, [filtered]);
  const totalEstimate = useMemo(() => {
    if (!filtered) return 0;
    return filtered.reduce((sum, p) => sum + (p.estimateTotal || 0), 0);
  }, [filtered]);
  const outstandingCount = filtered.filter((p) => p.balance && p.balance > 0).length;

  return (
    <div className="p-4 space-y-4">
      {/* Summary cards */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="secondary" className="text-xs">
          {activeCount} active
        </Badge>
        <Badge variant="outline" className="text-xs">
          {totalCount} total
        </Badge>
        {totalBalance > 0 && (
          <Badge variant="destructive" className="text-xs gap-1">
            <DollarSign className="h-3 w-3" />
            {fmtMoney(totalBalance)} outstanding
          </Badge>
        )}
        {totalEstimate > 0 && (
          <Badge variant="outline" className="text-xs gap-1">
            <DollarSign className="h-3 w-3" />
            {fmtMoney(totalEstimate)} estimated
          </Badge>
        )}
        {outstandingCount > 0 && (
          <Badge variant="outline" className="text-xs gap-1 border-yellow-600 text-yellow-500">
            <AlertTriangle className="h-3 w-3" />
            {outstandingCount} with balance
          </Badge>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="h-8 w-[200px] text-sm pl-7"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="h-8 w-[110px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        {jobStatuses.length > 0 && (
          <Select value={jobStatusFilter || "__all__"} onValueChange={(v) => setJobStatusFilter(v === "__all__" ? "" : v)}>
            <SelectTrigger className="h-8 w-[130px] text-sm">
              <SelectValue placeholder="Job Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Job Status</SelectItem>
              {jobStatuses.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {jobTypes.length > 0 && (
          <Select value={jobTypeFilter || "__all__"} onValueChange={(v) => setJobTypeFilter(v === "__all__" ? "" : v)}>
            <SelectTrigger className="h-8 w-[110px] text-sm">
              <SelectValue placeholder="Job Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Types</SelectItem>
              {jobTypes.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {reps.length > 0 && (
          <Select value={repFilter || "__all__"} onValueChange={(v) => setRepFilter(v === "__all__" ? "" : v)}>
            <SelectTrigger className="h-8 w-[90px] text-sm">
              <SelectValue placeholder="Rep" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Reps</SelectItem>
              {reps.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={balanceFilter} onValueChange={(v) => setBalanceFilter(v as any)}>
          <SelectTrigger className="h-8 w-[120px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Balances</SelectItem>
            <SelectItem value="outstanding">Outstanding</SelectItem>
            <SelectItem value="zero">Paid / Zero</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2">
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          {filtered.length} shown
        </span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="border rounded-lg overflow-auto max-h-[calc(100vh-220px)]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[80px] sticky left-0 bg-muted/50 z-10">Status</TableHead>
                <TableHead className="w-[130px]">Project #</TableHead>
                <TableHead className="min-w-[150px]">Customer</TableHead>
                <TableHead className="min-w-[200px]">Description</TableHead>
                <TableHead className="w-[50px]">Rep</TableHead>
                <TableHead className="w-[90px]">Job Status</TableHead>
                <TableHead className="w-[110px] text-right">Estimate</TableHead>
                <TableHead className="w-[110px] text-right">Balance</TableHead>
                <TableHead className="w-[80px]">Start</TableHead>
                <TableHead className="w-[80px]">Proj. End</TableHead>
                <TableHead className="w-[80px]">End</TableHead>
                <TableHead className="w-[80px]">Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-10 text-muted-foreground">
                    No projects found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id} className={!p.active ? "opacity-50" : undefined}>
                    <TableCell className="sticky left-0 bg-background z-10">
                      <Button
                        variant={p.active ? "default" : "outline"}
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => toggleActive.mutate({ id: p.id, active: !p.active })}
                        disabled={toggleActive.isPending}
                      >
                        {p.active ? "Active" : "Inactive"}
                      </Button>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{p.number}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{p.customer || "—"}</TableCell>
                    <TableCell className="max-w-[300px] truncate">{p.description || "—"}</TableCell>
                    <TableCell>{p.rep || "—"}</TableCell>
                    <TableCell>
                      {p.jobStatus ? (
                        <Badge
                          variant={
                            p.jobStatus === "In progress" ? "default" :
                            p.jobStatus === "Finished" ? "secondary" :
                            "destructive"
                          }
                          className="text-xs"
                        >
                          {p.jobStatus}
                        </Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {fmtMoney(p.estimateTotal)}
                    </TableCell>
                    <TableCell className={`text-right font-mono text-sm ${p.balance && p.balance > 0 ? "text-red-400 font-semibold" : ""}`}>
                      {fmtMoney(p.balance)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(p.startDate)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(p.projectedEnd)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(p.endDate)}</TableCell>
                    <TableCell>
                      {p.jobType ? (
                        <Badge variant={p.jobType === "Open" ? "outline" : "secondary"} className="text-xs">
                          {p.jobType}
                        </Badge>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
