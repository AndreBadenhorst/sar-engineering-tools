import { useState, useMemo, useCallback, useEffect } from "react";
import {
  useStorageLocations,
  useInventoryByLocation,
  usePartSearch,
  useAdjustStock,
  type StorageLocation,
  type InventoryLevel,
  type Part,
  type AdjustStockInput,
} from "@/hooks/use-inventory";
import { useTeamMembers } from "@/hooks/use-capacity";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MapPin,
  Search,
  ClipboardCheck,
  ArrowLeft,
  Check,
  AlertTriangle,
  Loader2,
  Plus,
  X,
  RotateCcw,
  Zap,
} from "lucide-react";

// ── Session persistence helpers ─────────────────────────────
function getSessionValue(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return null; }
}
function setSessionValue(key: string, value: string) {
  try { sessionStorage.setItem(key, value); } catch {}
}
function getCompletedLocations(): number[] {
  try {
    const v = sessionStorage.getItem("stocktake-completed");
    return v ? JSON.parse(v) : [];
  } catch { return []; }
}
function addCompletedLocation(id: number) {
  const list = getCompletedLocations();
  if (!list.includes(id)) {
    list.push(id);
    setSessionValue("stocktake-completed", JSON.stringify(list));
  }
}

// ── Types ───────────────────────────────────────────────────
type Mode = "select" | "count-by-location" | "quick-count";
type LocationStep = "pick-location" | "count-sheet" | "review" | "submitting" | "done";
type QuickStep = "search-part" | "pick-location" | "enter-qty" | "done";

interface CountRow {
  partId: number;
  partNumber: string;
  partName: string;
  unitOfMeasure: string | null;
  systemQty: number;
  countedQty: string; // string for input binding, "" = not yet counted
  notes: string;
  isNew: boolean; // found unexpectedly on shelf
}

// ── Main Page ───────────────────────────────────────────────
export default function Stocktake() {
  const [mode, setMode] = useState<Mode>("select");
  const [performedBy, setPerformedBy] = useState<number | null>(() => {
    const v = getSessionValue("stocktake-performer");
    return v ? Number(v) : null;
  });

  useEffect(() => {
    if (performedBy != null) setSessionValue("stocktake-performer", String(performedBy));
  }, [performedBy]);

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      {mode === "select" && (
        <ModeSelect
          performedBy={performedBy}
          onPerformedByChange={setPerformedBy}
          onSelect={setMode}
        />
      )}
      {mode === "count-by-location" && (
        <CountByLocation
          performedBy={performedBy}
          onBack={() => setMode("select")}
        />
      )}
      {mode === "quick-count" && (
        <QuickCount
          performedBy={performedBy}
          onBack={() => setMode("select")}
        />
      )}
    </div>
  );
}

// ── Mode Select ─────────────────────────────────────────────
function ModeSelect({
  performedBy,
  onPerformedByChange,
  onSelect,
}: {
  performedBy: number | null;
  onPerformedByChange: (id: number | null) => void;
  onSelect: (mode: Mode) => void;
}) {
  const { data: team } = useTeamMembers();
  const { data: locations } = useStorageLocations();
  const completed = getCompletedLocations();
  const activeTeam = useMemo(() => (team ?? []).filter((m) => m.active), [team]);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Who is counting?</Label>
        <Select
          value={performedBy?.toString() || ""}
          onValueChange={(v) => onPerformedByChange(v ? Number(v) : null)}
        >
          <SelectTrigger className="h-12 text-base">
            <SelectValue placeholder="Select team member..." />
          </SelectTrigger>
          <SelectContent>
            {activeTeam.map((m) => (
              <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {completed.length > 0 && locations && (
        <div className="text-xs text-muted-foreground">
          Session progress: {completed.length} of {locations.length} locations counted
        </div>
      )}

      <button
        className="w-full text-left rounded-lg border bg-card p-4 hover:bg-accent/50 transition-colors"
        onClick={() => onSelect("count-by-location")}
        disabled={!performedBy}
      >
        <div className="flex items-center gap-3">
          <MapPin className="h-6 w-6 text-primary shrink-0" />
          <div>
            <div className="font-medium">Count by Location</div>
            <div className="text-sm text-muted-foreground">Walk to a shelf, count everything on it</div>
          </div>
        </div>
      </button>

      <button
        className="w-full text-left rounded-lg border bg-card p-4 hover:bg-accent/50 transition-colors"
        onClick={() => onSelect("quick-count")}
        disabled={!performedBy}
      >
        <div className="flex items-center gap-3">
          <Zap className="h-6 w-6 text-primary shrink-0" />
          <div>
            <div className="font-medium">Quick Count</div>
            <div className="text-sm text-muted-foreground">Count a single part at a specific location</div>
          </div>
        </div>
      </button>

      {!performedBy && (
        <p className="text-xs text-amber-500 text-center">Select who is counting to continue</p>
      )}
    </div>
  );
}

// ── Count by Location Flow ──────────────────────────────────
function CountByLocation({
  performedBy,
  onBack,
}: {
  performedBy: number | null;
  onBack: () => void;
}) {
  const [step, setStep] = useState<LocationStep>("pick-location");
  const [locationId, setLocationId] = useState<number | null>(null);
  const [locationLabel, setLocationLabel] = useState("");
  const [counts, setCounts] = useState<CountRow[]>([]);
  const [submitProgress, setSubmitProgress] = useState({ current: 0, total: 0 });
  const [submitResults, setSubmitResults] = useState<{ discrepancies: number; newItems: number; total: number }>({ discrepancies: 0, newItems: 0, total: 0 });
  const [addPartOpen, setAddPartOpen] = useState(false);

  const { data: locations } = useStorageLocations();
  const { data: levelData, isLoading: levelsLoading } = useInventoryByLocation(locationId);
  const adjustStock = useAdjustStock();
  const completed = getCompletedLocations();

  // Populate count rows when location data loads
  useEffect(() => {
    if (levelData && step === "count-sheet") {
      setCounts(
        levelData.map((lv) => ({
          partId: lv.partId,
          partNumber: lv.partNumber,
          partName: lv.partName,
          unitOfMeasure: lv.unitOfMeasure,
          systemQty: lv.qtyOnHand,
          countedQty: "",
          notes: "",
          isNew: false,
        }))
      );
    }
  }, [levelData, step]);

  function pickLocation(loc: StorageLocation) {
    setLocationId(loc.id);
    setLocationLabel(loc.label || [loc.warehouse, loc.shelf, loc.bin].filter(Boolean).join(" / "));
    setStep("count-sheet");
  }

  function updateCount(partId: number, field: "countedQty" | "notes", value: string) {
    setCounts((prev) =>
      prev.map((c) => (c.partId === partId ? { ...c, [field]: value } : c))
    );
  }

  function addUnexpectedPart(part: Part) {
    if (counts.some((c) => c.partId === part.id)) return;
    setCounts((prev) => [
      ...prev,
      {
        partId: part.id,
        partNumber: part.partNumber,
        partName: part.name,
        unitOfMeasure: part.unitOfMeasure,
        systemQty: 0,
        countedQty: "",
        notes: "",
        isNew: true,
      },
    ]);
    setAddPartOpen(false);
  }

  const countedRows = counts.filter((c) => c.countedQty !== "");
  const discrepancies = countedRows.filter((c) => Number(c.countedQty) !== c.systemQty);

  async function submitCounts() {
    if (!locationId || !performedBy) return;
    setStep("submitting");

    // Only submit rows that were counted AND differ from system (or are new)
    const toSubmit = countedRows.filter(
      (c) => Number(c.countedQty) !== c.systemQty || c.isNew
    );
    setSubmitProgress({ current: 0, total: toSubmit.length });

    let submitted = 0;
    for (const row of toSubmit) {
      try {
        await adjustStock.mutateAsync({
          partId: row.partId,
          locationId,
          newQty: Number(row.countedQty),
          reason: "stocktake",
          performedBy,
          notes: row.notes || `Stocktake: system had ${row.systemQty}, counted ${row.countedQty}`,
        });
      } catch (err) {
        console.error("Adjust failed for", row.partNumber, err);
      }
      submitted++;
      setSubmitProgress({ current: submitted, total: toSubmit.length });
    }

    addCompletedLocation(locationId);
    setSubmitResults({
      discrepancies: discrepancies.length,
      newItems: counts.filter((c) => c.isNew && c.countedQty !== "").length,
      total: countedRows.length,
    });
    setStep("done");
  }

  function nextLocation() {
    setLocationId(null);
    setLocationLabel("");
    setCounts([]);
    setStep("pick-location");
  }

  // ── Pick Location ──────────
  if (step === "pick-location") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h3 className="font-medium">Select Location</h3>
        </div>
        {!locations ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : locations.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No storage locations defined. Add locations in Inventory first.</p>
        ) : (
          <div className="space-y-1">
            {locations.map((loc) => {
              const done = completed.includes(loc.id);
              const label = loc.label || [loc.warehouse, loc.shelf, loc.bin].filter(Boolean).join(" / ");
              return (
                <button
                  key={loc.id}
                  className={`w-full text-left px-3 py-3 rounded-lg border transition-colors ${
                    done ? "bg-emerald-500/5 border-emerald-500/20" : "bg-card hover:bg-accent/50"
                  }`}
                  onClick={() => pickLocation(loc)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium">{label}</span>
                    </div>
                    {done && <Check className="h-4 w-4 text-emerald-500" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Count Sheet ──────────
  if (step === "count-sheet") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setStep("pick-location")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h3 className="font-medium">{locationLabel}</h3>
            <p className="text-xs text-muted-foreground">
              {countedRows.length} of {counts.length} counted
              {discrepancies.length > 0 && <span className="text-amber-500 ml-1">· {discrepancies.length} discrepancies</span>}
            </p>
          </div>
        </div>

        {levelsLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : counts.length === 0 ? (
          <div className="text-center py-8 space-y-3">
            <p className="text-muted-foreground">No parts expected at this location.</p>
            <Button variant="outline" onClick={() => setAddPartOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Part Found Here
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {counts.map((row) => {
              const counted = row.countedQty !== "";
              const mismatch = counted && Number(row.countedQty) !== row.systemQty;
              return (
                <div
                  key={row.partId}
                  className={`rounded-lg border p-3 space-y-1.5 ${
                    mismatch ? "border-amber-500/40 bg-amber-500/5" : counted ? "border-emerald-500/30 bg-emerald-500/5" : "bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-medium">{row.partNumber}</div>
                      <div className="text-xs text-muted-foreground truncate">{row.partName}</div>
                      {row.isNew && <span className="text-xs text-blue-500 font-medium">NEW — not expected here</span>}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-muted-foreground">System</div>
                      <div className="font-mono text-sm">{row.systemQty} {row.unitOfMeasure || "EA"}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs shrink-0 w-14">Count:</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={row.countedQty}
                      onChange={(e) => updateCount(row.partId, "countedQty", e.target.value)}
                      placeholder="—"
                      className="h-12 text-xl font-mono text-center flex-1"
                    />
                  </div>
                  {mismatch && (
                    <div className="flex items-center gap-1 text-xs text-amber-600">
                      <AlertTriangle className="h-3 w-3" />
                      Delta: {Number(row.countedQty) - row.systemQty > 0 ? "+" : ""}{Number(row.countedQty) - row.systemQty}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Sticky bottom */}
        <div className="sticky bottom-0 bg-background border-t pt-3 pb-2 space-y-2">
          <Button variant="outline" className="w-full h-10" onClick={() => setAddPartOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Unexpected Part
          </Button>
          <Button
            className="w-full h-12 text-base"
            onClick={() => setStep("review")}
            disabled={countedRows.length === 0}
          >
            Review ({countedRows.length} counted)
          </Button>
        </div>

        {addPartOpen && (
          <AddPartModal
            onSelect={addUnexpectedPart}
            onClose={() => setAddPartOpen(false)}
            excludeIds={counts.map((c) => c.partId)}
          />
        )}
      </div>
    );
  }

  // ── Review ──────────
  if (step === "review") {
    const adjustments = countedRows.filter((c) => Number(c.countedQty) !== c.systemQty || c.isNew);
    const matching = countedRows.filter((c) => Number(c.countedQty) === c.systemQty && !c.isNew);
    const uncounted = counts.filter((c) => c.countedQty === "");

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setStep("count-sheet")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h3 className="font-medium">Review — {locationLabel}</h3>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border p-2">
            <div className="text-lg font-semibold">{countedRows.length}</div>
            <div className="text-xs text-muted-foreground">Counted</div>
          </div>
          <div className={`rounded-lg border p-2 ${adjustments.length > 0 ? "border-amber-500/40" : ""}`}>
            <div className="text-lg font-semibold text-amber-500">{adjustments.length}</div>
            <div className="text-xs text-muted-foreground">Adjustments</div>
          </div>
          <div className="rounded-lg border p-2">
            <div className="text-lg font-semibold text-emerald-500">{matching.length}</div>
            <div className="text-xs text-muted-foreground">Match</div>
          </div>
        </div>

        {uncounted.length > 0 && (
          <div className="text-xs text-amber-600 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {uncounted.length} part{uncounted.length > 1 ? "s" : ""} not counted — they will be skipped.
          </div>
        )}

        {adjustments.length > 0 && (
          <div className="space-y-1">
            <h4 className="text-xs font-medium text-muted-foreground">Adjustments to submit:</h4>
            {adjustments.map((row) => (
              <div key={row.partId} className="flex items-center justify-between px-2 py-1.5 rounded bg-amber-500/5 text-sm">
                <span className="font-mono text-xs">{row.partNumber}</span>
                <span className="font-mono">
                  {row.systemQty} → <span className="font-semibold">{row.countedQty}</span>
                </span>
              </div>
            ))}
          </div>
        )}

        {adjustments.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">All counts match the system. Nothing to adjust.</p>
        )}

        <Button className="w-full h-12 text-base" onClick={submitCounts}>
          <ClipboardCheck className="h-5 w-5 mr-2" />
          Submit {adjustments.length > 0 ? `${adjustments.length} Adjustments` : "Counts"}
        </Button>
      </div>
    );
  }

  // ── Submitting ──────────
  if (step === "submitting") {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          Submitting {submitProgress.current} of {submitProgress.total}...
        </p>
      </div>
    );
  }

  // ── Done ──────────
  if (step === "done") {
    return (
      <div className="space-y-4 text-center py-8">
        <Check className="h-12 w-12 mx-auto text-emerald-500" />
        <div>
          <p className="text-lg font-medium">Location Complete</p>
          <p className="text-sm text-muted-foreground">{locationLabel}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border p-2">
            <div className="text-lg font-semibold">{submitResults.total}</div>
            <div className="text-xs text-muted-foreground">Counted</div>
          </div>
          <div className="rounded-lg border p-2">
            <div className="text-lg font-semibold text-amber-500">{submitResults.discrepancies}</div>
            <div className="text-xs text-muted-foreground">Adjusted</div>
          </div>
          <div className="rounded-lg border p-2">
            <div className="text-lg font-semibold text-blue-500">{submitResults.newItems}</div>
            <div className="text-xs text-muted-foreground">New Items</div>
          </div>
        </div>
        <div className="space-y-2 pt-2">
          <Button className="w-full h-12 text-base" onClick={nextLocation}>
            <MapPin className="h-4 w-4 mr-2" /> Next Location
          </Button>
          <Button variant="outline" className="w-full h-10" onClick={onBack}>
            Back to Menu
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

// ── Quick Count Flow ────────────────────────────────────────
function QuickCount({
  performedBy,
  onBack,
}: {
  performedBy: number | null;
  onBack: () => void;
}) {
  const [step, setStep] = useState<QuickStep>("search-part");
  const [searchQuery, setSearchQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [locationId, setLocationId] = useState<number | null>(null);
  const [locationLabel, setLocationLabel] = useState("");
  const [systemQty, setSystemQty] = useState(0);
  const [countedQty, setCountedQty] = useState("");
  const [result, setResult] = useState<any>(null);

  const { data: searchResult, isLoading: searching } = usePartSearch(submittedQuery);
  const { data: locations } = useStorageLocations();
  const { data: allLevels } = useInventoryByLocation(null); // we'll use inventory levels differently
  const adjustStock = useAdjustStock();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim().length >= 2) {
      setSubmittedQuery(searchQuery.trim());
    }
  }

  function selectPart(part: Part) {
    setSelectedPart(part);
    setStep("pick-location");
  }

  function selectLocation(locId: number) {
    const loc = locations?.find((l) => l.id === locId);
    setLocationId(locId);
    setLocationLabel(loc?.label || [loc?.warehouse, loc?.shelf, loc?.bin].filter(Boolean).join(" / ") || "");
    // We can't easily get the system qty here without another query,
    // so we'll use 0 as default and let the adjust endpoint handle it
    setSystemQty(0);
    setStep("enter-qty");
  }

  async function handleSubmit() {
    if (!selectedPart || !locationId || !performedBy || countedQty === "") return;
    try {
      const res = await adjustStock.mutateAsync({
        partId: selectedPart.id,
        locationId,
        newQty: Number(countedQty),
        reason: "stocktake",
        performedBy,
        notes: `Quick count: ${selectedPart.partNumber} at ${locationLabel}`,
      });
      setResult(res);
      setStep("done");
    } catch (err: any) {
      setResult({ error: err.message || "Failed to submit count" });
      setStep("done");
    }
  }

  function reset() {
    setStep("search-part");
    setSearchQuery("");
    setSubmittedQuery("");
    setSelectedPart(null);
    setLocationId(null);
    setLocationLabel("");
    setCountedQty("");
    setResult(null);
  }

  // ── Search Part ──────────
  if (step === "search-part") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h3 className="font-medium">Quick Count</h3>
        </div>
        <form onSubmit={handleSearch} className="space-y-2">
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value.trim().length >= 2) setSubmittedQuery(e.target.value.trim());
            }}
            placeholder="Part number or name..."
            className="h-12 text-lg"
            autoFocus
          />
        </form>

        {searching && <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>}

        {searchResult && (
          <div className="space-y-1">
            {searchResult.exact && (
              <PartResultButton part={searchResult.exact} onClick={() => selectPart(searchResult.exact!)} />
            )}
            {searchResult.matches
              .filter((m) => m.id !== searchResult.exact?.id)
              .slice(0, 8)
              .map((p) => (
                <PartResultButton key={p.id} part={p} onClick={() => selectPart(p)} />
              ))}
            {searchResult.suggestions.slice(0, 5).map((p) => (
              <PartResultButton key={p.id} part={p} onClick={() => selectPart(p)} />
            ))}
            {!searchResult.exact && searchResult.matches.length === 0 && searchResult.suggestions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No parts found</p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Pick Location ──────────
  if (step === "pick-location" && selectedPart) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setStep("search-part")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h3 className="font-medium">{selectedPart.partNumber}</h3>
            <p className="text-xs text-muted-foreground">{selectedPart.name}</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Where is this part?</Label>
          {!locations ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <div className="space-y-1">
              {locations.map((loc) => {
                const label = loc.label || [loc.warehouse, loc.shelf, loc.bin].filter(Boolean).join(" / ");
                return (
                  <button
                    key={loc.id}
                    className="w-full text-left px-3 py-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    onClick={() => selectLocation(loc.id)}
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Enter Qty ──────────
  if (step === "enter-qty" && selectedPart) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setStep("pick-location")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h3 className="font-medium">{selectedPart.partNumber}</h3>
            <p className="text-xs text-muted-foreground">{locationLabel}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>How many on the shelf?</Label>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={countedQty}
            onChange={(e) => setCountedQty(e.target.value)}
            placeholder="0"
            className="h-14 text-2xl font-mono text-center"
            autoFocus
          />
        </div>

        <Button
          className="w-full h-12 text-base"
          onClick={handleSubmit}
          disabled={countedQty === "" || adjustStock.isPending}
        >
          {adjustStock.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <ClipboardCheck className="h-5 w-5 mr-2" />}
          Submit Count
        </Button>
      </div>
    );
  }

  // ── Done ──────────
  if (step === "done") {
    return (
      <div className="space-y-4 text-center py-8">
        {result?.error ? (
          <>
            <AlertTriangle className="h-12 w-12 mx-auto text-destructive" />
            <p className="text-lg font-medium text-destructive">Count Failed</p>
            <p className="text-sm text-muted-foreground">{result.error}</p>
          </>
        ) : (
          <>
            <Check className="h-12 w-12 mx-auto text-emerald-500" />
            <p className="text-lg font-medium">Count Submitted</p>
            <p className="text-sm text-muted-foreground">
              {selectedPart?.partNumber} at {locationLabel}
            </p>
            {result && (
              <p className="text-sm">
                {result.oldQty} → <span className="font-semibold">{result.qtyAfter}</span> {selectedPart?.unitOfMeasure || "EA"}
              </p>
            )}
          </>
        )}
        <div className="space-y-2 pt-2">
          <Button className="w-full h-12 text-base" onClick={reset}>
            <RotateCcw className="h-4 w-4 mr-2" /> Count Another
          </Button>
          <Button variant="outline" className="w-full h-10" onClick={onBack}>
            Back to Menu
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

// ── Add Part Modal (for unexpected parts) ───────────────────
function AddPartModal({
  onSelect,
  onClose,
  excludeIds,
}: {
  onSelect: (part: Part) => void;
  onClose: () => void;
  excludeIds: number[];
}) {
  const [query, setQuery] = useState("");
  const { data: searchResult, isLoading } = usePartSearch(query);

  const results = useMemo(() => {
    if (!searchResult) return [];
    const all = [
      ...(searchResult.exact ? [searchResult.exact] : []),
      ...searchResult.matches,
      ...searchResult.suggestions,
    ];
    // Deduplicate and exclude already-added parts
    const seen = new Set<number>();
    return all.filter((p) => {
      if (seen.has(p.id) || excludeIds.includes(p.id)) return false;
      seen.add(p.id);
      return true;
    }).slice(0, 10);
  }, [searchResult, excludeIds]);

  return (
    <div className="fixed inset-0 z-50 bg-background/95 flex flex-col">
      <div className="flex items-center gap-2 p-4 border-b">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
        <h3 className="font-medium">Add Part Found on Shelf</h3>
      </div>
      <div className="p-4">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search part number or name..."
          className="h-12 text-lg"
          autoFocus
        />
      </div>
      <div className="flex-1 overflow-auto px-4 space-y-1">
        {isLoading && <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>}
        {results.map((p) => (
          <PartResultButton key={p.id} part={p} onClick={() => onSelect(p)} />
        ))}
        {query.length >= 2 && !isLoading && results.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No parts found</p>
        )}
      </div>
    </div>
  );
}

// ── Shared Part Button ──────────────────────────────────────
function PartResultButton({ part, onClick }: { part: Part; onClick: () => void }) {
  return (
    <button
      className="w-full text-left px-3 py-2.5 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
      onClick={onClick}
    >
      <div className="font-mono text-sm font-medium">{part.partNumber}</div>
      <div className="text-sm text-muted-foreground truncate">{part.name}</div>
    </button>
  );
}
