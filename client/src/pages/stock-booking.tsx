import { useState } from "react";
import {
  usePartSearch,
  useStorageLocations,
  useBookOut,
  type Part,
  type PartSearchResult,
} from "@/hooks/use-inventory";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Search,
  Check,
  AlertTriangle,
  ArrowLeft,
  Package,
  Loader2,
  RotateCcw,
} from "lucide-react";

type Step = "search" | "select" | "confirm-part" | "book-out" | "summary" | "done";

interface BookingState {
  part: Part | null;
  locationId: number | null;
  locationLabel: string;
  currentQty: number;
  qtyOut: number;
  shelfRemaining: number | null;
  projectId: number | null;
  reason: string;
}

export default function StockBooking() {
  const [step, setStep] = useState<Step>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [booking, setBooking] = useState<BookingState>({
    part: null,
    locationId: null,
    locationLabel: "",
    currentQty: 0,
    qtyOut: 0,
    shelfRemaining: null,
    projectId: null,
    reason: "project use",
  });
  const [result, setResult] = useState<any>(null);

  const { data: searchResult, isLoading: searching } = usePartSearch(submittedQuery);
  const { data: locations } = useStorageLocations();
  const bookOutMutation = useBookOut();

  // Fetch inventory levels for selected part
  const { data: partDetail } = useQuery<any>({
    queryKey: ["/api/parts", `/${booking.part?.id}`],
    enabled: booking.part != null,
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim().length >= 2) {
      setSubmittedQuery(searchQuery.trim());
      setStep("select");
    }
  }

  function selectPart(part: Part) {
    setBooking((prev) => ({ ...prev, part }));
    setStep("confirm-part");
  }

  function confirmPart() {
    setStep("book-out");
  }

  async function handleBookOut() {
    if (!booking.part || !booking.locationId || booking.qtyOut <= 0) return;

    try {
      const res = await bookOutMutation.mutateAsync({
        partId: booking.part.id,
        locationId: booking.locationId,
        qty: booking.qtyOut,
        reason: booking.reason || "project use",
        shelfQtyRemaining: booking.shelfRemaining != null ? booking.shelfRemaining : undefined,
      });
      setResult(res);
      setStep("done");
    } catch (err: any) {
      setResult({ error: err.message || "Book-out failed" });
    }
  }

  function reset() {
    setStep("search");
    setSearchQuery("");
    setSubmittedQuery("");
    setBooking({
      part: null,
      locationId: null,
      locationLabel: "",
      currentQty: 0,
      qtyOut: 0,
      shelfRemaining: null,
      projectId: null,
      reason: "project use",
    });
    setResult(null);
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      {/* Progress indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {["Search", "Select", "Details", "Book Out", "Done"].map((label, i) => {
          const stepIdx = ["search", "select", "confirm-part", "book-out", "done"].indexOf(step);
          return (
            <div key={label} className="flex items-center gap-1">
              <div
                className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  i <= stepIdx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {i < stepIdx ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <span className={i <= stepIdx ? "text-foreground" : ""}>{label}</span>
              {i < 4 && <div className="w-4 h-px bg-border" />}
            </div>
          );
        })}
      </div>

      {/* Step 1: Search */}
      {step === "search" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" /> Find Part
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="space-y-3">
              <div className="space-y-1">
                <Label>Part number or name</Label>
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type or scan part number..."
                  className="h-12 text-lg"
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full h-12 text-base" disabled={searchQuery.trim().length < 2}>
                <Search className="h-5 w-5 mr-2" /> Search
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Select from results */}
      {step === "select" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Search Results</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setStep("search")}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {searching ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : !searchResult ? (
              <p className="text-muted-foreground text-center py-4">No results</p>
            ) : (
              <>
                {searchResult.exact && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Exact match</p>
                    <PartButton part={searchResult.exact} onClick={() => selectPart(searchResult.exact!)} />
                  </div>
                )}
                {searchResult.matches.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {searchResult.exact ? "Other matches" : "Matches"}
                    </p>
                    <div className="space-y-1">
                      {searchResult.matches
                        .filter((m) => m.id !== searchResult.exact?.id)
                        .slice(0, 10)
                        .map((p) => (
                          <PartButton key={p.id} part={p} onClick={() => selectPart(p)} />
                        ))}
                    </div>
                  </div>
                )}
                {searchResult.suggestions.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      <AlertTriangle className="h-3 w-3 inline mr-1" /> Similar parts
                    </p>
                    <div className="space-y-1">
                      {searchResult.suggestions.slice(0, 5).map((p) => (
                        <PartButton key={p.id} part={p} onClick={() => selectPart(p)} />
                      ))}
                    </div>
                  </div>
                )}
                {searchResult.matches.length === 0 && !searchResult.exact && searchResult.suggestions.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">No parts found for "{submittedQuery}"</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Confirm part + pick location */}
      {step === "confirm-part" && booking.part && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Confirm Part</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setStep("select")}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <div className="font-mono font-medium">{booking.part.partNumber}</div>
              <div className="text-lg">{booking.part.name}</div>
              {booking.part.description && <div className="text-sm text-muted-foreground">{booking.part.description}</div>}
              {booking.part.preferredVendor && <Badge variant="outline" className="text-xs">{booking.part.preferredVendor}</Badge>}
            </div>

            {/* Inventory levels at each location */}
            {partDetail?.inventory && partDetail.inventory.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">Stock levels</Label>
                <div className="space-y-1 mt-1">
                  {partDetail.inventory.map((inv: any) => (
                    <div key={inv.id} className="flex justify-between text-sm bg-muted/30 rounded px-2 py-1">
                      <span>{inv.label || inv.warehouse}</span>
                      <span className="font-medium">{inv.qtyOnHand} {booking.part?.unitOfMeasure || "EA"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label>Select location *</Label>
              <Select
                value={booking.locationId?.toString() || ""}
                onValueChange={(v) => {
                  const locId = Number(v);
                  const inv = partDetail?.inventory?.find((i: any) => i.locationId === locId);
                  const loc = locations?.find((l) => l.id === locId);
                  setBooking((prev) => ({
                    ...prev,
                    locationId: locId,
                    locationLabel: loc?.label || loc?.warehouse || "",
                    currentQty: inv?.qtyOnHand || 0,
                  }));
                }}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Pick a location..." />
                </SelectTrigger>
                <SelectContent>
                  {locations?.map((loc) => {
                    const inv = partDetail?.inventory?.find((i: any) => i.locationId === loc.id);
                    return (
                      <SelectItem key={loc.id} value={loc.id.toString()}>
                        {loc.label || loc.warehouse} {inv ? `(${inv.qtyOnHand} on hand)` : "(0 on hand)"}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full h-12 text-base"
              onClick={confirmPart}
              disabled={!booking.locationId}
            >
              Continue
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Enter quantities */}
      {step === "book-out" && booking.part && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Book Out</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setStep("confirm-part")}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="font-mono text-sm">{booking.part.partNumber}</div>
              <div>{booking.part.name}</div>
              <div className="text-sm text-muted-foreground">{booking.locationLabel} — {booking.currentQty} on hand</div>
            </div>

            <div className="space-y-1">
              <Label>Quantity to book out *</Label>
              <Input
                type="number"
                min={1}
                max={booking.currentQty}
                value={booking.qtyOut || ""}
                onChange={(e) => setBooking((prev) => ({ ...prev, qtyOut: Number(e.target.value) }))}
                className="h-12 text-lg"
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <Label>Qty remaining on shelf (optional check)</Label>
              <Input
                type="number"
                min={0}
                value={booking.shelfRemaining ?? ""}
                onChange={(e) =>
                  setBooking((prev) => ({
                    ...prev,
                    shelfRemaining: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                className="h-12 text-lg"
                placeholder="Count what's left..."
              />
              {booking.shelfRemaining != null && booking.qtyOut > 0 && (
                (() => {
                  const expected = booking.currentQty - booking.qtyOut;
                  const match = expected === booking.shelfRemaining;
                  return match ? (
                    <p className="text-xs text-green-400 flex items-center gap-1 mt-1">
                      <Check className="h-3 w-3" /> Shelf count matches system
                    </p>
                  ) : (
                    <p className="text-xs text-yellow-400 flex items-center gap-1 mt-1">
                      <AlertTriangle className="h-3 w-3" /> Mismatch: system expects {expected}, you counted {booking.shelfRemaining}. An adjustment will be created.
                    </p>
                  );
                })()
              )}
            </div>

            <div className="space-y-1">
              <Label>Reason</Label>
              <Select
                value={booking.reason}
                onValueChange={(v) => setBooking((prev) => ({ ...prev, reason: v }))}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="project use">Project Use</SelectItem>
                  <SelectItem value="testing">Testing</SelectItem>
                  <SelectItem value="damaged">Damaged / Scrapped</SelectItem>
                  <SelectItem value="returned to vendor">Returned to Vendor</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full h-12 text-base"
              onClick={handleBookOut}
              disabled={booking.qtyOut <= 0 || booking.qtyOut > booking.currentQty || bookOutMutation.isPending}
            >
              {bookOutMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : null}
              Confirm Book-Out ({booking.qtyOut} {booking.part.unitOfMeasure || "EA"})
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Done */}
      {step === "done" && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {result?.error ? (
              <div className="text-center space-y-2">
                <AlertTriangle className="h-12 w-12 mx-auto text-destructive" />
                <p className="text-lg font-medium text-destructive">Book-out failed</p>
                <p className="text-muted-foreground">{result.error}</p>
              </div>
            ) : (
              <>
                <div className="text-center space-y-2">
                  <Check className="h-12 w-12 mx-auto text-green-400" />
                  <p className="text-lg font-medium">Booked out successfully</p>
                  <p className="text-muted-foreground">
                    {booking.qtyOut} {booking.part?.unitOfMeasure || "EA"} of {booking.part?.partNumber} from {booking.locationLabel}
                  </p>
                  <p className="text-sm">New stock level: <span className="font-medium">{result?.qtyAfter ?? "—"}</span></p>
                </div>

                {result?.discrepancy && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm">
                    <AlertTriangle className="h-4 w-4 inline mr-1 text-yellow-400" />
                    <strong>Stock adjustment applied</strong> — shelf count didn't match system. Inventory has been corrected.
                  </div>
                )}

                {result?.lowStock && (
                  <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-center">
                    <AlertTriangle className="h-8 w-8 mx-auto text-destructive mb-2" />
                    <p className="font-medium text-destructive text-lg">Low Stock Alert</p>
                    <p className="text-sm mt-1">
                      Stock is at or below reorder point ({result.reorderPoint}).
                    </p>
                    {result.reorderQty && (
                      <p className="text-sm mt-1">
                        Suggested reorder: <strong>{result.reorderQty}</strong> units
                        {booking.part?.preferredVendor && <> from <strong>{booking.part.preferredVendor}</strong></>}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            <Button className="w-full h-12 text-base" onClick={reset}>
              <RotateCcw className="h-4 w-4 mr-2" /> Book Another Part
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Part selection button ─────────────────────────────────────
function PartButton({ part, onClick }: { part: Part; onClick: () => void }) {
  return (
    <button
      className="w-full text-left px-3 py-2 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono font-medium text-sm">{part.partNumber}</span>
        {part.category && <Badge variant="outline" className="text-xs">{part.category}</Badge>}
      </div>
      <div className="text-sm">{part.name}</div>
      {part.description && <div className="text-xs text-muted-foreground truncate">{part.description}</div>}
    </button>
  );
}
