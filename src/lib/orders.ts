import type { OrderStatus } from "@/components/abl/OrderStatusBadge";

export type TabKey =
  | "pending" | "approved" | "picking" | "packed"
  | "out_for_delivery" | "delivered_today" | "all" | "cancelled";

export const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "pending",          label: "Pending" },
  { key: "approved",         label: "Approved" },
  { key: "picking",          label: "Picking" },
  { key: "packed",           label: "Packed" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "delivered_today",  label: "Delivered today" },
  { key: "all",              label: "All" },
  { key: "cancelled",        label: "Cancelled" },
];

export function statusToTab(s?: string): TabKey {
  if (!s) return "pending";
  if (s === "pending_approval") return "pending";
  if (s === "delivered") return "delivered_today";
  if (TABS.some((t) => t.key === s)) return s as TabKey;
  return "pending";
}

export function isToday(iso: string | null) {
  if (!iso) return false;
  const d = new Date(iso); const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function formatTimeOnly(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function matchesTab(o: { status: OrderStatus; delivered_at: string | null }, k: TabKey) {
  switch (k) {
    case "pending": return o.status === "pending_approval";
    case "approved": return o.status === "approved";
    case "picking": return o.status === "picking";
    case "packed": return o.status === "packed";
    case "out_for_delivery": return o.status === "out_for_delivery";
    case "delivered_today": return o.status === "delivered" && isToday(o.delivered_at);
    case "all": return o.status !== "cancelled";
    case "cancelled": return o.status === "cancelled";
  }
}

export type DatePreset = "today" | "yesterday" | "this_week" | "last_7" | "last_30" | "this_month" | "last_month" | "last_90" | "all";

export const DATE_PRESETS: Array<{ key: DatePreset; label: string }> = [
  { key: "today",      label: "Today" },
  { key: "yesterday",  label: "Yesterday" },
  { key: "this_week",  label: "This week" },
  { key: "last_7",     label: "Last 7 days" },
  { key: "last_30",    label: "Last 30 days" },
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "last_90",    label: "Last 90 days" },
  { key: "all",        label: "All time" },
];

export function dateRangeFor(preset: DatePreset): { from: Date | null; to: Date | null } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = startOfDay(now);
  switch (preset) {
    case "today":      return { from: today, to: null };
    case "yesterday":  { const y = new Date(today); y.setDate(y.getDate() - 1); return { from: y, to: today }; }
    case "this_week":  { const w = new Date(today); w.setDate(w.getDate() - w.getDay()); return { from: w, to: null }; }
    case "last_7":     { const d = new Date(today); d.setDate(d.getDate() - 7); return { from: d, to: null }; }
    case "last_30":    { const d = new Date(today); d.setDate(d.getDate() - 30); return { from: d, to: null }; }
    case "this_month": return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: null };
    case "last_month": { const f = new Date(now.getFullYear(), now.getMonth() - 1, 1); const t = new Date(now.getFullYear(), now.getMonth(), 1); return { from: f, to: t }; }
    case "last_90":    { const d = new Date(today); d.setDate(d.getDate() - 90); return { from: d, to: null }; }
    case "all":        return { from: null, to: null };
  }
}

export type SortKey = "newest" | "oldest" | "highest" | "lowest" | "az" | "overdue";

export const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: "newest",  label: "Newest first" },
  { key: "oldest",  label: "Oldest first" },
  { key: "highest", label: "Highest value" },
  { key: "lowest",  label: "Lowest value" },
  { key: "az",      label: "Customer A→Z" },
  { key: "overdue", label: "Most overdue" },
];

export function defaultSortFor(tab: TabKey): SortKey {
  return "newest";
}

export function defaultDatePresetFor(tab: TabKey): DatePreset {
  if (tab === "delivered_today") return "today";
  if (tab === "cancelled") return "last_90";
  return "last_30";
}

// pipeline mini-tracker ordering
export const PIPELINE: OrderStatus[] = [
  "pending_approval","approved","picking","packed","out_for_delivery","delivered","invoiced","paid",
];

export function pipelineIndex(status: OrderStatus) {
  return PIPELINE.indexOf(status);
}

// CSV export
export function ordersToCsv(rows: any[], customers: Record<string, { company_name: string }>): string {
  const head = ["Order #","Customer","Status","Placed","Delivered","Invoiced","Invoice #","Total"];
  const body = rows.map((o) => [
    o.order_number ?? "",
    customers[o.customer_id]?.company_name ?? "",
    o.status,
    o.placed_at ?? "",
    o.delivered_at ?? "",
    o.invoiced_at ?? "",
    o.invoice_number ?? "",
    String(o.total ?? ""),
  ]);
  return [head, ...body]
    .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
