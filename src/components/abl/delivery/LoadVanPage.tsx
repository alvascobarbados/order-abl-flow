import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, X, ArrowRight, Package, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDriver } from "@/hooks/use-driver";
import { DeliveryShell } from "./DeliveryShell";
import { formatBBD } from "@/lib/format";
import { fmtTime } from "./util";
import { toast } from "sonner";

type PackedOrder = {
  id: string; order_number: string; total: number; packed_at: string | null;
  driver_name: string | null;
  customer: { id: string; company_name: string; delivery_address: string | null; delivery_city: string | null; delivery_parish: string | null } | null;
  items_count?: number;
};

export function LoadVanPage() {
  const { driverName, vehicleId } = useDriver();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<PackedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const reload = async () => {
    setLoading(true);
    const { data: o } = await supabase.from("orders")
      .select("id, order_number, total, packed_at, driver_name, customer:customers(id, company_name, delivery_address, delivery_city, delivery_parish)")
      .eq("status", "packed")
      .order("packed_at", { ascending: true });
    const ids = (o ?? []).map((r: any) => r.id);
    let counts: Record<string, number> = {};
    if (ids.length) {
      const { data: items } = await supabase.from("order_items").select("order_id").in("order_id", ids);
      (items as any[] | null)?.forEach((it) => { counts[it.order_id] = (counts[it.order_id] ?? 0) + 1; });
    }
    setOrders(((o ?? []) as any[]).map((r) => ({ ...r, items_count: counts[r.id] ?? 0 })));
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const loaded = orders.filter((o) => o.driver_name === driverName);
  const available = orders.filter((o) => !o.driver_name);

  const loadOrder = async (id: string) => {
    const nextSeq = loaded.length + 1;
    const { error } = await supabase.from("orders").update({
      driver_name: driverName, vehicle_id: vehicleId, route_sequence: nextSeq,
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("delivery_events").insert({
      order_id: id, driver_name: driverName, event_type: "loaded", notes: `Loaded onto ${vehicleId}`,
    });
    reload();
  };

  const unload = async (id: string) => {
    const { error } = await supabase.from("orders").update({
      driver_name: null, vehicle_id: null, route_sequence: null,
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    reload();
  };

  const startRoute = async () => {
    if (!loaded.length) return;
    setStarting(true);
    const now = new Date().toISOString();
    for (const o of loaded) {
      const { error } = await supabase.from("orders").update({
        status: "out_for_delivery", dispatched_at: now,
      }).eq("id", o.id);
      if (error) { toast.error(`${o.order_number}: ${error.message}`); setStarting(false); return; }
      await supabase.from("delivery_events").insert({
        order_id: o.id, driver_name: driverName, event_type: "dispatched", notes: `Dispatched on ${vehicleId}`,
      });
    }
    toast.success(`Route started · ${loaded.length} stops`);
    navigate({ to: "/delivery" });
  };

  return (
    <DeliveryShell title="Load van" back={{ to: "/delivery" }}>
      <section className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[16px] font-extrabold text-ink">Today's load</h2>
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {loaded.length} loaded · {formatBBD(loaded.reduce((s, o) => s + Number(o.total), 0))}
          </span>
        </div>
        {loaded.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E5E9EF] bg-white px-4 py-6 text-center text-[13px] text-muted-foreground">
            No orders loaded yet. Tap “+ Load” on an order below.
          </div>
        ) : (
          <ul className="space-y-2">
            {loaded.map((o, i) => (
              <li key={o.id} className="flex items-center gap-3 rounded-xl border border-[#10B981]/30 bg-[#ECFDF5] p-3">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-[#10B981] text-[12px] font-extrabold text-white">{i + 1}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <div className="truncate text-[14px] font-bold text-ink">{o.customer?.company_name}</div>
                    <span className="font-mono text-[12px] font-bold text-ink">{formatBBD(Number(o.total))}</span>
                  </div>
                  <div className="text-[11.5px] text-muted-foreground">{o.order_number} · {o.items_count} items</div>
                </div>
                <button type="button" onClick={() => unload(o.id)}
                  className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-white" aria-label="Unload">
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[16px] font-extrabold text-ink">Available packed orders</h2>
          <button type="button" onClick={() => toast("Bulk scan mode coming soon")}
            className="rounded-full border border-[#E5E9EF] bg-white px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
            Bulk scan
          </button>
        </div>
        {loading ? (
          <div className="space-y-2">{[0,1].map((i) => <div key={i} className="h-[78px] animate-pulse rounded-xl bg-white/60" />)}</div>
        ) : available.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E5E9EF] bg-white px-4 py-8 text-center text-[13px] text-muted-foreground">
            <Package className="mx-auto mb-2 h-5 w-5" />
            No unassigned packed orders. Ask the warehouse to pack more.
          </div>
        ) : (
          <ul className="space-y-2">
            {available.map((o) => (
              <li key={o.id} className="flex items-center gap-3 rounded-xl border border-[#E5E9EF] bg-white p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <div className="truncate text-[14px] font-bold text-ink">{o.customer?.company_name}</div>
                    <span className="font-mono text-[12px] font-bold text-ink">{formatBBD(Number(o.total))}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-[11.5px] text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{[o.customer?.delivery_city, o.customer?.delivery_parish].filter(Boolean).join(", ") || o.customer?.delivery_address || "No address"}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">{o.order_number} · packed {fmtTime(o.packed_at)} · {o.items_count} items</div>
                </div>
                <button type="button" onClick={() => loadOrder(o.id)}
                  className="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg bg-[#10B981] px-3 text-[12.5px] font-extrabold text-white shadow-sm hover:bg-[#059669]">
                  <Plus className="h-4 w-4" /> Load
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="sticky bottom-3 z-20 pt-2">
        <button
          type="button"
          onClick={startRoute}
          disabled={!loaded.length || starting}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#10B981] text-[15.5px] font-extrabold text-white shadow-lg transition disabled:opacity-50"
        >
          {starting ? "Starting…" : <>Start route <ArrowRight className="h-5 w-5" /></>}
        </button>
      </div>
    </DeliveryShell>
  );
}
