import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// ── Types ─────────────────────────────────────────────────────
export const JOB_FUNCTIONS = [
  "Controls Engineer",
  "Hardware Planner",
  "Technician",
  "Site Manager",
  "Project Manager",
] as const;
export type JobFunction = (typeof JOB_FUNCTIONS)[number];

export interface TeamMember {
  id: number;
  name: string;
  email: string | null;
  role: string | null;
  jobFunction: JobFunction | null;
  department: string | null;
  source: "manual" | "exchange";
  isExternal: boolean;
  company: string | null;
  active: boolean;
}

export interface Project {
  id: number;
  number: string;
  customer: string | null;
  description: string | null;
  poNumber: string | null;
  contact: string | null;
  rep: string | null;
  // QB financial fields
  balance: number | null;          // cents
  estimateTotal: number | null;    // cents
  // QB job metadata
  jobStatus: string | null;
  jobType: string | null;
  customerType: string | null;
  endLocationState: string | null;
  startDate: string | null;
  projectedEnd: string | null;
  endDate: string | null;
  // system
  source: string;
  active: boolean;
}

export interface Activity {
  id: number;
  name: string;
  sortOrder: number;
}

export interface Location {
  id: number;
  name: string;
  shortCode: string | null;
  active: boolean;
}

export interface CapacityEntry {
  id: number;
  teamMemberId: number;
  projectId: number | null;
  activityId: number | null;
  locationId: number | null;
  date: string;
  comment: string | null;
  nightShift: boolean;
  teamMemberName: string | null;
  projectNumber: string | null;
  projectDescription: string | null;
  activityName: string | null;
  locationName: string | null;
}

export interface WeekData {
  weekStart: string;
  weekEnd: string;
  entries: CapacityEntry[];
  teamMembers: TeamMember[];
}

// ── Hooks ─────────────────────────────────────────────────────

export function useWeekCapacity(weekStart: string) {
  return useQuery<WeekData>({
    queryKey: ["/api/capacity", `?week=${weekStart}`],
    enabled: !!weekStart,
  });
}

export function useMultiWeekCapacity(weekStarts: string[]) {
  const queries = useQueries({
    queries: weekStarts.map((ws) => ({
      queryKey: ["/api/capacity", `?week=${ws}`],
      enabled: !!ws,
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);

  // Merge all week data: combine entries, deduplicate team members
  const data = !isLoading && !isError
    ? (() => {
        const allEntries: CapacityEntry[] = [];
        const memberMap = new Map<number, TeamMember>();

        for (const q of queries) {
          const wd = q.data as WeekData | undefined;
          if (!wd) continue;
          allEntries.push(...wd.entries);
          for (const m of wd.teamMembers) {
            memberMap.set(m.id, m);
          }
        }

        return {
          entries: allEntries,
          teamMembers: Array.from(memberMap.values()).sort((a, b) =>
            a.name.localeCompare(b.name)
          ),
        };
      })()
    : null;

  return { data, isLoading, isError };
}

export function useTeamMembers() {
  return useQuery<TeamMember[]>({
    queryKey: ["/api/team-members"],
  });
}

export function useActivities() {
  return useQuery<Activity[]>({
    queryKey: ["/api/activities"],
  });
}

// ── Holiday types & hooks ───────────────────────────────────

export interface HolidayRecord {
  id: number;
  date: string;
  name: string;
  nameLocal: string | null;
  category: "us_federal" | "german" | "company";
  active: boolean;
}

export function useHolidays() {
  return useQuery<HolidayRecord[]>({
    queryKey: ["/api/holidays"],
  });
}

export function useCreateHoliday() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { date: string; name: string; nameLocal?: string; category: string }) => {
      const res = await apiRequest("POST", "/api/holidays", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holidays"] });
    },
  });
}

export function useUpdateHoliday() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<HolidayRecord>) => {
      const res = await apiRequest("PUT", `/api/holidays/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holidays"] });
    },
  });
}

export function useDeleteHoliday() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/holidays/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holidays"] });
    },
  });
}

export function useLocations() {
  return useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });
}

export function useCreateLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; shortCode?: string }) => {
      const res = await apiRequest("POST", "/api/locations", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
    },
  });
}

export function useDeleteLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/locations/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/capacity"] });
    },
  });
}

export function useProjectSearch(query: string) {
  return useQuery<Project[]>({
    queryKey: ["/api/projects/search", `?q=${encodeURIComponent(query)}`],
    enabled: query.length >= 2,
  });
}

export function useSaveCapacity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entries: any[]) => {
      const res = await apiRequest("PUT", "/api/capacity/bulk", { entries });
      return res.json();
    },
    onSuccess: async () => {
      // Await both invalidations so the grid re-syncs from fresh data before the mutation resolves
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/capacity"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/capacity/changelog"] }),
      ]);
    },
  });
}

export function useCreateTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<TeamMember>) => {
      const res = await apiRequest("POST", "/api/team-members", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/capacity"] });
    },
  });
}

export function useUpdateTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<TeamMember> & { id: number }) => {
      const res = await apiRequest("PUT", `/api/team-members/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/capacity"] });
    },
  });
}

export function useDeleteCapacityEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/capacity/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/capacity"] });
    },
  });
}

// ── Changelog ────────────────────────────────────────────────

export interface ChangelogEntry {
  id: number;
  entryId: number | null;
  teamMemberId: number | null;
  date: string | null;
  action: "create" | "update" | "delete";
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  summary: string | null;
  createdAt: string;
}

export function useCapacityChangelog(limit = 50, offset = 0) {
  return useQuery<{ logs: ChangelogEntry[]; total: number }>({
    queryKey: ["/api/capacity/changelog", `?limit=${limit}&offset=${offset}`],
    staleTime: 0,            // Always refetch when sheet opens
    refetchOnMount: "always", // Re-run even if data exists in cache
  });
}
