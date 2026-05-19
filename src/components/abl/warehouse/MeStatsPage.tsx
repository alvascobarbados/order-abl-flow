import { useEffect, useState } from "react";
import { WarehouseShell } from "./WarehouseShell";
import { usePicker } from "@/hooks/use-picker";
import { supabase } from "@/integrations/supabase/client";

type Bucket = { orders: number; cases: number; avgMins: number | null };

export function MeStatsPage() {
  const { pickerName } = usePicker();
  const [today, setToday] = useState<Bucket>({ orders: 0, cases: 0, avgMins: null });
  const [week, setWeek] = useState<Bucket>({ orders: 0, cases: 0, avgMins: null });
  const [all, setAll] = useState<Bucket>({ orders: 0, cases: 0, avgMins: null });

  useEffect(() => {
    (async () => {
      const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
      const startWeek = new Date(); startWeek.setDate(startWeek.getDate() - 7);

      const [{ data: o }, { data: items }] = await Promise.all([
        supabase.from("orders").select("id, packed_at, picking_started_at").eq("status", "packed").order("packed_at", { ascending: false }).limit(500),
        supabase.from("order_items").select("order_id, picked_quantity, quantity"),
      ]);
      const byOrder: Record<string, number> = {};
      (items as any[] | null)?.forEach((it) => {
        byOrder[it.order_id] = (byOrder[it.order_id] ?? 0) + (Number(it.picked_quantity) || Number(it.quantity) || 0);
      });

      const compute = (rows: any[]): Bucket => {
        const orders = rows.length;
        const cases = rows.reduce((s, r) => s + (byOrder[r.id] ?? 0), 0);
        const times = rows.filter((r) => r.picking_started_at && r.packed_at).map((r) => (new Date(r.packed_at).getTime() - new Date(r.picking_started_at).getTime()) / 60000);
        const avg = times.length ? Math.round(times.reduce((s, t) => s + t, 0) / times.length) : null;
        return { orders, cases, avgMins: avg };
      };

      const all = (o ?? []) as any[];
      setAll(compute(all));
      setWeek(compute(all.filter((r) => new Date(r.packed_at) >= startWeek)));
      setToday(compute(all.filter((r) => new Date(r.packed_at) >= startToday)));
    })();
  }, []);

  return (
    <WarehouseShell title="My stats" subtitle={pickerName} back={{ to: "/warehouse" }}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card title="Today" b={today} />
        <Card title="This week" b={week} />
        <Card title="All time" b={all} />
      </div>
      <p className="mt-6 text-center text-[12px] text-muted-foreground">Stats are based on completed packs. Average time is from start of picking to confirmed pack.</p>
    </WarehouseShell>
  );
}

function Card({ title, b }: { title: string; b: Bucket }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_1px_0_#E5E9EF]">
      <div className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="mt-3 grid grid-cols-2 gap-4">
        <div>
          <div className="text-[28px] font-extrabold leading-none text-ink">{b.orders}</div>
          <div className="mt-1 text-[12px] text-muted-foreground">orders packed</div>
        </div>
        <div>
          <div className="text-[28px] font-extrabold leading-none text-ink">{b.cases}</div>
          <div className="mt-1 text-[12px] text-muted-foreground">cases picked</div>
        </div>
      </div>
      <div className="mt-4 rounded-xl bg-[#FAFBFC] p-3">
        <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Avg pick → pack</div>
        <div className="mt-1 text-[18px] font-extrabold text-ink">{b.avgMins != null ? `${b.avgMins} min` : "—"}</div>
      </div>
    </div>
  );
}
