import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { addDays, format, startOfISOWeek, getISOWeek, isToday as isTodayFn } from "date-fns";
import { ProjectAutocomplete } from "./project-autocomplete";
import { CopyCheck, MessageSquare, Moon, MapPin, Pencil } from "lucide-react";
import {
  type CapacityEntry,
  type TeamMember,
  type Activity,
  type Location,
  type HolidayRecord,
  useSaveCapacity,
} from "@/hooks/use-capacity";
import { MemberEditDialog } from "./member-edit-dialog";

interface DayInfo {
  date: string;
  label: string;
  dayNum: string;
  isWeekend: boolean;
  isToday: boolean;
  cwNum: number;
  holiday: HolidayRecord | null;
}

interface WeekGroup {
  cwNum: number;
  days: DayInfo[];
  isCurrentWeek: boolean;
}

interface WeeklyGridProps {
  weekStarts: string[];
  entries: CapacityEntry[];
  teamMembers: TeamMember[];
  activities: Activity[];
  locations: Location[];
  holidays: HolidayRecord[];
  /** Called whenever dirty state changes, so parent can render Save in sticky header */
  onDirtyChange?: (dirty: boolean, save: () => Promise<void>, saving: boolean) => void;
}

interface CellState {
  id?: number;
  projectId: number | null;
  projectNumber: string;
  projectDescription: string;
  activityId: number | null;
  locationId: number | null;
  comment: string;
  nightShift: boolean;
  dirty: boolean;
}

type GridState = Record<string, CellState>; // key: `${memberId}-${date}`

function cellKey(memberId: number, date: string) {
  return `${memberId}-${date}`;
}

function emptyCell(): CellState {
  return {
    projectId: null,
    projectNumber: "",
    projectDescription: "",
    activityId: null,
    locationId: null,
    comment: "",
    nightShift: false,
    dirty: false,
  };
}

// ── Lightweight activity picker ──
function ActivityPicker({
  value,
  activities,
  onChange,
}: {
  value: number | null;
  activities: Activity[];
  onChange: (id: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = activities.find((a) => a.id === value);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="h-6 w-full text-[11px] px-1.5 rounded border border-border/50 bg-transparent text-left truncate hover:bg-accent/50 flex items-center justify-between transition-colors"
      >
        <span className={current ? "font-medium" : "text-muted-foreground/60"}>
          {current ? current.name : "—"}
        </span>
        <svg className="h-2.5 w-2.5 opacity-40 shrink-0 ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-48 max-h-52 overflow-auto rounded-md border bg-popover p-1 shadow-lg">
          <button
            className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent hover:text-accent-foreground text-muted-foreground"
            onClick={() => { onChange(null); setOpen(false); }}
          >
            — (none)
          </button>
          {activities.map((a) => (
            <button
              key={a.id}
              className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent hover:text-accent-foreground ${
                a.id === value ? "bg-accent text-accent-foreground font-medium" : ""
              }`}
              onClick={() => { onChange(a.id); setOpen(false); }}
            >
              {a.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Compact comment with inline edit ──
function CommentCell({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditing(false); }}
        className="h-5 w-full text-[10px] px-1 rounded border border-primary/30 bg-transparent outline-none"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="h-5 w-full text-left flex items-center gap-0.5 group"
      title={value || "Add comment"}
    >
      {value ? (
        <span className="text-[10px] text-muted-foreground truncate">{value}</span>
      ) : (
        <MessageSquare className="h-2.5 w-2.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
      )}
    </button>
  );
}

// ── Lightweight location picker ──
function LocationPicker({
  value,
  locations,
  onChange,
}: {
  value: number | null;
  locations: Location[];
  onChange: (id: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = locations.find((l) => l.id === value);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="h-5 w-full text-[10px] px-1 rounded border border-border/30 bg-transparent text-left truncate hover:bg-accent/50 flex items-center gap-0.5 transition-colors"
      >
        <MapPin className={`h-2.5 w-2.5 shrink-0 ${current ? "text-emerald-400" : "text-muted-foreground/30"}`} />
        <span className={current ? "text-emerald-300/90 font-medium truncate" : "text-muted-foreground/40 truncate"}>
          {current ? (current.shortCode || current.name) : "—"}
        </span>
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-44 max-h-48 overflow-auto rounded-md border bg-popover p-1 shadow-lg">
          <button
            className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent hover:text-accent-foreground text-muted-foreground"
            onClick={() => { onChange(null); setOpen(false); }}
          >
            — (none)
          </button>
          {locations.filter(l => l.active).map((l) => (
            <button
              key={l.id}
              className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent hover:text-accent-foreground ${
                l.id === value ? "bg-accent text-accent-foreground font-medium" : ""
              }`}
              onClick={() => { onChange(l.id); setOpen(false); }}
            >
              <span className="font-medium">{l.name}</span>
              {l.shortCode && <span className="ml-1 text-muted-foreground">({l.shortCode})</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function WeeklyGrid({ weekStarts, entries, teamMembers, activities, locations, holidays: holidaysList, onDirtyChange }: WeeklyGridProps) {
  const saveMutation = useSaveCapacity();
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);

  // Build all days across all weeks, with holiday lookup from DB
  const { allDays, weekGroups, weekdaysByWeek } = useMemo(() => {
    // Build a date → holiday lookup from DB records
    const holidayLookup = new Map<string, HolidayRecord>();
    for (const h of holidaysList) {
      if (h.active) {
        // If multiple holidays on same date, prefer showing the first one
        if (!holidayLookup.has(h.date)) {
          holidayLookup.set(h.date, h);
        }
      }
    }

    const allDays: DayInfo[] = [];
    const weekGroups: WeekGroup[] = [];
    const weekdaysByWeek: DayInfo[][] = [];

    for (const ws of weekStarts) {
      const start = startOfISOWeek(new Date(ws + "T00:00:00"));
      const cwNum = getISOWeek(start);
      const days: DayInfo[] = [];
      const weekdays: DayInfo[] = [];

      for (let i = 0; i < 7; i++) {
        const d = addDays(start, i);
        const dateStr = format(d, "yyyy-MM-dd");
        const day: DayInfo = {
          date: dateStr,
          label: format(d, "EEE"),
          dayNum: format(d, "dd"),
          isWeekend: i >= 5,
          isToday: isTodayFn(d),
          cwNum,
          holiday: holidayLookup.get(dateStr) || null,
        };
        days.push(day);
        allDays.push(day);
        if (!day.isWeekend) weekdays.push(day);
      }

      weekGroups.push({ cwNum, days, isCurrentWeek: days.some((d) => d.isToday) });
      weekdaysByWeek.push(weekdays);
    }

    return { allDays, weekGroups, weekdaysByWeek };
  }, [weekStarts, holidaysList]);

  const multiWeek = weekStarts.length > 1;

  // Initialize grid state from entries
  // Track dirty cells in a ref so they survive across any number of grid rebuilds
  // (e.g. when zooming from 1→2 weeks triggers multiple query resolves)
  const dirtyCellsRef = useRef<GridState>({});

  function buildGridFromEntries(serverEntries: CapacityEntry[]): GridState {
    const state: GridState = {};
    for (const entry of serverEntries) {
      const key = cellKey(entry.teamMemberId, entry.date);
      state[key] = {
        id: entry.id,
        projectId: entry.projectId,
        projectNumber: entry.projectNumber || "",
        projectDescription: entry.projectDescription || "",
        activityId: entry.activityId,
        locationId: entry.locationId,
        comment: entry.comment || "",
        nightShift: !!entry.nightShift,
        dirty: false,
      };
    }
    // Overlay dirty (unsaved) cells
    for (const [key, cell] of Object.entries(dirtyCellsRef.current)) {
      state[key] = cell;
    }
    return state;
  }

  const [grid, setGrid] = useState<GridState>(() => buildGridFromEntries(entries));

  // Re-sync when entries change (week navigation, zoom, or after save refetch)
  const entriesKey = useMemo(
    () => entries.map((e) => `${e.id}:${e.projectId}:${e.activityId}:${e.locationId}:${e.comment}:${e.nightShift}`).join(","),
    [entries]
  );
  const [lastEntriesKey, setLastEntriesKey] = useState(entriesKey);
  if (entriesKey !== lastEntriesKey) {
    setLastEntriesKey(entriesKey);
    setGrid(buildGridFromEntries(entries));
  }

  const getCell = useCallback(
    (memberId: number, date: string): CellState => {
      return grid[cellKey(memberId, date)] || emptyCell();
    },
    [grid]
  );

  const updateCell = useCallback(
    (memberId: number, date: string, updates: Partial<CellState>) => {
      setGrid((prev) => {
        const key = cellKey(memberId, date);
        const existing = prev[key] || emptyCell();
        const updated = { ...existing, ...updates, dirty: true };
        // Track in ref so it survives grid rebuilds (zoom, week nav)
        dirtyCellsRef.current[key] = updated;
        return { ...prev, [key]: updated };
      });
    },
    []
  );

  const hasDirty = Object.values(grid).some((c) => c.dirty);

  // Expose save state to parent for sticky header button
  const saveRef = useRef<() => Promise<void>>();
  saveRef.current = handleSave;
  const stableSave = useCallback(() => saveRef.current?.() ?? Promise.resolve(), []);

  useEffect(() => {
    onDirtyChange?.(hasDirty, stableSave, saveMutation.isPending);
  }, [hasDirty, saveMutation.isPending, onDirtyChange, stableSave]);

  // ── Fill week: copy Monday's data to Tue-Fri ──
  function fillWeek(memberId: number, weekIndex: number) {
    const weekdays = weekdaysByWeek[weekIndex];
    if (!weekdays || weekdays.length === 0) return;

    const mondayCell = getCell(memberId, weekdays[0].date);
    if (!mondayCell.projectId && !mondayCell.activityId) return;

    setGrid((prev) => {
      const next = { ...prev };
      for (let i = 1; i < weekdays.length; i++) {
        const key = cellKey(memberId, weekdays[i].date);
        const existing = next[key] || emptyCell();
        if (!existing.projectId && !existing.activityId && !existing.comment) {
          const filled = {
            ...existing,
            projectId: mondayCell.projectId,
            projectNumber: mondayCell.projectNumber,
            projectDescription: mondayCell.projectDescription,
            activityId: mondayCell.activityId,
            locationId: mondayCell.locationId,
            comment: mondayCell.comment,
            nightShift: mondayCell.nightShift,
            dirty: true,
          };
          next[key] = filled;
          dirtyCellsRef.current[key] = filled;
        }
      }
      return next;
    });
  }

  async function handleSave() {
    const dirtyKeys: string[] = [];
    const dirtyEntries = Object.entries(grid)
      .filter(([, cell]) => cell.dirty)
      .map(([key, cell]) => {
        dirtyKeys.push(key);
        const [memberIdStr, date] = key.split(/-(.+)/);
        return {
          id: cell.id || undefined,
          teamMemberId: Number(memberIdStr),
          date,
          projectId: cell.projectId,
          activityId: cell.activityId,
          locationId: cell.locationId,
          comment: cell.comment || null,
          nightShift: cell.nightShift,
        };
      });

    if (!dirtyEntries.length) return;

    const result = await saveMutation.mutateAsync(dirtyEntries);

    // Clear dirty flags and update IDs for newly-created entries.
    // We can't rely solely on the entriesKey re-sync because the refetched
    // data may produce the same key (data matches what we just saved),
    // so the grid wouldn't rebuild and dirty flags would persist.
    const savedEntries: { id: number; teamMemberId: number; date: string }[] = result?.entries || [];
    const idLookup = new Map(savedEntries.map((e) => [`${e.teamMemberId}-${e.date}`, e.id]));

    // Clear the dirty ref — these cells are now saved
    dirtyCellsRef.current = {};

    setGrid((prev) => {
      const next = { ...prev };
      for (const key of dirtyKeys) {
        if (next[key]) {
          const serverId = idLookup.get(key);
          next[key] = {
            ...next[key],
            dirty: false,
            ...(serverId ? { id: serverId } : {}),
          };
        }
      }
      return next;
    });
  }

  // Separate internal vs external members
  const internal = teamMembers.filter((m) => !m.isExternal);
  const external = teamMembers.filter((m) => m.isExternal);

  return (
    <div className="space-y-3">

      <div className="overflow-auto border-2 border-border rounded-lg bg-card">
        <table className="w-full border-collapse">
          <thead>
            {/* CW header row */}
            <tr>
              <th className="sticky left-0 z-30 bg-card border-b-2 border-border px-3 py-2 w-[200px] min-w-[200px]" />
              {weekGroups.map((wg) => (
                <th
                  key={wg.cwNum}
                  colSpan={wg.days.length}
                  className={`border-b-2 border-l-2 px-2 py-2 text-center ${
                    wg.isCurrentWeek
                      ? "bg-primary/10 border-primary/30"
                      : "border-border"
                  }`}
                >
                  <span className={`text-sm font-bold tracking-wider ${
                    wg.isCurrentWeek ? "text-primary" : "text-muted-foreground"
                  }`}>
                    CW {String(wg.cwNum).padStart(2, "0")}
                  </span>
                </th>
              ))}
            </tr>
            {/* Day header row */}
            <tr>
              <th className="sticky left-0 z-30 bg-card border-b-2 border-r-2 border-border px-3 py-1.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[200px] min-w-[200px]">
                Team Member
              </th>
              {allDays.map((day) => (
                <th
                  key={day.date}
                  className={`border-b-2 border-border border-l px-1.5 py-1.5 text-center min-w-[150px] ${
                    day.isWeekend ? "bg-muted/20 text-muted-foreground/50" : ""
                  } ${day.isToday ? "bg-primary/15 border-l-2 border-l-primary border-r-2 border-r-primary" : ""} ${day.holiday ? "bg-rose-500/[0.08]" : ""}`}
                >
                  <div className={`text-xs font-semibold ${day.isToday ? "text-primary" : "text-foreground/80"}`}>
                    {day.label}
                    <span className="ml-1 font-normal text-muted-foreground">{day.dayNum}</span>
                  </div>
                  {day.isToday && (
                    <div className="text-[9px] font-bold text-primary uppercase tracking-widest">today</div>
                  )}
                  {day.holiday && (
                    <div className="text-[9px] font-medium text-rose-400 truncate leading-tight mt-0.5" title={day.holiday.nameLocal ? `${day.holiday.name} / ${day.holiday.nameLocal}` : day.holiday.name}>
                      <span className="inline-flex items-center gap-0.5">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${day.holiday.category === "us_federal" ? "bg-blue-400" : day.holiday.category === "german" ? "bg-amber-400" : "bg-emerald-400"}`} />
                        {day.holiday.category === "german" && day.holiday.nameLocal ? day.holiday.nameLocal : day.holiday.name}
                      </span>
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {renderMemberGroup(internal, "SAR Team")}
            {external.length > 0 && renderMemberGroup(external, "External / Subcontractors")}
          </tbody>
        </table>
      </div>
      <MemberEditDialog
        member={editingMember}
        open={!!editingMember}
        onOpenChange={(open) => { if (!open) setEditingMember(null); }}
      />
    </div>
  );

  function renderMemberGroup(members: TeamMember[], groupLabel: string) {
    return (
      <>
        <tr>
          <td
            colSpan={1 + allDays.length}
            className="sticky left-0 bg-muted/60 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground border-y-2 border-border"
          >
            {groupLabel}
          </td>
        </tr>
        {members.map((member, memberIdx) => renderMemberRow(member, memberIdx))}
      </>
    );
  }

  function renderMemberRow(member: TeamMember, memberIdx: number) {
    const isEven = memberIdx % 2 === 0;
    const bgClass = isEven ? "bg-card" : "bg-muted/[0.15]";
    // Sticky cells need opaque backgrounds so content doesn't bleed through when scrolling
    const stickyBgClass = isEven ? "bg-card" : "bg-[hsl(var(--muted))]";

    return (
      <tr
        key={member.id}
        className={`${bgClass} border-b border-border/40 hover:bg-accent/5 transition-colors`}
      >
        {/* Member name — sticky left */}
        <td className={`sticky left-0 z-20 ${stickyBgClass} border-r-2 border-border px-3 py-2 align-top w-[200px] min-w-[200px]`}>
          <div className="flex items-start justify-between gap-1">
            <button
              className="min-w-0 text-left group/name cursor-pointer hover:text-primary transition-colors"
              onClick={() => setEditingMember(member)}
              title="Click to edit member"
            >
              <div className="font-semibold text-sm leading-tight truncate flex items-center gap-1">
                {member.name}
                <Pencil className="h-2.5 w-2.5 opacity-0 group-hover/name:opacity-50 shrink-0 transition-opacity" />
              </div>
              {(member.jobFunction || member.company) && (
                <div className="text-[10px] text-muted-foreground/70 truncate mt-0.5">
                  {[member.jobFunction, member.company].filter(Boolean).join(" · ")}
                </div>
              )}
            </button>
            {/* Fill week buttons */}
            <div className="flex gap-0.5 shrink-0">
              {weekdaysByWeek.map((weekdays, wIdx) => {
                const mondayCell = getCell(member.id, weekdays[0]?.date);
                const hasMonday = !!(mondayCell.projectId || mondayCell.activityId);
                if (!hasMonday) return null;
                return (
                  <button
                    key={wIdx}
                    className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/50 hover:text-primary hover:bg-primary/10 transition-colors"
                    onClick={() => fillWeek(member.id, wIdx)}
                    title={`Copy Monday to Tue-Fri${multiWeek ? ` (CW ${weekGroups[wIdx]?.cwNum})` : ""}`}
                  >
                    <CopyCheck className="h-3 w-3" />
                  </button>
                );
              })}
            </div>
          </div>
        </td>

        {/* Day cells — each cell is a compact card with project + activity + comment */}
        {allDays.map((day) => {
          const cell = getCell(member.id, day.date);
          const isEmpty = !cell.projectId && !cell.activityId && !cell.comment;
          const isDirty = cell.dirty;

          return (
            <td
              key={day.date}
              className={`border-l px-1 py-1.5 align-top min-w-[150px] ${
                day.isWeekend ? "bg-muted/15" : ""
              } ${day.isToday ? "bg-primary/[0.06] border-l-2 border-l-primary border-r-2 border-r-primary" : ""} ${
                day.holiday ? "bg-rose-500/[0.04]" : ""
              } ${isDirty ? "bg-yellow-500/[0.08]" : ""} ${
                cell.nightShift ? "bg-indigo-500/[0.08]" : ""
              }`}
            >
              <div className={`space-y-0.5 ${isEmpty ? "opacity-60" : ""}`}>
                {/* Top row: project # + night shift toggle */}
                <div className="flex items-center gap-0.5">
                  <div className="flex-1 min-w-0">
                    <ProjectAutocomplete
                      value={cell.projectNumber}
                      onChange={(project) => {
                        if (project) {
                          updateCell(member.id, day.date, {
                            projectId: project.id,
                            projectNumber: project.number,
                            projectDescription: project.description || "",
                          });
                        } else {
                          updateCell(member.id, day.date, {
                            projectId: null,
                            projectNumber: "",
                            projectDescription: "",
                          });
                        }
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => updateCell(member.id, day.date, { nightShift: !cell.nightShift })}
                    className={`shrink-0 h-5 w-5 flex items-center justify-center rounded transition-colors ${
                      cell.nightShift
                        ? "bg-indigo-500/30 text-indigo-300"
                        : "text-muted-foreground/20 hover:text-muted-foreground/50 hover:bg-muted/50"
                    }`}
                    title={cell.nightShift ? "Night shift (click to remove)" : "Mark as night shift"}
                  >
                    <Moon className="h-3 w-3" />
                  </button>
                </div>
                {/* Project description — only show if there's a project */}
                {cell.projectDescription && (
                  <div className="px-1 text-[10px] leading-tight text-muted-foreground/70 truncate" title={cell.projectDescription}>
                    {cell.projectDescription}
                  </div>
                )}
                {/* Activity picker */}
                <ActivityPicker
                  value={cell.activityId}
                  activities={activities}
                  onChange={(id) =>
                    updateCell(member.id, day.date, { activityId: id })
                  }
                />
                {/* Location picker */}
                <LocationPicker
                  value={cell.locationId}
                  locations={locations}
                  onChange={(id) =>
                    updateCell(member.id, day.date, { locationId: id })
                  }
                />
                {/* Comment — inline click-to-edit */}
                <CommentCell
                  value={cell.comment}
                  onChange={(v) =>
                    updateCell(member.id, day.date, { comment: v })
                  }
                />
              </div>
            </td>
          );
        })}
      </tr>
    );
  }
}
