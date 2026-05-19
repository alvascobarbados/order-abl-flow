import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { formatBBD } from "@/lib/format";
import { toast } from "sonner";
import { Check, X, Eye, Truck, FileText, RotateCcw, ChevronRight } from "lucide-react";
import { OrderStatusBadge, type OrderStatus } from "@/components/abl/OrderStatusBadge";

type OrderRow = {
  id: string;
  order_number: string | null;
  invoice_number: string | null;
  customer_id: string;
  status: OrderStatus;
  total: number;
  placed_at: string;
  delivered_at: string | null;
  invoiced_at: string | null;
  internal_notes: string | null;
  rejection_reason: string | null;
};
type Customer = { id: string; company_name: string; phone: string | null; delivery_address: string | null };

type TabKey =
  | "pending" | "approved" | "picking" | "packed"
  | "out_for_delivery" | "delivered_today" | "all" | "cancelled";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "pending",          label: "Pending" },
  { key: "approved",         label: "Approved" },
  { key: "picking",          label: "Picking" },
  { key: "packed",           label: "Packed" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "delivered_today",  label: "Delivered today" },
  { key: "all",              label: "All" },
  { key: "cancelled",        label: "Cancelled" },
];

function isToday(iso: string | null) {
  if (!iso) return false;
  const d = new Date(iso); const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// Map URL status → tab
function statusToTab(s?: string): TabKey {
  if (!s) return "pending";
  if (s === "pending_approval") return "pending";
  if (s === "delivered") return "delivered_today";
  if (TABS.some((t) => t.key === s)) return s as TabKey;
  return "pending";
}

export function OrdersPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { tab?: string; status?: string };
  const initialTab = (search.tab as TabKey) || statusToTab(search.status);

  const [tab, setTab] = useState<TabKey>(initialTab);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [customers, setCustomers] = useState<Record<string, Customer>>({});
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | { kind: "approve" | "reject" | "send-to-warehouse" | "mark-delivered" | "mark-invoiced" | "restore"; orderId: string; reason?: string }>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setTab(initialTab); /* react to URL changes */ }, [search.tab, search.status]);

  const reload = async () => {
    const [{ data: o }, { data: c }] = await Promise.all([
      supabase.from("orders").select("id, order_number, invoice_number, customer_id, status, total, placed_at, delivered_at, invoiced_at, internal_notes, rejection_reason").order("placed_at", { ascending: false }),
      supabase.from("customers").select("id, company_name, phone, delivery_address"),
    ]);
    setOrders((o as OrderRow[]) ?? []);
    const m: Record<string, Customer> = {};
    (c as Customer[] | null)?.forEach((x) => (m[x.id] = x));
    setCustomers(m);
  };
  useEffect(() => { reload(); }, []);

  const matchesTab = (o: OrderRow, k: TabKey) => {
    switch (k) {
      case "pending": return o.status === "pending_approval";
      case "approved": return o.status === "approved";
      case "picking": return o.status === "picking";
      case "packed": return o.status === "packed";
      case "out_for_delivery": return o.status === "out_for_delivery";
      case "delivered_today": return o.status === "delivered" && isToday(o.delivered_at);
      case "all": return true;
      case "cancelled": return o.status === "cancelled";
    }
  };

  const counts = useMemo(() => {
    const map: Record<TabKey, number> = { pending: 0, approved: 0, picking: 0, packed: 0, out_for_delivery: 0, delivered_today: 0, all: 0, cancelled: 0 };
    orders.forEach((o) => TABS.forEach((t) => { if (matchesTab(o, t.key)) map[t.key]++; }));
    return map;
  }, [orders]);

  const rows = useMemo(() => orders.filter((o) => matchesTab(o, tab)), [orders, tab]);

  const setTabAndUrl = (k: TabKey) => {
    setTab(k);
    navigate({ to: "/office/orders", search: { tab: k } as any, replace: true });
  };

  // --- Actions ---
  const runAction = async (override?: { kind: any; orderId: string; reason?: string }) => {
    const c = override ?? confirm;
    if (!c) return;
    const order = orders.find((o) => o.id === c.orderId);
    if (!order) return;
    setBusy(true);
    let patch: any = {};
    let message = "";
    switch (c.kind) {
      case "approve":
        patch = { status: "approved", approved_at: new Date().toISOString() };
        message = `Order ${order.order_number} approved`;
        break;
      case "reject":
        patch = {
          status: "cancelled",
          rejection_reason: c.reason ?? "",
          internal_notes: order.internal_notes ? `${order.internal_notes}\nREJECTED: ${c.reason}` : `REJECTED: ${c.reason}`,
        };
        message = `Order ${order.order_number} rejected`;
        break;
      case "send-to-warehouse":
        patch = { status: "picking" };
        message = `Order ${order.order_number} sent to warehouse`;
        break;
      case "mark-delivered":
        patch = { status: "delivered", delivered_at: new Date().toISOString() };
        message = `Order ${order.order_number} marked delivered`;
        break;
      case "mark-invoiced": {
        const seq = (order.order_number ?? "").replace(/[^0-9]/g, "");
        patch = { status: "invoiced", invoiced_at: new Date().toISOString(), invoice_number: `INV-${seq || Date.now()}` };
        message = `Order ${order.order_number} invoiced`;
        break;
      }
      case "restore":
        patch = { status: "pending_approval", rejection_reason: null };
        message = `Order ${order.order_number} restored to pending`;
        break;
    }
    const { error } = await supabase.from("orders").update(patch).eq("id", order.id);
    setBusy(false);
    setConfirm(null);
    setDrawerId(null);
    if (error) return toast.error(error.message);
    toast.success(message);
    reload();
  };

  return (
    <>
      <div className="mb-5">
        <div className="font-mono text-[10.5px] uppercase text-muted-foreground" style={{ letterSpacing: "0.12em" }}>
          OPERATIONS · ORDERS
        </div>
        <h1 className="mt-1 text-[24px] font-extrabold text-ink" style={{ letterSpacing: "-0.02em" }}>
          All orders
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Approve, track, and manage every order across its lifecycle.
        </p>
      </div>

      {/* Sticky tabs */}
      <div className="sticky top-0 z-20 -mx-6 mb-4 border-b border-border bg-background/95 px-6 py-3 backdrop-blur">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => {
            const active = tab === t.key;
            const muted = t.key === "cancelled";
            return (
              <button
                key={t.key}
                onClick={() => setTabAndUrl(t.key)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition ${
                  active
                    ? "bg-[#0B1A2E] text-white"
                    : muted
                      ? "border border-border bg-card text-muted-foreground/70 hover:text-ink"
                      : "border border-border bg-card text-[#64748B] hover:text-ink"
                } ${t.key === "cancelled" ? "ml-auto" : ""}`}
              >
                <span>{t.label}</span>
                <span className={`font-mono text-[10.5px] ${active ? "text-white/70" : "text-muted-foreground"}`}>
                  ({counts[t.key]})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Rows */}
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center text-[13px] text-muted-foreground">
          Nothing in this view.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((o) => (
            <OrderRowItem
              key={o.id}
              order={o}
              customer={customers[o.customer_id]}
              onView={() => setDrawerId(o.id)}
              onAction={(kind, reason) => setConfirm({ kind, orderId: o.id, reason })}
            />
          ))}
        </ul>
      )}

      {drawerId && (
        <OrderDrawer
          order={orders.find((o) => o.id === drawerId)!}
          customer={customers[orders.find((o) => o.id === drawerId)!.customer_id]}
          onClose={() => setDrawerId(null)}
          onAction={(kind, reason) => setConfirm({ kind, orderId: drawerId, reason })}
        />
      )}

      {confirm && confirm.kind !== "reject" && (
        <ConfirmModal
          title={confirmTitle(confirm.kind, orders.find((o) => o.id === confirm.orderId))}
          confirmLabel={confirmLabel(confirm.kind)}
          confirmColor={confirmColor(confirm.kind)}
          onConfirm={runAction}
          onCancel={() => setConfirm(null)}
          loading={busy}
        />
      )}
      {confirm?.kind === "reject" && (
        <RejectModal
          orderNumber={orders.find((o) => o.id === confirm.orderId)?.order_number ?? ""}
          onConfirm={(reason) => runAction({ ...confirm, reason })}
          onCancel={() => setConfirm(null)}
          loading={busy}
        />
      )}
    </>
  );
}

function confirmTitle(kind: string, o?: OrderRow) {
  const n = o?.order_number ?? "";
  switch (kind) {
    case "approve": return `Approve order ${n}?`;
    case "send-to-warehouse": return `Send ${n} to warehouse?`;
    case "mark-delivered": return `Mark ${n} as delivered? (manual override)`;
    case "mark-invoiced": return `Mark ${n} as invoiced? An invoice number will be generated.`;
    case "restore": return `Restore ${n} to pending approval?`;
    default: return "";
  }
}
function confirmLabel(kind: string) {
  return ({
    approve: "Yes, approve", "send-to-warehouse": "Send to warehouse",
    "mark-delivered": "Mark delivered", "mark-invoiced": "Generate invoice", restore: "Restore",
  } as any)[kind];
}
function confirmColor(kind: string) {
  if (kind === "approve" || kind === "mark-delivered" || kind === "mark-invoiced") return "#10B981";
  if (kind === "restore") return "#3B82F6";
  return "#0B1A2E";
}

// --- Row ---
function OrderRowItem({
  order, customer, onView, onAction,
}: {
  order: OrderRow;
  customer?: Customer;
  onView: () => void;
  onAction: (k: any, reason?: string) => void;
}) {
  const accent =
    order.status === "pending_approval" ? "#F59E0B"
    : order.status === "cancelled" ? "#94A3B8" : "#CBD5E1";

  return (
    <li
      className="rounded-[10px] border border-border bg-card p-3.5 transition hover:border-[var(--accent)]"
      style={{ ["--accent" as any]: accent }}
    >
      <div className="flex items-start justify-between gap-3">
        <button onClick={onView} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-[11px] font-semibold text-ink">
              {order.order_number}
            </span>
            <OrderStatusBadge status={order.status} />
            <span className="text-[11px] text-muted-foreground">{timeAgo(order.placed_at)}</span>
          </div>
          <div className="mt-1.5 text-[14.5px] font-bold text-ink" style={{ letterSpacing: "-0.01em" }}>
            {customer?.company_name ?? "—"}
          </div>
          <div className="mt-0.5 text-[12px] text-muted-foreground">
            {formatBBD(Number(order.total))}
            {order.invoice_number && <span className="ml-2 font-mono text-[11px]">{order.invoice_number}</span>}
            {customer?.delivery_address && <span> · {customer.delivery_address.split(",")[0]}</span>}
          </div>
        </button>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <RowActions order={order} onView={onView} onAction={onAction} />
        </div>
      </div>
    </li>
  );
}

function RowActions({ order, onView, onAction }: {
  order: OrderRow; onView: () => void; onAction: (k: any, reason?: string) => void;
}) {
  const viewBtn = (
    <button onClick={onView} className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-[12px] font-semibold text-ink hover:bg-secondary">
      <Eye className="h-3.5 w-3.5" /> View
    </button>
  );
  switch (order.status) {
    case "pending_approval":
      return (
        <>
          <button onClick={() => onAction("reject")} className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-[12px] font-semibold text-[#B91C1C] hover:bg-[#FEF2F2]">
            <X className="h-3.5 w-3.5" /> Reject
          </button>
          {viewBtn}
          <button onClick={() => onAction("approve")} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[12px] font-semibold text-white" style={{ backgroundColor: "#10B981" }}>
            <Check className="h-3.5 w-3.5" /> Approve
          </button>
        </>
      );
    case "approved":
      return (
        <>
          {viewBtn}
          <button onClick={() => onAction("send-to-warehouse")} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[12px] font-semibold text-white" style={{ backgroundColor: "#0B1A2E" }}>
            <Truck className="h-3.5 w-3.5" /> Send to warehouse
          </button>
        </>
      );
    case "picking":
    case "packed":
      return viewBtn;
    case "out_for_delivery":
      return (
        <>
          {viewBtn}
          <button onClick={() => onAction("mark-delivered")} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[12px] font-semibold text-white" style={{ backgroundColor: "#10B981" }}>
            <Check className="h-3.5 w-3.5" /> Mark delivered
          </button>
        </>
      );
    case "delivered":
      return (
        <>
          {viewBtn}
          <button onClick={() => onAction("mark-invoiced")} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[12px] font-semibold text-white" style={{ backgroundColor: "#6D28D9" }}>
            <FileText className="h-3.5 w-3.5" /> Mark invoiced
          </button>
        </>
      );
    case "cancelled":
      return (
        <>
          {viewBtn}
          <button onClick={() => onAction("restore")} className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-[12px] font-semibold text-ink hover:bg-secondary">
            <RotateCcw className="h-3.5 w-3.5" /> Restore
          </button>
        </>
      );
    default:
      return viewBtn;
  }
}

// --- Drawer (light: details only) ---
function OrderDrawer({
  order, customer, onClose, onAction,
}: {
  order: OrderRow; customer?: Customer; onClose: () => void;
  onAction: (k: any, reason?: string) => void;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [notes, setNotes] = useState(order.internal_notes ?? "");

  useEffect(() => {
    supabase
      .from("order_items")
      .select("*, product:products(name, sku)")
      .eq("order_id", order.id)
      .then(({ data }) => setItems(data ?? []));
  }, [order.id]);

  const saveNotes = async () => {
    if (notes === (order.internal_notes ?? "")) return;
    await supabase.from("orders").update({ internal_notes: notes }).eq("id", order.id);
    toast.success("Notes saved");
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        className="flex h-full w-[600px] max-w-full flex-col overflow-y-auto bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border bg-card px-5 py-4">
          <div>
            <div className="font-mono text-[10.5px] uppercase text-muted-foreground" style={{ letterSpacing: "0.12em" }}>Order detail</div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-[17px] font-extrabold text-ink">{order.order_number}</span>
              <OrderStatusBadge status={order.status} />
            </div>
          </div>
          <button onClick={onClose} className="rounded-md border border-border px-2.5 py-1 text-[12px] font-semibold text-ink hover:bg-secondary">
            × Close
          </button>
        </header>

        <div className="flex-1 space-y-4 px-5 py-5">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-[11px] font-semibold uppercase text-muted-foreground">Customer</div>
            <div className="mt-1 text-[15px] font-bold text-ink">{customer?.company_name ?? "—"}</div>
            <div className="mt-1 text-[12px] text-muted-foreground">
              {customer?.phone ?? ""}<br />
              {customer?.delivery_address ?? ""}
            </div>
          </div>

          {order.rejection_reason && (
            <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4">
              <div className="text-[11px] font-semibold uppercase text-[#B91C1C]">Rejection reason</div>
              <div className="mt-1 text-[13px] text-ink">{order.rejection_reason}</div>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-2.5 text-[11px] font-semibold uppercase text-muted-foreground">Items</div>
            <table className="w-full text-[12.5px]">
              <thead className="bg-secondary text-left text-[11px] text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Product</th>
                  <th className="px-2 py-2 text-right">Qty</th>
                  <th className="px-4 py-2 text-right">Line total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-border">
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-ink">{it.product?.name ?? "—"}</div>
                      <div className="font-mono text-[10.5px] text-muted-foreground">{it.product?.sku}</div>
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono">{it.quantity}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold">{formatBBD(Number(it.line_total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between border-t border-border px-4 py-3 text-[13px]">
              <span className="font-semibold text-ink">Total</span>
              <span className="font-mono font-bold text-ink">{formatBBD(Number(order.total))}</span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-[11px] font-semibold uppercase text-muted-foreground">Internal notes</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNotes}
              rows={3}
              className="mt-2 w-full rounded-md border border-border bg-background p-2 text-[13px]"
            />
          </div>
        </div>

        <footer className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-card px-5 py-3">
          <DrawerActions order={order} onAction={onAction} />
        </footer>
      </aside>
    </div>
  );
}

function DrawerActions({ order, onAction }: { order: OrderRow; onAction: (k: any, reason?: string) => void }) {
  if (order.status === "pending_approval") return (
    <>
      <button onClick={() => onAction("reject")} className="rounded-md border border-border bg-card px-3 py-2 text-[13px] font-semibold text-[#B91C1C] hover:bg-[#FEF2F2]">Reject</button>
      <button onClick={() => onAction("approve")} className="rounded-md px-3 py-2 text-[13px] font-semibold text-white" style={{ backgroundColor: "#10B981" }}>Approve order</button>
    </>
  );
  if (order.status === "approved") return (
    <button onClick={() => onAction("send-to-warehouse")} className="rounded-md px-3 py-2 text-[13px] font-semibold text-white" style={{ backgroundColor: "#0B1A2E" }}>Send to warehouse</button>
  );
  if (order.status === "out_for_delivery") return (
    <button onClick={() => onAction("mark-delivered")} className="rounded-md px-3 py-2 text-[13px] font-semibold text-white" style={{ backgroundColor: "#10B981" }}>Mark delivered</button>
  );
  if (order.status === "delivered") return (
    <button onClick={() => onAction("mark-invoiced")} className="rounded-md px-3 py-2 text-[13px] font-semibold text-white" style={{ backgroundColor: "#6D28D9" }}>Mark invoiced</button>
  );
  if (order.status === "cancelled") return (
    <button onClick={() => onAction("restore")} className="rounded-md border border-border bg-card px-3 py-2 text-[13px] font-semibold text-ink hover:bg-secondary">Restore to pending</button>
  );
  return <span className="text-[12px] text-muted-foreground">Warehouse owns this transition.</span>;
}

// --- Modals ---
function ConfirmModal({
  title, confirmLabel, confirmColor, onConfirm, onCancel, loading,
}: { title: string; confirmLabel: string; confirmColor: string; onConfirm: () => void; onCancel: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
        <h4 className="text-[15px] font-bold text-ink">{title}</h4>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-md border border-border bg-card px-3 py-2 text-[13px] font-semibold text-ink hover:bg-secondary">Cancel</button>
          <button disabled={loading} onClick={onConfirm} className="rounded-md px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-50" style={{ backgroundColor: confirmColor }}>
            {loading ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function RejectModal({
  orderNumber, onConfirm, onCancel, loading,
}: { orderNumber: string; onConfirm: (reason: string) => void; onCancel: () => void; loading: boolean }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
        <h4 className="text-[15px] font-bold text-ink">Reject order {orderNumber}?</h4>
        <label className="mt-4 block text-[12px] font-semibold text-ink">Reason (visible to customer)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          className="mt-1.5 w-full rounded-md border border-border bg-background p-2 text-[13px]"
          placeholder="Out of stock, credit limit reached, etc."
        />
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-md border border-border bg-card px-3 py-2 text-[13px] font-semibold text-ink hover:bg-secondary">Cancel</button>
          <button
            disabled={!reason.trim() || loading}
            onClick={() => reason.trim() && onConfirm(reason.trim())}
            className="rounded-md bg-[#E11D48] px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Working…" : "Confirm rejection"}
          </button>
        </div>
      </div>
    </div>
  );
}
