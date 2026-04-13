import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Project } from "@/hooks/use-capacity";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { Search, Filter, X, Loader2 } from "lucide-react";

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

    return list;
  }, [projects, search, statusFilter, jobStatusFilter, jobTypeFilter, repFilter]);

  const hasFilters = search || statusFilter !== "all" || jobStatusFilter || jobTypeFilter || repFilter;

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setJobStatusFilter("");
    setJobTypeFilter("");
    setRepFilter("");
  }

  // Summary stats
  const activeCount = projects?.filter((p) => p.active).length ?? 0;
  const totalCount = projects?.length ?? 0;

  return (
    <div className="p-4 space-y-3">
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
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2">
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
          {filtered.length} of {totalCount} · {activeCount} active
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
                <TableHead className="w-[80px]">Start</TableHead>
                <TableHead className="w-[80px]">Proj. End</TableHead>
                <TableHead className="w-[80px]">End</TableHead>
                <TableHead className="w-[80px]">Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-10 text-muted-foreground">
                    No projects found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id} className={!p.active ? "opacity-50" : undefined}>
                    <TableCell className="sticky left-0 bg-background z-10">
                      <button
                        className={`text-xs font-medium px-1.5 py-0.5 rounded ${p.active ? "text-emerald-600 bg-emerald-500/10" : "text-muted-foreground bg-muted"}`}
                        onClick={() => toggleActive.mutate({ id: p.id, active: !p.active })}
                        disabled={toggleActive.isPending}
                      >
                        {p.active ? "Active" : "Inactive"}
                      </button>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{p.number}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{p.customer || "—"}</TableCell>
                    <TableCell className="max-w-[300px] truncate">{p.description || "—"}</TableCell>
                    <TableCell>{p.rep || "—"}</TableCell>
                    <TableCell className="text-xs">{p.jobStatus || "—"}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {fmtMoney(p.estimateTotal)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(p.startDate)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(p.projectedEnd)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(p.endDate)}</TableCell>
                    <TableCell className="text-xs">{p.jobType || "—"}</TableCell>
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
