import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { addDays, format, startOfISOWeek, getISOWeek, isToday as isTodayFn } from "date-fns";
import { ProjectAutocomplete } from "./project-autocomplete";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save, Loader2, CopyCheck, MessageSquare, Moon } from "lucide-react";
import {
  type CapacityEntry,
  type TeamMember,
  type Activity,
  useSaveCapacity,
} from "@/hooks/use-capacity";
import { holidayMap, type Holiday } from "@shared/holidays";

interface DayInfo {
  date: string;
  label: string;
  dayNum: string;
  isWeekend: boolean;
  isToday: boolean;
  cwNum: number;
  holiday: Holiday | null;
}

interface WeekGroup {
  cwNum: number;
  days: DayInfo[];
}

interface WeeklyGridProps {
  weekStarts: string[];
  entries: CapacityEntry[];
  teamMembers: TeamMember[];
  activities: Activity[];
}

interface CellState {
  id?: number;
  projectId: number | null;
  projectNumber: string;
  projectDescription: string;
  activityId: number | null;
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

export function WeeklyGrid({ weekStarts, entries, teamMembers, activities }: WeeklyGridProps) {
  const saveMutation = useSaveCapacity();

  // Build all days across all weeks, with holiday lookup
  const { allDays, weekGroups, weekdaysByWeek } = useMemo(() => {
    // Determine which years we need holidays for
    const yearSet = new Set<number>();
    for (const ws of weekStarts) {
      const y = new Date(ws + "T00:00:00").getFullYear();
      yearSet.add(y);
      yearSet.add(y + 1); // in case week spans year boundary
    }
    const holidays = holidayMap(Array.from(yearSet));

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
          holiday: holidays.get(dateStr) || null,
        };
        days.push(day);
        allDays.push(day);
        if (!day.isWeekend) weekdays.push(day);
      }

      weekGroups.push({ cwNum, days });
      weekdaysByWeek.push(weekdays);
    }

    return { allDays, weekGroups, weekdaysByWeek };
  }, [weekStarts]);

  const multiWeek = weekStarts.length > 1;

  // Initialize grid state from entries
  const [grid, setGrid] = useState<GridState>(() => {
    const state: GridState = {};
    for (const entry of entries) {
      const key = cellKey(entry.teamMemberId, entry.date);
      state[key] = {
        id: entry.id,
        projectId: entry.projectId,
        projectNumber: entry.projectNumber || "",
        projectDescription: entry.projectDescription || "",
        activityId: entry.activityId,
        comment: entry.comment || "",
        nightShift: !!entry.nightShift,
        dirty: false,
      };
    }
    return state;
  });

  // Re-sync when entries change (week navigation)
  const entriesKey = useMemo(() => entries.map((e) => e.id).join(","), [entries]);
  const [lastEntriesKey, setLastEntriesKey] = useState(entriesKey);
  if (entriesKey !== lastEntriesKey) {
    setLastEntriesKey(entriesKey);
    const state: GridState = {};
    for (const entry of entries) {
      const key = cellKey(entry.teamMemberId, entry.date);
      state[key] = {
        id: entry.id,
        projectId: entry.projectId,
        projectNumber: entry.projectNumber || "",
        projectDescription: entry.projectDescription || "",
        activityId: entry.activityId,
        comment: entry.comment || "",
        nightShift: !!entry.nightShift,
        dirty: false,
      };
    }
    setGrid(state);
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
        return { ...prev, [key]: { ...existing, ...updates, dirty: true } };
      });
    },
    []
  );

  const hasDirty = Object.values(grid).some((c) => c.dirty);

  const dirtyRef = useRef(false);
  dirtyRef.current = hasDirty;

  useEffect(() => {
    const el = document.getElementById("capacity-grid-root");
    if (el) el.setAttribute("data-dirty", String(hasDirty));
  }, [hasDirty]);

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
          next[key] = {
            ...existing,
            projectId: mondayCell.projectId,
            projectNumber: mondayCell.projectNumber,
            projectDescription: mondayCell.projectDescription,
            activityId: mondayCell.activityId,
            comment: mondayCell.comment,
            nightShift: mondayCell.nightShift,
            dirty: true,
          };
        }
      }
      return next;
    });
  }

  async function handleSave() {
    const dirtyEntries = Object.entries(grid)
      .filter(([, cell]) => cell.dirty)
      .map(([key, cell]) => {
        const [memberIdStr, date] = key.split(/-(.+)/);
        return {
          id: cell.id || undefined,
          teamMemberId: Number(memberIdStr),
          date,
          projectId: cell.projectId,
          activityId: cell.activityId,
          comment: cell.comment || null,
          nightShift: cell.nightShift,
        };
      });

    if (!dirtyEntries.length) return;

    const result = await saveMutation.mutateAsync(dirtyEntries);

    setGrid((prev) => {
      const next = { ...prev };
      for (const saved of result.entries || []) {
        const key = cellKey(saved.teamMemberId, saved.date);
        if (next[key]) {
          next[key] = { ...next[key], id: saved.id, dirty: false };
        }
      }
      return next;
    });
  }

  // Separate internal vs external members
  const internal = teamMembers.filter((m) => !m.isExternal);
  const external = teamMembers.filter((m) => m.isExternal);

  return (
    <div className="space-y-3" id="capacity-grid-root" data-dirty={String(hasDirty)}>
      {/* Save bar */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={!hasDirty || saveMutation.isPending} size="sm">
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1.5" />
          )}
          Save Changes
        </Button>
      </div>

      <div className="overflow-auto border rounded-lg bg-card">
        <table className="w-full border-collapse">
          <thead>
            {/* CW header row */}
            <tr>
              <th className="sticky left-0 z-30 bg-card border-b-2 border-primary/20 px-3 py-2 w-[200px] min-w-[200px]" />
              {weekGroups.map((wg) => (
                <th
                  key={wg.cwNum}
                  colSpan={wg.days.length}
                  className="border-b-2 border-primary/20 border-l px-2 py-2 text-center"
                >
                  <span className="text-sm font-bold text-primary tracking-wider">
                    CW {String(wg.cwNum).padStart(2, "0")}
                  </span>
                </th>
              ))}
            </tr>
            {/* Day header row */}
            <tr>
              <th className="sticky left-0 z-30 bg-card border-b border-r px-3 py-1.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[200px] min-w-[200px]">
                Team Member
              </th>
              {allDays.map((day) => (
                <th
                  key={day.date}
                  className={`border-b border-l px-1.5 py-1.5 text-center min-w-[150px] ${
                    day.isWeekend ? "bg-muted/20 text-muted-foreground/50" : ""
                  } ${day.isToday ? "bg-primary/10" : ""} ${day.holiday ? "bg-rose-500/[0.08]" : ""}`}
                >
                  <div className={`text-xs font-semibold ${day.isToday ? "text-primary" : "text-foreground/80"}`}>
                    {day.label}
                    <span className="ml-1 font-normal text-muted-foreground">{day.dayNum}</span>
                  </div>
                  {day.isToday && (
                    <div className="text-[9px] font-medium text-primary/70 uppercase tracking-widest">today</div>
                  )}
                  {day.holiday && (
                    <div className="text-[9px] font-medium text-rose-400 truncate leading-tight mt-0.5" title={day.holiday.nameDE ? `${day.holiday.name} / ${day.holiday.nameDE}` : day.holiday.name}>
                      <span className="inline-flex items-center gap-0.5">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${day.holiday.country === "US" ? "bg-blue-400" : day.holiday.country === "DE" ? "bg-amber-400" : "bg-rose-400"}`} />
                        {day.holiday.country === "DE" ? (day.holiday.nameDE || day.holiday.name) : day.holiday.name}
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
    </div>
  );

  function renderMemberGroup(members: TeamMember[], groupLabel: string) {
    return (
      <>
        <tr>
          <td
            colSpan={1 + allDays.length}
            className="sticky left-0 bg-muted/60 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground border-y border-border/50"
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

    return (
      <tr
        key={member.id}
        className={`${bgClass} border-b border-border/40 hover:bg-accent/5 transition-colors`}
      >
        {/* Member name — sticky left */}
        <td className={`sticky left-0 z-20 ${bgClass} border-r px-3 py-2 align-top w-[200px] min-w-[200px]`}>
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0">
              <div className="font-semibold text-sm leading-tight truncate">{member.name}</div>
              {(member.role || member.company) && (
                <div className="text-[10px] text-muted-foreground/70 truncate mt-0.5">
                  {[member.role, member.company].filter(Boolean).join(" · ")}
                </div>
              )}
            </div>
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
              } ${day.isToday ? "bg-primary/[0.04]" : ""} ${
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
