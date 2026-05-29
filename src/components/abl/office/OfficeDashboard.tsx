import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useClientGreeting } from "@/hooks/use-client-greeting";
import { qk } from "@/lib/query-keys";
import {
  SkeletonKpiCard,
  SkeletonActivityRow,
  SkeletonPendingRow,
  SkeletonPipelineCol,
} from "@/components/abl/skeletons";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { formatBBD } from "@/lib/format";
import { isToday } from "@/lib/orders";
import { toast } from "sonner";
import { Check, X, Eye, Printer } from "lucide-react";
import { printInvoicesBulk } from "@/lib/invoices/generate";
import type { Tables } from "@/integrations/supabase/types";

type OrderRow = Tables<"orders">;
type Customer = Tables<"customers">;
type Activity = Tables<"activity_log">;

type PipelineCounts = {
  pending_approval: number;
  approved: number;
  picking: number;
  packed: number;
  out_for_delivery: number;
  delivered_today: number;
};

type KpiData = PipelineCounts & {
  in_warehouse: number;
  delivered_today_total: number;
  revenue_today: number;
};

type PendingOrderWithCustomer = OrderRow & {
  customer: Pick<
    Customer,
    "id" | "company_name" | "phone" | "delivery_address" | "credit_limit" | "current_balance"
  > | null;
  item_total_qty: number;
};

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr`;
  return `${Math.floor(diff / 86400)}d`;
}

// ---------- Query functions ----------

async function fetchKpiData(): Promise<KpiData> {
  const { data, error } = await supabase
    .from("orders")
    .select("status, total, delivered_at")
    .returns<Pick<OrderRow, "status" | "total" | "delivered_at">[]>();
  if (error) throw error;
  const c: KpiData = {
    pending_approval: 0, approved: 0, picking: 0, packed: 0,
    out_for_delivery: 0, delivered_today: 0,
    in_warehouse: 0, delivered_today_total: 0, revenue_today: 0,
  };
  for (const o of data ?? []) {
    if (o.status === "pending_approval") c.pending_approval++;
    else if (o.status === "approved") c.approved++;
    else if (o.status === "picking") { c.picking++; c.in_warehouse++; }
    else if (o.status === "packed") { c.packed++; c.in_warehouse++; }
    else if (o.status === "out_for_delivery") c.out_for_delivery++;
    if (
      (o.status === "delivered" || o.status === "invoiced" || o.status === "paid") &&
      isToday(o.delivered_at)
    ) {
      c.delivered_today++;
      c.delivered_today_total += Number(o.total);
      c.revenue_today += Number(o.total);
    }
  }
  return c;
}

async function fetchPipelineCounts(): Promise<PipelineCounts> {
  const { data, error } = await supabase
    .from("orders")
    .select("status, delivered_at")
    .returns<Pick<OrderRow, "status" | "delivered_at">[]>();
  if (error) throw error;
  const c: PipelineCounts = {
    pending_approval: 0, approved: 0, picking: 0, packed: 0,
    out_for_delivery: 0, delivered_today: 0,
  };
  for (const o of data ?? []) {
    if (o.status === "pending_approval") c.pending_approval++;
    else if (o.status === "approved") c.approved++;
    else if (o.status === "picking") c.picking++;
    else if (o.status === "packed") c.packed++;
    else if (o.status === "out_for_delivery") c.out_for_delivery++;
    if (
      (o.status === "delivered" || o.status === "invoiced" || o.status === "paid") &&
      isToday(o.delivered_at)
    ) c.delivered_today++;
  }
  return c;
}

async function fetchPendingOrders(): Promise<PendingOrderWithCustomer[]> {
  const { data: orders, error } = await supabase
    .from("orders")
    .select("*, customer:customers(id, company_name, phone, delivery_address, credit_limit, current_balance)")
    .eq("status", "pending_approval")
    .order("placed_at", { ascending: false })
    .returns<(OrderRow & { customer: PendingOrderWithCustomer["customer"] })[]>();
  if (error) throw error;
  const rows = orders ?? [];
  if (rows.length === 0) return [];
  const ids = rows.map((o) => o.id);
  const { data: items } = await supabase
    .from("order_items")
    .select("order_id, quantity")
    .in("order_id", ids)
    .returns<{ order_id: string; quantity: number }[]>();
  const qtyByOrder = new Map<string, number>();
  for (const it of items ?? []) {
    qtyByOrder.set(it.order_id, (qtyByOrder.get(it.order_id) ?? 0) + Number(it.quantity));
  }
  return rows.map((o) => ({ ...o, item_total_qty: qtyByOrder.get(o.id) ?? 0 }));
}

async function fetchActivityFeed(): Promise<Activity[]> {
  const { data, error } = await supabase
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10)
    .returns<Activity[]>();
  if (error) throw error;
  return data ?? [];
}

async function fetchPrintableOrderIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("id, status, invoice_number, driver_profile_id")
    .eq("status", "packed")
    .not("invoice_number", "is", null)
    .is("driver_profile_id", null)
    .returns<Pick<OrderRow, "id" | "status" | "invoice_number" | "driver_profile_id">[]>();
  if (error) throw error;
  return (data ?? []).map((r) => r.id);
}

// ---------- Main component ----------

export function OfficeDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const helloText = useClientGreeting();
  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);
  const [rejectOrderId, setRejectOrderId] = useState<string | null>(null);
  const [approveOrderId, setApproveOrderId] = useState<string | null>(null);

  const kpisQ = useQuery({
    queryKey: qk.dashboardKpis(),
    queryFn: fetchKpiData,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
  const pipelineQ = useQuery({
    queryKey: qk.pipelineCounts(),
    queryFn: fetchPipelineCounts,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
  const pendingQ = useQuery({
    queryKey: qk.pendingOrders(),
    queryFn: fetchPendingOrders,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
  const activityQ = useQuery({
    queryKey: qk.activityFeed(),
    queryFn: fetchActivityFeed,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  const kpis = kpisQ.data;
  const pipeline = pipelineQ.data;
  const pendingOrders = pendingQ.data ?? [];
  const activity = activityQ.data ?? [];

  const invalidatePendingArea = () => {
    queryClient.invalidateQueries({ queryKey: qk.pendingOrders() });
    queryClient.invalidateQueries({ queryKey: qk.pipelineCounts() });
    queryClient.invalidateQueries({ queryKey: qk.dashboardKpis() });
    queryClient.invalidateQueries({ queryKey: qk.activityFeed() });
  };

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("orders")
        .update({ status: "approved", approved_at: new Date().toISOString() })
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Update affected 0 rows — likely blocked by RLS");
      }
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: qk.pendingOrders() });
      const prev = queryClient.getQueryData<PendingOrderWithCustomer[]>(qk.pendingOrders());
      queryClient.setQueryData<PendingOrderWithCustomer[]>(
        qk.pendingOrders(),
        (old) => (old ?? []).filter((o) => o.id !== id),
      );
      return { prev };
    },
    onError: (err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(qk.pendingOrders(), ctx.prev);
      toast.error(err instanceof Error ? err.message : "Failed to approve");
    },
    onSuccess: (id) => {
      const o = pendingOrders.find((x) => x.id === id);
      toast.success(`Order ${o?.order_number ?? ""} approved · Now visible to warehouse`);
      setApproveOrderId(null);
      setDrawerOrderId(null);
    },
    onSettled: invalidatePendingArea,
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const o = pendingOrders.find((x) => x.id === id);
      const note = `REJECTED: ${reason}`;
      const { error } = await supabase
        .from("orders")
        .update({
          status: "cancelled",
          rejection_reason: reason,
          internal_notes: o?.internal_notes ? `${o.internal_notes}\n${note}` : note,
        })
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: qk.pendingOrders() });
      const prev = queryClient.getQueryData<PendingOrderWithCustomer[]>(qk.pendingOrders());
      queryClient.setQueryData<PendingOrderWithCustomer[]>(
        qk.pendingOrders(),
        (old) => (old ?? []).filter((o) => o.id !== id),
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(qk.pendingOrders(), ctx.prev);
      toast.error(err instanceof Error ? err.message : "Failed to reject");
    },
    onSuccess: (id) => {
      const o = pendingOrders.find((x) => x.id === id);
      toast.success(`Order ${o?.order_number ?? ""} rejected · Customer will be notified`);
      setRejectOrderId(null);
      setDrawerOrderId(null);
    },
    onSettled: invalidatePendingArea,
  });

  const drawerOrder = pendingOrders.find((o) => o.id === drawerOrderId) ?? null;

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const pendingCount = kpis?.pending_approval ?? pendingOrders.length;

  return (
    <>
      {/* Top bar */}
      <div className="mb-[22px] flex items-end justify-between gap-4">
        <div>
          <div className="text-[10.5px] uppercase text-muted-foreground" style={{ letterSpacing: "0.12em" }}>
            OPERATIONS · DASHBOARD
          </div>
          <h1 className="mt-1 text-[24px] font-extrabold text-ink" style={{ letterSpacing: "-0.02em" }}>
            {helloText}, Sarah
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {today}
            {kpisQ.isLoading ? "" : ` · ${pendingCount} ${pendingCount === 1 ? "order needs" : "orders need"} your attention`}
          </p>
        </div>
        <div className="flex gap-2">
          <PrintPendingInvoicesBtn />
          <button
            onClick={() => navigate({ to: "/office/tv" })}
            className="rounded-lg border border-border bg-card px-3.5 py-2 text-[13px] font-semibold text-ink hover:bg-secondary"
          >
            Open TV Dashboard
          </button>
          <button
            onClick={() => toast.info("Manual order entry coming soon")}
            className="rounded-lg px-3.5 py-2 text-[13px] font-semibold text-white"
            style={{ backgroundColor: "#0B1A2E" }}
          >
            + New Manual Order
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="mb-6 grid gap-3 grid-cols-2 min-[1100px]:grid-cols-6">
        {kpisQ.isLoading || !kpis ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonKpiCard key={i} />)
        ) : (
          <>
            <KpiCard
              alert
              label="PENDING APPROVAL"
              value={String(kpis.pending_approval)}
              trend="Needs action"
              trendClass="text-[#9A3412]"
            />
            <KpiCard
              label="REVENUE TODAY"
              value={
                <span>
                  <span className="mr-1 text-[14px] font-semibold text-muted-foreground">BBD$</span>
                  {kpis.revenue_today.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              }
              trend="↑ 22% vs avg"
              trendClass="text-[#047857]"
            />
            <KpiCard
              label="IN WAREHOUSE"
              value={String(kpis.in_warehouse)}
              trend={`${kpis.picking} picking · ${kpis.packed} packed`}
              trendClass="text-muted-foreground"
            />
            <KpiCard
              label="READY FOR DISPATCH"
              value={String(kpis.packed)}
              trend={kpis.packed > 0 ? "Awaiting driver assignment" : "All clear"}
              trendClass={kpis.packed > 0 ? "text-[#6D28D9]" : "text-muted-foreground"}
            />
            <KpiCard
              label="OUT FOR DELIVERY"
              value={String(kpis.out_for_delivery)}
              trend="Neal · Damon · Shawn"
              trendClass="text-muted-foreground"
            />
            <KpiCard
              label="DELIVERED TODAY"
              value={String(kpis.delivered_today)}
              trend={
                kpis.delivered_today_total > 0
                  ? `↑ ${formatBBD(kpis.delivered_today_total)} collected`
                  : "↑ $8,420 collected"
              }
              trendClass="text-[#047857]"
            />
          </>
        )}
      </div>

      {/* Pipeline header */}
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-[15px] font-bold text-ink" style={{ letterSpacing: "-0.01em" }}>
          Order pipeline
        </h2>
        <span className="text-[10.5px] text-muted-foreground">Real-time across all roles</span>
      </div>

      {/* Pipeline card */}
      <div className="mb-6 rounded-xl border border-border bg-card p-4">
        <div className="grid grid-cols-6 gap-2">
          {pipelineQ.isLoading || !pipeline ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonPipelineCol key={i} />)
          ) : (
            <>
              <PipelineCol n={pipeline.pending_approval} label="Pending"          color="#F59E0B" onClick={() => navigate({ to: "/office/orders", search: { status: "pending_approval" } })} />
              <PipelineCol n={pipeline.approved}         label="Approved"         color="#3B82F6" onClick={() => navigate({ to: "/office/orders", search: { status: "approved" } })} />
              <PipelineCol n={pipeline.picking}          label="Picking"          color="#6366F1" onClick={() => navigate({ to: "/office/orders", search: { status: "picking" } })} />
              <PipelineCol n={pipeline.packed}           label="Packed"           color="#8B5CF6" onClick={() => navigate({ to: "/office/orders", search: { status: "packed" } })} />
              <PipelineCol n={pipeline.out_for_delivery} label="Out for Delivery" color="#A855F7" onClick={() => navigate({ to: "/office/orders", search: { status: "out_for_delivery" } })} />
              <PipelineCol n={pipeline.delivered_today}  label="Delivered Today"  color="#047857" last onClick={() => navigate({ to: "/office/orders", search: { status: "delivered" } })} />
            </>
          )}
        </div>
      </div>

      {/* Two-col grid */}
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        {/* Pending approval queue */}
        <section className="rounded-xl border border-border bg-card p-[18px]">
          <header className="mb-3 flex items-baseline justify-between">
            <h3 className="text-[15px] font-bold text-ink">Pending approval</h3>
            <span className="text-[11.5px] text-muted-foreground">
              {pendingQ.isLoading
                ? "loading…"
                : `${pendingOrders.length} ${pendingOrders.length === 1 ? "order" : "orders"} waiting`}
            </span>
          </header>
          {pendingQ.isLoading ? (
            <ul className="space-y-2.5">{[0,1,2].map((i) => <SkeletonPendingRow key={i} />)}</ul>
          ) : pendingOrders.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-12 text-center text-[13px] text-muted-foreground">
              All caught up. No orders awaiting approval.
            </div>
          ) : (
            <ul className="space-y-2.5">
              {pendingOrders.map((o) => (
                <PendingRow
                  key={o.id}
                  order={o}
                  onApprove={() => setApproveOrderId(o.id)}
                  onReject={() => setRejectOrderId(o.id)}
                  onView={() => setDrawerOrderId(o.id)}
                />
              ))}
            </ul>
          )}
        </section>

        {/* Recent activity */}
        <section className="rounded-xl border border-border bg-card p-[18px]">
          <header className="mb-3 flex items-baseline justify-between">
            <h3 className="text-[15px] font-bold text-ink">Recent activity</h3>
            <span className="text-[11.5px] text-muted-foreground">Live feed</span>
          </header>
          {activityQ.isLoading ? (
            <ul>{[0,1,2,3,4].map((i) => <SkeletonActivityRow key={i} />)}</ul>
          ) : activity.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-muted-foreground">No activity yet.</div>
          ) : (
            <ul>
              {activity.map((ev, i) => (
                <li
                  key={ev.id}
                  className={`flex gap-3 py-2.5 ${i < activity.length - 1 ? "border-b border-border" : ""}`}
                >
                  <span className="w-[56px] flex-shrink-0 text-[11px] text-muted-foreground">{timeAgo(ev.created_at)}</span>
                  <span className="text-[12.5px] leading-[1.4] text-ink">{ev.description}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Modals & drawer */}
      {approveOrderId && (
        <ConfirmModal
          title={`Approve order ${pendingOrders.find((o) => o.id === approveOrderId)?.order_number} for ${pendingOrders.find((o) => o.id === approveOrderId)?.customer?.company_name ?? ""}?`}
          confirmLabel="Yes, approve"
          confirmClass="bg-[#10B981] text-white hover:bg-[#0EA371]"
          onConfirm={() => approveMutation.mutate(approveOrderId)}
          onCancel={() => setApproveOrderId(null)}
        />
      )}
      {rejectOrderId && (
        <RejectModal
          orderNumber={pendingOrders.find((o) => o.id === rejectOrderId)?.order_number ?? ""}
          onConfirm={(reason) => rejectMutation.mutate({ id: rejectOrderId, reason })}
          onCancel={() => setRejectOrderId(null)}
        />
      )}
      {drawerOrder && (
        <OrderDrawer
          order={drawerOrder}
          customer={drawerOrder.customer}
          onApprove={() => setApproveOrderId(drawerOrder.id)}
          onReject={() => setRejectOrderId(drawerOrder.id)}
          onClose={() => setDrawerOrderId(null)}
          onNotesSaved={invalidatePendingArea}
        />
      )}
    </>
  );
}

function KpiCard({
  label, value, trend, trendClass, alert,
}: {
  label: string; value: React.ReactNode; trend: string; trendClass?: string; alert?: boolean;
}) {
  const style = alert
    ? { background: "linear-gradient(135deg, #FFF8F2, #FFEFE0)", borderColor: "#FFD9B8" }
    : undefined;
  const valueColor = alert ? "#9A3412" : undefined;
  return (
    <div className="rounded-xl border border-border bg-card p-4" style={style}>
      <div className="text-[11.5px] font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="mt-1.5 text-[28px] font-extrabold text-ink" style={{ letterSpacing: "-0.025em", color: valueColor }}>
        {value}
      </div>
      <div className={`mt-1 text-[11px] font-semibold ${trendClass ?? ""}`}>{trend}</div>
    </div>
  );
}

function PrintPendingInvoicesBtn() {
  const { data: ids = [] } = useQuery({
    queryKey: [...qk.orders(), "printable-pending"] as const,
    queryFn: fetchPrintableOrderIds,
    staleTime: 10_000,
  });
  const [busy, setBusy] = useState(false);
  if (ids.length === 0) return null;
  return (
    <button
      onClick={async () => { setBusy(true); try { await printInvoicesBulk(ids); } finally { setBusy(false); } }}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-[13px] font-semibold text-ink hover:bg-secondary disabled:opacity-60"
    >
      <Printer className="h-3.5 w-3.5" />
      {busy ? "Building…" : `Print ${ids.length} pending invoice${ids.length === 1 ? "" : "s"}`}
    </button>
  );
}

function PipelineCol({
  n, label, color, last, onClick,
}: { n: number; label: string; color: string; last?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="relative flex flex-col items-center justify-center rounded-lg py-3 transition hover:bg-secondary">
      <div className="text-[26px] font-extrabold" style={{ color, letterSpacing: "-0.025em" }}>{n}</div>
      <div className="mt-0.5 text-[11px] font-semibold text-muted-foreground">{label}</div>
      {!last && (
        <span
          aria-hidden
          className="absolute -right-[5px] top-1/2 -translate-y-1/2 border-y-[5px] border-l-[6px] border-y-transparent"
          style={{ borderLeftColor: "#CBD5E1" }}
        />
      )}
    </button>
  );
}

function PendingRow({
  order, onApprove, onReject, onView,
}: {
  order: PendingOrderWithCustomer;
  onApprove: () => void; onReject: () => void; onView: () => void;
}) {
  const customer = order.customer;
  return (
    <li className="group rounded-[10px] border border-border p-3.5 transition hover:border-[#F59E0B] hover:bg-[#FFFBEB]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-semibold text-ink">
              {order.order_number}
            </span>
            <span className="text-[11px] text-muted-foreground">{timeAgo(order.placed_at)} ago</span>
          </div>
          <div className="mt-1.5 text-[14.5px] font-bold text-ink" style={{ letterSpacing: "-0.01em" }}>
            {customer?.company_name ?? "—"}
          </div>
          <div className="mt-0.5 text-[12px] text-muted-foreground">
            {order.item_total_qty} items · {formatBBD(Number(order.total))} · Direct order
            {customer?.delivery_address ? ` · ${customer.delivery_address.split(",")[0]}` : ""}
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <button onClick={onReject} className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-[12px] font-semibold text-[#B91C1C] hover:bg-[#FEF2F2]">
            <X className="h-3.5 w-3.5" /> Reject
          </button>
          <button onClick={onView} className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-[12px] font-semibold text-ink hover:bg-secondary">
            <Eye className="h-3.5 w-3.5" /> View
          </button>
          <button onClick={onApprove} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[12px] font-semibold text-white" style={{ backgroundColor: "#10B981" }}>
            <Check className="h-3.5 w-3.5" /> Approve
          </button>
        </div>
      </div>
    </li>
  );
}

function ConfirmModal({
  title, confirmLabel, confirmClass, onConfirm, onCancel,
}: { title: string; confirmLabel: string; confirmClass: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
        <h4 className="text-[15px] font-bold text-ink">{title}</h4>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-md border border-border bg-card px-3 py-2 text-[13px] font-semibold text-ink hover:bg-secondary">Cancel</button>
          <button onClick={onConfirm} className={`rounded-md px-3 py-2 text-[13px] font-semibold ${confirmClass}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function RejectModal({
  orderNumber, onConfirm, onCancel,
}: { orderNumber: string; onConfirm: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
        <h4 className="text-[15px] font-bold text-ink">Reject order {orderNumber}?</h4>
        <label className="mt-4 block text-[12px] font-semibold text-ink">
          Reason for rejection (visible to customer)
        </label>
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
            onClick={() => reason.trim() && onConfirm(reason.trim())}
            disabled={!reason.trim()}
            className="rounded-md bg-[#E11D48] px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            Confirm rejection
          </button>
        </div>
      </div>
    </div>
  );
}

type OrderItemRow = Tables<"order_items"> & {
  product: Pick<Tables<"products">, "name" | "sku" | "pack_size" | "pack_unit"> | null;
};

function OrderDrawer({
  order, customer, onApprove, onReject, onClose, onNotesSaved,
}: {
  order: OrderRow;
  customer: PendingOrderWithCustomer["customer"];
  onApprove: () => void; onReject: () => void; onClose: () => void; onNotesSaved: () => void;
}) {
  const [notes, setNotes] = useState(order.internal_notes ?? "");

  const itemsQ = useQuery({
    queryKey: [...qk.orderById(order.id), "items"] as const,
    queryFn: async (): Promise<OrderItemRow[]> => {
      const { data, error } = await supabase
        .from("order_items")
        .select("*, product:products(name, sku, pack_size, pack_unit)")
        .eq("order_id", order.id)
        .returns<OrderItemRow[]>();
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 10_000,
  });
  const items = itemsQ.data ?? [];

  const saveNotesMutation = useMutation({
    mutationFn: async (next: string) => {
      const { error } = await supabase.from("orders").update({ internal_notes: next }).eq("id", order.id);
      if (error) throw error;
    },
    onSuccess: onNotesSaved,
  });

  const saveNotes = () => {
    if (notes === (order.internal_notes ?? "")) return;
    saveNotesMutation.mutate(notes);
  };

  const available = customer ? Number(customer.credit_limit) - Number(customer.current_balance) : 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        className="flex h-full w-[600px] max-w-full flex-col overflow-y-auto bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border bg-card px-5 py-4">
          <div>
            <div className="text-[10.5px] uppercase text-muted-foreground" style={{ letterSpacing: "0.12em" }}>
              Order detail
            </div>
            <div className="mt-0.5 text-[17px] font-extrabold text-ink">{order.order_number}</div>
          </div>
          <button onClick={onClose} className="rounded-md border border-border px-2.5 py-1 text-[12px] font-semibold text-ink hover:bg-secondary">
            × Close
          </button>
        </div>

        <div className="flex-1 px-5 py-5">
          {/* Customer */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-[11px] font-semibold uppercase text-muted-foreground">Customer</div>
            <div className="mt-1 text-[15px] font-bold text-ink">{customer?.company_name ?? "—"}</div>
            <div className="mt-1 text-[12px] text-muted-foreground">
              {customer?.phone ?? "No phone"}<br />
              {customer?.delivery_address ?? "No address"}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <div className="text-muted-foreground">Credit limit</div>
                <div className="font-semibold text-ink">{formatBBD(Number(customer?.credit_limit ?? 0))}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Balance</div>
                <div className="font-semibold text-ink">{formatBBD(Number(customer?.current_balance ?? 0))}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Available</div>
                <div className={`font-semibold ${available < Number(order.total) ? "text-[#B91C1C]" : "text-[#047857]"}`}>
                  {formatBBD(available)}
                </div>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="mt-4 rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-2.5 text-[11px] font-semibold uppercase text-muted-foreground">Items</div>
            <table className="w-full text-[12.5px]">
              <thead className="bg-secondary text-left text-[11px] text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Product</th>
                  <th className="px-2 py-2 text-right">Qty</th>
                  <th className="px-2 py-2 text-right">Price</th>
                  <th className="px-4 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-border">
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-ink">{it.product?.name ?? "—"}</div>
                      <div className="font-mono text-[10.5px] text-muted-foreground">{it.product?.sku}</div>
                    </td>
                    <td className="px-2 py-2.5 text-right">{it.quantity}</td>
                    <td className="px-2 py-2.5 text-right">{formatBBD(Number(it.unit_price_at_order))}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{formatBBD(Number(it.line_total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="space-y-1 border-t border-border px-4 py-3 text-[12.5px]">
              <Row label="Subtotal" value={formatBBD(Number(order.subtotal))} />
              <Row label="VAT" value={formatBBD(Number(order.vat_amount))} />
              <Row label="Total" value={formatBBD(Number(order.total))} bold />
            </div>
          </div>

          {/* Delivery notes from customer */}
          {order.delivery_notes && (
            <div className="mt-4 rounded-xl border border-border bg-card p-4">
              <div className="text-[11px] font-semibold uppercase text-muted-foreground">Customer delivery notes</div>
              <div className="mt-1 text-[13px] text-ink">{order.delivery_notes}</div>
            </div>
          )}

          {/* Internal notes */}
          <div className="mt-4 rounded-xl border border-border bg-card p-4">
            <div className="text-[11px] font-semibold uppercase text-muted-foreground">Internal notes</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNotes}
              rows={3}
              className="mt-2 w-full rounded-md border border-border bg-background p-2 text-[13px]"
              placeholder="Notes only office/warehouse can see"
            />
          </div>
        </div>

        {order.status === "pending_approval" && (
          <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-card px-5 py-3">
            <button onClick={onReject} className="rounded-md border border-border bg-card px-3 py-2 text-[13px] font-semibold text-[#B91C1C] hover:bg-[#FEF2F2]">
              <X className="mr-1 inline h-3.5 w-3.5" /> Reject
            </button>
            <button onClick={onApprove} className="rounded-md px-3 py-2 text-[13px] font-semibold text-white" style={{ backgroundColor: "#10B981" }}>
              <Check className="mr-1 inline h-3.5 w-3.5" /> Approve order
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={bold ? "font-semibold text-ink" : "text-muted-foreground"}>{label}</span>
      <span className={`${bold ? "font-bold text-ink" : "text-ink"}`}>{value}</span>
    </div>
  );
}
