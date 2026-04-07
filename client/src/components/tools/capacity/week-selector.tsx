import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CalendarDays,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  startOfISOWeek,
  endOfISOWeek,
  addWeeks,
  subWeeks,
  getISOWeek,
  format,
} from "date-fns";

interface WeekSelectorProps {
  currentDate: Date;
  onWeekChange: (date: Date) => void;
  weekCount: number;
  onWeekCountChange: (count: number) => void;
}

const WEEK_OPTIONS = [1, 2, 4];

export function WeekSelector({
  currentDate,
  onWeekChange,
  weekCount,
  onWeekCountChange,
}: WeekSelectorProps) {
  const weekStart = startOfISOWeek(currentDate);
  const weekEnd = endOfISOWeek(addWeeks(currentDate, weekCount - 1));
  const weekNum = getISOWeek(currentDate);
  const endWeekNum = getISOWeek(addWeeks(currentDate, weekCount - 1));

  const weekLabel =
    weekCount === 1
      ? `CW ${String(weekNum).padStart(2, "0")}`
      : `CW ${String(weekNum).padStart(2, "0")}–${String(endWeekNum).padStart(2, "0")}`;

  function zoomIn() {
    const idx = WEEK_OPTIONS.indexOf(weekCount);
    if (idx > 0) onWeekCountChange(WEEK_OPTIONS[idx - 1]);
  }

  function zoomOut() {
    const idx = WEEK_OPTIONS.indexOf(weekCount);
    if (idx < WEEK_OPTIONS.length - 1) onWeekCountChange(WEEK_OPTIONS[idx + 1]);
  }

  return (
    <div className="flex items-center gap-2">
      {/* Skip back 4 weeks */}
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => onWeekChange(subWeeks(currentDate, 4))}
        title="Back 4 weeks"
      >
        <ChevronsLeft className="h-4 w-4" />
      </Button>

      {/* Back 1 week */}
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => onWeekChange(subWeeks(currentDate, 1))}
        title="Previous week"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-2 min-w-[260px] justify-center">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <span className="font-semibold text-lg">{weekLabel}</span>
        <span className="text-muted-foreground text-sm">
          {format(weekStart, "dd MMM")} – {format(weekEnd, "dd MMM yyyy")}
        </span>
      </div>

      {/* Forward 1 week */}
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => onWeekChange(addWeeks(currentDate, 1))}
        title="Next week"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {/* Skip forward 4 weeks */}
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => onWeekChange(addWeeks(currentDate, 4))}
        title="Forward 4 weeks"
      >
        <ChevronsRight className="h-4 w-4" />
      </Button>

      <Button variant="ghost" size="sm" className="h-8" onClick={() => onWeekChange(new Date())}>
        Today
      </Button>

      {/* Zoom controls */}
      <div className="flex items-center gap-1 ml-2 border-l pl-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={zoomIn}
          disabled={weekCount === 1}
          title="Fewer weeks"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground w-14 text-center">
          {weekCount === 1 ? "1 week" : `${weekCount} weeks`}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={zoomOut}
          disabled={weekCount === 4}
          title="More weeks"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
