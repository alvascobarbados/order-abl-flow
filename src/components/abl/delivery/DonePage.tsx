import { useEffect, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDriver } from "@/hooks/use-driver";
import { DeliveryShell } from "./DeliveryShell";
import { formatBBD } from "@/lib/format";
import { fmtTime } from "./util";

type Filter = "today" | "week" | "all";

type DoneOrder = {
  id: string; order_number: string; total: number; delivered_at: string | null;
  delivered_to_name: string | null;
  customer: { company_name: string } | null;
  allocations?: { amount: number; payment: { payment_method: string } | null }[];
};

export function DonePage() {
  const { driverName } = useDriver();
  const [filter, setFilter] = useState<Filter>("today");
  const [orders, setOrders] = useState<DoneOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let since = new Date();
      if (filter === "today") since.setHours(0, 0, 0, 0);
      else if (filter === "week") since.setDate(since.getDate() - 7);
      else since = new Date(0);

      const { data } = await supabase.from("orders")
        .select("id, order_number, total, delivered_at, delivered_to_name, customer:customers(company_name), allocations:payment_allocations(amount, payment:payments(payment_method))")
        .eq("driver_name", driverName)
        .in("status", ["delivered", "paid"])
        .gte("delivered_at", since.toISOString())
        .order("delivered_at", { ascending: false });
      setOrders((data ?? []) as any);
      setLoading(false);
    })();
  }, [driverName, filter]);

  const summary = useMemo(() => {
    let cash = 0, cheque = 0, card = 0, account = 0;
    for (const o of orders) {
      const allocs = o.allocations ?? [];
      const paidSum = allocs.reduce((s, a) => s + Number(a.amount), 0);
      if (!allocs.length) {
        account += Number(o.total);
      } else {
        for (const a of allocs) {
          const m = a.payment?.payment_method;
          if (m === "cash") cash += Number(a.amount);
          else if (m === "cheque") cheque += Number(a.amount);
          else if (m === "card") card += Number(a.amount);
          else account += Number(a.amount);
        }
        const ord = Number(o.total) - paidSum;
        if (ord > 0.01) account += ord;
      }
    }
    return { cash, cheque, card, account, count: orders.length };
  }, [orders]);

  return (
    <DeliveryShell title="Delivered" back={{ to: "/delivery" }}>
      <div className="mb-4 flex gap-2">
        {(["today","week","all"] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${
              filter === f ? "bg-[#0F2540] text-white" : "border border-[#E5E9EF] bg-white text-muted-foreground"
            }`}>
            {f === "today" ? "Today" : f === "week" ? "This week" : "All time"}
          </button>
        ))}
      </div>

      <section className="mb-4 rounded-2xl bg-white p-4 shadow-[0_1px_0_#E5E9EF]">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{filter === "today" ? "Today" : filter === "week" ? "This week" : "All time"}</div>
        <div className="mt-1 text-[28px] font-extrabold leading-none text-ink">{summary.count} deliveries</div>
        <div className="mt-2 text-[12.5px] text-muted-foreground">
          {formatBBD(summary.cash)} cash · {formatBBD(summary.cheque)} cheques · {formatBBD(summary.card)} cards · {formatBBD(summary.account)} on account
        </div>
      </section>

      {loading ? (
        <div className="space-y-2">{[0,1,2].map((i) => <div key={i} className="h-[64px] animate-pulse rounded-xl bg-white/60" />)}</div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E5E9EF] bg-white px-4 py-10 text-center text-[13px] text-muted-foreground">
          Nothing delivered in this range.
        </div>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => {
            const allocs = o.allocations ?? [];
            const m = allocs[0]?.payment?.payment_method ?? "account";
            return (
              <li key={o.id} className="flex items-center gap-3 rounded-xl border border-[#E5E9EF] bg-white p-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-[#ECFDF5]">
                  <CheckCircle2 className="h-5 w-5 text-[#047857]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-bold text-ink">{o.customer?.company_name ?? "—"}</div>
                  <div className="text-[11.5px] text-muted-foreground">{o.order_number} · {fmtTime(o.delivered_at)}{o.delivered_to_name ? ` · ${o.delivered_to_name}` : ""}</div>
                </div>
                <div className="text-right">
                  <div className="text-[13.5px] font-bold text-ink">{formatBBD(Number(o.total))}</div>
                  <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">{m}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </DeliveryShell>
  );
}
