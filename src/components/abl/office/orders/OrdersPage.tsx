import { useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/query-keys";
import { formatBBD } from "@/lib/format";
import { toast } from "sonner";
import { Search, Download, Plus, X as XIcon, Printer, RefreshCw } from "lucide-react";
import { openInvoicePdf, printInvoicesBulk, backfillMissingInvoicePdfs } from "@/lib/invoices/generate";
import { OrderStatusBadge, type OrderStatus } from "@/components/abl/OrderStatusBadge";
import {
  TABS, type TabKey, statusToTab, isToday, timeAgo, formatTimeOnly,
  matchesTab as matchTabFn, DATE_PRESETS, dateRangeFor, defaultDatePresetFor,
  SORTS, type SortKey, type DatePreset, ordersToCsv, downloadCsv,
} from "@/lib/orders";
import { ORDER_SELECT, type OrderRow, type CustomerLite } from "./types";
import { OrderDrawer } from "./OrderDrawer";
import {
  SimpleConfirm, ReasonModal, AssignPickerModal, AssignDriverModal, MarkDeliveredModal, MarkPaidModal,
} from "./OrderActionModals";
import { NewOrderModal } from "./NewOrderModal";

type ConfirmAction =
  | { kind: "approve" | "send-to-warehouse" | "mark-packed" | "mark-invoiced" | "restore"; orderId: string }
  | { kind: "reject" | "cancel"; orderId: string }
  | { kind: "assign-driver" | "mark-delivered" | "mark-paid"; orderId: string };

export function OrdersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = useSearch({ strict: false }) as { tab?: string; status?: string; new?: string };

  const initialTab = (search.tab as TabKey) || statusToTab(search.status);
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newOrderOpen, setNewOrderOpen] = useState(search.new === "1");

  // Filters
  const [query, setQuery] = useState("");
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [salesRepFilter, setSalesRepFilter] = useState<string>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>(defaultDatePresetFor(initialTab));
  const [sort, setSort] = useState<SortKey>("newest");

  // Sync tab from URL via memo on initialTab (no useEffect needed — change tab in setTabAndUrl)
  // initialTab recomputes when search changes, but we still need a way to react:
  // do it lazily by deriving from initialTab when user navigates.

  // ---- React Query: orders + customers + order item summary ----
  const ordersQuery = useQuery({
    queryKey: qk.orders(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(ORDER_SELECT)
        .order("placed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as OrderRow[];
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  const customersQuery = useQuery({
    queryKey: qk.customers(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, company_name, phone, delivery_address, sales_rep_name, payment_terms_days, credit_limit");
      if (error) throw error;
      const m: Record<string, CustomerLite> = {};
      ((data ?? []) as CustomerLite[]).forEach((x) => (m[x.id] = x));
      return m;
    },
    staleTime: 30_000,
  });

  const itemSummaryQuery = useQuery({
    queryKey: ["order-item-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.from("order_items").select("order_id, quantity");
      if (error) throw error;
      const sum: Record<string, { lines: number; cases: number }> = {};
      ((data ?? []) as Array<{ order_id: string; quantity: number }>).forEach((it) => {
        const s = sum[it.order_id] ?? { lines: 0, cases: 0 };
        s.lines += 1;
        s.cases += Number(it.quantity) || 0;
        sum[it.order_id] = s;
      });
      return sum;
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  const orders = ordersQuery.data ?? [];
  const customers = customersQuery.data ?? {};
  const itemSummary = itemSummaryQuery.data ?? {};

  const reload = () => {
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    queryClient.invalidateQueries({ queryKey: ["order-item-summary"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-kpis"] });
    queryClient.invalidateQueries({ queryKey: ["pipeline-counts"] });
    queryClient.invalidateQueries({ queryKey: ["pending-orders"] });
    queryClient.invalidateQueries({ queryKey: ["activity-feed"] });
    setSelected(new Set());
  };

  const setTabAndUrl = (k: TabKey) => {
    setTab(k);
    setSelected(new Set());
    setDatePreset(defaultDatePresetFor(k));
    navigate({ to: "/office/orders", search: { tab: k } as any, replace: true });
  };

  // ---- filtering ----
  const counts = useMemo(() => {
    const map: Record<TabKey, number> = { pending: 0, approved: 0, picking: 0, packed: 0, out_for_delivery: 0, delivered_today: 0, all: 0, cancelled: 0 };
    orders.forEach((o) => TABS.forEach((t) => { if (matchTabFn(o, t.key)) map[t.key]++; }));
    return map;
  }, [orders]);

  const filtered = useMemo(() => {
    let rows = orders.filter((o) => matchTabFn(o, tab));

    const { from, to } = dateRangeFor(datePreset);
    if (from || to) {
      const dateField = tab === "delivered_today" ? "delivered_at" : "placed_at";
      rows = rows.filter((o) => {
        const v = (o as any)[dateField];
        if (!v) return false;
        const t = new Date(v).getTime();
        if (from && t < from.getTime()) return false;
        if (to && t >= to.getTime()) return false;
        return true;
      });
    }

    if (customerFilter !== "all") rows = rows.filter((o) => o.customer_id === customerFilter);
    if (salesRepFilter !== "all") {
      rows = rows.filter((o) => (customers[o.customer_id]?.sales_rep_name ?? "Direct") === salesRepFilter);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter((o) => {
        const c = customers[o.customer_id]?.company_name?.toLowerCase() ?? "";
        return (o.order_number ?? "").toLowerCase().includes(q)
          || (o.invoice_number ?? "").toLowerCase().includes(q)
          || c.includes(q);
      });
    }

    rows = rows.slice().sort((a, b) => {
      switch (sort) {
        case "newest":  return new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime();
        case "oldest":  return new Date(a.placed_at).getTime() - new Date(b.placed_at).getTime();
        case "highest": return Number(b.total) - Number(a.total);
        case "lowest":  return Number(a.total) - Number(b.total);
        case "az":      return (customers[a.customer_id]?.company_name ?? "").localeCompare(customers[b.customer_id]?.company_name ?? "");
        case "overdue": {
          const ad = a.due_date ? new Date(a.due_date).getTime() : Infinity;
          const bd = b.due_date ? new Date(b.due_date).getTime() : Infinity;
          return ad - bd;
        }
      }
    });

    return rows;
  }, [orders, tab, datePreset, customerFilter, salesRepFilter, query, sort, customers]);

  const liveCounts = useMemo(() => {
    const pending = counts.pending;
    const inProgress = counts.approved + counts.picking + counts.packed + counts.out_for_delivery;
    const deliveredToday = counts.delivered_today;
    const invoiced = orders.filter((o) => o.status === "invoiced").length;
    return { pending, inProgress, deliveredToday, invoiced };
  }, [orders, counts]);

  const salesReps = useMemo(() => {
    const set = new Set<string>();
    Object.values(customers).forEach((c) => set.add(c.sales_rep_name ?? "Direct"));
    return Array.from(set).sort();
  }, [customers]);

  const customerOptions = useMemo(
    () => Object.values(customers).slice().sort((a, b) => a.company_name.localeCompare(b.company_name)),
    [customers],
  );

  const filtersActive =
    !!query || customerFilter !== "all" || salesRepFilter !== "all"
    || datePreset !== defaultDatePresetFor(tab) || sort !== "newest";

  const clearFilters = () => { setQuery(""); setCustomerFilter("all"); setSalesRepFilter("all"); setDatePreset(defaultDatePresetFor(tab)); setSort("newest"); };

  // ---- mutation: transition an order. Optimistic remove from current tab. ----
  const transitionMutation = useMutation({
    mutationFn: async (input: { orderId: string; kind: ConfirmAction["kind"]; reason?: string; data?: any }) => {
      const order = orders.find((o) => o.id === input.orderId);
      if (!order) throw new Error("Order not found");
      await performTransition(order, input.kind, input.reason, input.data);
    },
    onMutate: async (input) => {
      // Optimistically remove the row from the orders cache so it disappears
      // from the current tab instantly. The server refetch fixes the final state.
      await queryClient.cancelQueries({ queryKey: qk.orders() });
      const prev = queryClient.getQueryData<OrderRow[]>(qk.orders());
      if (prev) {
        const order = prev.find((o) => o.id === input.orderId);
        if (order) {
          const next = prev.map((o) => o.id === input.orderId ? { ...o, status: nextStatusFor(o, input.kind) } : o);
          queryClient.setQueryData(qk.orders(), next);
        }
      }
      return { prev };
    },
    onError: (err: any, _input, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(qk.orders(), ctx.prev);
      toast.error(err?.message ?? "Action failed");
    },
    onSettled: () => {
      reload();
    },
  });

  const busy = transitionMutation.isPending;

  const runAction = (ext?: { kind: ConfirmAction["kind"]; orderId: string; reason?: string; data?: any }) => {
    const c = ext ?? (confirm ? { ...confirm } : null);
    if (!c) return;
    transitionMutation.mutate(c, {
      onSuccess: () => setConfirm(null),
      onError: () => setConfirm(null),
    });
  };

  const bulkRun = async (kind: ConfirmAction["kind"], reason?: string) => {
    const ids = Array.from(selected);
    for (const id of ids) {
      try {
        await transitionMutation.mutateAsync({ orderId: id, kind, reason });
      } catch { /* per-order toast already shown */ }
    }
    toast.success(`${ids.length} order(s) updated`);
    setSelected(new Set());
  };

  const exportCurrent = () => {
    const csv = ordersToCsv(filtered, customers);
    downloadCsv(`orders-${tab}-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  return (
    <>
      {/* Top bar */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-extrabold text-ink" style={{ letterSpacing: "-0.02em" }}>Orders</h1>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            <span className="font-semibold text-[#B45309]">{liveCounts.pending} pending</span> ·{" "}
            <span className="font-semibold text-ink">{liveCounts.inProgress} in progress</span> ·{" "}
            <span className="font-semibold text-[#047857]">{liveCounts.deliveredToday} delivered today</span> ·{" "}
            <span className="font-semibold text-[#BE185D]">{liveCounts.invoiced} invoiced</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BackfillButton onDone={reload} />
          <button onClick={exportCurrent} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-[12.5px] font-semibold text-ink hover:bg-secondary">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          <button onClick={() => setNewOrderOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-2 text-[12.5px] font-semibold text-white">
            <Plus className="h-3.5 w-3.5" /> New order
          </button>
        </div>
      </div>

      {/* Sticky tabs */}
      <div className="sticky top-0 z-20 -mx-6 mb-3 border-b border-border bg-background/95 px-6 py-2.5 backdrop-blur">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => {
            const active = tab === t.key;
            const muted = t.key === "cancelled";
            return (
              <button key={t.key} onClick={() => setTabAndUrl(t.key)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition ${
                  active
                    ? "bg-[#0F2540] text-white"
                    : muted
                      ? "border border-border bg-[#FAFBFC] text-muted-foreground/70 hover:text-ink"
                      : "border border-border bg-[#FAFBFC] text-[#64748B] hover:text-ink"
                } ${t.key === "cancelled" ? "ml-auto" : ""}`}>
                <span>{t.label}</span>
                <span className={`text-[11px] ${active ? "text-white/70" : "text-muted-foreground/80"}`}>
                  ({counts[t.key]})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter bar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative max-w-[360px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search order #, customer, invoice…"
            className="w-full rounded-md border border-border bg-card py-1.5 pl-8 pr-3 text-[12.5px] text-ink focus:border-ink focus:outline-none" />
        </div>
        <Sel value={customerFilter} onChange={setCustomerFilter}>
          <option value="all">All customers</option>
          {customerOptions.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
        </Sel>
        <Sel value={salesRepFilter} onChange={setSalesRepFilter}>
          <option value="all">All sales reps</option>
          {salesReps.map((s) => <option key={s} value={s}>{s}</option>)}
        </Sel>
        <Sel value={datePreset} onChange={(v) => setDatePreset(v as DatePreset)}>
          {DATE_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </Sel>
        <Sel value={sort} onChange={(v) => setSort(v as SortKey)}>
          {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </Sel>
        {filtersActive && (
          <button onClick={clearFilters} className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-ink">
            <XIcon className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <OrdersTable
        tab={tab}
        rows={filtered}
        customers={customers}
        itemSummary={itemSummary}
        selected={selected}
        onSelectChange={setSelected}
        onRowClick={(id) => setDrawerId(id)}
        onAction={(orderId, kind) => setConfirm({ kind, orderId } as any)}
      />

      {/* Drawer */}
      {drawerId && (
        <OrderDrawer
          order={orders.find((o) => o.id === drawerId)!}
          customer={customers[orders.find((o) => o.id === drawerId)!.customer_id]}
          onClose={() => setDrawerId(null)}
          onOrderUpdated={reload}
          onAction={(kind) => setConfirm({ kind, orderId: drawerId } as any)}
        />
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <BulkBar
          tab={tab} count={selected.size}
          ids={Array.from(selected)}
          orders={filtered.filter((o) => selected.has(o.id))}
          onClear={() => setSelected(new Set())}
          onAction={(kind, reason) => bulkRun(kind, reason)}
          onExport={() => {
            const subset = filtered.filter((o) => selected.has(o.id));
            downloadCsv(`orders-selected-${new Date().toISOString().slice(0, 10)}.csv`, ordersToCsv(subset, customers));
          }}
        />
      )}

      {/* Modals */}
      {confirm && (
        <ActionModalSwitch
          action={confirm}
          order={orders.find((o) => o.id === confirm.orderId)}
          customers={customers}
          onCancel={() => setConfirm(null)}
          onRun={(reason, data) => runAction({ ...confirm, reason, data } as any)}
          busy={busy}
        />
      )}

      {newOrderOpen && (
        <NewOrderModal
          onClose={() => { setNewOrderOpen(false); navigate({ to: "/office/orders", search: { tab } as any, replace: true }); }}
          onCreated={(id) => { setNewOrderOpen(false); reload(); setDrawerId(id); }}
        />
      )}
    </>
  );
}

// ---------- Table ----------

function OrdersTable({
  tab, rows, customers, itemSummary, selected, onSelectChange, onRowClick, onAction,
}: {
  tab: TabKey; rows: OrderRow[]; customers: Record<string, CustomerLite>;
  itemSummary: Record<string, { lines: number; cases: number }>;
  selected: Set<string>; onSelectChange: (s: Set<string>) => void;
  onRowClick: (id: string) => void; onAction: (id: string, kind: string) => void;
}) {
  const showWaiting = tab === "pending";
  const showPicker = tab === "picking";
  const showReadySince = tab === "packed";
  const showDriver = tab === "out_for_delivery" || tab === "delivered_today";
  const showEta = tab === "out_for_delivery";
  const showDeliveredAt = tab === "delivered_today";
  const showCancelled = tab === "cancelled";
  const showInvoice = tab === "all" || tab === "packed";

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => {
    if (allChecked) onSelectChange(new Set());
    else onSelectChange(new Set(rows.map((r) => r.id)));
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {rows.length === 0 ? (
        <div className="py-16 text-center text-[13px] text-muted-foreground">Nothing in this view.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="sticky top-0 bg-secondary/60">
              <tr className="border-b border-border text-left text-[10.5px] uppercase text-muted-foreground" style={{ letterSpacing: "0.08em" }}>
                <th className="w-9 px-2 py-2.5">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} />
                </th>
                <th className="px-2 py-2.5">Order #</th>
                <th className="px-2 py-2.5">Customer</th>
                <th className="px-2 py-2.5">Date</th>
                <th className="px-2 py-2.5">Items</th>
                <th className="px-2 py-2.5 text-right">Total</th>
                <th className="px-2 py-2.5">Status</th>
                {showWaiting     && <th className="px-2 py-2.5">Waiting</th>}
                {showPicker      && <th className="px-2 py-2.5">Picker</th>}
                {showReadySince  && <th className="px-2 py-2.5">Ready since</th>}
                {showDriver      && <th className="px-2 py-2.5">Driver</th>}
                {showEta         && <th className="px-2 py-2.5">ETA</th>}
                {showDeliveredAt && <th className="px-2 py-2.5">Delivered</th>}
                {showCancelled   && <><th className="px-2 py-2.5">Reason</th></>}
                {showInvoice && tab === "all" && <><th className="px-2 py-2.5">Invoice</th><th className="px-2 py-2.5">Due</th></>}
                {showInvoice && tab === "packed" && <th className="px-2 py-2.5">Invoice</th>}
                <th className="w-10 px-2 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => <OrderTableRow key={o.id} order={o} customer={customers[o.customer_id]}
                tab={tab}
                summary={itemSummary[o.id]}
                checked={selected.has(o.id)}
                onToggle={() => {
                  const next = new Set(selected);
                  if (next.has(o.id)) next.delete(o.id); else next.add(o.id);
                  onSelectChange(next);
                }}
                onClick={() => onRowClick(o.id)}
                onAction={(k) => onAction(o.id, k)}
                flags={{ showWaiting, showPicker, showReadySince, showDriver, showEta, showDeliveredAt, showCancelled, showInvoice }}
              />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OrderTableRow({
  order, customer, tab, summary, checked, onToggle, onClick, onAction, flags,
}: {
  order: OrderRow; customer?: CustomerLite; tab: TabKey;
  summary?: { lines: number; cases: number };
  checked: boolean; onToggle: () => void; onClick: () => void; onAction: (k: string) => void;
  flags: { showWaiting: boolean; showPicker: boolean; showReadySince: boolean; showDriver: boolean; showEta: boolean; showDeliveredAt: boolean; showCancelled: boolean; showInvoice: boolean };
}) {
  const dateField =
    tab === "approved" ? order.approved_at
    : tab === "picking" ? order.picking_started_at
    : tab === "packed" ? order.packed_at
    : tab === "out_for_delivery" ? order.dispatched_at
    : tab === "delivered_today" ? order.delivered_at
    : tab === "cancelled" ? order.cancelled_at
    : order.placed_at;

  const waitingHrs = order.status === "pending_approval"
    ? (Date.now() - new Date(order.placed_at).getTime()) / 3600000 : 0;
  const overdue = order.due_date && new Date(order.due_date) < new Date();

  return (
    <tr className="border-b border-border hover:bg-[#FAFBFC] cursor-pointer" onClick={onClick}>
      <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={checked} onChange={onToggle} />
      </td>
      <td className="px-2 py-2"><span className="font-mono text-[11.5px] font-bold text-ink">{order.order_number}</span></td>
      <td className="px-2 py-2">
        <div className="font-semibold text-ink">{customer?.company_name ?? "—"}</div>
        <div className="text-[11px] text-muted-foreground">{customer?.sales_rep_name ?? "Direct"}{order.placed_on_behalf && " · on behalf"}</div>
      </td>
      <td className="px-2 py-2 text-muted-foreground">{timeAgo(dateField)}</td>
      <td className="px-2 py-2 text-muted-foreground">{summary ? `${summary.lines} lines · ${summary.cases} cases` : "—"}</td>
      <td className="px-2 py-2 text-right font-bold text-ink">{formatBBD(Number(order.total))}</td>
      <td className="px-2 py-2"><OrderStatusBadge status={order.status} /></td>
      {flags.showWaiting && (
        <td className="px-2 py-2" style={{ color: waitingHrs > 4 ? "#B91C1C" : undefined }}>{timeAgo(order.placed_at)}</td>
      )}
      {flags.showPicker && <td className="px-2 py-2">{order.assigned_picker_name ?? "Unassigned"}</td>}
      {flags.showReadySince && <td className="px-2 py-2">{timeAgo(order.packed_at)}</td>}
      {flags.showDriver && <td className="px-2 py-2">{order.driver_name ?? "—"}</td>}
      {flags.showEta && <td className="px-2 py-2">{order.eta ? formatTimeOnly(order.eta) : "—"}</td>}
      {flags.showDeliveredAt && <td className="px-2 py-2">{formatTimeOnly(order.delivered_at)}</td>}
      {flags.showCancelled && <td className="px-2 py-2 text-muted-foreground">{order.cancellation_reason ?? order.rejection_reason ?? "—"}</td>}
      {flags.showInvoice && tab === "all" && (
        <>
          <td className="px-2 py-2 font-mono text-[11px]">{order.invoice_number ?? "—"}</td>
          <td className="px-2 py-2" style={{ color: overdue ? "#B91C1C" : undefined }}>{order.due_date ?? "—"}</td>
        </>
      )}
      {flags.showInvoice && tab === "packed" && (
        <td className="px-2 py-2 font-mono text-[11px]">{order.invoice_number ?? <span className="text-muted-foreground">—</span>}</td>
      )}
      <td className="px-2 py-2 text-right" onClick={(e) => e.stopPropagation()}>
        <QuickActions order={order} onAction={onAction} />
      </td>
    </tr>
  );
}

function QuickActions({ order, onAction }: { order: OrderRow; onAction: (k: string) => void }) {
  const Item = ({ k, label, color = "#0B1A2E" }: { k: string; label: string; color?: string }) => (
    <button onClick={() => onAction(k)} className="rounded px-2 py-1 text-[11.5px] font-semibold text-white" style={{ backgroundColor: color }}>{label}</button>
  );
  const PrintBtn = order.invoice_number ? <PrintInvoiceButton orderId={order.id} /> : null;
  const wrap = (node: React.ReactNode) => PrintBtn ? <div className="flex items-center justify-end gap-1.5">{PrintBtn}{node}</div> : node;
  switch (order.status) {
    case "pending_approval": return <div className="flex justify-end gap-1.5"><Item k="reject" label="Reject" color="#B91C1C" /><Item k="approve" label="Approve" color="#10B981" /></div>;
    case "approved":         return wrap(<Item k="send-to-warehouse" label="To warehouse" />);
    case "picking":          return wrap(<Item k="mark-packed" label="Mark packed" color="#6D28D9" />);
    case "packed":           return wrap(<Item k="assign-driver" label="Assign driver" color="#7E22CE" />);
    case "out_for_delivery": return wrap(<Item k="mark-delivered" label="Mark delivered" color="#10B981" />);
    case "delivered":        return wrap(<Item k="mark-invoiced" label="Mark invoiced" color="#BE185D" />);
    case "invoiced":         return wrap(<Item k="mark-paid" label="Mark paid" color="#10B981" />);
    case "cancelled":        return <Item k="restore" label="Restore" />;
    default:                 return PrintBtn ?? null;
  }
}

function PrintInvoiceButton({ orderId }: { orderId: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      title="Print invoice"
      aria-label="Print invoice"
      disabled={busy}
      onClick={async (e) => {
        e.stopPropagation();
        setBusy(true);
        try { await openInvoicePdf(orderId, { print: true }); } finally { setBusy(false); }
      }}
      className="grid h-7 w-7 place-items-center rounded border border-border bg-white text-ink hover:bg-[#F1F5F9] disabled:opacity-50"
    >
      <Printer className="h-3.5 w-3.5" />
    </button>
  );
}

// ---------- Bulk action bar ----------

function BulkBar({ tab, count, ids, orders, onClear, onAction, onExport }: {
  tab: TabKey; count: number; ids: string[]; orders: OrderRow[]; onClear: () => void;
  onAction: (kind: ConfirmAction["kind"], reason?: string) => void; onExport: () => void;
}) {
  const invoicedIds = orders.filter((o) => o.invoice_number).map((o) => o.id);
  return (
    <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-white shadow-2xl">
        <span className="text-[12.5px] font-semibold">{count} selected</span>
        <span className="h-4 w-px bg-white/20" />
        {tab === "pending" && <>
          <BulkBtn label="Approve all" color="#10B981" onClick={() => onAction("approve")} />
        </>}
        {tab === "approved" && <BulkBtn label="Send to warehouse" onClick={() => onAction("send-to-warehouse")} />}
        {tab === "picking" && <BulkBtn label="Mark all packed" color="#6D28D9" onClick={() => onAction("mark-packed")} />}
        {tab === "packed" && invoicedIds.length > 0 && (
          <BulkPrintInvoicesBtn ids={invoicedIds} count={invoicedIds.length} />
        )}
        {tab === "delivered_today" && <BulkBtn label="Mark all invoiced" color="#BE185D" onClick={() => onAction("mark-invoiced")} />}
        <BulkBtn label="Export selected" onClick={onExport} />
        <button onClick={onClear} className="rounded-full px-2 py-0.5 text-[11px] text-white/70 hover:text-white">Cancel</button>
      </div>
    </div>
  );
}
function BulkBtn({ label, color = "#1F3553", onClick }: { label: string; color?: string; onClick: () => void }) {
  return <button onClick={onClick} className="rounded-full px-3 py-1 text-[12px] font-semibold text-white" style={{ backgroundColor: color }}>{label}</button>;
}

function BulkPrintInvoicesBtn({ ids, count }: { ids: string[]; count: number }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => { setBusy(true); try { await printInvoicesBulk(ids); } finally { setBusy(false); } }}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-full bg-[#6D28D9] px-3 py-1 text-[12px] font-semibold text-white disabled:opacity-60"
    >
      <Printer className="h-3 w-3" /> {busy ? "Building…" : `Print ${count} invoice${count === 1 ? "" : "s"}`}
    </button>
  );
}

function BackfillButton({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const run = async () => {
    setBusy(true);
    setProgress({ done: 0, total: 0 });
    try {
      const res = await backfillMissingInvoicePdfs((done, total) => setProgress({ done, total }));
      if (res.generated === 0 && res.failed === 0) {
        toast.info("No invoices needed regenerating");
      } else {
        toast.success(`Backfill complete · ${res.generated} generated${res.failed ? ` · ${res.failed} failed` : ""}`);
      }
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Backfill failed");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };
  return (
    <button onClick={run} disabled={busy} title="Generate any missing invoice PDFs"
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-[12.5px] font-semibold text-ink hover:bg-secondary disabled:opacity-60">
      <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
      {busy && progress ? `Backfill ${progress.done}/${progress.total}` : "Backfill PDFs"}
    </button>
  );
}

// ---------- Action modal switch ----------

function ActionModalSwitch({ action, order, customers, onCancel, onRun, busy }: {
  action: ConfirmAction; order?: OrderRow; customers: Record<string, CustomerLite>;
  onCancel: () => void; onRun: (reason?: string, data?: any) => void; busy: boolean;
}) {
  if (!order) return null;
  const n = order.order_number ?? "";
  const cust = customers[order.customer_id]?.company_name ?? "customer";

  switch (action.kind) {
    case "approve":
      return <SimpleConfirm title={`Approve ${n}?`} body={`Approve order ${n} for ${cust}.`} confirmLabel="Yes, approve" confirmColor="#10B981" onConfirm={() => onRun()} onCancel={onCancel} loading={busy} />;
    case "send-to-warehouse":
      return <AssignPickerModal onConfirm={(name) => onRun(undefined, { picker: name })} onCancel={onCancel} loading={busy} />;
    case "mark-packed":
      return <SimpleConfirm title={`Mark ${n} as packed?`} confirmLabel="Mark packed" confirmColor="#6D28D9" onConfirm={() => onRun()} onCancel={onCancel} loading={busy} />;
    case "mark-invoiced":
      return <SimpleConfirm title={`Mark ${n} as invoiced?`} body="An invoice number will be generated and a due date set based on the customer's payment terms." confirmLabel="Generate invoice" confirmColor="#BE185D" onConfirm={() => onRun()} onCancel={onCancel} loading={busy} />;
    case "restore":
      return <SimpleConfirm title={`Restore ${n}?`} body="The order will return to its previous state." confirmLabel="Restore" confirmColor="#3B82F6" onConfirm={() => onRun()} onCancel={onCancel} loading={busy} />;
    case "reject":
      return <ReasonModal title={`Reject ${n}?`} label="Rejection reason (required)" placeholder="e.g. Out of stock, credit hold…" confirmLabel="Reject order" onConfirm={(r) => onRun(r)} onCancel={onCancel} loading={busy} />;
    case "cancel":
      return <ReasonModal title={`Cancel ${n}?`} label="Cancellation reason (required)" placeholder="e.g. Customer request"
        warning={cancelWarning(order.status)} confirmLabel="Cancel order" onConfirm={(r) => onRun(r)} onCancel={onCancel} loading={busy} />;
    case "assign-driver":
      return <AssignDriverModal onConfirm={(d) => onRun(undefined, d)} onCancel={onCancel} loading={busy} />;
    case "mark-delivered":
      return <MarkDeliveredModal onConfirm={(d) => onRun(undefined, d)} onCancel={onCancel} loading={busy} />;
    case "mark-paid":
      return <MarkPaidModal amount={Number(order.total)} onConfirm={(d) => onRun(undefined, d)} onCancel={onCancel} loading={busy} />;
  }
}

function cancelWarning(s: OrderStatus): string | undefined {
  switch (s) {
    case "approved": return "Order is approved. Cancelling will not return inventory because picking hasn't started.";
    case "picking":
    case "packed":  return "Order is in the warehouse. Cancelling will reverse the stock allocation and require physical return-to-shelf.";
    case "out_for_delivery": return "Order is on the truck. Confirm physical recovery before cancelling.";
    case "delivered":
    case "invoiced": return "Delivered/invoiced orders cannot be cancelled directly — issue a credit note instead.";
    default: return undefined;
  }
}

// ---------- Status transition core ----------

async function performTransition(order: OrderRow, kind: ConfirmAction["kind"], reason?: string, data?: any) {
  let patch: any = {};
  switch (kind) {
    case "approve":
      patch = { status: "approved" }; break;
    case "reject":
      patch = { status: "cancelled", rejection_reason: reason ?? "", cancellation_reason: reason ?? "" }; break;
    case "send-to-warehouse":
      patch = { status: "picking", assigned_picker_name: data?.picker || null }; break;
    case "mark-packed":
      patch = { status: "packed" }; break;
    case "assign-driver":
      patch = { status: "out_for_delivery", driver_name: data?.driver_name, vehicle_id: data?.vehicle_id, eta: data?.eta }; break;
    case "mark-delivered":
      patch = { status: "delivered", delivered_to_name: data?.delivered_to_name }; break;
    case "mark-invoiced":
      patch = { status: "invoiced" }; break;
    case "cancel":
      patch = { status: "cancelled", cancellation_reason: reason ?? "" }; break;
    case "restore": {
      const target = order.previous_status ?? "pending_approval";
      patch = { status: target, cancellation_reason: null }; break;
    }
    case "mark-paid": {
      // Insert a cleared payment fully allocated; trigger flips order → paid.
      const { data: pmt, error } = await supabase.from("payments").insert({
        customer_id: order.customer_id, amount: Number(order.total),
        payment_method: data?.method ?? "cash", reference: data?.reference || null,
        status: "cleared",
      } as any).select("id").single();
      if (error || !pmt) throw error ?? new Error("Payment failed");
      const { error: ae } = await supabase.from("payment_allocations").insert({
        payment_id: pmt.id, order_id: order.id, amount: Number(order.total),
      } as any);
      if (ae) throw ae;
      toast.success(`Payment recorded · ${order.order_number} marked paid`);
      return;
    }
  }
  const { error } = await supabase.from("orders").update(patch).eq("id", order.id);
  if (error) throw error;
  toast.success(`${order.order_number} updated`);
}

/** Project the optimistic next status for a transition (used by useMutation onMutate). */
function nextStatusFor(order: OrderRow, kind: ConfirmAction["kind"]): OrderStatus {
  switch (kind) {
    case "approve":            return "approved";
    case "reject":             return "cancelled";
    case "send-to-warehouse":  return "picking";
    case "mark-packed":        return "packed";
    case "assign-driver":      return "out_for_delivery";
    case "mark-delivered":     return "delivered";
    case "mark-invoiced":      return "invoiced";
    case "cancel":             return "cancelled";
    case "mark-paid":          return "paid" as OrderStatus;
    case "restore":            return (order.previous_status ?? "pending_approval") as OrderStatus;
  }
}

// ---------- small UI helpers ----------

function Sel({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-border bg-card px-2.5 py-1.5 text-[12.5px] text-ink focus:border-ink focus:outline-none">
      {children}
    </select>
  );
}
