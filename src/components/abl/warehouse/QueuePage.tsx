import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Package, ListChecks, ArrowRight, Sparkles, Truck, MapPin, Warehouse, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePicker } from "@/hooks/use-picker";
import { useClientGreeting } from "@/hooks/use-client-greeting";
import { WarehouseShell, UrgencyChip } from "./WarehouseShell";
import { formatBBD } from "@/lib/format";
import { fmtDayLabel, pickDeadline, urgencyOf, formatTimeShort, type QueueOrder } from "./util";
import { qk } from "@/lib/query-keys";
import { InvoicePreviewDrawer } from "./InvoicePreviewDrawer";
import { SkeletonKpiCard, SkeletonOrderCard } from "@/components/abl/skeletons";

type PackedOrder = {
  id: string;
  order_number: string;
  invoice_number: string | null;
  total: number;
  packed_at: string | null;
  driver_name: string | null;
  vehicle_id: string | null;
  packed_by_name: string | null;
  customer: { company_name: string; delivery_address: string | null; delivery_city: string | null; delivery_parish: string | null } | null;
  items_count: number;
};

type QueueData = {
  orders: QueueOrder[];
  packed: PackedOrder[];
  doneToday: number;
};

async function loadQueue(): Promise<QueueData> {
  const start = new Date(); start.setHours(0, 0, 0, 0);

  const [{ data: o }, { data: p }, { data: items }, { data: done }] = await Promise.all([
    supabase.from("orders")
      .select("id, order_number, status, placed_at, approved_at, picking_started_at, picked_by_profile_id, total, delivery_notes, customer:customers(id, company_name, delivery_address, pricing_tier)")
      .in("status", ["approved", "picking"])
      .order("placed_at", { ascending: true }),
    supabase.from("orders")
      .select("id, order_number, invoice_number, total, packed_at, driver_name, vehicle_id, packed_by_profile_id, customer:customers(company_name, delivery_address, delivery_city, delivery_parish)")
      .eq("status", "packed")
      .order("packed_at", { ascending: true }),
    supabase.from("order_items").select("order_id, quantity"),
    supabase.from("orders").select("id").eq("status", "packed").gte("packed_at", start.toISOString()),
  ]);

  const sum: Record<string, { lines: number; cases: number }> = {};
  (items as any[] | null)?.forEach((it) => {
    const s = sum[it.order_id] ?? { lines: 0, cases: 0 };
    s.lines += 1; s.cases += Number(it.quantity) || 0;
    sum[it.order_id] = s;
  });

  const list = ((o ?? []) as any[]).map((r) => ({
    ...r,
    items_count: sum[r.id]?.lines ?? 0,
    cases_count: sum[r.id]?.cases ?? 0,
  })) as QueueOrder[];

  list.sort((a, b) => {
    const aR = a.status === "picking" ? 0 : urgencyOf(a) === "URGENT" ? 1 : 2;
    const bR = b.status === "picking" ? 0 : urgencyOf(b) === "URGENT" ? 1 : 2;
    if (aR !== bR) return aR - bR;
    return new Date(a.placed_at).getTime() - new Date(b.placed_at).getTime();
  });

  const packerIds = Array.from(new Set(((p ?? []) as any[]).map((r) => r.packed_by_profile_id).filter(Boolean)));
  const nameById: Record<string, string> = {};
  if (packerIds.length) {
    const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", packerIds);
    (profs as any[] | null)?.forEach((pr) => { nameById[pr.id] = pr.full_name ?? ""; });
  }

  const packedList = ((p ?? []) as any[]).map((r) => ({
    ...r,
    packed_by_name: r.packed_by_profile_id ? (nameById[r.packed_by_profile_id] ?? null) : null,
    items_count: sum[r.id]?.lines ?? 0,
  })) as PackedOrder[];

  return {
    orders: list,
    packed: packedList,
    doneToday: ((done as any[] | null) ?? []).length,
  };
}

export function QueuePage() {
  const { pickerName, demoScan } = usePicker();
  const greeting = useClientGreeting();
  const [previewOrderId, setPreviewOrderId] = useState<string | null>(null);
  const { data, isPending } = useQuery({
    queryKey: qk.warehouseQueue(),
    queryFn: loadQueue,
    staleTime: 15_000,
  });
  const orders = data?.orders ?? [];
  const packed = data?.packed ?? [];
  const doneToday = data?.doneToday ?? 0;

  const itemsTotal = orders.reduce((s, o) => s + (o.cases_count ?? 0), 0);
  const toPickCount = orders.length;
  const dispatchCount = packed.length;

  return (
    <WarehouseShell title={`Today's picks · ${toPickCount} waiting`} subtitle="Tap an order to start picking">
      <section className="mb-5">
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-ink">{greeting}, {pickerName.split(" ")[0]}</h1>
        <p className="mt-1 text-[14px] text-muted-foreground">{fmtDayLabel()} · {toPickCount} to pick · {doneToday} done today</p>
      </section>

      <section className={`mb-6 grid gap-3 ${dispatchCount > 0 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-3"}`}>
        {isPending ? (
          <>
            <SkeletonKpiCard /><SkeletonKpiCard /><SkeletonKpiCard />
          </>
        ) : (
          <>
            <StatCard label="To pick" value={String(toPickCount)} />
            <StatCard label="items in queue" value={String(itemsTotal)} prefix="cases" />
            <StatCard label="done today" value={String(doneToday)} prefix="orders" />
            {dispatchCount > 0 && <StatCard label="in dispatch" value={String(dispatchCount)} prefix="awaiting van" />}
          </>
        )}
      </section>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[20px] font-extrabold text-ink">Your queue</h2>
        <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Sorted by urgency</span>
      </div>

      {demoScan && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-[#FFE8D6] bg-[#FFFBEB] px-3 py-2 text-[12px] text-[#92400E]">
          <Sparkles className="h-3.5 w-3.5" /> Demo scan mode is on — you can simulate scans during picking.
        </div>
      )}

      {isPending ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {[0, 1, 2].map((i) => <SkeletonOrderCard key={i} />)}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {orders.map((o) => <QueueCard key={o.id} order={o} />)}
        </div>
      )}

      {dispatchCount > 0 && (
        <section className="mt-8">
          <div className="mb-1 flex items-center gap-2">
            <Warehouse className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Staged in warehouse</span>
          </div>
          <div className="mb-3 flex items-baseline justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-[20px] font-extrabold text-ink">Ready for dispatch</h2>
              <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[11px] font-bold text-[#92400E]">{dispatchCount}</span>
            </div>
          </div>
          <p className="-mt-2 mb-3 text-[12.5px] text-muted-foreground">Boxes are packed and on the dock. Drivers will load them next.</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {packed.map((o) => <DispatchCard key={o.id} order={o} onViewInvoice={() => setPreviewOrderId(o.id)} />)}
          </div>
        </section>
      )}

      <InvoicePreviewDrawer
        orderId={previewOrderId}
        open={!!previewOrderId}
        onOpenChange={(o) => { if (!o) setPreviewOrderId(null); }}
      />
    </WarehouseShell>
  );
}

function DispatchCard({ order, onViewInvoice }: { order: PackedOrder; onViewInvoice: () => void }) {
  const loaded = !!order.driver_name;
  const addr = [order.customer?.delivery_city, order.customer?.delivery_parish].filter(Boolean).join(", ")
    || order.customer?.delivery_address || "—";
  return (
    <article className="rounded-2xl border border-[#E5E9EF] bg-[#F8FAFC] p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[12px] font-bold text-muted-foreground">
          <span className="font-mono">{order.order_number}</span>
          <span className="text-[#CBD5E1]">→</span>
          <span className="font-mono">{order.invoice_number ?? "—"}</span>
        </div>
        {loaded ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wider text-[#047857]">
            <Truck className="h-3 w-3" /> Loaded on {order.vehicle_id ?? "van"}
          </span>
        ) : (
          <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wider text-[#92400E]">Awaiting driver</span>
        )}
      </div>
      <div className="mt-2 text-[16px] font-semibold leading-tight text-ink">{order.customer?.company_name ?? "—"}</div>
      <div className="mt-0.5 flex items-center gap-1 text-[12.5px] text-muted-foreground">
        <MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{addr}</span>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="rounded-md bg-white px-2 py-1 text-[11.5px] font-semibold text-ink ring-1 ring-[#E5E9EF] tabular-nums">{order.items_count} items</span>
        <span className="text-[14px] font-bold text-ink tabular-nums">{formatBBD(Number(order.total))}</span>
      </div>
      <div className="mt-2 border-t border-[#E5E9EF] pt-2 text-[11.5px] text-muted-foreground">
        Packed {timeAgo(order.packed_at)}{order.packed_by_name ? ` by ${order.packed_by_name.split(" ")[0]}` : ""}
      </div>
    </article>
  );
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function StatCard({ label, value, prefix }: { label: string; value: string; prefix?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-[0_1px_0_#E5E9EF]">
      <div className="text-[32px] font-extrabold leading-none tracking-tight text-ink sm:text-[36px]">{value}</div>
      <div className="mt-2 text-[12px] font-semibold text-muted-foreground">{label}</div>
      {prefix && <div className="text-[11px] text-muted-foreground">{prefix}</div>}
    </div>
  );
}

function QueueCard({ order }: { order: QueueOrder }) {
  const isResume = order.status === "picking";
  const urgency = isResume ? "RESUME" : urgencyOf(order);
  const deadline = pickDeadline(order);
  const minsLeft = Math.round((deadline.getTime() - Date.now()) / 60000);
  const overdue = minsLeft < 0;
  const close = minsLeft >= 0 && minsLeft <= 30;

  return (
    <Link to="/warehouse/pick/$orderId" params={{ orderId: order.id }} className="block">
      <article className="flex h-full flex-col gap-3 rounded-2xl border border-[#E5E9EF] bg-white p-5 transition hover:border-[#0F2540]/30 hover:shadow-md">
        <div className="flex items-center justify-between">
          <UrgencyChip kind={urgency as any} />
          <span className="font-mono text-[12px] font-bold text-muted-foreground">{order.order_number}</span>
        </div>
        <div className="text-[22px] font-extrabold leading-tight tracking-tight text-ink">{order.customer?.company_name ?? "—"}</div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
          <span>{order.items_count} line items</span><span className="text-[#CBD5E1]">·</span>
          <span>{order.cases_count} cases</span><span className="text-[#CBD5E1]">·</span>
          <span>{formatBBD(Number(order.total))}</span>
        </div>
        <div className={`text-[13.5px] font-bold ${overdue ? "text-[#B91C1C]" : close ? "text-[#B45309]" : "text-ink"}`}>
          {overdue ? "Overdue — pick now" : `Pick by ${formatTimeShort(deadline)}`}
        </div>
        <div className="mt-auto pt-1">
          <span className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#0F2540] text-[15.5px] font-extrabold text-white shadow-sm hover:bg-[#1A3556]">
            {isResume ? "Resume picking" : "Start picking"} <ArrowRight className="h-5 w-5" />
          </span>
        </div>
      </article>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-[#E5E9EF] bg-white px-6 py-16 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#ECFDF5]">
        <CheckCircle2 className="h-9 w-9 text-[#047857]" />
      </div>
      <div className="mt-4 text-[20px] font-extrabold text-ink">All caught up</div>
      <p className="mt-1 text-[14px] text-muted-foreground">Nothing in the queue right now. Check back in a few minutes.</p>
      <div className="mt-6 flex items-center justify-center gap-4 text-[12px] text-muted-foreground">
        <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5" /> 0 to pick</span>
        <span className="flex items-center gap-1"><ListChecks className="h-3.5 w-3.5" /> Pickers stand by</span>
      </div>
    </div>
  );
}
