export type PickListItem = {
  id: string;
  product_id: string;
  quantity: number;
  picked_quantity: number;
  shortfall_quantity: number;
  shortfall_note: string | null;
  picked_at: string | null;
  last_scan_at: string | null;
  product: { name: string; sku: string; bin_location: string | null; pack_size: number | null; pack_unit: string | null; on_hand: number | null; primary_image_url: string | null } | null;
};

export type QueueOrder = {
  id: string;
  order_number: string;
  status: "approved" | "picking";
  placed_at: string;
  approved_at: string | null;
  picking_started_at: string | null;
  picked_by_profile_id: string | null;
  total: number;
  delivery_notes: string | null;
  customer: { id: string; company_name: string; delivery_address: string | null; pricing_tier: string | null } | null;
  items_count?: number;
  cases_count?: number;
};

const URGENT_AGE_HOURS = 2;

export function urgencyOf(o: QueueOrder, now = Date.now()): "URGENT" | "QUEUED" {
  const ageHrs = (now - new Date(o.placed_at).getTime()) / 3600000;
  if (o.customer?.pricing_tier === "premium") return "URGENT";
  if (ageHrs > URGENT_AGE_HOURS) return "URGENT";
  return "QUEUED";
}

export function pickDeadline(o: QueueOrder): Date {
  // 4 hours from placed_at, but at least 11:00 same day if placed before 9am
  const placed = new Date(o.placed_at);
  const same11 = new Date(placed);
  same11.setHours(11, 0, 0, 0);
  const plus4 = new Date(placed.getTime() + 4 * 3600000);
  return placed.getHours() < 9 && same11 > placed ? same11 : plus4;
}

export function formatTimeShort(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function fmtDayLabel(d = new Date()): string {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}
