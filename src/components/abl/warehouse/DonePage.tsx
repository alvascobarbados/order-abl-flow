import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { WarehouseShell } from "./WarehouseShell";
import { usePicker } from "@/hooks/use-picker";

type Row = {
  id: string; order_number: string; packed_at: string;
  customer: { company_name: string } | null;
  carton_count: number | null;
  items_count?: number; cases_count?: number;
};

type Filter = "today" | "week" | "all";

export function DonePage() {
  const { pickerName } = usePicker();
  const [filter, setFilter] = useState<Filter>("today");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase.from("orders")
        .select("id, order_number, packed_at, carton_count, customer:customers(company_name)")
        .eq("status", "packed")
        .order("packed_at", { ascending: false });
      if (filter !== "all") {
        const start = new Date();
        if (filter === "today") start.setHours(0, 0, 0, 0);
        else start.setDate(start.getDate() - 7);
        q = q.gte("packed_at", start.toISOString());
      }
      const [{ data: o }, { data: items }] = await Promise.all([
        q,
        supabase.from("order_items").select("order_id, picked_quantity, quantity"),
      ]);
      const sum: Record<string, { lines: number; cases: number }> = {};
      (items as any[] | null)?.forEach((it) => {
        const s = sum[it.order_id] ?? { lines: 0, cases: 0 };
        s.lines += 1; s.cases += Math.max(0, Number(it.picked_quantity) || Number(it.quantity) || 0);
        sum[it.order_id] = s;
      });
      const list = ((o ?? []) as any[]).map((r) => ({ ...r, items_count: sum[r.id]?.lines ?? 0, cases_count: sum[r.id]?.cases ?? 0 }));
      setRows(list as Row[]); setLoading(false);
    })();
  }, [filter]);

  const totalCases = rows.reduce((s, r) => s + (r.cases_count ?? 0), 0);
  const totalLines = rows.reduce((s, r) => s + (r.items_count ?? 0), 0);

  return (
    <WarehouseShell title="Packed today" subtitle="Your recent work" back={{ to: "/warehouse" }}>
      <div className="mb-4 flex items-center gap-2">
        {(["today", "week", "all"] as Filter[]).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={`rounded-full px-4 py-2 text-[12.5px] font-bold capitalize ${filter === f ? "bg-[#0F2540] text-white" : "border border-[#E5E9EF] bg-white text-ink"}`}>
            {f === "week" ? "This week" : f === "all" ? "All time" : "Today"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-white/60" />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E5E9EF] bg-white p-10 text-center text-muted-foreground">No packed orders {filter === "today" ? "today" : filter === "week" ? "this week" : "yet"}.</div>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-2xl border border-[#E5E9EF] bg-white p-4 opacity-90">
              <div>
                <div className="text-[15px] font-extrabold text-ink">{r.customer?.company_name ?? "—"}</div>
                <div className="mt-0.5 text-[12.5px] text-muted-foreground">
                  <span className="font-mono">{r.order_number}</span> · {r.items_count} lines · {r.cases_count} cases{r.carton_count ? ` · ${r.carton_count} cartons` : ""}
                </div>
              </div>
              <div className="text-right text-[12px] text-muted-foreground">{new Date(r.packed_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 rounded-2xl bg-[#0F2540] p-5 text-white">
        <div className="text-[12px] font-bold uppercase tracking-wider text-white/70">Your day, {pickerName.split(" ")[0]}</div>
        <div className="mt-2 text-[16px] font-bold">You packed {rows.length} orders · {totalCases} cases across {totalLines} lines</div>
      </div>
    </WarehouseShell>
  );
}
