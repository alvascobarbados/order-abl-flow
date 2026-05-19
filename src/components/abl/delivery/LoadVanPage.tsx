import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Camera, CheckCircle2, Plus, X, MapPin, Package, ScanLine, List } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { useDriver } from "@/hooks/use-driver";
import { DeliveryShell } from "./DeliveryShell";
import { formatBBD } from "@/lib/format";
import { fmtTime } from "./util";
import { toast } from "sonner";

type LoadedOrder = {
  id: string; order_number: string; invoice_number: string | null; total: number;
  packed_at: string | null; driver_name: string | null;
  customer: { id: string; company_name: string; delivery_address: string | null; delivery_city: string | null; delivery_parish: string | null } | null;
  items_count?: number;
};

type Mode = "scan" | "list";

export function LoadVanPage() {
  const { driverName, vehicleId } = useDriver();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("scan");
  const [orders, setOrders] = useState<LoadedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const reload = async () => {
    setLoading(true);
    const { data: o } = await supabase.from("orders")
      .select("id, order_number, invoice_number, total, packed_at, driver_name, customer:customers(id, company_name, delivery_address, delivery_city, delivery_parish)")
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
  const loadedTotal = loaded.reduce((s, o) => s + Number(o.total), 0);

  const loadOrder = async (id: string): Promise<LoadedOrder | null> => {
    const nextSeq = loaded.length + 1;
    const { error } = await supabase.from("orders").update({
      driver_name: driverName, vehicle_id: vehicleId, route_sequence: nextSeq,
    }).eq("id", id);
    if (error) { toast.error(error.message); return null; }
    await supabase.from("delivery_events").insert({
      order_id: id, driver_name: driverName, event_type: "loaded", notes: `Loaded onto ${vehicleId}`,
    });
    await reload();
    return orders.find((o) => o.id === id) ?? null;
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

  /** Validate + load by scanned invoice number. Returns toast-friendly outcome. */
  const handleScan = async (raw: string): Promise<{ ok: boolean; msg: string; order?: LoadedOrder }> => {
    const code = raw.trim().toUpperCase();
    if (!/^INV-/.test(code)) return { ok: false, msg: `Not an invoice QR (${code.slice(0, 20)})` };

    const { data: ord, error } = await supabase.from("orders")
      .select("id, order_number, invoice_number, status, total, driver_name, customer:customers(id, company_name, delivery_address, delivery_city, delivery_parish)")
      .eq("invoice_number", code).maybeSingle();
    if (error) return { ok: false, msg: error.message };
    if (!ord) return { ok: false, msg: "Invoice not found" };
    if (!ord.invoice_number) return { ok: false, msg: "Order not yet invoiced" };
    if (ord.status !== "packed") {
      if (ord.status === "out_for_delivery" || ord.status === "delivered" || ord.status === "paid")
        return { ok: false, msg: `Already dispatched (${ord.status.replace(/_/g, " ")})` };
      return { ok: false, msg: "Order not yet packed — finish in warehouse first" };
    }
    if (ord.driver_name && ord.driver_name !== driverName) {
      return { ok: false, msg: `Already assigned to ${ord.driver_name}` };
    }
    if (ord.driver_name === driverName) {
      return { ok: false, msg: `${code} already on your van` };
    }
    const loadedRow = await loadOrder(ord.id);
    return {
      ok: true,
      msg: `${code} loaded · ${ord.customer?.company_name ?? "Customer"} · ${formatBBD(Number(ord.total))}`,
      order: { ...(ord as any), items_count: 0 } as LoadedOrder,
    };
  };

  return (
    <DeliveryShell title="Load van" back={{ to: "/delivery" }}>
      {/* Sticky loaded summary */}
      <div className="sticky top-[56px] z-20 -mx-4 mb-3 border-b border-[#E5E9EF] bg-white/95 px-4 py-2 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="text-[12px] font-bold text-ink">
            {loaded.length} loaded · <span className="">{formatBBD(loadedTotal)}</span>
          </div>
          <button onClick={() => setMode(mode === "scan" ? "list" : "scan")}
            className="inline-flex items-center gap-1 rounded-full border border-[#E5E9EF] bg-white px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
            {mode === "scan" ? <><List className="h-3 w-3" /> Manual</> : <><ScanLine className="h-3 w-3" /> Scan</>}
          </button>
        </div>
      </div>

      {mode === "scan"
        ? <ScanMode onScan={handleScan} />
        : <ListMode loading={loading} loaded={loaded} available={available} onLoad={(id) => loadOrder(id)} onUnload={unload} />}

      {/* Sticky start route */}
      <div className="sticky bottom-3 z-20 mt-4 pt-2">
        <button
          type="button"
          onClick={startRoute}
          disabled={!loaded.length || starting}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#10B981] text-[15.5px] font-extrabold text-white shadow-lg transition disabled:opacity-50"
        >
          {starting ? "Starting…" : <>Start route · {loaded.length} stop{loaded.length === 1 ? "" : "s"} <ArrowRight className="h-5 w-5" /></>}
        </button>
      </div>
    </DeliveryShell>
  );
}

/* ---------- Scan mode ---------- */

function ScanMode({ onScan }: { onScan: (text: string) => Promise<{ ok: boolean; msg: string; order?: LoadedOrder }> }) {
  const containerId = "delivery-scanner";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lockRef = useRef(false);
  const [status, setStatus] = useState<{ type: "idle" | "ok" | "err"; msg: string; order?: LoadedOrder }>({ type: "idle", msg: "" });
  const [cameraError, setCameraError] = useState<string | null>(null);

  const beep = (ok: boolean) => {
    try {
      const Ctor: any = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = ok ? 880 : 220;
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
      o.start(); o.stop(ctx.currentTime + 0.2);
    } catch {}
  };
  const vibrate = (ok: boolean) => { try { (navigator as any).vibrate?.(ok ? 60 : [40, 40, 40]); } catch {} };

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        const s = new Html5Qrcode(containerId, { verbose: false });
        scannerRef.current = s;
        await s.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
          async (decoded) => {
            if (lockRef.current) return;
            lockRef.current = true;
            try { await s.pause(true); } catch {}
            const res = await onScan(decoded);
            setStatus({ type: res.ok ? "ok" : "err", msg: res.msg, order: res.order });
            beep(res.ok); vibrate(res.ok);
            setTimeout(async () => {
              setStatus({ type: "idle", msg: "" });
              try { await s.resume(); } catch {}
              lockRef.current = false;
            }, 1500);
          },
          () => { /* per-frame failures ignored */ },
        );
        if (cancelled) {
          try { await s.stop(); await s.clear(); } catch {}
        }
      } catch (e: any) {
        setCameraError(e?.message ?? "Could not access camera");
      }
    };
    start();
    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        s.stop().catch(() => {}).finally(() => { try { s.clear(); } catch {} });
      }
    };
  }, [onScan]);

  return (
    <section>
      <div className="relative mx-auto overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: "1 / 1" }}>
        <div id={containerId} className="absolute inset-0 [&_video]:!h-full [&_video]:!w-full [&_video]:object-cover" />
        {/* Corner brackets */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="relative h-[68%] w-[68%]">
            {(["tl","tr","bl","br"] as const).map((p) => (
              <span key={p} className={`absolute h-8 w-8 border-[#10B981] ${
                p === "tl" ? "left-0 top-0 border-l-[3px] border-t-[3px] rounded-tl-lg"
                : p === "tr" ? "right-0 top-0 border-r-[3px] border-t-[3px] rounded-tr-lg"
                : p === "bl" ? "left-0 bottom-0 border-l-[3px] border-b-[3px] rounded-bl-lg"
                : "right-0 bottom-0 border-r-[3px] border-b-[3px] rounded-br-lg"
              }`} />
            ))}
          </div>
        </div>

        {/* Flash overlays */}
        {status.type === "ok" && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-[#10B981]/85 animate-in fade-in zoom-in duration-150">
            <CheckCircle2 className="h-24 w-24 text-white" strokeWidth={2.5} />
          </div>
        )}
        {status.type === "err" && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-[#B91C1C]/85 animate-in fade-in duration-150">
            <X className="h-24 w-24 text-white" strokeWidth={2.5} />
          </div>
        )}

        {cameraError && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <div>
              <Camera className="mx-auto h-8 w-8 text-white/80" />
              <div className="mt-2 text-[13px] font-bold text-white">{cameraError}</div>
              <p className="mt-1 text-[11.5px] text-white/70">Allow camera access, or use “Manual” above.</p>
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 text-center text-[13px] font-semibold text-muted-foreground">
        Point at the QR code on the invoice
      </p>

      {/* Success card */}
      <div className="mt-3 min-h-[56px]">
        {status.type === "ok" && status.order && (
          <div className="flex items-center gap-3 rounded-xl border border-[#10B981]/30 bg-[#ECFDF5] p-3 animate-in slide-in-from-bottom-2 duration-200">
            <CheckCircle2 className="h-5 w-5 text-[#047857]" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-bold text-ink">{status.order.customer?.company_name ?? "Customer"}</div>
              <div className="text-[11.5px] font-mono text-muted-foreground">{status.order.invoice_number ?? status.order.order_number}</div>
            </div>
            <span className="text-[13px] font-bold text-ink">{formatBBD(Number(status.order.total))}</span>
          </div>
        )}
        {status.type === "err" && (
          <div className="rounded-xl border border-[#FECACA] bg-[#FEE2E2] p-3 text-[13px] font-semibold text-[#B91C1C] animate-in slide-in-from-bottom-2 duration-200">
            {status.msg}
          </div>
        )}
        {status.type === "idle" && (
          <p className="text-center text-[11.5px] text-muted-foreground">Scan another, or tap below to load manually.</p>
        )}
      </div>
    </section>
  );
}

/* ---------- List mode (fallback) ---------- */

function ListMode({ loading, loaded, available, onLoad, onUnload }: {
  loading: boolean; loaded: LoadedOrder[]; available: LoadedOrder[];
  onLoad: (id: string) => Promise<LoadedOrder | null>; onUnload: (id: string) => void;
}) {
  return (
    <>
      <section className="mb-5">
        <h2 className="mb-2 text-[14px] font-extrabold text-ink">On the van</h2>
        {loaded.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E5E9EF] bg-white px-4 py-6 text-center text-[13px] text-muted-foreground">
            Nothing loaded yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {loaded.map((o, i) => (
              <li key={o.id} className="flex items-center gap-3 rounded-xl border border-[#10B981]/30 bg-[#ECFDF5] p-3">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-[#10B981] text-[12px] font-extrabold text-white">{i + 1}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-[14px] font-bold text-ink">{o.customer?.company_name}</div>
                    <span className="text-[12px] font-bold text-ink">{formatBBD(Number(o.total))}</span>
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground">{o.invoice_number ?? o.order_number}</div>
                </div>
                <button type="button" onClick={() => onUnload(o.id)}
                  className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-white" aria-label="Unload">
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-[14px] font-extrabold text-ink">Available packed orders</h2>
        {loading ? (
          <div className="space-y-2">{[0,1].map((i) => <div key={i} className="h-[78px] animate-pulse rounded-xl bg-white/60" />)}</div>
        ) : available.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E5E9EF] bg-white px-4 py-8 text-center text-[13px] text-muted-foreground">
            <Package className="mx-auto mb-2 h-5 w-5" />
            No unassigned packed orders.
          </div>
        ) : (
          <ul className="space-y-2">
            {available.map((o) => (
              <li key={o.id} className="flex items-center gap-3 rounded-xl border border-[#E5E9EF] bg-white p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-[14px] font-bold text-ink">{o.customer?.company_name}</div>
                    <span className="text-[12px] font-bold text-ink">{formatBBD(Number(o.total))}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-[11.5px] text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{[o.customer?.delivery_city, o.customer?.delivery_parish].filter(Boolean).join(", ") || o.customer?.delivery_address || "No address"}</span>
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground">{o.invoice_number ?? o.order_number} · packed {fmtTime(o.packed_at)}</div>
                </div>
                <button type="button" onClick={() => onLoad(o.id)}
                  className="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg bg-[#10B981] px-3 text-[12.5px] font-extrabold text-white shadow-sm hover:bg-[#059669]">
                  <Plus className="h-4 w-4" /> Load
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
