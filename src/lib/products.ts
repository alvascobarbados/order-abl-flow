import { supabase } from "@/integrations/supabase/client";

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";
export type StockStatusOverride = "auto" | "in_stock" | "low_stock" | "out_of_stock";
export type MovementType =
  | "received" | "sold" | "damaged" | "count_correction"
  | "customer_return" | "internal_use" | "other";

export interface ProductFull {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string;
  pack_size: number;
  pack_unit: string;
  case_price: number;
  unit_price: number;
  cost_price: number | null;
  vat_inclusive: boolean;
  image_url: string | null;
  primary_image_url: string | null;
  secondary_image_urls: string[];
  stock_status: StockStatus;
  stock_status_override: StockStatusOverride;
  on_hand: number;
  reorder_point: number;
  reorder_quantity: number;
  lead_time_days: number | null;
  track_inventory: boolean;
  bin_location: string | null;
  barcode: string | null;
  supplier_sku: string | null;
  supplier_name: string | null;
  is_active: boolean;
  archived_at: string | null;
  archived_by_profile_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string | null;
  sort_order: number;
  product_count?: number;
}

export interface StockMovement {
  id: string;
  product_id: string;
  movement_type: MovementType;
  quantity: number;
  reason: string | null;
  reference: string | null;
  recorded_by_profile_id: string | null;
  balance_after: number;
  created_at: string;
}

export function resolveImageUrl(p: Pick<ProductFull, "primary_image_url" | "image_url">) {
  return p.primary_image_url ?? p.image_url ?? null;
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  const days = Math.floor(diff / 86400);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)} mo ago`;
  return `${Math.floor(days / 365)} yr ago`;
}

export async function uploadProductImage(productIdHint: string, file: File): Promise<string> {
  const path = `${productIdHint}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}

export async function applyStockMovement(args: {
  product_id: string;
  movement_type: MovementType;
  quantity: number;
  reason?: string | null;
  reference?: string | null;
}) {
  const { error } = await (supabase as any).rpc("apply_stock_movement", {
    _product_id: args.product_id,
    _movement_type: args.movement_type,
    _quantity: args.quantity,
    _reason: args.reason ?? null,
    _reference: args.reference ?? null,
    _recorded_by: null,
  });
  if (error) throw error;
}

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  received: "Received",
  sold: "Sold",
  damaged: "Damaged / Write-off",
  count_correction: "Stock count correction",
  customer_return: "Customer return",
  internal_use: "Internal use",
  other: "Other",
};
