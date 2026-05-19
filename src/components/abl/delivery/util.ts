export type RouteStop = {
  id: string;
  order_number: string;
  status: "packed" | "out_for_delivery" | "delivered" | "paid";
  total: number;
  delivery_notes: string | null;
  internal_notes: string | null;
  packed_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  delivery_status_detail: string | null;
  signature_image_url: string | null;
  delivered_to_name: string | null;
  route_sequence: number | null;
  driver_name: string | null;
  customer: {
    id: string;
    company_name: string;
    delivery_address: string | null;
    delivery_city: string | null;
    delivery_parish: string | null;
    delivery_notes: string | null;
    phone: string | null;
  } | null;
  items_count?: number;
  cases_count?: number;
};

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function fmtDayLabel(d = new Date()): string {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

export function fmtTime(t: string | Date | null | undefined): string {
  if (!t) return "—";
  const d = typeof t === "string" ? new Date(t) : t;
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function todayISODateRange(): [string, string] {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return [start.toISOString(), end.toISOString()];
}

export function fmtFullAddress(c: RouteStop["customer"]): { line1: string; line2: string } {
  if (!c) return { line1: "—", line2: "" };
  const line1 = c.delivery_address ?? "—";
  const cityParish = [c.delivery_city, c.delivery_parish].filter(Boolean).join(", ");
  return { line1, line2: cityParish || "" };
}

export function estimatedArrival(stopIndex: number, startHour = 9): string {
  // crude ETA — 45 min per stop starting at 9 AM
  const base = new Date(); base.setHours(startHour, 0, 0, 0);
  base.setMinutes(base.getMinutes() + stopIndex * 45);
  return fmtTime(base);
}
