import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// ── Types ─────────────────────────────────────────────────────

export interface Part {
  id: number;
  partNumber: string;
  name: string;
  description: string | null;
  category: string | null;
  unitOfMeasure: string | null;
  preferredVendor: string | null;
  manufacturer: string | null;
  manufacturerPartNumber: string | null;
  cost: number | null;
  source: "manual" | "qb_sync";
  active: boolean;
  searchKeywords: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PartWithInventory extends Part {
  inventory: InventoryLocationLevel[];
}

export interface StorageLocation {
  id: number;
  warehouse: string;
  shelf: string | null;
  bin: string | null;
  label: string | null;
  active: boolean;
}

export interface InventoryLevel {
  id: number;
  partId: number;
  partNumber: string;
  partName: string;
  category: string | null;
  unitOfMeasure: string | null;
  locationId: number;
  warehouse: string;
  shelf: string | null;
  bin: string | null;
  locationLabel: string | null;
  qtyOnHand: number;
  reorderPoint: number | null;
  reorderQty: number | null;
}

export interface InventoryLocationLevel {
  id: number;
  locationId: number;
  warehouse: string;
  shelf: string | null;
  bin: string | null;
  label: string | null;
  qtyOnHand: number;
  reorderPoint: number | null;
  reorderQty: number | null;
}

export interface LowStockItem {
  id: number;
  partId: number;
  partNumber: string;
  partName: string;
  preferredVendor: string | null;
  locationId: number;
  locationLabel: string | null;
  qtyOnHand: number;
  reorderPoint: number | null;
  reorderQty: number | null;
}

export interface StockTransaction {
  id: number;
  partId: number;
  partNumber: string;
  partName: string;
  locationId: number;
  locationLabel: string | null;
  type: "book_in" | "book_out" | "adjustment";
  qty: number;
  reason: string | null;
  projectId: number | null;
  projectNumber: string | null;
  performedBy: number | null;
  performedByName: string | null;
  notes: string | null;
  qtyAfter: number | null;
  createdAt: string;
}

export interface PartSearchResult {
  exact: Part | null;
  matches: Part[];
  suggestions: Part[];
}

export interface CreatePartInput {
  partNumber: string;
  name: string;
  description?: string | null;
  category?: string | null;
  unitOfMeasure?: string | null;
  preferredVendor?: string | null;
  manufacturer?: string | null;
  manufacturerPartNumber?: string | null;
  cost?: number | null;
  source?: "manual" | "qb_sync";
  active?: boolean;
}

export interface CreateStorageLocationInput {
  warehouse: string;
  shelf?: string | null;
  bin?: string | null;
  label?: string | null;
  active?: boolean;
}

export interface BookInInput {
  partId: number;
  locationId: number;
  qty: number;
  reason?: string | null;
  projectId?: number | null;
  performedBy?: number | null;
  notes?: string | null;
}

export interface BookOutInput extends BookInInput {
  shelfQtyRemaining?: number;
}

export interface AdjustStockInput {
  partId: number;
  locationId: number;
  newQty: number;
  reason?: string | null;
  performedBy?: number | null;
  notes?: string | null;
}

// ── Query Hooks ───────────────────────────────────────────────

export function useParts(activeOnly = true) {
  return useQuery<Part[]>({
    queryKey: ["/api/parts", `?active=${activeOnly}`],
  });
}

export function usePartCategories() {
  return useQuery<string[]>({
    queryKey: ["/api/parts/categories"],
  });
}

export function usePartSearch(query: string) {
  return useQuery<PartSearchResult>({
    queryKey: ["/api/parts/search", `?q=${encodeURIComponent(query)}`],
    enabled: query.length >= 2,
  });
}

export function usePartDetail(id: number | null) {
  return useQuery<PartWithInventory>({
    queryKey: ["/api/parts", `/${id}`],
    enabled: id != null,
  });
}

export function useStorageLocations() {
  return useQuery<StorageLocation[]>({
    queryKey: ["/api/storage-locations"],
  });
}

export function useInventoryLevels() {
  return useQuery<InventoryLevel[]>({
    queryKey: ["/api/inventory"],
  });
}

export function useLowStock() {
  return useQuery<LowStockItem[]>({
    queryKey: ["/api/inventory/low-stock"],
  });
}

export function useTransactions(filters?: { partId?: number; limit?: number }) {
  const params = new URLSearchParams();
  if (filters?.partId) params.set("partId", String(filters.partId));
  if (filters?.limit) params.set("limit", String(filters.limit));
  const qs = params.toString();

  return useQuery<StockTransaction[]>({
    queryKey: ["/api/inventory/transactions", qs ? `?${qs}` : ""],
  });
}

// ── Mutation Hooks ────────────────────────────────────────────

export function useCreatePart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreatePartInput) => {
      const res = await apiRequest("POST", "/api/parts", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/parts"] });
    },
  });
}

export function useUpdatePart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<CreatePartInput> & { id: number }) => {
      const res = await apiRequest("PUT", `/api/parts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/parts"] });
    },
  });
}

export function useCreateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateStorageLocationInput) => {
      const res = await apiRequest("POST", "/api/storage-locations", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/storage-locations"] });
    },
  });
}

export function useBookIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: BookInInput) => {
      const res = await apiRequest("POST", "/api/inventory/book-in", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/inventory"] });
      qc.invalidateQueries({ queryKey: ["/api/parts"] });
    },
  });
}

export function useBookOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: BookOutInput) => {
      const res = await apiRequest("POST", "/api/inventory/book-out", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/inventory"] });
      qc.invalidateQueries({ queryKey: ["/api/parts"] });
    },
  });
}

export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: AdjustStockInput) => {
      const res = await apiRequest("POST", "/api/inventory/adjust", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/inventory"] });
      qc.invalidateQueries({ queryKey: ["/api/parts"] });
    },
  });
}
