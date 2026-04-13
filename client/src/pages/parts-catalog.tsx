import { useState, useMemo } from "react";
import {
  useCatalogParts,
  useCatalogPartDetail,
  useManufacturerList,
  useVendorList,
  useUpdateCatalogPart,
  useUpdatePartPrices,
  type CatalogPart,
  type CatalogPartDetail,
  type PartPrice,
} from "@/hooks/use-parts-catalog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Search,
  Loader2,
  ExternalLink,
  DollarSign,
  Info,
  Clock,
  ShoppingCart,
  Wrench,
  X,
} from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────

function centsToDisplay(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

function displayTocents(value: string): number | null {
  const num = parseFloat(value.replace(/[$,]/g, ""));
  if (isNaN(num)) return null;
  return Math.round(num * 100);
}

const PART_TYPE_LABELS: Record<string, string> = {
  purchased: "Purchased",
  manufactured: "Manufactured",
  sub_assembly: "Sub-Assy",
  raw_material: "Raw Mat.",
  service: "Service",
  consumable: "Consumable",
};

function partTypeLabel(t: string | null): string {
  return t ? PART_TYPE_LABELS[t] || t : "—";
}

// ── Main Page ────────────────────────────────────────────────

export default function PartsCatalog() {
  const [search, setSearch] = useState("");
  const [mfgFilter, setMfgFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "all" | "inactive">("active");
  const [selectedPartId, setSelectedPartId] = useState<number | null>(null);

  const { data: parts, isLoading } = useCatalogParts(statusFilter !== "inactive");
  const { data: manufacturers } = useManufacturerList();
  const { data: vendors } = useVendorList();

  const filtered = useMemo(() => {
    if (!parts) return [];
    let list = parts;
    if (statusFilter === "inactive") list = list.filter((p) => !p.active);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.partNumber.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          (p.manufacturer && p.manufacturer.toLowerCase().includes(q)) ||
          (p.preferredVendor && p.preferredVendor.toLowerCase().includes(q)) ||
          (p.searchKeywords && p.searchKeywords.toLowerCase().includes(q))
      );
    }
    if (mfgFilter) list = list.filter((p) => p.manufacturer === mfgFilter);
    if (vendorFilter) list = list.filter((p) => p.preferredVendor === vendorFilter);
    return list;
  }, [parts, search, mfgFilter, vendorFilter, statusFilter]);

  return (
    <div className="p-4 space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search parts, manufacturers..."
            className="h-8 w-[280px] text-sm pl-7"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>

        {manufacturers && manufacturers.length > 0 && (
          <Select
            value={mfgFilter || "__all__"}
            onValueChange={(v) => setMfgFilter(v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="h-8 w-[160px] text-sm">
              <SelectValue placeholder="Manufacturer..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Manufacturers</SelectItem>
              {manufacturers.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {vendors && vendors.length > 0 && (
          <Select
            value={vendorFilter || "__all__"}
            onValueChange={(v) => setVendorFilter(v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="h-8 w-[160px] text-sm">
              <SelectValue placeholder="Vendor..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Vendors</SelectItem>
              {vendors.map((v) => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="h-8 w-[110px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} of {parts?.length || 0} parts
        </span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="border rounded-lg overflow-auto max-h-[calc(100vh-200px)]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[180px] sticky top-0">Part #</TableHead>
                <TableHead className="sticky top-0">Description</TableHead>
                <TableHead className="w-[90px] sticky top-0">Type</TableHead>
                <TableHead className="w-[120px] sticky top-0">Manufacturer</TableHead>
                <TableHead className="w-[120px] sticky top-0">Vendor</TableHead>
                <TableHead className="w-[90px] text-right sticky top-0">Cost</TableHead>
                <TableHead className="w-[50px] sticky top-0">Rev</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    No parts found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => setSelectedPartId(p.id)}
                  >
                    <TableCell className="font-mono text-sm">{p.partNumber}</TableCell>
                    <TableCell>
                      <div className="truncate max-w-[400px]">{p.name}</div>
                    </TableCell>
                    <TableCell className="text-xs">{partTypeLabel(p.partType)}</TableCell>
                    <TableCell className="text-sm">{p.manufacturer || "—"}</TableCell>
                    <TableCell className="text-sm">{p.preferredVendor || "—"}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {centsToDisplay(p.cost)}
                    </TableCell>
                    <TableCell className="text-sm font-mono">{p.revision || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Sheet */}
      <PartDetailSheet
        partId={selectedPartId}
        onClose={() => setSelectedPartId(null)}
      />
    </div>
  );
}

// ── Part Detail Sheet ────────────────────────────────────────

function PartDetailSheet({
  partId,
  onClose,
}: {
  partId: number | null;
  onClose: () => void;
}) {
  const { data: part, isLoading } = useCatalogPartDetail(partId);

  return (
    <Sheet open={partId != null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-[520px] sm:max-w-[520px] overflow-y-auto">
        {isLoading || !part ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="font-mono text-base">{part.partNumber}</SheetTitle>
              <p className="text-sm text-muted-foreground leading-snug">{part.name}</p>
            </SheetHeader>

            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <span>{partTypeLabel(part.partType)}</span>
              {part.revision && <><span className="text-border">|</span><span className="font-mono">Rev {part.revision}</span></>}
              <span className="text-border">|</span>
              <span>{part.source === "calc_sheet" ? "Calc Sheet" : part.source}</span>
            </div>

            <Tabs defaultValue="details" className="mt-3">
              <TabsList className="w-full">
                <TabsTrigger value="details" className="flex-1 gap-1">
                  <Info className="h-3.5 w-3.5" /> Details
                </TabsTrigger>
                <TabsTrigger value="purchasing" className="flex-1 gap-1">
                  <ShoppingCart className="h-3.5 w-3.5" /> Purchasing
                </TabsTrigger>
                <TabsTrigger value="pricing" className="flex-1 gap-1">
                  <DollarSign className="h-3.5 w-3.5" /> Pricing
                </TabsTrigger>
                <TabsTrigger value="engineering" className="flex-1 gap-1">
                  <Wrench className="h-3.5 w-3.5" /> Eng.
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details">
                <DetailsTab part={part} />
              </TabsContent>
              <TabsContent value="purchasing">
                <PurchasingTab part={part} />
              </TabsContent>
              <TabsContent value="pricing">
                <PricingTab part={part} />
              </TabsContent>
              <TabsContent value="engineering">
                <EngineeringTab part={part} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Helper: field row ────────────────────────────────────────

function Field({ label, value }: { label: string; value: string | number | boolean | null | undefined }) {
  let display: string;
  if (value == null || value === "") display = "—";
  else if (typeof value === "boolean") display = value ? "Yes" : "No";
  else display = String(value);

  return (
    <div className="flex gap-2">
      <dt className="text-xs text-muted-foreground w-[130px] shrink-0 pt-0.5">{label}</dt>
      <dd className="text-sm break-words">{display}</dd>
    </div>
  );
}

// ── Details Tab ──────────────────────────────────────────────

function DetailsTab({ part }: { part: CatalogPartDetail }) {
  return (
    <div className="space-y-3 mt-3">
      <dl className="space-y-2">
        <Field label="Manufacturer" value={part.manufacturer} />
        <Field label="Mfr Part #" value={part.manufacturerPartNumber} />
        {part.manufacturerUrl && (
          <div className="flex items-center gap-2 pl-0">
            <dt className="text-xs text-muted-foreground shrink-0 w-32">Mfr Website</dt>
            <dd className="text-sm">
              <a href={part.manufacturerUrl} target="_blank" rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1">
                <ExternalLink className="h-3 w-3" /> Open
              </a>
            </dd>
          </div>
        )}
        <Field label="EAN / Barcode" value={part.ean} />
        <Field label="Vendor" value={part.preferredVendor} />
        <Field label="Supplier Part #" value={part.supplierPartNumber} />
        <Field label="Unit of Measure" value={part.unitOfMeasure} />
        <Field label="Category" value={part.category} />
        <Field label="Description" value={part.description} />
        <Field label="Comments" value={part.comments} />
        <Field label="Country of Origin" value={part.countryOfOrigin} />
        <Field label="HS Code (Intl)" value={part.hsCode} />
        <Field label="HTS Code (US)" value={part.htsCodeUs} />
        <Field label="HT Code (EU)" value={part.htCodeEu} />
      </dl>

      <div className="border-t pt-2 mt-2">
        <h4 className="text-xs font-medium text-muted-foreground mb-1.5">Tracking</h4>
        <dl className="space-y-1.5">
          <Field label="Lot Tracked" value={part.lotTracked} />
          <Field label="Serial Tracked" value={part.serialTracked} />
          <Field label="Inspect on Receipt" value={part.inspectionRequired} />
          <Field label="Shelf Life (days)" value={part.shelfLifeDays} />
        </dl>
      </div>

      {part.datasheetUrl && (
        <a
          href={part.datasheetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" /> View Datasheet
        </a>
      )}

      {part.inventory.length > 0 && (
        <div className="pt-2">
          <h4 className="text-xs font-medium text-muted-foreground mb-1">Inventory</h4>
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs py-1">Location</TableHead>
                  <TableHead className="text-xs py-1 text-right">Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {part.inventory.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="text-sm py-1">
                      {inv.label || `${inv.warehouse}/${inv.shelf || ""}/${inv.bin || ""}`}
                    </TableCell>
                    <TableCell className="text-sm py-1 text-right font-medium">{inv.qtyOnHand}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <div className="border-t pt-2 mt-2 text-xs text-muted-foreground space-y-0.5">
        <div>Created: {part.createdAt ? new Date(part.createdAt).toLocaleDateString() : "—"}</div>
        <div>Updated: {part.updatedAt ? new Date(part.updatedAt).toLocaleDateString() : "—"}</div>
      </div>
    </div>
  );
}

// ── Purchasing Tab ───────────────────────────────────────────

function PurchasingTab({ part }: { part: CatalogPartDetail }) {
  return (
    <div className="space-y-3 mt-3">
      <dl className="space-y-2">
        <Field label="Preferred Vendor" value={part.preferredVendor} />
        <Field label="Supplier Part #" value={part.supplierPartNumber} />
        <Field label="Lead Time" value={part.leadTimeDays != null ? `${part.leadTimeDays} days` : null} />
        <Field label="MOQ" value={part.moq} />
        <Field label="Order Multiple" value={part.orderMultiple} />
      </dl>

      <div className="border-t pt-2 mt-2">
        <h4 className="text-xs font-medium text-muted-foreground mb-1.5">Stock Planning</h4>
        <dl className="space-y-2">
          <Field label="Safety Stock" value={part.safetyStock} />
          <Field label="Reorder Qty" value={part.reorderQty} />
        </dl>
      </div>

      <div className="border-t pt-2 mt-2">
        <h4 className="text-xs font-medium text-muted-foreground mb-1.5">Costing</h4>
        <dl className="space-y-2">
          <Field label="Standard Cost" value={centsToDisplay(part.cost)} />
          <Field label="Last Cost" value={centsToDisplay(part.lastCost)} />
          <Field label="Average Cost" value={centsToDisplay(part.averageCost)} />
          <Field label="Price Updated" value={part.priceUpdatedAt} />
        </dl>
      </div>
    </div>
  );
}

// ── Pricing Tab ──────────────────────────────────────────────

function PricingTab({ part }: { part: CatalogPartDetail }) {
  const updatePrices = useUpdatePartPrices();
  const [editing, setEditing] = useState(false);
  const [editPrices, setEditPrices] = useState<{ customerName: string; displayPrice: string }[]>([]);

  function startEdit() {
    setEditPrices(
      part.prices.map((p) => ({
        customerName: p.customerName,
        displayPrice: p.price != null ? (p.price / 100).toFixed(2) : "",
      }))
    );
    setEditing(true);
  }

  async function save() {
    const prices = editPrices.map((ep) => ({
      customerName: ep.customerName,
      price: displayTocents(ep.displayPrice),
    }));
    await updatePrices.mutateAsync({ partId: part.id, prices });
    setEditing(false);
  }

  return (
    <div className="space-y-3 mt-3">
      <div className="flex items-center justify-between">
        <div className="text-sm">
          <span className="text-muted-foreground">Base cost: </span>
          <span className="font-mono font-medium">{centsToDisplay(part.cost)}</span>
        </div>
        {!editing && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={startEdit}>
            Edit Prices
          </Button>
        )}
      </div>

      {part.prices.length === 0 && !editing ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No customer prices set</p>
      ) : editing ? (
        <div className="space-y-2">
          {editPrices.map((ep, i) => (
            <div key={ep.customerName} className="flex items-center gap-2">
              <span className="text-sm w-[100px] shrink-0">{ep.customerName}</span>
              <div className="relative flex-1">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  value={ep.displayPrice}
                  onChange={(e) => {
                    const next = [...editPrices];
                    next[i] = { ...ep, displayPrice: e.target.value };
                    setEditPrices(next);
                  }}
                  className="h-8 text-sm pl-6 font-mono"
                  placeholder="0.00"
                />
              </div>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="h-7 text-xs" onClick={save} disabled={updatePrices.isPending}>
              {updatePrices.isPending ? "Saving..." : "Save"}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs py-1">Customer</TableHead>
                <TableHead className="text-xs py-1 text-right">Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {part.prices.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm py-1.5">{p.customerName}</TableCell>
                  <TableCell className="text-sm py-1.5 text-right font-mono">
                    {centsToDisplay(p.price)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Engineering Tab ──────────────────────────────────────────

function EngineeringTab({ part }: { part: CatalogPartDetail }) {
  return (
    <div className="space-y-3 mt-3">
      <dl className="space-y-2">
        <Field label="Drawing #" value={part.drawingNumber} />
        <Field label="Revision" value={part.revision} />
        <Field label="Weight" value={part.weight != null ? `${part.weight} ${part.weightUom || ""}`.trim() : null} />
      </dl>

      <div className="border-t pt-2 mt-2">
        <h4 className="text-xs font-medium text-muted-foreground mb-1.5">Install Times</h4>
        <p className="text-xs text-muted-foreground mb-2">
          Labor rates for the SAR calculation sheet.
        </p>
        <dl className="space-y-2">
          <Field label="min / meter" value={part.installMinPerMeter} />
          <Field label="min / connection" value={part.installMinPerConnection} />
        </dl>
      </div>
    </div>
  );
}
