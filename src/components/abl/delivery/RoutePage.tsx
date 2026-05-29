import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Truck, MapPin, CheckCircle2, ArrowRight, Sparkles, Package, Plus, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDriver } from "@/hooks/use-driver";
import { useClientGreeting } from "@/hooks/use-client-greeting";
import { DeliveryShell } from "./DeliveryShell";
import { formatBBD } from "@/lib/format";
import { fmtDayLabel, fmtTime, estimatedArrival, fmtFullAddress, type RouteStop } from "./util";
import { qk } from "@/lib/query-keys";
import { SkeletonStopCard } from "@/components/abl/skeletons";
import { toast } from "sonner";

async function loadRoute(driverName: string): Promise<RouteStop[]> {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const startISO = start.toISOString();

  const { data: o } = await supabase.from("orders")
    .select("id, order_number, status, total, delivery_notes, internal_notes, packed_at, dispatched_at, delivered_at, delivery_status_detail, signature_image_url, delivered_to_name, route_sequence, driver_name, customer:customer_delivery_info!customer_id(id, company_name, delivery_address, delivery_city, delivery_parish, delivery_notes, phone)")
    .eq("driver_name", driverName)
    .in("status", ["packed", "out_for_delivery", "delivered", "paid"])
    .or(`status.in.(packed,out_for_delivery),delivered_at.gte.${startISO}`)
    .order("route_sequence", { ascending: true, nullsFirst: false });

  const ids = (o ?? []).map((r: any) => r.id);
  const counts: Record<string, { lines: number; cases: number }> = {};
  if (ids.length) {
    const { data: items } = await supabase.from("order_items")
      .select("order_id, quantity").in("order_id", ids);
    (items as any[] | null)?.forEach((it) => {
      const s = counts[it.order_id] ?? { lines: 0, cases: 0 };
      s.lines += 1; s.cases += Number(it.quantity) || 0;
      counts[it.order_id] = s;
    });
  }
  return ((o ?? []) as any[]).map((r) => ({
    ...r,
    items_count: counts[r.id]?.lines ?? 0,
    cases_count: counts[r.id]?.cases ?? 0,
  })) as RouteStop[];
}

export function RoutePage() {
  const { driverName, vehicleId, setVehicleId } = useDriver();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const greeting = useClientGreeting();
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [starting, setStarting] = useState(false);

  const { data: stops = [], isPending } = useQuery({
    queryKey: qk.route(driverName),
    queryFn: () => loadRoute(driverName),
    staleTime: 15_000,
  });

  const reload = () => queryClient.invalidateQueries({ queryKey: qk.route(driverName) });

  const loaded = useMemo(() => stops.filter((s) => s.status === "packed"), [stops]);
  const pending = useMemo(() => stops.filter((s) => s.status === "out_for_delivery"), [stops]);
  const done = useMemo(() => stops.filter((s) => s.status === "delivered" || s.status === "paid"), [stops]);

  const routeStarted = pending.length > 0 || done.length > 0;
  const activeIdx = pending.length ? 0 : -1;
  const collectFromActive = [...pending, ...loaded].reduce((sum, s) => sum + Number(s.total), 0);
  const pct = stops.length ? Math.round((done.length / stops.length) * 100) : 0;
  const sorted: RouteStop[] = [...pending, ...loaded, ...done];

  const reorder = async (id: string, dir: -1 | 1) => {
    const movable = routeStarted ? pending : loaded;
    const idx = movable.findIndex((s) => s.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= movable.length) return;
    const a = movable[idx]; const b = movable[swap];
    const aSeq = a.route_sequence ?? idx + 1;
    const bSeq = b.route_sequence ?? swap + 1;
    await Promise.all([
      supabase.from("orders").update({ route_sequence: bSeq }).eq("id", a.id),
      supabase.from("orders").update({ route_sequence: aSeq }).eq("id", b.id),
    ]);
    reload();
  };

  const startRoute = async () => {
    if (loaded.length === 0 || starting) return;
    setStarting(true);
    const now = new Date().toISOString();
    // Assign route_sequence to any loaded order missing one
    const updates = loaded.map((s, i) => ({
      id: s.id,
      seq: s.route_sequence ?? i + 1,
    }));
    const { error } = await supabase.from("orders")
      .update({ status: "out_for_delivery", dispatched_at: now })
      .in("id", updates.map((u) => u.id))
      .eq("driver_name", driverName)
      .eq("status", "packed");
    if (error) { setStarting(false); toast.error(error.message); return; }
    await Promise.all(
      updates.filter((u, i) => loaded[i].route_sequence == null).map((u) =>
        supabase.from("orders").update({ route_sequence: u.seq }).eq("id", u.id),
      ),
    );
    await supabase.from("delivery_events").insert(
      updates.map((u) => ({
        order_id: u.id, driver_name: driverName, event_type: "dispatched",
        notes: `Route started on ${vehicleId}`, meta: { vehicle_id: vehicleId },
      })),
    );
    toast.success(`Route started — ${loaded.length} stop${loaded.length > 1 ? "s" : ""}`);
    await reload();
    setStarting(false);
  };

  const showStartBanner = loaded.length > 0 && pending.length === 0;

  return (
    <DeliveryShell title="Today's route">
      <section className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-extrabold leading-tight tracking-tight text-ink">
            {greeting}, {driverName.split(" ")[0]}
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {fmtDayLabel()} · {stops.length} stops · {formatBBD(collectFromActive)} to collect
          </p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setVehicleOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#10B981] px-3 py-1.5 text-[12px] font-bold text-white shadow-sm"
          >
            <Truck className="h-3.5 w-3.5" /> {vehicleId}
          </button>
          {vehicleOpen && (
            <div className="absolute right-0 top-[36px] z-20 w-[140px] overflow-hidden rounded-xl border border-[#E5E9EF] bg-white shadow-xl">
              {["VAN-01","VAN-02","VAN-03","VAN-04","VAN-05","VAN-06"].map((v) => (
                <button key={v} onClick={() => { setVehicleId(v); setVehicleOpen(false); }}
                  className={`block w-full px-3 py-2 text-left text-[13px] font-semibold ${v === vehicleId ? "bg-[#ECFDF5] text-[#047857]" : "hover:bg-[#FAFBFC]"}`}>
                  {v}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mb-5 overflow-hidden rounded-2xl p-5 text-white shadow-lg"
        style={{ background: "linear-gradient(135deg, #0F2540 0%, #1A3556 100%)" }}>
        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-white/60">
          <span>{showStartBanner ? "Loaded & ready" : "Today's route"}</span>
          <span>{stops.length} stops · {done.length} done</span>
        </div>
        <div className="mt-3 text-[11px] font-bold uppercase tracking-wider text-white/60">To collect today</div>
        <div className="mt-1 text-[36px] font-extrabold leading-none text-[#FF6A1A] tabular-nums">
          {formatBBD(collectFromActive)}
        </div>
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[#10B981] transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1.5 text-[11px] text-white/60">{pct}% complete</div>
        </div>
      </section>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[17px] font-extrabold text-ink">Your route</h2>
        <Link
          to="/delivery/load"
          className="inline-flex items-center gap-1 rounded-full border border-[#E5E9EF] bg-white px-3 py-1.5 text-[11.5px] font-bold text-ink hover:bg-[#FAFBFC]"
        >
          <Plus className="h-3 w-3" /> Load more
        </Link>
      </div>

      {isPending ? (
        <div className="space-y-3">{[0,1,2].map((i) => <SkeletonStopCard key={i} />)}</div>
      ) : stops.length === 0 ? (
        <EmptyNothingLoaded />
      ) : pending.length === 0 && loaded.length === 0 ? (
        <AllDone />
      ) : (
        <ul className={`space-y-3 ${showStartBanner ? "pb-24" : ""}`}>
          {sorted.map((s, i) => {
            const isDone = s.status === "delivered" || s.status === "paid";
            const isLoaded = s.status === "packed";
            const isActive = s.status === "out_for_delivery" && i === activeIdx;
            return (
              <StopCard
                key={s.id}
                stop={s}
                index={i + 1}
                active={isActive}
                done={isDone}
                loaded={isLoaded}
                onClick={() => {
                  if (isDone) {
                    toast(`${s.customer?.company_name ?? "Delivered"} · ${fmtTime(s.delivered_at)}`);
                    return;
                  }
                  if (isLoaded) {
                    toast("Tap Start route below to begin deliveries.");
                    return;
                  }
                  if (!isActive) {
                    if (!window.confirm("This isn't your next stop — are you skipping ahead?")) return;
                  }
                  navigate({ to: "/delivery/stop/$orderId", params: { orderId: s.id } });
                }}
                onUp={i > 0 && (isLoaded || s.status === "out_for_delivery") ? () => reorder(s.id, -1) : undefined}
                onDown={i < (pending.length + loaded.length) - 1 && (isLoaded || s.status === "out_for_delivery") ? () => reorder(s.id, 1) : undefined}
                eta={
                  isDone ? fmtTime(s.delivered_at)
                  : isLoaded ? "Awaiting start"
                  : (isActive ? "Now" : `~${estimatedArrival(i)}`)
                }
              />
            );
          })}
        </ul>
      )}

      {!showStartBanner && stops.length > 0 && (
        <div className="mt-6 flex justify-center">
          <button type="button" onClick={() => toast("Route optimization coming soon. Use the arrows to reorder.")}
            className="text-[12px] font-semibold text-muted-foreground hover:text-ink">
            Optimize route →
          </button>
        </div>
      )}

      {showStartBanner && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E5E9EF] bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-[640px] items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-bold uppercase tracking-wider text-[#047857]">Ready to roll</div>
              <div className="truncate text-[13px] text-muted-foreground">
                {loaded.length} stop{loaded.length > 1 ? "s" : ""} loaded on {vehicleId} · {formatBBD(collectFromActive)}
              </div>
            </div>
            <button
              type="button"
              onClick={startRoute}
              disabled={starting}
              className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-[#10B981] px-5 text-[14.5px] font-extrabold text-white shadow-lg transition disabled:opacity-50"
            >
              <Play className="h-4 w-4" fill="currentColor" /> {starting ? "Starting…" : "Start route"}
            </button>
          </div>
        </div>
      )}
    </DeliveryShell>
  );
}

function StopCard({
  stop, index, active, done, loaded, onClick, eta, onUp, onDown,
}: {
  stop: RouteStop;
  index: number;
  active: boolean;
  done: boolean;
  loaded: boolean;
  onClick: () => void;
  eta: string;
  onUp?: () => void;
  onDown?: () => void;
}) {
  const addr = fmtFullAddress(stop.customer);
  const num = (
    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-[14px] font-extrabold ${
      done ? "bg-[#10B981] text-white"
      : active ? "bg-[#F59E0B] text-white"
      : loaded ? "bg-[#0F2540] text-white"
      : "bg-[#F1F4F8] text-muted-foreground"
    }`}>
      {done ? <CheckCircle2 className="h-5 w-5" strokeWidth={2.5} /> : index}
    </div>
  );

  return (
    <li
      onClick={onClick}
      className={`flex cursor-pointer items-stretch gap-3 rounded-2xl border p-3 transition ${
        done ? "border-[#E5E9EF] bg-white opacity-60"
        : active ? "border-[#F59E0B] bg-gradient-to-br from-[#FFF8F2] to-[#FFEFE0] shadow-[0_0_0_4px_rgba(245,158,11,0.12)]"
        : loaded ? "border-[#CBD5E1] bg-white"
        : "border-[#E5E9EF] bg-white"
      }`}
    >
      {num}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="text-[15px] font-bold leading-tight text-ink truncate">{stop.customer?.company_name ?? "—"}</div>
          {done ? (
            <span className="shrink-0 rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[10.5px] font-bold text-[#047857]">✓ Delivered</span>
          ) : active ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#F59E0B] px-2 py-0.5 text-[10.5px] font-bold text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Up next
            </span>
          ) : loaded ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[10.5px] font-bold text-[#047857]">
              <Truck className="h-3 w-3" /> Loaded
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-[#F1F4F8] px-2 py-0.5 text-[10.5px] font-bold text-muted-foreground">Queued</span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-[12px] text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{addr.line2 || addr.line1} · {stop.items_count ?? 0} items</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[13.5px] font-bold text-ink tabular-nums">{formatBBD(Number(stop.total))}</span>
          <span className="text-[11.5px] text-muted-foreground">{eta}</span>
        </div>
        {(onUp || onDown) && (
          <div className="mt-1.5 flex gap-1">
            {onUp && <button onClick={(e) => { e.stopPropagation(); onUp(); }}
              className="rounded-md border border-[#E5E9EF] px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground hover:bg-[#F1F4F8]">↑</button>}
            {onDown && <button onClick={(e) => { e.stopPropagation(); onDown(); }}
              className="rounded-md border border-[#E5E9EF] px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground hover:bg-[#F1F4F8]">↓</button>}
          </div>
        )}
      </div>
    </li>
  );
}

function EmptyNothingLoaded() {
  return (
    <div className="rounded-2xl border border-dashed border-[#E5E9EF] bg-white px-5 py-10 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#F1F4F8]">
        <Package className="h-7 w-7 text-muted-foreground" />
      </div>
      <div className="mt-3 text-[16px] font-extrabold text-ink">No stops on your route yet</div>
      <p className="mt-1 text-[13px] text-muted-foreground">Head to the warehouse and load up.</p>
      <Link to="/delivery/load" className="mt-5 inline-flex h-12 items-center justify-center rounded-xl bg-[#10B981] px-5 text-[14.5px] font-extrabold text-white shadow-sm">
        Load van <ArrowRight className="ml-2 h-4 w-4" />
      </Link>
    </div>
  );
}

function AllDone() {
  return (
    <div className="rounded-2xl border border-[#D1FAE5] bg-[#ECFDF5] px-5 py-10 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#10B981]">
        <CheckCircle2 className="h-8 w-8 text-white" strokeWidth={2.5} />
      </div>
      <div className="mt-3 text-[18px] font-extrabold text-ink">All deliveries done — nice work</div>
      <p className="mt-1 text-[13px] text-muted-foreground">Time to reconcile and hand in.</p>
      <Link to="/delivery/end-shift" className="mt-5 inline-flex h-12 items-center justify-center rounded-xl bg-[#FF6A1A] px-5 text-[14.5px] font-extrabold text-white shadow-sm">
        End shift <ArrowRight className="ml-2 h-4 w-4" />
      </Link>
      <div className="mt-4 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Sparkles className="h-3 w-3" /> Great driving today
      </div>
    </div>
  );
}
