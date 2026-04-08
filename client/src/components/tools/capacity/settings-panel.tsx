import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, Plus, Trash2, MapPin, Calendar } from "lucide-react";

/** Format YYYY-MM-DD → MM/DD/YYYY for US display */
function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}
import {
  useHolidays,
  useCreateHoliday,
  useDeleteHoliday,
  useLocations,
  useCreateLocation,
  useDeleteLocation,
  type HolidayRecord,
  type Location,
} from "@/hooks/use-capacity";

type Tab = "holidays" | "locations";
type HolidayCategory = "us_federal" | "german" | "company";

const CATEGORY_LABELS: Record<HolidayCategory, string> = {
  us_federal: "US Federal",
  german: "German",
  company: "SAR Company",
};

const CATEGORY_COLORS: Record<HolidayCategory, string> = {
  us_federal: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  german: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  company: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

export function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("holidays");

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Settings className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Settings</span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-[90vw] sm:w-[600px] sm:max-w-[600px] p-0 flex flex-col">
          <SheetHeader className="px-4 pt-4 pb-2 border-b shrink-0">
            <SheetTitle className="flex items-center gap-2 text-base pr-6">
              <Settings className="h-4 w-4" />
              Capacity Planner Settings
            </SheetTitle>
          </SheetHeader>

          {/* Tab bar */}
          <div className="flex border-b shrink-0">
            <button
              className={`flex-1 px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                tab === "holidays"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setTab("holidays")}
            >
              <Calendar className="h-3.5 w-3.5" />
              Holidays
            </button>
            <button
              className={`flex-1 px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                tab === "locations"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setTab("locations")}
            >
              <MapPin className="h-3.5 w-3.5" />
              Locations
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-auto">
            {tab === "holidays" ? <HolidaysTab /> : <LocationsTab />}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// HOLIDAYS TAB
// ══════════════════════════════════════════════════════════════

function HolidaysTab() {
  const { data: allHolidays, isLoading } = useHolidays();
  const createMutation = useCreateHoliday();
  const deleteMutation = useDeleteHoliday();

  const [filterCategory, setFilterCategory] = useState<HolidayCategory | "all">("all");
  const [filterYear, setFilterYear] = useState<string>("all");

  // New holiday form
  const [newDate, setNewDate] = useState("");
  const [newName, setNewName] = useState("");
  const [newNameLocal, setNewNameLocal] = useState("");
  const [newCategory, setNewCategory] = useState<HolidayCategory>("company");

  // Get available years from data
  const years = useMemo(() => {
    if (!allHolidays) return [];
    const yearSet = new Set<string>();
    for (const h of allHolidays) {
      yearSet.add(h.date.slice(0, 4));
    }
    return Array.from(yearSet).sort();
  }, [allHolidays]);

  // Filter holidays
  const filtered = useMemo(() => {
    if (!allHolidays) return [];
    return allHolidays.filter((h) => {
      if (filterCategory !== "all" && h.category !== filterCategory) return false;
      if (filterYear !== "all" && !h.date.startsWith(filterYear)) return false;
      return true;
    });
  }, [allHolidays, filterCategory, filterYear]);

  // Group by category for display
  const grouped = useMemo(() => {
    const groups: Record<HolidayCategory, HolidayRecord[]> = {
      us_federal: [],
      german: [],
      company: [],
    };
    for (const h of filtered) {
      groups[h.category as HolidayCategory]?.push(h);
    }
    return groups;
  }, [filtered]);

  async function handleAdd() {
    if (!newDate || !newName) return;
    await createMutation.mutateAsync({
      date: newDate,
      name: newName.trim(),
      nameLocal: newNameLocal.trim() || undefined,
      category: newCategory,
    });
    setNewDate("");
    setNewName("");
    setNewNameLocal("");
  }

  async function handleDelete(id: number) {
    await deleteMutation.mutateAsync(id);
  }

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading holidays...</div>;
  }

  return (
    <div className="p-4 space-y-4">
      {/* Add new holiday form */}
      <div className="border rounded-lg p-3 space-y-2.5 bg-muted/30">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Add Holiday</div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="h-8 text-sm"
          />
          <Select value={newCategory} onValueChange={(v) => setNewCategory(v as HolidayCategory)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="us_federal">US Federal</SelectItem>
              <SelectItem value="german">German</SelectItem>
              <SelectItem value="company">SAR Company</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Holiday name (English)"
            className="h-8 text-sm"
          />
          <Input
            value={newNameLocal}
            onChange={(e) => setNewNameLocal(e.target.value)}
            placeholder="Local name (optional)"
            className="h-8 text-sm"
          />
        </div>
        <Button
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={handleAdd}
          disabled={!newDate || !newName || createMutation.isPending}
        >
          <Plus className="h-3 w-3" />
          Add Holiday
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v as any)}>
          <SelectTrigger className="h-8 w-[140px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="us_federal">US Federal</SelectItem>
            <SelectItem value="german">German</SelectItem>
            <SelectItem value="company">SAR Company</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="h-8 w-[100px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground ml-auto">
          {filtered.length} holidays
        </div>
      </div>

      {/* Holiday list grouped by category */}
      {(["us_federal", "german", "company"] as HolidayCategory[]).map((cat) => {
        const items = grouped[cat];
        if (!items.length) return null;
        return (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-1.5">
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${CATEGORY_COLORS[cat]}`}>
                {CATEGORY_LABELS[cat]}
              </Badge>
              <span className="text-[10px] text-muted-foreground">{items.length}</span>
            </div>
            <div className="space-y-0.5">
              {items.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/40 group text-sm"
                >
                  <span className="text-muted-foreground text-xs font-mono w-[85px] shrink-0">
                    {fmtDate(h.date)}
                  </span>
                  <span className="flex-1 truncate">{h.name}</span>
                  {h.nameLocal && (
                    <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                      {h.nameLocal}
                    </span>
                  )}
                  <button
                    onClick={() => handleDelete(h.id)}
                    className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition-opacity p-0.5"
                    title="Delete holiday"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No holidays found. Add some above.
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// LOCATIONS TAB
// ══════════════════════════════════════════════════════════════

function LocationsTab() {
  const { data: locationsList, isLoading } = useLocations();
  const createMutation = useCreateLocation();
  const deleteMutation = useDeleteLocation();

  const [newName, setNewName] = useState("");
  const [newShortCode, setNewShortCode] = useState("");

  async function handleAdd() {
    if (!newName.trim()) return;
    await createMutation.mutateAsync({
      name: newName.trim(),
      shortCode: newShortCode.trim() || undefined,
    });
    setNewName("");
    setNewShortCode("");
  }

  async function handleDelete(id: number) {
    await deleteMutation.mutateAsync(id);
  }

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading locations...</div>;
  }

  return (
    <div className="p-4 space-y-4">
      {/* Add new location form */}
      <div className="border rounded-lg p-3 space-y-2.5 bg-muted/30">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Add Location</div>
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Location name (e.g. Dallas TX)"
            className="h-8 text-sm flex-1"
          />
          <Input
            value={newShortCode}
            onChange={(e) => setNewShortCode(e.target.value)}
            placeholder="Code (e.g. DAL)"
            className="h-8 text-sm w-[100px]"
          />
          <Button
            size="sm"
            className="h-8 text-xs gap-1 shrink-0"
            onClick={handleAdd}
            disabled={!newName.trim() || createMutation.isPending}
          >
            <Plus className="h-3 w-3" />
            Add
          </Button>
        </div>
      </div>

      {/* Locations list */}
      <div className="space-y-0.5">
        {locationsList?.map((loc) => (
          <div
            key={loc.id}
            className="flex items-center gap-2 px-2 py-2 rounded hover:bg-muted/40 group"
          >
            <MapPin className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span className="text-sm font-medium flex-1">{loc.name}</span>
            {loc.shortCode && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {loc.shortCode}
              </Badge>
            )}
            <button
              onClick={() => handleDelete(loc.id)}
              className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition-opacity p-0.5"
              title="Delete location"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      {(!locationsList || locationsList.length === 0) && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No locations defined. Add some above.
        </div>
      )}
    </div>
  );
}
