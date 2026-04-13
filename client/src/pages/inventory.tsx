import { useState, useMemo } from "react";
import {
  useParts,
  useInventoryLevels,
  useLowStock,
  useTransactions,
  useStorageLocations,
  usePartCategories,
  useCreatePart,
  useCreateLocation,
  useBookIn,
  useAdjustStock,
  type Part,
  type CreatePartInput,
  type CreateStorageLocationInput,
} from "@/hooks/use-inventory";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Search,
  Filter,
  X,
  Loader2,
  Plus,
  AlertTriangle,
  Package,
  MapPin,
  ArrowDownUp,
} from "lucide-react";

export default function Inventory() {
  const [tab, setTab] = useState("parts");

  return (
    <div className="p-4 space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="parts" className="gap-1.5">
            <Package className="h-3.5 w-3.5" /> Parts
          </TabsTrigger>
          <TabsTrigger value="stock" className="gap-1.5">
            <ArrowDownUp className="h-3.5 w-3.5" /> Stock Levels
          </TabsTrigger>
          <TabsTrigger value="low-stock" className="gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Low Stock
          </TabsTrigger>
          <TabsTrigger value="transactions" className="gap-1.5">
            <ArrowDownUp className="h-3.5 w-3.5" /> Transactions
          </TabsTrigger>
          <TabsTrigger value="locations" className="gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> Locations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="parts"><PartsTab /></TabsContent>
        <TabsContent value="stock"><StockLevelsTab /></TabsContent>
        <TabsContent value="low-stock"><LowStockTab /></TabsContent>
        <TabsContent value="transactions"><TransactionsTab /></TabsContent>
        <TabsContent value="locations"><LocationsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ── Parts Tab ─────────────────────────────────────────────────
function PartsTab() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("active");
  const [addOpen, setAddOpen] = useState(false);

  const { data: allParts, isLoading } = useParts(statusFilter !== "inactive");
  const { data: categories } = usePartCategories();

  const filtered = useMemo(() => {
    if (!allParts) return [];
    let list = allParts;
    if (statusFilter === "inactive") list = list.filter((p) => !p.active);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.partNumber.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          (p.preferredVendor && p.preferredVendor.toLowerCase().includes(q))
      );
    }
    if (categoryFilter) {
      list = list.filter((p) => p.category === categoryFilter);
    }
    return list;
  }, [allParts, search, categoryFilter, statusFilter]);

  return (
    <div className="space-y-3 mt-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search parts..."
            className="h-8 w-[240px] text-sm pl-7"
          />
        </div>
        {categories && categories.length > 0 && (
          <Select
            value={categoryFilter || "__all__"}
            onValueChange={(v) => setCategoryFilter(v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="h-8 w-[150px] text-sm">
              <SelectValue placeholder="Category..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="h-8 w-[120px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <AddPartDialog open={addOpen} onOpenChange={setAddOpen} />
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} parts</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="border rounded-lg overflow-auto max-h-[calc(100vh-250px)]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[140px]">Part #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="w-[60px]">UoM</TableHead>
                <TableHead className="w-[80px]">Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No parts found</TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-sm">{p.partNumber}</TableCell>
                    <TableCell>
                      <div>{p.name}</div>
                      {p.description && <div className="text-xs text-muted-foreground truncate max-w-[300px]">{p.description}</div>}
                    </TableCell>
                    <TableCell>{p.category || "—"}</TableCell>
                    <TableCell>{p.preferredVendor || "—"}</TableCell>
                    <TableCell>{p.unitOfMeasure || "EA"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.source}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Add Part Dialog ───────────────────────────────────────────
function AddPartDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [partNumber, setPartNumber] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [unitOfMeasure, setUnitOfMeasure] = useState("EA");
  const [preferredVendor, setPreferredVendor] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [mfgPartNumber, setMfgPartNumber] = useState("");

  const createPart = useCreatePart();

  function reset() {
    setPartNumber(""); setName(""); setDescription(""); setCategory("");
    setUnitOfMeasure("EA"); setPreferredVendor(""); setManufacturer(""); setMfgPartNumber("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!partNumber.trim() || !name.trim()) return;
    const payload: CreatePartInput = {
      partNumber: partNumber.trim(),
      name: name.trim(),
      description: description.trim() || null,
      category: category.trim() || null,
      unitOfMeasure: unitOfMeasure.trim() || null,
      preferredVendor: preferredVendor.trim() || null,
      manufacturer: manufacturer.trim() || null,
      manufacturerPartNumber: mfgPartNumber.trim() || null,
    };
    await createPart.mutateAsync(payload);
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8"><Plus className="h-3.5 w-3.5 mr-1" /> Add Part</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add Part</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Part Number *</Label>
              <Input value={partNumber} onChange={(e) => setPartNumber(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Category</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Electrical" />
            </div>
            <div className="space-y-1">
              <Label>Unit</Label>
              <Input value={unitOfMeasure} onChange={(e) => setUnitOfMeasure(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Vendor</Label>
              <Input value={preferredVendor} onChange={(e) => setPreferredVendor(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Manufacturer</Label>
              <Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Mfg Part #</Label>
              <Input value={mfgPartNumber} onChange={(e) => setMfgPartNumber(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createPart.isPending}>
              {createPart.isPending ? "Adding..." : "Add Part"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Stock Levels Tab ──────────────────────────────────────────
function StockLevelsTab() {
  const [search, setSearch] = useState("");
  const { data: levels, isLoading } = useInventoryLevels();

  const filtered = useMemo(() => {
    if (!levels) return [];
    if (!search) return levels;
    const q = search.toLowerCase();
    return levels.filter(
      (l) =>
        l.partNumber.toLowerCase().includes(q) ||
        l.partName.toLowerCase().includes(q) ||
        (l.locationLabel && l.locationLabel.toLowerCase().includes(q))
    );
  }, [levels, search]);

  return (
    <div className="space-y-3 mt-3">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search stock..." className="h-8 w-[240px] text-sm pl-7" />
        </div>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} items</span>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="border rounded-lg overflow-auto max-h-[calc(100vh-250px)]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Part #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="w-[80px] text-right">Qty</TableHead>
                <TableHead className="w-[80px] text-right">Reorder @</TableHead>
                <TableHead className="w-[80px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No inventory data</TableCell></TableRow>
              ) : (
                filtered.map((l) => {
                  const isLow = l.reorderPoint != null && l.qtyOnHand <= l.reorderPoint;
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-sm">{l.partNumber}</TableCell>
                      <TableCell>{l.partName}</TableCell>
                      <TableCell>{l.locationLabel || `${l.warehouse} / ${l.shelf || ""} / ${l.bin || ""}`}</TableCell>
                      <TableCell className="text-right font-medium">{l.qtyOnHand}</TableCell>
                      <TableCell className="text-right">{l.reorderPoint ?? "—"}</TableCell>
                      <TableCell className="text-xs font-medium">
                        {isLow ? (
                          <span className="text-destructive">Low</span>
                        ) : (
                          <span className="text-muted-foreground">OK</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Low Stock Tab ─────────────────────────────────────────────
function LowStockTab() {
  const { data: items, isLoading } = useLowStock();

  return (
    <div className="space-y-3 mt-3">
      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : !items || items.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">No low stock items</div>
      ) : (
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-destructive/10">
                <TableHead>Part #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">On Hand</TableHead>
                <TableHead className="text-right">Reorder Point</TableHead>
                <TableHead className="text-right">Order Qty</TableHead>
                <TableHead>Vendor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-sm">{item.partNumber}</TableCell>
                  <TableCell>{item.partName}</TableCell>
                  <TableCell>{item.locationLabel || "—"}</TableCell>
                  <TableCell className="text-right font-medium text-destructive">{item.qtyOnHand}</TableCell>
                  <TableCell className="text-right">{item.reorderPoint}</TableCell>
                  <TableCell className="text-right">{item.reorderQty || "—"}</TableCell>
                  <TableCell>{item.preferredVendor || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Transactions Tab ──────────────────────────────────────────
function TransactionsTab() {
  const { data: txns, isLoading } = useTransactions({ limit: 200 });

  return (
    <div className="space-y-3 mt-3">
      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : !txns || txns.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">No transactions yet</div>
      ) : (
        <div className="border rounded-lg overflow-auto max-h-[calc(100vh-250px)]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[140px]">Date</TableHead>
                <TableHead className="w-[80px]">Type</TableHead>
                <TableHead>Part #</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right w-[60px]">Qty</TableHead>
                <TableHead className="text-right w-[60px]">After</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {txns.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-xs">{new Date(t.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge
                      variant={t.type === "book_in" ? "default" : t.type === "book_out" ? "destructive" : "secondary"}
                      className="text-xs"
                    >
                      {t.type === "book_in" ? "IN" : t.type === "book_out" ? "OUT" : "ADJ"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{t.partNumber}</TableCell>
                  <TableCell>{t.locationLabel || "—"}</TableCell>
                  <TableCell className={`text-right font-medium ${t.qty > 0 ? "text-green-400" : "text-red-400"}`}>
                    {t.qty > 0 ? "+" : ""}{t.qty}
                  </TableCell>
                  <TableCell className="text-right">{t.qtyAfter ?? "—"}</TableCell>
                  <TableCell>{t.projectNumber || "—"}</TableCell>
                  <TableCell>{t.performedByName || "—"}</TableCell>
                  <TableCell className="text-xs max-w-[150px] truncate">{t.reason || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Locations Tab ─────────────────────────────────────────────
function LocationsTab() {
  const { data: locations, isLoading } = useStorageLocations();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="space-y-3 mt-3">
      <div className="flex items-center gap-3">
        <AddLocationDialog open={addOpen} onOpenChange={setAddOpen} />
        <span className="text-xs text-muted-foreground ml-auto">{locations?.length || 0} locations</span>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Warehouse</TableHead>
                <TableHead>Shelf</TableHead>
                <TableHead>Bin</TableHead>
                <TableHead>Label</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!locations || locations.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">No locations. Add one to start tracking inventory.</TableCell></TableRow>
              ) : (
                locations.map((loc) => (
                  <TableRow key={loc.id}>
                    <TableCell className="font-medium">{loc.warehouse}</TableCell>
                    <TableCell>{loc.shelf || "—"}</TableCell>
                    <TableCell>{loc.bin || "—"}</TableCell>
                    <TableCell>{loc.label || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function AddLocationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [warehouse, setWarehouse] = useState("");
  const [shelf, setShelf] = useState("");
  const [bin, setBin] = useState("");
  const createLoc = useCreateLocation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!warehouse.trim()) return;
    const payload: CreateStorageLocationInput = {
      warehouse: warehouse.trim(),
      shelf: shelf.trim() || null,
      bin: bin.trim() || null,
    };
    await createLoc.mutateAsync(payload);
    setWarehouse(""); setShelf(""); setBin("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8"><Plus className="h-3.5 w-3.5 mr-1" /> Add Location</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Storage Location</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1"><Label>Warehouse *</Label><Input value={warehouse} onChange={(e) => setWarehouse(e.target.value)} placeholder="e.g. Main" required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Shelf</Label><Input value={shelf} onChange={(e) => setShelf(e.target.value)} placeholder="e.g. A1" /></div>
            <div className="space-y-1"><Label>Bin</Label><Input value={bin} onChange={(e) => setBin(e.target.value)} placeholder="e.g. 01" /></div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createLoc.isPending}>{createLoc.isPending ? "Adding..." : "Add Location"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
