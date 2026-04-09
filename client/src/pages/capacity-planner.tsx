import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { startOfISOWeek, addWeeks, format } from "date-fns";
import { WeekSelector } from "@/components/tools/capacity/week-selector";
import { WeeklyGrid } from "@/components/tools/capacity/weekly-grid";
import { TeamMemberDialog } from "@/components/tools/capacity/team-member-dialog";
import { ChangelogPanel } from "@/components/tools/capacity/changelog-panel";
import { ExportClipboard } from "@/components/tools/capacity/export-clipboard";
import { SettingsPanel } from "@/components/tools/capacity/settings-panel";
import { useMultiWeekCapacity, useActivities, useLocations, useHolidays, JOB_FUNCTIONS, type TeamMember } from "@/hooks/use-capacity";
import { Loader2, Filter, X, ChevronDown, Check, ArrowUpDown, Save } from "lucide-react";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function CapacityPlanner() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [weekCount, setWeekCount] = useState(1);

  // Unsaved changes warning state
  const [pendingNavigation, setPendingNavigation] = useState<Date | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [gridDirty, setGridDirty] = useState(false);
  const [gridSaving, setGridSaving] = useState(false);
  const gridSaveRef = useRef<(() => Promise<void>) | null>(null);

  /** Navigate to a new week — with unsaved check */
  const safeNavigate = useCallback((date: Date) => {
    if (gridDirty) {
      setPendingNavigation(date);
      setShowUnsavedDialog(true);
    } else {
      setCurrentDate(date);
    }
  }, [gridDirty]);

  function confirmDiscard() {
    if (pendingNavigation) {
      setCurrentDate(pendingNavigation);
      setPendingNavigation(null);
    }
    setShowUnsavedDialog(false);
  }

  function cancelDiscard() {
    setPendingNavigation(null);
    setShowUnsavedDialog(false);
  }

  // Build array of week start dates
  const weekStarts = useMemo(() => {
    const starts: string[] = [];
    for (let i = 0; i < weekCount; i++) {
      starts.push(format(startOfISOWeek(addWeeks(currentDate, i)), "yyyy-MM-dd"));
    }
    return starts;
  }, [currentDate, weekCount]);

  const { data: multiWeekData, isLoading: weekLoading } = useMultiWeekCapacity(weekStarts);
  const { data: activities, isLoading: activitiesLoading } = useActivities();
  const { data: locationsList, isLoading: locationsLoading } = useLocations();
  const { data: holidaysList, isLoading: holidaysLoading } = useHolidays();

  // Browser-level unsaved changes warning (tab close / browser back)
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (gridDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [gridDirty]);

  const handleDirtyChange = useCallback((dirty: boolean, save: () => Promise<void>, saving: boolean) => {
    setGridDirty(dirty);
    setGridSaving(saving);
    gridSaveRef.current = save;
  }, []);

  // Filters
  const [selectedPersonIds, setSelectedPersonIds] = useState<Set<number>>(new Set());
  const [personSearch, setPersonSearch] = useState("");
  const [showExternal, setShowExternal] = useState<"all" | "internal" | "external">("all");
  const [functionFilter, setFunctionFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "function">("name");

  const isLoading = weekLoading || activitiesLoading || locationsLoading || holidaysLoading;

  // Filter team members
  const filteredMembers = useMemo(() => {
    if (!multiWeekData) return [];
    let members = multiWeekData.teamMembers;

    if (selectedPersonIds.size > 0) {
      members = members.filter((m) => selectedPersonIds.has(m.id));
    }

    if (showExternal === "internal") {
      members = members.filter((m) => !m.isExternal);
    } else if (showExternal === "external") {
      members = members.filter((m) => m.isExternal);
    }

    if (functionFilter) {
      members = members.filter((m) => m.jobFunction === functionFilter);
    }

    if (projectFilter && multiWeekData.entries.length > 0) {
      const q = projectFilter.toLowerCase();
      const memberIdsWithProject = new Set(
        multiWeekData.entries
          .filter(
            (e) =>
              (e.projectNumber && e.projectNumber.toLowerCase().includes(q)) ||
              (e.projectDescription && e.projectDescription.toLowerCase().includes(q))
          )
          .map((e) => e.teamMemberId)
      );
      members = members.filter((m) => memberIdsWithProject.has(m.id));
    }

    // Sort
    members = [...members].sort((a, b) => {
      if (sortBy === "function") {
        const fa = a.jobFunction || "zzz"; // push null to end
        const fb = b.jobFunction || "zzz";
        if (fa !== fb) return fa.localeCompare(fb);
      }
      return a.name.localeCompare(b.name);
    });

    return members;
  }, [multiWeekData, selectedPersonIds, showExternal, functionFilter, projectFilter, sortBy]);

  // Filter entries by project
  const filteredEntries = useMemo(() => {
    if (!multiWeekData) return [];
    if (!projectFilter) return multiWeekData.entries;

    const q = projectFilter.toLowerCase();
    return multiWeekData.entries.filter(
      (e) =>
        (e.projectNumber && e.projectNumber.toLowerCase().includes(q)) ||
        (e.projectDescription && e.projectDescription.toLowerCase().includes(q))
    );
  }, [multiWeekData, projectFilter]);

  const hasFilters =
    selectedPersonIds.size > 0 || showExternal !== "all" || functionFilter || projectFilter;

  function clearFilters() {
    setSelectedPersonIds(new Set());
    setPersonSearch("");
    setShowExternal("all");
    setFunctionFilter("");
    setProjectFilter("");
  }

  function togglePerson(id: number) {
    setSelectedPersonIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const personOptions = useMemo(() => {
    if (!multiWeekData) return [];
    const q = personSearch.toLowerCase();
    return multiWeekData.teamMembers.filter(
      (m) =>
        !q ||
        m.name.toLowerCase().includes(q) ||
        (m.company && m.company.toLowerCase().includes(q)) ||
        (m.role && m.role.toLowerCase().includes(q)) ||
        (m.jobFunction && m.jobFunction.toLowerCase().includes(q))
    );
  }, [multiWeekData, personSearch]);

  return (
    <div className="space-y-0">
      {/* Unsaved changes dialog */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes in the grid. If you navigate away, your changes will be lost.
              Would you like to discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDiscard}>Stay & Save</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDiscard} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-40 bg-background border-b border-border shadow-sm px-4 pt-4 pb-3 space-y-3">
        {/* Top bar: week nav + actions */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <WeekSelector
            currentDate={currentDate}
            onWeekChange={safeNavigate}
            weekCount={weekCount}
            onWeekCountChange={setWeekCount}
          />
          <div className="flex items-center gap-2">
            <Button
              onClick={() => gridSaveRef.current?.()}
              disabled={!gridDirty || gridSaving}
              size="sm"
              className={gridDirty ? "bg-primary text-primary-foreground shadow-md" : ""}
            >
              {gridSaving ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1.5" />
              )}
              Save
            </Button>
            {multiWeekData && activities && holidaysList && (
              <ExportClipboard
                weekStarts={weekStarts}
                entries={filteredEntries}
                teamMembers={filteredMembers}
                activities={activities}
                holidays={holidaysList}
              />
            )}
            <SettingsPanel />
            <ChangelogPanel />
            <TeamMemberDialog />
          </div>
        </div>

        {/* Filters bar */}
        <div className="flex items-center gap-3 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />

        {/* Multi-person select */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-sm min-w-[160px] justify-between">
              {selectedPersonIds.size > 0
                ? `${selectedPersonIds.size} selected`
                : "Filter people..."}
              <ChevronDown className="h-3 w-3 ml-1.5 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <Input
              value={personSearch}
              onChange={(e) => setPersonSearch(e.target.value)}
              placeholder="Search by name, role..."
              className="h-8 text-sm mb-2"
            />
            <div className="max-h-56 overflow-auto space-y-0.5">
              {personOptions.map((m) => (
                <button
                  key={m.id}
                  className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent hover:text-accent-foreground"
                  onClick={() => togglePerson(m.id)}
                >
                  <div className="h-4 w-4 shrink-0 flex items-center justify-center">
                    {selectedPersonIds.has(m.id) && <Check className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{m.name}</div>
                    {(m.jobFunction || m.company) && (
                      <div className="text-xs text-muted-foreground truncate">
                        {[m.jobFunction, m.company].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
            {selectedPersonIds.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-1 h-7 text-xs"
                onClick={() => setSelectedPersonIds(new Set())}
              >
                Clear selection
              </Button>
            )}
          </PopoverContent>
        </Popover>

        <Select value={showExternal} onValueChange={(v) => setShowExternal(v as any)}>
          <SelectTrigger className="h-8 w-[140px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Members</SelectItem>
            <SelectItem value="internal">SAR Team</SelectItem>
            <SelectItem value="external">External</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={functionFilter || "__all__"}
          onValueChange={(v) => setFunctionFilter(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="h-8 w-[170px] text-sm">
            <SelectValue placeholder="All Functions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Functions</SelectItem>
            {JOB_FUNCTIONS.map((fn) => (
              <SelectItem key={fn} value={fn}>{fn}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          placeholder="Filter by project..."
          className="h-8 w-[180px] text-sm"
        />

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as "name" | "function")}>
          <SelectTrigger className="h-8 w-[150px] text-sm">
            <ArrowUpDown className="h-3 w-3 mr-1.5 opacity-50" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Sort by Name</SelectItem>
            <SelectItem value="function">Sort by Function</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2">
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
        {multiWeekData && (
          <Badge variant="secondary" className="text-xs">
            {filteredMembers.length} of {multiWeekData.teamMembers.length} members
          </Badge>
        )}
      </div>

        {/* Selected person badges */}
        {selectedPersonIds.size > 0 && multiWeekData && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {multiWeekData.teamMembers
              .filter((m) => selectedPersonIds.has(m.id))
              .map((m) => (
                <Badge key={m.id} variant="secondary" className="text-xs pr-1">
                  {m.name}
                  <button
                    className="ml-1 hover:text-foreground"
                    onClick={() => togglePerson(m.id)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
          </div>
        )}
      </div>
      {/* ── End sticky header ── */}

      {/* Grid content */}
      <div className="px-4 pt-4 pb-4 relative">
        {/* Loading overlay — shown on top of existing grid so it doesn't unmount */}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px] rounded-lg">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        {multiWeekData && activities && locationsList && holidaysList ? (
          <WeeklyGrid
            weekStarts={weekStarts}
            entries={filteredEntries}
            teamMembers={filteredMembers}
            activities={activities}
            locations={locationsList}
            holidays={holidaysList}
            onDirtyChange={handleDirtyChange}
          />
        ) : !isLoading ? (
          <div className="text-center py-20 text-muted-foreground">
            Failed to load data. Is the server running?
          </div>
        ) : (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
