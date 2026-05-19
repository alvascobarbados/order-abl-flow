import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Package, ListChecks, ArrowRight, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePicker } from "@/hooks/use-picker";
import { WarehouseShell, UrgencyChip } from "./WarehouseShell";
import { formatBBD } from "@/lib/format";
import { fmtDayLabel, greeting, pickDeadline, urgencyOf, formatTimeShort, type QueueOrder } from "./util";

export function QueuePage() {
  const { pickerName, demoScan } = usePicker();
  const [orders, setOrders] = useState<QueueOrder[]>([]);
  const [doneToday, setDoneToday] = useState(0);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    const start = new Date(); start.setHours(0, 0, 0, 0);

    const [{ data: o }, { data: items }, { data: done }] = await Promise.all([
      supabase.from("orders")
        .select("id, order_number, status, placed_at, approved_at, picking_started_at, picked_by_profile_id, total, delivery_notes, customer:customers(id, company_name, delivery_address, pricing_tier)")
        .in("status", ["approved", "picking"])
        .order("placed_at", { ascending: true }),
      supabase.from("order_items").select("order_id, quantity"),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "packed").gte("packed_at", start.toISOString()),
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

    setOrders(list);
    setDoneToday((done as any)?.length ?? 0);
    setLoading(false);
  };

  useEffect(() => {
    reload();
    const id = window.setInterval(reload, 30000);
    return () => window.clearInterval(id);
  }, []);

  const itemsTotal = orders.reduce((s, o) => s + (o.cases_count ?? 0), 0);
  const toPickCount = orders.length;

  return (
    <WarehouseShell title={`Today's picks · ${toPickCount} waiting`} subtitle="Tap an order to start picking">
      <section className="mb-5">
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-ink">{greeting()}, {pickerName.split(" ")[0]}</h1>
        <p className="mt-1 text-[14px] text-muted-foreground">{fmtDayLabel()} · {toPickCount} to pick · {doneToday} done today</p>
      </section>

      <section className="mb-6 grid grid-cols-3 gap-3">
        <StatCard label="To pick" value={String(toPickCount)} />
        <StatCard label="items in queue" value={String(itemsTotal)} prefix="cases" />
        <StatCard label="done today" value={String(doneToday)} prefix="orders" />
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

      {loading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {[0, 1].map((i) => <div key={i} className="h-[200px] animate-pulse rounded-2xl bg-white/60" />)}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {orders.map((o) => <QueueCard key={o.id} order={o} />)}
        </div>
      )}
    </WarehouseShell>
  );
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
