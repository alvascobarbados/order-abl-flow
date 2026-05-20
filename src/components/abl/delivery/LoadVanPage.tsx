import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Camera, CheckCircle2, X, MapPin, Package, Sparkles } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { useDriver } from "@/hooks/use-driver";
import { DeliveryShell } from "./DeliveryShell";
import { formatBBD } from "@/lib/format";
import { fmtTime } from "./util";
import { toast } from "sonner";

type AvailableOrder = {
  id: string; order_number: string; invoice_number: string | null; total: number;
  packed_at: string | null; driver_name: string | null;
  customer: { id: string; company_name: string; delivery_address: string | null; delivery_city: string | null; delivery_parish: string | null; phone: string | null } | null;
};

export function LoadVanPage() {
  const { driverName, vehicleId } = useDriver();
  const navigate = useNavigate();
  const [available, setAvailable] = useState<AvailableOrder[]>([]);
  const [loadedCount, setLoadedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());

  const reload = async () => {
    const [{ data: avail }, { data: mine }] = await Promise.all([
      supabase.from("orders")
        .select("id, order_number, invoice_number, total, packed_at, driver_name, customer:customers(id, company_name, delivery_address, delivery_city, delivery_parish, phone)")
        .eq("status", "packed")
        .is("driver_name", null)
        .not("invoice_number", "is", null)
        .order("packed_at", { ascending: true }),
      supabase.from("orders").select("id", { count: "exact", head: true })
        .eq("status", "packed").eq("driver_name", driverName),
    ]);
    setAvailable((avail ?? []) as any);
    setLoadedCount((mine as any)?.length ?? 0);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [driverName]);

  const assign = async (id: string, method: "scan" | "manual"): Promise<AvailableOrder | null> => {
    const row = available.find((o) => o.id === id);
    setExitingIds((s) => new Set(s).add(id));
    const nextSeq = loadedCount + 1;
    const { error } = await supabase.from("orders").update({
      driver_name: driverName, vehicle_id: vehicleId, route_sequence: nextSeq,
    }).eq("id", id).eq("status", "packed").is("driver_name", null);
    if (error) {
      setExitingIds((s) => { const n = new Set(s); n.delete(id); return n; });
      toast.error(error.message);
      return null;
    }
    await supabase.from("delivery_events").insert({
      order_id: id, driver_name: driverName, event_type: "loaded",
      notes: `Loaded onto ${vehicleId} via ${method}`,
      meta: { method, vehicle_id: vehicleId },
    });
    setTimeout(() => {
      setAvailable((arr) => arr.filter((o) => o.id !== id));
      setExitingIds((s) => { const n = new Set(s); n.delete(id); return n; });
      setLoadedCount((c) => c + 1);
    }, 220);
    return row ?? null;
  };

  /** Scan handler — validates by invoice_number, returns toast-friendly outcome. */
  const handleScan = async (raw: string): Promise<{ ok: boolean; msg: string; row?: AvailableOrder | null }> => {
    const code = raw.trim().toUpperCase();
    if (!/^INV-/.test(code)) return { ok: false, msg: `Not an invoice QR (${code.slice(0, 24)})` };
    const { data: ord, error } = await supabase.from("orders")
      .select("id, status, invoice_number, driver_name, total, customer:customers(company_name)")
      .eq("invoice_number", code).maybeSingle();
    if (error) return { ok: false, msg: error.message };
    if (!ord) return { ok: false, msg: `${code} not found` };
    if (ord.status !== "packed") return { ok: false, msg: `${code} already ${String(ord.status).replace(/_/g, " ")}` };
    if (ord.driver_name && ord.driver_name !== driverName) return { ok: false, msg: `${code} on ${ord.driver_name}'s van` };
    if (ord.driver_name === driverName) return { ok: false, msg: `${code} already on your van` };
    const row = await assign(ord.id, "scan");
    return {
      ok: true,
      msg: `${code} loaded — ${(ord.customer as any)?.company_name ?? "customer"}`,
      row,
    };
  };

  const demoScan = async () => {
    const first = available[0];
    if (!first) { toast("No packed orders available to scan."); return; }
    const inv = first.invoice_number;
    if (!inv) { toast.error("First order has no invoice yet."); return; }
    const res = await handleScan(inv);
    if (res.ok) toast.success(res.msg); else toast.error(res.msg);
  };

  const isEmpty = !loading && available.length === 0 && loadedCount === 0;

  return (
    <DeliveryShell title="Load van" subtitle={`Tap or scan to load orders onto ${vehicleId}`} back={{ to: "/delivery" }}>
      {isEmpty ? (
        <EmptyState />
      ) : (
        <>
          <ScanPanel onScan={handleScan} onDemo={demoScan} />

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#E5E9EF]" />
            <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Or load manually</span>
            <div className="h-px flex-1 bg-[#E5E9EF]" />
          </div>

          {loading ? (
            <div className="space-y-2">{[0,1].map((i) => <div key={i} className="h-[78px] animate-pulse rounded-xl bg-white/60" />)}</div>
          ) : available.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#E5E9EF] bg-white px-4 py-8 text-center text-[13px] text-muted-foreground">
              <Package className="mx-auto mb-2 h-5 w-5" />
              All packed orders are loaded. {loadedCount > 0 && "Continue to route below."}
            </div>
          ) : (
            <ul className="space-y-2">
              {available.map((o) => (
                <li
                  key={o.id}
                  className={`transition-all duration-200 ${exitingIds.has(o.id) ? "translate-x-4 opacity-0" : "opacity-100"}`}
                >
                  <button
                    type="button"
                    onClick={() => assign(o.id, "manual")}
                    className="flex w-full items-center gap-3 rounded-xl border border-[#E5E9EF] bg-white p-3 text-left transition hover:border-[#10B981]/40 hover:shadow-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-[16px] font-semibold text-ink">{o.customer?.company_name ?? "—"}</div>
                        <span className="shrink-0 text-[13px] font-bold text-ink tabular-nums">{formatBBD(Number(o.total))}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-[12px] text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {[o.customer?.delivery_address, o.customer?.delivery_city, o.customer?.delivery_parish].filter(Boolean).join(", ") || "No address"}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span><span className="font-mono">{o.invoice_number ?? o.order_number}</span> · packed {fmtTime(o.packed_at)}</span>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* Sticky bottom continue */}
      {!isEmpty && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E5E9EF] bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto max-w-[640px]">
            <button
              type="button"
              onClick={() => navigate({ to: "/delivery" })}
              disabled={loadedCount === 0}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#10B981] text-[15.5px] font-extrabold text-white shadow-lg transition disabled:opacity-40"
            >
              {loadedCount === 0 ? "Load at least 1 order to continue" : <>{loadedCount} loaded · Continue to route <ArrowRight className="h-5 w-5" /></>}
            </button>
          </div>
        </div>
      )}
    </DeliveryShell>
  );
}

/* ---------- Scan panel ---------- */

function ScanPanel({ onScan, onDemo }: {
  onScan: (text: string) => Promise<{ ok: boolean; msg: string }>;
  onDemo: () => void;
}) {
  const containerId = "delivery-scanner";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lockRef = useRef(false);
  const [status, setStatus] = useState<{ type: "idle" | "ok" | "err"; msg: string }>({ type: "idle", msg: "" });
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
          { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1 },
          async (decoded) => {
            if (lockRef.current) return;
            lockRef.current = true;
            try { await s.pause(true); } catch {}
            const res = await onScan(decoded);
            setStatus({ type: res.ok ? "ok" : "err", msg: res.msg });
            if (res.ok) toast.success(res.msg); else toast.error(res.msg);
            beep(res.ok); vibrate(res.ok);
            setTimeout(async () => {
              setStatus({ type: "idle", msg: "" });
              try { await s.resume(); } catch {}
              lockRef.current = false;
            }, 1500);
          },
          () => {},
        );
        if (cancelled) { try { await s.stop(); await s.clear(); } catch {} }
      } catch (e: any) {
        setCameraError(e?.message ?? "Could not access camera");
      }
    };
    start();
    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) s.stop().catch(() => {}).finally(() => { try { s.clear(); } catch {} });
    };
  }, [onScan]);

  return (
    <section>
      <div className="relative mx-auto overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: "1 / 1" }}>
        <div id={containerId} className="absolute inset-0 [&_video]:!h-full [&_video]:!w-full [&_video]:object-cover" />
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="relative h-[64%] w-[64%]">
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
              <p className="mt-1 text-[11.5px] text-white/70">Allow camera access, or tap an order below.</p>
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 text-center text-[13px] font-semibold text-muted-foreground">
        Scan the QR code on the invoice
      </p>

      <div className="mt-3 flex justify-center">
        <button
          type="button"
          onClick={onDemo}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E9EF] bg-white px-3 py-1.5 text-[12px] font-bold text-ink hover:bg-[#FAFBFC]"
        >
          <Sparkles className="h-3.5 w-3.5 text-[#FF6A1A]" /> Demo scan
        </button>
      </div>
    </section>
  );
}

/* ---------- Empty state ---------- */

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-[#E5E9EF] bg-white px-5 py-12 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#F1F4F8]">
        <Package className="h-7 w-7 text-muted-foreground" />
      </div>
      <div className="mt-3 text-[16px] font-extrabold text-ink">No orders ready to load</div>
      <p className="mt-1 text-[13px] text-muted-foreground">Check with warehouse — nothing is packed yet.</p>
      <Link to="/delivery" className="mt-5 inline-flex h-11 items-center justify-center rounded-xl border border-[#E5E9EF] bg-white px-5 text-[13.5px] font-bold text-ink">
        Back to route
      </Link>
    </div>
  );
}
