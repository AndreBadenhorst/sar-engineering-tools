import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ClipboardCopy, Check, ChevronDown } from "lucide-react";
import {
  type CapacityEntry,
  type TeamMember,
  type Activity,
  type HolidayRecord,
} from "@/hooks/use-capacity";

interface ExportClipboardProps {
  weekStarts: string[];
  entries: CapacityEntry[];
  teamMembers: TeamMember[];
  activities: Activity[];
  holidays: HolidayRecord[];
}

interface DayCol {
  date: string;
  label: string;
  dayNum: string;
  isWeekend: boolean;
  cwNum: number;
  holiday: HolidayRecord | null;
}

function buildDays(weekStarts: string[], holidays: HolidayRecord[]): DayCol[] {
  const holidayLookup = new Map<string, HolidayRecord>();
  for (const h of holidays) {
    if (h.active && !holidayLookup.has(h.date)) {
      holidayLookup.set(h.date, h);
    }
  }
  const days: DayCol[] = [];

  for (const ws of weekStarts) {
    const start = new Date(ws + "T00:00:00");
    // Ensure Monday
    const dow = start.getDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    start.setDate(start.getDate() + mondayOffset);

    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      days.push({
        date: dateStr,
        label: labels[d.getDay()],
        dayNum: String(d.getDate()).padStart(2, "0"),
        isWeekend: i >= 5,
        cwNum: getISOWeek(d),
        holiday: holidayLookup.get(dateStr) || null,
      });
    }
  }
  return days;
}

function getISOWeek(d: Date): number {
  const tmp = new Date(d.getTime());
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const week1 = new Date(tmp.getFullYear(), 0, 4);
  return 1 + Math.round(((tmp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

function generateHTML(
  days: DayCol[],
  members: TeamMember[],
  entries: CapacityEntry[],
  activities: Activity[],
  selectedMembers: Set<number>,
  weekdaysOnly: boolean,
): string {
  const filteredDays = weekdaysOnly ? days.filter((d) => !d.isWeekend) : days;
  const filteredMembers = members.filter((m) => selectedMembers.has(m.id));
  const activityMap = new Map(activities.map((a) => [a.id, a.name]));

  // Build entry lookup: memberId-date -> entry
  const entryMap = new Map<string, CapacityEntry>();
  for (const e of entries) {
    entryMap.set(`${e.teamMemberId}-${e.date}`, e);
  }

  // Group days by CW
  const cwGroups: { cw: number; days: DayCol[] }[] = [];
  let lastCw = -1;
  for (const day of filteredDays) {
    if (day.cwNum !== lastCw) {
      cwGroups.push({ cw: day.cwNum, days: [] });
      lastCw = day.cwNum;
    }
    cwGroups[cwGroups.length - 1].days.push(day);
  }

  const borderStyle = "border:1px solid #444;padding:4px 6px;";
  const headerBg = "background:#1e293b;color:#e2e8f0;";
  const cwBg = "background:#0f172a;color:#38bdf8;font-weight:bold;text-align:center;";
  const altRowBg = "background:#1a1f2e;";
  const nightBg = "background:#312e81;color:#a5b4fc;";
  const holidayBg = "background:#3f1219;color:#fca5a5;";

  let html = `<table style="border-collapse:collapse;font-family:Segoe UI,Arial,sans-serif;font-size:11px;color:#cbd5e1;background:#0f172a;width:100%;">`;

  // CW header row
  html += `<tr>`;
  html += `<th style="${borderStyle}${cwBg}">Team Member</th>`;
  for (const g of cwGroups) {
    html += `<th colspan="${g.days.length}" style="${borderStyle}${cwBg}">CW ${String(g.cw).padStart(2, "0")}</th>`;
  }
  html += `</tr>`;

  // Day header row
  html += `<tr>`;
  html += `<th style="${borderStyle}${headerBg}"></th>`;
  for (const day of filteredDays) {
    const isHoliday = !!day.holiday;
    const bg = isHoliday ? holidayBg : headerBg;
    const holidayLabel = day.holiday
      ? `<br><span style="font-size:9px;font-weight:normal;">${day.holiday.category === "german" && day.holiday.nameLocal ? day.holiday.nameLocal : day.holiday.name}</span>`
      : "";
    html += `<th style="${borderStyle}${bg}text-align:center;min-width:100px;">${day.label} ${day.dayNum}${holidayLabel}</th>`;
  }
  html += `</tr>`;

  // Member rows
  filteredMembers.forEach((member, mIdx) => {
    const rowBg = mIdx % 2 === 1 ? altRowBg : "";
    html += `<tr>`;
    html += `<td style="${borderStyle}${rowBg}font-weight:bold;white-space:nowrap;vertical-align:top;">${member.name}</td>`;

    for (const day of filteredDays) {
      const entry = entryMap.get(`${member.id}-${day.date}`);
      const isHoliday = !!day.holiday;
      const isNight = entry?.nightShift;
      let cellBg = rowBg;
      if (isNight) cellBg = nightBg;
      else if (isHoliday) cellBg = "background:#1f1215;";

      const parts: string[] = [];
      if (entry?.projectNumber) {
        parts.push(`<strong>${entry.projectNumber}</strong>`);
      }
      if (entry?.projectDescription) {
        parts.push(`<span style="font-size:10px;color:#94a3b8;">${entry.projectDescription}</span>`);
      }
      if (entry?.activityId) {
        const actName = activityMap.get(entry.activityId) || "";
        if (actName) parts.push(`<span style="color:#60a5fa;">${actName}</span>`);
      }
      if (isNight) {
        parts.push(`<span style="font-size:9px;">🌙 Night Shift</span>`);
      }
      if ((entry as any)?.locationName) {
        parts.push(`<span style="font-size:10px;color:#34d399;">📍 ${(entry as any).locationName}</span>`);
      }
      if (entry?.comment) {
        parts.push(`<span style="font-size:10px;color:#9ca3af;font-style:italic;">${entry.comment}</span>`);
      }

      html += `<td style="${borderStyle}${cellBg}vertical-align:top;min-width:100px;">${parts.join("<br>")}</td>`;
    }
    html += `</tr>`;
  });

  html += `</table>`;
  return html;
}

export function ExportClipboard({ weekStarts, entries, teamMembers, activities, holidays }: ExportClipboardProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [weekdaysOnly, setWeekdaysOnly] = useState(true);
  const [selectedMembers, setSelectedMembers] = useState<Set<number>>(
    () => new Set(teamMembers.map((m) => m.id))
  );
  const previewRef = useRef<HTMLDivElement>(null);

  // Update selected members when teamMembers changes
  const memberIds = teamMembers.map((m) => m.id).join(",");
  const [lastMemberIds, setLastMemberIds] = useState(memberIds);
  if (memberIds !== lastMemberIds) {
    setLastMemberIds(memberIds);
    setSelectedMembers(new Set(teamMembers.map((m) => m.id)));
  }

  const days = buildDays(weekStarts, holidays);
  const internal = teamMembers.filter((m) => !m.isExternal);
  const external = teamMembers.filter((m) => m.isExternal);

  function toggleMember(id: number) {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedMembers(new Set(teamMembers.map((m) => m.id)));
  }

  function selectNone() {
    setSelectedMembers(new Set());
  }

  async function copyToClipboard() {
    const html = generateHTML(days, teamMembers, entries, activities, selectedMembers, weekdaysOnly);

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob(["Capacity Planner Export"], { type: "text/plain" }),
        }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the preview content
      if (previewRef.current) {
        const range = document.createRange();
        range.selectNodeContents(previewRef.current);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        document.execCommand("copy");
        sel?.removeAllRanges();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  }

  const previewHTML = generateHTML(days, teamMembers, entries, activities, selectedMembers, weekdaysOnly);

  return (
    <>
      <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setOpen(true)}>
        <ClipboardCopy className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Export</span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-[90vw] sm:w-[800px] sm:max-w-[800px] p-0 flex flex-col">
          <SheetHeader className="px-4 pt-4 pb-2 border-b shrink-0">
            <SheetTitle className="flex items-center gap-2 text-base pr-6">
              <ClipboardCopy className="h-4 w-4" />
              Export for Outlook
            </SheetTitle>
          </SheetHeader>

          {/* Controls */}
          <div className="px-4 py-3 border-b space-y-3 shrink-0">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={weekdaysOnly}
                  onChange={(e) => setWeekdaysOnly(e.target.checked)}
                  className="rounded"
                />
                Weekdays only
              </label>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={selectAll}>
                Select All
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={selectNone}>
                Select None
              </Button>
            </div>

            {/* Member checkboxes */}
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 max-h-[120px] overflow-auto">
              {internal.length > 0 && (
                <>
                  <div className="w-full text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">SAR Team</div>
                  {internal.map((m) => (
                    <label key={m.id} className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedMembers.has(m.id)}
                        onChange={() => toggleMember(m.id)}
                        className="rounded"
                      />
                      {m.name}
                    </label>
                  ))}
                </>
              )}
              {external.length > 0 && (
                <>
                  <div className="w-full text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1">External</div>
                  {external.map((m) => (
                    <label key={m.id} className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedMembers.has(m.id)}
                        onChange={() => toggleMember(m.id)}
                        className="rounded"
                      />
                      {m.name}
                    </label>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Preview */}
          <div className="flex-1 overflow-auto p-3">
            <div
              ref={previewRef}
              dangerouslySetInnerHTML={{ __html: previewHTML }}
              className="overflow-auto"
            />
          </div>

          {/* Copy button */}
          <div className="shrink-0 px-4 py-3 border-t flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {selectedMembers.size} of {teamMembers.length} members selected
            </p>
            <Button onClick={copyToClipboard} className="gap-1.5">
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <ClipboardCopy className="h-4 w-4" />
                  Copy to Clipboard
                </>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
