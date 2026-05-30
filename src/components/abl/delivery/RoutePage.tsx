import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Truck, MapPin, CheckCircle2, ArrowRight, Sparkles, Package, Play, PartyPopper } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
import { useDriver } from "@/hooks/use-driver";
import { useClientGreeting } from "@/hooks/use-client-greeting";
import { DeliveryShell } from "./DeliveryShell";
import { DeliveryErrorCard } from "./DeliveryErrorCard";
import { formatBBD } from "@/lib/format";
import { fmtDayLabel, fmtTime, estimatedArrival, fmtFullAddress, type RouteStop } from "./util";
import { qk } from "@/lib/query-keys";
import { SkeletonStopCard } from "@/components/abl/skeletons";
import { fetchCustomerInfoMap } from "./customer-info";
import { toast } from "sonner";

type RouteData = {
  active: RouteStop[];          // packed + out_for_delivery only — the current run
  deliveredToday: number;       // cumulative across all runs today
  ordersWaiting: number;        // packed + unassigned + invoiced at warehouse
};

async function loadRouteData(driverProfileId: string): Promise<RouteData> {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const startISO = start.toISOString();

  const [activeRes, deliveredRes, waitingRes] = await Promise.all([
    supabase.from("orders")
      .select("id, customer_id, order_number, status, total, delivery_notes, internal_notes, packed_at, dispatched_at, delivered_at, delivery_status_detail, signature_image_url, delivered_to_name, route_sequence, driver_name, driver_profile_id")
      .eq("driver_profile_id", driverProfileId)
      .in("status", ["packed", "out_for_delivery"])
      .order("route_sequence", { ascending: true, nullsFirst: false }),
    supabase.from("orders")
      .select("id", { count: "exact", head: true })
      .eq("driver_profile_id", driverProfileId)
      .in("status", ["delivered", "paid"])
      .gte("delivered_at", startISO),
    supabase.from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "packed")
      .is("driver_profile_id", null)
      .not("invoice_number", "is", null),
  ]);

  if (activeRes.error) throw new Error(activeRes.error.message);
  if (deliveredRes.error) throw new Error(deliveredRes.error.message);
  if (waitingRes.error) throw new Error(waitingRes.error.message);

  const rows = activeRes.data ?? [];
  let active: RouteStop[] = [];
  if (rows.length > 0) {
    const customerIds = rows.map((r) => r.customer_id);
    const orderIds = rows.map((r) => r.id);
    const [custMap, itemsRes] = await Promise.all([
      fetchCustomerInfoMap(customerIds),
      supabase.from("order_items").select("order_id, quantity").in("order_id", orderIds),
    ]);
    if (itemsRes.error) throw new Error(itemsRes.error.message);
    const counts: Record<string, { lines: number; cases: number }> = {};
    for (const it of itemsRes.data ?? []) {
      const s = counts[it.order_id] ?? { lines: 0, cases: 0 };
      s.lines += 1; s.cases += Number(it.quantity) || 0;
      counts[it.order_id] = s;
    }
    active = rows.map((r) => ({
      ...r,
      customer: custMap.get(r.customer_id) ?? null,
      items_count: counts[r.id]?.lines ?? 0,
      cases_count: counts[r.id]?.cases ?? 0,
    })) as RouteStop[];
  }

  return {
    active,
    deliveredToday: deliveredRes.count ?? 0,
    ordersWaiting: waitingRes.count ?? 0,
  };
}

export function RoutePage() {
  const { driverName, driverProfileId, vehicleId, setVehicleId } = useDriver();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const greeting = useClientGreeting();
  const [vehicleOpen, setVehicleOpen] = useState(false);

  const routeKey = qk.route(driverProfileId ?? "_anon");

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: routeKey,
    queryFn: () => loadRouteData(driverProfileId!),
    enabled: !!driverProfileId,
    staleTime: 15_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: routeKey });

  const active = data?.active ?? [];
  const deliveredToday = data?.deliveredToday ?? 0;
  const ordersWaiting = data?.ordersWaiting ?? 0;

  const loaded = useMemo(() => active.filter((s) => s.status === "packed"), [active]);
  const pending = useMemo(() => active.filter((s) => s.status === "out_for_delivery"), [active]);

  const routeStarted = pending.length > 0;
  const activeIdx = pending.length ? 0 : -1;
  const goodsOnBoard = active.reduce((sum, s) => sum + Number(s.total), 0);
  const sorted: RouteStop[] = [...pending, ...loaded];

  // Reorderable set: undelivered stops (after start = pending only; before start = loaded only).
  const reorderable = routeStarted ? pending : loaded;
  const reorderableIds = reorderable.map((s) => s.id);

  // Persist a new ordering of the reorderable subset.
  const persistOrderMut = useMutation({
    mutationFn: async (newOrder: RouteStop[]) => {
      if (!driverProfileId) throw new Error("Not signed in as a driver.");
      const results = await Promise.all(
        newOrder.map((s, i) =>
          supabase.from("orders")
            .update({ route_sequence: i + 1 })
            .eq("id", s.id)
            .eq("driver_profile_id", driverProfileId)
            .select("id"),
        ),
      );
      for (const r of results) {
        if (r.error) throw new Error(r.error.message);
        if ((r.data ?? []).length === 0) throw new Error("Reorder blocked — affected 0 rows (likely RLS).");
      }
    },
    onError: (e: Error) => {
      toast.error(e.message);
      invalidate(); // rollback optimistic
    },
    onSettled: () => invalidate(),
  });

  const handleDragEnd = (e: DragEndEvent) => {
    const { active: a, over } = e;
    if (!over || a.id === over.id) return;
    const oldIdx = reorderable.findIndex((s) => s.id === a.id);
    const newIdx = reorderable.findIndex((s) => s.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const newOrder = arrayMove(reorderable, oldIdx, newIdx);

    queryClient.setQueryData<RouteData>(routeKey, (prev) => {
      if (!prev) return prev;
      const orderMap = new Map(newOrder.map((s, i) => [s.id, i + 1]));
      return {
        ...prev,
        active: prev.active.map((s) => orderMap.has(s.id) ? { ...s, route_sequence: orderMap.get(s.id)! } : s),
      };
    });
    persistOrderMut.mutate(newOrder);
  };

  const sensors = useSensors(
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const startMut = useMutation({
    mutationFn: async () => {
      if (!driverProfileId) throw new Error("Not signed in as a driver.");
      if (loaded.length === 0) throw new Error("Nothing loaded.");
      const now = new Date().toISOString();
      const updates = loaded.map((s, i) => ({ id: s.id, seq: s.route_sequence ?? i + 1 }));

      const seqResults = await Promise.all(
        updates.filter((_u, i) => loaded[i].route_sequence == null).map((u) =>
          supabase.from("orders").update({ route_sequence: u.seq })
            .eq("id", u.id).eq("driver_profile_id", driverProfileId).select("id"),
        ),
      );
      for (const r of seqResults) {
        if (r.error) throw new Error(r.error.message);
      }

      const { data: updRes, error } = await supabase.from("orders")
        .update({ status: "out_for_delivery", dispatched_at: now })
        .in("id", updates.map((u) => u.id))
        .eq("driver_profile_id", driverProfileId)
        .eq("status", "packed")
        .select("id");
      if (error) throw new Error(error.message);
      const affected = (updRes ?? []).length;
      if (affected === 0) throw new Error("Start route blocked — affected 0 rows (likely RLS).");

      await supabase.from("delivery_events").insert(
        updates.slice(0, affected).map((u) => ({
          order_id: u.id, driver_name: driverName, driver_profile_id: driverProfileId,
          event_type: "dispatched", notes: `Run started on ${vehicleId}`, meta: { vehicle_id: vehicleId },
        })),
      );
      return affected;
    },
    onSuccess: (n) => toast.success(`Run started — ${n} stop${n > 1 ? "s" : ""}`),
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => invalidate(),
  });

  const isVanEmpty = !isPending && active.length === 0;
  const showStartBanner = loaded.length > 0 && pending.length === 0;

  return (
    <DeliveryShell title="Today's runs">
      <section className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-extrabold leading-tight tracking-tight text-ink">
            {greeting}, {driverName.split(" ")[0]}
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground" suppressHydrationWarning>
            {fmtDayLabel()}
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

      {/* Hero — delivered today (cumulative, never decreases) */}
      <section className="mb-5 overflow-hidden rounded-2xl p-5 text-white shadow-lg"
        style={{ background: "linear-gradient(135deg, #0F2540 0%, #1A3556 100%)" }}>
        <div className="text-[11px] font-bold uppercase tracking-wider text-white/60">Delivered today</div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-[56px] font-extrabold leading-none text-white tabular-nums">{deliveredToday}</span>
          <span className="ml-1 text-[12px] font-bold uppercase tracking-wider text-white/60">
            {deliveredToday === 1 ? "stop" : "stops"}
          </span>
        </div>
        <div className="mt-4 text-[12.5px] text-white/75">
          {isVanEmpty
            ? (ordersWaiting > 0
                ? `Van empty · ${ordersWaiting} order${ordersWaiting === 1 ? "" : "s"} waiting to load`
                : "Van empty · nothing waiting at the warehouse")
            : routeStarted
              ? `${active.length - loaded.length === 0 ? 0 : pending.length === 0 ? loaded.length : 1} of ${active.length} on this run`
              : `${loaded.length} loaded — ready to roll`}
        </div>
        {!isVanEmpty && goodsOnBoard > 0 && (
          <div className="mt-1 text-[11px] text-white/55 tabular-nums">{formatBBD(goodsOnBoard)} in goods on board</div>
        )}
      </section>

      {isError ? (
        <DeliveryErrorCard
          title="Couldn't load your route"
          message={(error as Error)?.message}
          onRetry={() => refetch()}
        />
      ) : isPending || !driverProfileId ? (
        <div className="space-y-3">{[0,1,2].map((i) => <SkeletonStopCard key={i} />)}</div>
      ) : isVanEmpty ? (
        <VanEmptyHome
          ordersWaiting={ordersWaiting}
          deliveredToday={deliveredToday}
        />
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[17px] font-extrabold text-ink">This run</h2>
            <Link
              to="/delivery/load"
              className="inline-flex items-center gap-1 rounded-full border border-[#E5E9EF] bg-white px-3 py-1.5 text-[11.5px] font-bold text-ink hover:bg-[#FAFBFC]"
            >
              Load more
            </Link>
          </div>

          {reorderable.length >= 2 && (
            <p className="mb-3 text-[11.5px] text-muted-foreground">Hold and drag to reorder stops.</p>
          )}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={() => { if (typeof navigator !== "undefined") navigator.vibrate?.(10); }}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={reorderableIds} strategy={verticalListSortingStrategy}>
              <ul className={`space-y-3 ${showStartBanner ? "pb-24" : ""}`}>
                {sorted.map((s, i) => {
                  const isLoaded = s.status === "packed";
                  const isActive = s.status === "out_for_delivery" && i === activeIdx;
                  const isReorderable = reorderableIds.includes(s.id);
                  return (
                    <StopCard
                      key={s.id}
                      stop={s}
                      index={i + 1}
                      active={isActive}
                      loaded={isLoaded}
                      sortable={isReorderable}
                      onOpen={() => {
                        if (isLoaded) {
                          toast("Tap Start run below to begin deliveries.");
                          return;
                        }
                        if (!isActive) {
                          if (!window.confirm("This isn't your next stop — are you skipping ahead?")) return;
                        }
                        navigate({ to: "/delivery/stop/$orderId", params: { orderId: s.id } });
                      }}
                      eta={isLoaded ? "Awaiting start" : (isActive ? "Now" : `~${estimatedArrival(i)}`)}
                    />
                  );
                })}
              </ul>
            </SortableContext>
          </DndContext>
        </>
      )}

      {showStartBanner && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E5E9EF] bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-[640px] items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-bold uppercase tracking-wider text-[#047857]">Ready to roll</div>
              <div className="truncate text-[13px] text-muted-foreground">
                {loaded.length} stop{loaded.length > 1 ? "s" : ""} loaded on {vehicleId}
              </div>
            </div>
            <button
              type="button"
              onClick={() => startMut.mutate()}
              disabled={startMut.isPending}
              className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-[#10B981] px-5 text-[14.5px] font-extrabold text-white shadow-lg transition disabled:opacity-50"
            >
              <Play className="h-4 w-4" fill="currentColor" /> {startMut.isPending ? "Starting…" : "Start run"}
            </button>
          </div>
        </div>
      )}
    </DeliveryShell>
  );
}

/* ---------- Van empty home (STATE 1) ---------- */

function VanEmptyHome({ ordersWaiting, deliveredToday }: { ordersWaiting: number; deliveredToday: number }) {
  const justFinishedRun = deliveredToday > 0;
  return (
    <div className="space-y-4">
      {justFinishedRun && (
        <div className="rounded-2xl border border-[#D1FAE5] bg-gradient-to-br from-[#ECFDF5] to-[#D1FAE5] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#10B981]">
              <PartyPopper className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-[14.5px] font-extrabold text-[#065F46]">Run complete — nice work</div>
              <div className="text-[12px] text-[#047857]">
                {deliveredToday} stop{deliveredToday === 1 ? "" : "s"} delivered today
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[#E5E9EF] bg-white px-5 py-8 text-center shadow-[0_1px_0_#E5E9EF]">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#ECFDF5]">
          <Truck className="h-7 w-7 text-[#10B981]" />
        </div>
        <div className="mt-3 text-[20px] font-extrabold text-ink">Ready to load</div>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {ordersWaiting > 0
            ? `${ordersWaiting} order${ordersWaiting === 1 ? "" : "s"} waiting at the warehouse.`
            : "No orders waiting right now — check with the warehouse."}
        </p>
        <Link
          to="/delivery/load"
          className="mt-5 inline-flex h-14 w-full max-w-[320px] items-center justify-center rounded-xl bg-[#10B981] px-6 text-[16px] font-extrabold text-white shadow-lg"
        >
          {justFinishedRun ? "Load next run" : "Load van"} <ArrowRight className="ml-2 h-5 w-5" />
        </Link>
      </div>

      {justFinishedRun && (
        <div className="text-center">
          <Link
            to="/delivery/end-shift"
            className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-muted-foreground underline-offset-4 hover:text-ink hover:underline"
          >
            Done for the day <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}

function StopCard({
  stop, index, active, loaded, sortable, onOpen, eta,
}: {
  stop: RouteStop;
  index: number;
  active: boolean;
  loaded: boolean;
  sortable: boolean;
  onOpen: () => void;
  eta: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stop.id,
    disabled: !sortable,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const addr = fmtFullAddress(stop.customer);
  const num = (
    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-[14px] font-extrabold ${
      active ? "bg-[#F59E0B] text-white"
      : loaded ? "bg-[#0F2540] text-white"
      : "bg-[#F1F4F8] text-muted-foreground"
    }`}>
      {index}
    </div>
  );

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => { if (!isDragging) onOpen(); }}
      className={`flex cursor-pointer items-stretch gap-3 rounded-2xl border p-3 transition-shadow touch-manipulation select-none ${
        isDragging ? "shadow-lg scale-[1.03] bg-white border-[#0F2540]"
        : active ? "border-[#F59E0B] bg-gradient-to-br from-[#FFF8F2] to-[#FFEFE0] shadow-[0_0_0_4px_rgba(245,158,11,0.12)]"
        : loaded ? "border-[#CBD5E1] bg-white"
        : "border-[#E5E9EF] bg-white"
      }`}
    >
      {num}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="text-[15px] font-bold leading-tight text-ink truncate">{stop.customer?.company_name ?? "—"}</div>
          {active ? (
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
          <span className="truncate">{addr.line2 || addr.line1}</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="text-[13px] font-bold text-ink">{stop.items_count ?? 0} items</span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground tabular-nums">{formatBBD(Number(stop.total))}</span>
            <span className="text-[11.5px] text-muted-foreground">· {eta}</span>
          </div>
        </div>
      </div>
    </li>
  );
}

// Kept as fallback; no longer used in the main flow since AllDone is replaced by VanEmptyHome.
export function _UnusedAllDone() {
  return (
    <div className="rounded-2xl border border-[#D1FAE5] bg-[#ECFDF5] px-5 py-10 text-center">
      <CheckCircle2 className="mx-auto h-8 w-8 text-[#10B981]" />
      <div className="mt-3 text-[18px] font-extrabold text-ink">All deliveries done</div>
      <Sparkles className="mx-auto mt-2 h-3 w-3 text-muted-foreground" />
      <Package className="hidden" />
    </div>
  );
}
