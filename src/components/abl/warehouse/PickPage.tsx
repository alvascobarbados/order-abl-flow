import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ScanLine, Plus, Minus, MapPin, AlertTriangle, Undo2, ChevronRight, HelpCircle, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePicker } from "@/hooks/use-picker";
import { WarehouseShell, UrgencyChip } from "./WarehouseShell";
import { Scanner } from "./Scanner";
import { HelpDrawer } from "./HelpDrawer";
import { urgencyOf, type PickListItem } from "./util";

type Order = {
  id: string;
  order_number: string;
  status: string;
  placed_at: string;
  delivery_notes: string | null;
  customer: { id: string; company_name: string; delivery_address: string | null; pricing_tier: string | null } | null;
};

export function PickPage({ orderId }: { orderId: string }) {
  const navigate = useNavigate();
  const { pickerName, demoScan } = usePicker();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<PickListItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [undoFor, setUndoFor] = useState<string | null>(null);
  const startedRef = useRef(false);

  const load = useCallback(async () => {
    const [{ data: o }, { data: oi }] = await Promise.all([
      supabase.from("orders").select("id, order_number, status, placed_at, delivery_notes, customer:customers(id, company_name, delivery_address, pricing_tier)").eq("id", orderId).maybeSingle(),
      supabase.from("order_items")
        .select("id, product_id, quantity, picked_quantity, shortfall_quantity, shortfall_note, picked_at, last_scan_at, product:products(name, sku, bin_location, pack_size, pack_unit, on_hand, primary_image_url)")
        .eq("order_id", orderId),
    ]);
    setOrder(o as any);
    const list = ((oi ?? []) as any[]) as PickListItem[];
    list.sort((a, b) => (a.product?.bin_location ?? "zzz").localeCompare(b.product?.bin_location ?? "zzz"));
    setItems(list);
    if (!activeId) {
      const next = list.find((i) => (i.picked_quantity + i.shortfall_quantity) < i.quantity);
      setActiveId(next?.id ?? null);
    }
  }, [orderId, activeId]);

  // Transition status approved → picking on mount
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      const { data: row } = await supabase.from("orders").select("status").eq("id", orderId).maybeSingle();
      if (row?.status === "approved") {
        await supabase.from("orders").update({
          status: "picking",
          picking_started_at: new Date().toISOString(),
          assigned_picker_name: pickerName,
        }).eq("id", orderId);
        await supabase.from("picking_events").insert({
          order_id: orderId, event_type: "pick_started", meta: { picker: pickerName },
        });
      } else if (row?.status === "picking") {
        await supabase.from("picking_events").insert({
          order_id: orderId, event_type: "resume", meta: { picker: pickerName },
        });
      }
      await load();
    })();
  }, [orderId, pickerName, load]);

  // Sort items: active first, then todo by bin, then done last
  const sorted = useMemo(() => {
    const done = items.filter((i) => (i.picked_quantity + i.shortfall_quantity) >= i.quantity);
    const todo = items.filter((i) => (i.picked_quantity + i.shortfall_quantity) < i.quantity);
    const active = todo.find((i) => i.id === activeId);
    const rest = todo.filter((i) => i.id !== activeId);
    rest.sort((a, b) => (a.product?.bin_location ?? "zzz").localeCompare(b.product?.bin_location ?? "zzz"));
    return [...(active ? [active] : []), ...rest, ...done];
  }, [items, activeId]);

  const totals = useMemo(() => {
    const lines = items.length;
    const linesDone = items.filter((i) => (i.picked_quantity + i.shortfall_quantity) >= i.quantity).length;
    const needUnits = items.reduce((s, i) => s + i.quantity, 0);
    const gotUnits = items.reduce((s, i) => s + i.picked_quantity + i.shortfall_quantity, 0);
    const pct = needUnits ? Math.round((gotUnits / needUnits) * 100) : 0;
    return { lines, linesDone, needUnits, gotUnits, pct };
  }, [items]);

  const allLinesDone = totals.lines > 0 && totals.linesDone === totals.lines;

  const setPicked = async (item: PickListItem, nextQty: number, source: "manual" | "scan") => {
    const clamped = Math.max(0, Math.min(item.quantity + 5, nextQty)); // allow over-pick up to +5 then warn
    const isDone = clamped + item.shortfall_quantity >= item.quantity;
    await supabase.from("order_items").update({
      picked_quantity: clamped,
      picked_at: isDone ? new Date().toISOString() : null,
      last_scan_at: source === "scan" ? new Date().toISOString() : item.last_scan_at ?? null,
    } as any).eq("id", item.id);
    await supabase.from("picking_events").insert({
      order_id: orderId, order_item_id: item.id,
      event_type: source === "scan" ? "item_scanned" : "item_picked_manually",
      quantity: clamped - item.picked_quantity, meta: { picker: pickerName },
    });
    // optimistic update
    setItems((prev) => prev.map((p) => p.id === item.id ? { ...p, picked_quantity: clamped, picked_at: isDone ? new Date().toISOString() : p.picked_at } : p));
    // advance active
    if (isDone) {
      const next = items.find((i) => i.id !== item.id && (i.picked_quantity + i.shortfall_quantity) < i.quantity);
      setActiveId(next?.id ?? null);
    }
  };

  const undoLine = async (item: PickListItem) => {
    await supabase.from("order_items").update({
      picked_quantity: 0, shortfall_quantity: 0, shortfall_note: null, picked_at: null,
    } as any).eq("id", item.id);
    await supabase.from("picking_events").insert({
      order_id: orderId, order_item_id: item.id, event_type: "item_undone", meta: { picker: pickerName },
    });
    setItems((prev) => prev.map((p) => p.id === item.id ? { ...p, picked_quantity: 0, shortfall_quantity: 0, shortfall_note: null, picked_at: null } : p));
    setActiveId(item.id);
    setUndoFor(null);
    toast.success("Undone");
  };

  const handleScanned = async (text: string) => {
    const match = items.find((i) => i.product?.sku?.toUpperCase() === text.toUpperCase());
    if (!match) {
      toast.error(`${text} — not on this order`, { description: "Check the carton or tap manually." });
      return;
    }
    if ((match.picked_quantity + match.shortfall_quantity) >= match.quantity) {
      toast(`${match.product?.sku} already complete`);
      return;
    }
    setActiveId(match.id);
    await setPicked(match, match.picked_quantity + 1, "scan");
    setLastScan(`${match.product?.sku} · ${match.picked_quantity + 1} of ${match.quantity}`);
    setScannerOpen(false);
    if (typeof window !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(30);
    window.setTimeout(() => setLastScan(null), 4000);
  };

  const demoScanStep = async () => {
    const next = items.find((i) => (i.picked_quantity + i.shortfall_quantity) < i.quantity);
    if (!next) { toast("Nothing left to pick"); return; }
    setActiveId(next.id);
    await setPicked(next, next.picked_quantity + 1, "scan");
    setLastScan(`${next.product?.sku} · ${next.picked_quantity + 1} of ${next.quantity}`);
    window.setTimeout(() => setLastScan(null), 4000);
  };

  const pauseAndExit = async () => {
    await supabase.from("orders").update({ picking_paused_at: new Date().toISOString() }).eq("id", orderId);
    await supabase.from("picking_events").insert({ order_id: orderId, event_type: "pause", meta: { picker: pickerName } });
    toast.success("Saved — pick up later");
    navigate({ to: "/warehouse" });
  };

  // Open help when shell dispatches event
  useEffect(() => {
    const fn = () => setHelpOpen(true);
    window.addEventListener("warehouse:help", fn);
    return () => window.removeEventListener("warehouse:help", fn);
  }, []);

  if (!order) {
    return (
      <WarehouseShell title="Loading…" back={{ to: "/warehouse" }}>
        <div className="h-64 animate-pulse rounded-2xl bg-white/60" />
      </WarehouseShell>
    );
  }

  const urgency = urgencyOf({ ...order, picked_by_profile_id: null, approved_at: null, picking_started_at: null, total: 0 } as any);

  return (
    <WarehouseShell title={`Picking ${order.order_number}`} subtitle={order.customer?.company_name ?? ""} back={{ to: "/warehouse" }}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <UrgencyChip kind={urgency} />
          <span className="font-mono text-[12px] font-bold text-muted-foreground">{order.order_number}</span>
        </div>
        <button type="button" onClick={() => setHelpOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-[#E5E9EF] bg-white px-3 py-2 text-[13px] font-bold text-ink hover:bg-[#FAFBFC]">
          <HelpCircle className="h-4 w-4" /> Help
        </button>
      </div>

      <ProgressStrip totals={totals} />

      <ActionPanel
        onScan={() => setScannerOpen(true)}
        demoScan={demoScan}
        onDemo={demoScanStep}
        lastScan={lastScan}
        onClearScan={() => setLastScan(null)}
      />

      <ul className="mt-4 space-y-2.5 pb-32">
        {sorted.map((it) => {
          const done = (it.picked_quantity + it.shortfall_quantity) >= it.quantity;
          const isActive = activeId === it.id && !done;
          const over = it.picked_quantity > it.quantity;
          const insufficient = it.product?.on_hand != null && it.product.on_hand < it.quantity;
          return (
            <li key={it.id} className={`relative flex min-h-[76px] items-center gap-4 rounded-2xl border bg-white p-4 transition ${
              done ? "border-[#E5E9EF] opacity-70"
              : isActive ? "border-[#F59E0B] shadow-[0_0_0_3px_rgba(245,158,11,0.15)]"
              : "border-[#E5E9EF]"}`}
              onClick={() => { if (!done) setActiveId(it.id); }}
            >
              <StatusDot state={done ? "done" : isActive ? "active" : "todo"} />
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-extrabold leading-snug text-ink">{it.product?.name ?? "—"}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px]">
                  <span className="font-mono text-muted-foreground">{it.product?.sku}</span>
                  {it.product?.bin_location && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-[#0F2540] px-2 py-0.5 text-[10.5px] font-bold text-white">
                      <MapPin className="h-3 w-3" /> {it.product.bin_location}
                    </span>
                  )}
                  {it.shortfall_quantity > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-[#FEF3C7] px-2 py-0.5 text-[10.5px] font-bold text-[#92400E]">
                      <AlertTriangle className="h-3 w-3" /> Short by {it.shortfall_quantity}
                    </span>
                  )}
                  {insufficient && it.shortfall_quantity === 0 && !done && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-[#FFEBE6] px-2 py-0.5 text-[10.5px] font-bold text-[#B91C1C]">
                      Low on hand · {it.product?.on_hand}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <div className="min-w-[64px] text-right">
                  <div className="leading-none">
                    <span className={`text-[22px] font-extrabold ${over ? "text-[#B91C1C]" : "text-ink"}`}>{it.picked_quantity}</span>
                    <span className="text-[16px] font-bold text-muted-foreground"> / {it.quantity}</span>
                  </div>
                  <div className="mt-1 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">{it.product?.pack_unit ?? "cases"}</div>
                  {over && <div className="mt-0.5 text-[10.5px] font-bold text-[#B91C1C]">+{it.picked_quantity - it.quantity} over</div>}
                </div>
                {!done ? (
                  <div className="flex flex-col gap-1.5">
                    <button type="button" onClick={(e) => { e.stopPropagation(); setPicked(it, it.picked_quantity + 1, "manual"); }} className="grid h-12 w-12 place-items-center rounded-full bg-[#0F2540] text-white shadow-sm active:scale-95" aria-label="Add one">
                      <Plus className="h-5 w-5" strokeWidth={2.5} />
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setPicked(it, Math.max(0, it.picked_quantity - 1), "manual"); }} className="grid h-12 w-12 place-items-center rounded-full border border-[#CBD5E1] bg-white text-ink active:scale-95" aria-label="Remove one">
                      <Minus className="h-5 w-5" strokeWidth={2.5} />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <button type="button" onClick={(e) => { e.stopPropagation(); setUndoFor(undoFor === it.id ? null : it.id); }} className="inline-flex items-center gap-1.5 rounded-xl bg-[#F1F4F8] px-3 py-2 text-[12px] font-bold text-ink">
                      <Undo2 className="h-3.5 w-3.5" /> Undo
                    </button>
                    {undoFor === it.id && (
                      <div className="absolute right-0 top-12 z-10 w-[200px] rounded-xl border border-[#E5E9EF] bg-white p-2 shadow-xl">
                        <button type="button" onClick={() => undoLine(it)} className="block w-full rounded-lg bg-[#FEE2E2] px-3 py-2 text-left text-[13px] font-bold text-[#B91C1C]">Reset this pick</button>
                        <button type="button" onClick={() => setUndoFor(null)} className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-[12px] text-muted-foreground hover:bg-[#FAFBFC]">Cancel</button>
                      </div>
                    )}
                  </div>
                )}
                {!done && <ChevronRight className="ml-1 hidden h-5 w-5 text-muted-foreground md:block" />}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E5E9EF] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex-1">
            <div className="text-[14px] font-bold text-ink">{totals.linesDone} / {totals.lines} lines complete</div>
            <button type="button" onClick={pauseAndExit} className="text-[12.5px] font-bold text-muted-foreground underline-offset-2 hover:underline">Save &amp; exit</button>
          </div>
          {allLinesDone ? (
            <Link to="/warehouse/pack/$orderId" params={{ orderId: order.id }} className="inline-flex h-14 items-center gap-2 rounded-xl bg-[#FF6A1A] px-6 text-[15.5px] font-extrabold text-white shadow-sm hover:bg-[#E55A0F]">
              Proceed to pack <ChevronRight className="h-5 w-5" />
            </Link>
          ) : (
            <button type="button" disabled className="inline-flex h-14 cursor-not-allowed items-center gap-2 rounded-xl bg-[#CBD5E1] px-6 text-[15.5px] font-extrabold text-white opacity-70">
              Proceed to pack
            </button>
          )}
        </div>
      </div>

      <Scanner open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={handleScanned} />
      <HelpDrawer
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        orderId={order.id}
        orderNumber={order.order_number}
        customerName={order.customer?.company_name ?? ""}
        deliveryAddress={order.customer?.delivery_address ?? null}
        deliveryNotes={order.delivery_notes}
        items={items}
        onAfterShortfall={load}
        onPause={pauseAndExit}
      />
    </WarehouseShell>
  );
}

function ProgressStrip({ totals }: { totals: { lines: number; linesDone: number; needUnits: number; gotUnits: number; pct: number } }) {
  return (
    <div className="mb-4 rounded-2xl bg-white p-4 shadow-[0_1px_0_#E5E9EF]">
      <div className="h-2 w-full overflow-hidden rounded-full bg-[#F1F4F8]">
        <div className="h-full rounded-full bg-gradient-to-r from-[#F59E0B] to-[#10B981] transition-all" style={{ width: `${totals.pct}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-[13px]">
        <div><span className="font-extrabold text-ink">{totals.linesDone} of {totals.lines} lines</span><span className="text-muted-foreground"> · {totals.gotUnits} of {totals.needUnits} units picked</span></div>
        <div className="text-[11.5px] text-muted-foreground">{totals.pct}%</div>
      </div>
    </div>
  );
}

function StatusDot({ state }: { state: "done" | "active" | "todo" }) {
  if (state === "done") return <span className="grid h-9 w-9 place-items-center rounded-full bg-[#10B981] text-white"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></span>;
  if (state === "active") return (
    <span className="relative grid h-9 w-9 place-items-center rounded-full border-[3px] border-[#F59E0B] bg-white">
      <span className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-[#F59E0B] opacity-70" />
      <span className="relative h-2.5 w-2.5 rounded-full bg-[#F59E0B]" />
    </span>
  );
  return <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-dashed border-[#CBD5E1]" />;
}

function ActionPanel({ onScan, demoScan, onDemo, lastScan, onClearScan }: { onScan: () => void; demoScan: boolean; onDemo: () => void; lastScan: string | null; onClearScan: () => void }) {
  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr]">
      <button type="button" onClick={onScan} className="flex items-center gap-4 rounded-2xl bg-[#0B1A2E] p-5 text-left text-white shadow-sm transition active:scale-[0.99]">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#FF6A1A]">
          <ScanLine className="h-8 w-8" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-extrabold">Tap to scan carton</div>
          <div className="text-[12.5px] text-white/70">Aim camera at the QR sticker</div>
        </div>
        {lastScan && (
          <div className="hidden items-center gap-2 rounded-full bg-[#10B981]/15 px-3 py-1.5 text-[12px] font-bold text-[#10B981] md:inline-flex">
            ✓ {lastScan}
            <button type="button" onClick={(e) => { e.stopPropagation(); onClearScan(); }} aria-label="Dismiss" className="ml-1 opacity-70 hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
      </button>
      <div className="flex flex-col gap-2 rounded-2xl border border-[#E5E9EF] bg-white p-4">
        <div className="text-[13px] font-bold text-ink">Mark picked manually</div>
        <p className="text-[12px] text-muted-foreground">Tap an item below to pick it manually, or use + / − buttons.</p>
        {demoScan && (
          <button type="button" onClick={onDemo} className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#FF6A1A] bg-[#FFFBEB] px-3 py-2 text-[12.5px] font-bold text-[#B45309]">
            <Sparkles className="h-3.5 w-3.5" /> Demo scan
          </button>
        )}
      </div>
      {lastScan && (
        <div className="md:hidden col-span-full rounded-xl bg-[#ECFDF5] px-3 py-2 text-[13px] font-bold text-[#047857]">✓ {lastScan}</div>
      )}
    </section>
  );
}
