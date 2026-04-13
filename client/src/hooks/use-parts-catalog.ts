import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// ── Types ─────────────────────────────────────────────────────

export type PartType = "purchased" | "manufactured" | "sub_assembly" | "raw_material" | "service" | "consumable";

export interface CatalogPart {
  id: number;
  partNumber: string;
  name: string;
  description: string | null;
  category: string | null;
  unitOfMeasure: string | null;
  // Vendor / Manufacturer
  preferredVendor: string | null;
  manufacturer: string | null;
  manufacturerPartNumber: string | null;
  manufacturerUrl: string | null;
  // Identification
  ean: string | null;
  // Classification
  partType: PartType | null;
  // Costing (cents)
  cost: number | null;
  lastCost: number | null;
  averageCost: number | null;
  // Purchasing
  supplierPartNumber: string | null;
  leadTimeDays: number | null;
  moq: number | null;
  orderMultiple: number | null;
  safetyStock: number | null;
  reorderQty: number | null;
  // Engineering
  drawingNumber: string | null;
  revision: string | null;
  weight: number | null;
  weightUom: string | null;
  // Install times
  installMinPerMeter: number | null;
  installMinPerConnection: number | null;
  // Metadata
  priceUpdatedAt: string | null;
  datasheetUrl: string | null;
  comments: string | null;
  countryOfOrigin: string | null;
  hsCode: string | null;
  htsCodeUs: string | null;
  htCodeEu: string | null;
  // Tracking flags
  inspectionRequired: boolean;
  lotTracked: boolean;
  serialTracked: boolean;
  shelfLifeDays: number | null;
  // System
  qbListId: string | null;
  source: "manual" | "calc_sheet" | "qb_sync";
  active: boolean;
  searchKeywords: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PartPrice {
  id: number;
  partId: number;
  customerName: string;
  price: number | null;
  updatedAt: string;
}

export interface CatalogPartDetail extends CatalogPart {
  prices: PartPrice[];
  inventory: Array<{
    id: number;
    locationId: number;
    warehouse: string;
    shelf: string | null;
    bin: string | null;
    label: string | null;
    qtyOnHand: number;
    reorderPoint: number | null;
    reorderQty: number | null;
  }>;
}

// ── Query Hooks ───────────────────────────────────────────────

export function useCatalogParts(activeOnly = true) {
  return useQuery<CatalogPart[]>({
    queryKey: ["/api/parts", `?active=${activeOnly}`],
  });
}

export function useCatalogPartDetail(id: number | null) {
  return useQuery<CatalogPartDetail>({
    queryKey: [`/api/parts/${id}`],
    enabled: id != null,
  });
}

export function useCustomerList() {
  return useQuery<string[]>({
    queryKey: ["/api/parts/customers/list"],
  });
}

export function useManufacturerList() {
  return useQuery<string[]>({
    queryKey: ["/api/parts/manufacturers/list"],
  });
}

export function useVendorList() {
  return useQuery<string[]>({
    queryKey: ["/api/parts/vendors/list"],
  });
}

// ── Mutation Hooks ────────────────────────────────────────────

export function useUpdateCatalogPart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<CatalogPart> & { id: number }) => {
      const res = await apiRequest("PUT", `/api/parts/${id}`, data);
      return res.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/parts"] });
      qc.invalidateQueries({ queryKey: ["/api/parts", `/${vars.id}`] });
    },
  });
}

export function useUpdatePartPrices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ partId, prices }: { partId: number; prices: { customerName: string; price: number | null }[] }) => {
      const res = await apiRequest("PUT", `/api/parts/${partId}/prices`, { prices });
      return res.json();
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/parts", `/${vars.partId}`] });
    },
  });
}
