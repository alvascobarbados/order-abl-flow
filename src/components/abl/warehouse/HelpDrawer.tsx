import { useEffect, useState } from "react";
import { X, AlertTriangle, Camera, UserCog, PauseCircle, MapPin, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePicker } from "@/hooks/use-picker";
import type { PickListItem } from "./util";

export function HelpDrawer({
  open, onClose, orderId, orderNumber, customerName, deliveryAddress, deliveryNotes, items, onAfterShortfall, onPause,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: string;
  customerName: string;
  deliveryAddress: string | null;
  deliveryNotes: string | null;
  items: PickListItem[];
  onAfterShortfall: () => void;
  onPause: () => void;
}) {
  const { pickerName } = usePicker();
  const [step, setStep] = useState<"menu" | "shortfall">("menu");
  const [shortItemId, setShortItemId] = useState<string>("");
  const [shortQty, setShortQty] = useState<number>(1);
  const [shortNote, setShortNote] = useState<string>("");

  useEffect(() => { if (open) setStep("menu"); }, [open]);

  if (!open) return null;

  const requestSupervisor = async () => {
    await supabase.from("activity_log").insert({
      event_type: "supervisor_requested",
      description: `Supervisor requested by ${pickerName} on ${orderNumber}`,
      related_order_id: orderId,
    });
    await supabase.from("picking_events").insert({ order_id: orderId, event_type: "supervisor_requested", meta: { picker: pickerName } });
    toast.success("Supervisor notified");
    onClose();
  };

  const reportDamage = async () => {
    const sku = window.prompt("Damaged item SKU");
    if (!sku) return;
    const qty = Number(window.prompt("Quantity damaged", "1") ?? 1);
    await supabase.from("activity_log").insert({
      event_type: "damage_reported",
      description: `Damage reported by ${pickerName}: ${sku} × ${qty} on ${orderNumber}`,
      related_order_id: orderId,
    });
    await supabase.from("picking_events").insert({ order_id: orderId, event_type: "damage_reported", quantity: qty, meta: { sku, picker: pickerName } });
    toast.success("Damage logged");
    onClose();
  };

  const submitShortfall = async () => {
    if (!shortItemId) return;
    const item = items.find((i) => i.id === shortItemId);
    if (!item) return;
    const qty = Math.max(1, Math.min(item.quantity, shortQty));
    await supabase.from("order_items").update({
      shortfall_quantity: qty,
      shortfall_note: shortNote || null,
      picked_at: new Date().toISOString(),
    }).eq("id", shortItemId);
    await supabase.from("picking_events").insert({
      order_id: orderId, order_item_id: shortItemId,
      event_type: "shortfall_marked", quantity: qty,
      meta: { picker: pickerName, note: shortNote },
    });
    await supabase.from("activity_log").insert({
      event_type: "shortfall_marked",
      description: `Shortfall on ${orderNumber}: ${item.product?.sku ?? "?"} short by ${qty}${shortNote ? ` · note: ${shortNote}` : ""}`,
      related_order_id: orderId,
    });
    toast.success("Shortfall recorded");
    onAfterShortfall();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-end bg-black/40" onClick={onClose}>
      <div className="w-full max-h-[88vh] overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:mx-auto sm:max-w-[640px] sm:rounded-3xl sm:mb-4" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#F1F4F8] bg-white px-5 py-4">
          <div className="text-[18px] font-extrabold text-ink">Need a hand?</div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full hover:bg-[#F1F4F8]" aria-label="Close help">
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === "menu" && (
          <div className="space-y-3 p-5">
            <ActionTile icon={<AlertTriangle className="h-6 w-6 text-[#F59E0B]" />} title="Mark a line as shortfall" desc="When stock is short or unavailable" onClick={() => setStep("shortfall")} />
            <ActionTile icon={<Camera className="h-6 w-6 text-[#FF6A1A]" />} title="Report damaged item" desc="Log SKU, quantity, and notes" onClick={reportDamage} />
            <ActionTile icon={<UserCog className="h-6 w-6 text-[#3730A3]" />} title="Request supervisor" desc="Office is notified immediately" onClick={requestSupervisor} />
            <ActionTile icon={<PauseCircle className="h-6 w-6 text-[#64748B]" />} title="Pause this order" desc="Save progress and return to the queue" onClick={() => { onPause(); onClose(); }} />

            <div className="mt-5 rounded-2xl border border-[#E5E9EF] bg-[#FAFBFC] p-4">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Order context</div>
              <div className="text-[14px] font-bold text-ink">{customerName}</div>
              {deliveryAddress && (
                <div className="mt-1 flex items-start gap-1.5 text-[12.5px] text-muted-foreground"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{deliveryAddress}</span></div>
              )}
              {deliveryNotes && (
                <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-[#FFFBEB] px-3 py-2 text-[12.5px] text-[#92400E]"><StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{deliveryNotes}</span></div>
              )}
            </div>

            <div className="mt-3 rounded-2xl border border-[#E5E9EF] p-4">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Recently asked</div>
              <Faq q="Shortfall vs reject vs pause?" a="Shortfall: marks units we can't supply but the order continues. Reject: only the office can do this. Pause: saves progress to come back later." />
              <Faq q="What if a SKU isn't on the order?" a="Scan it anyway — you can add it as a flagged extra line that office reviews." />
              <Faq q="Camera won't work?" a="Use the manual + and − buttons. Nothing is lost." />
            </div>
          </div>
        )}

        {step === "shortfall" && (
          <div className="space-y-4 p-5">
            <button type="button" onClick={() => setStep("menu")} className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">‹ Back</button>
            <div className="text-[16px] font-extrabold text-ink">Mark a line as shortfall</div>
            <div>
              <label className="mb-1 block text-[12px] font-bold text-muted-foreground">Which line?</label>
              <select value={shortItemId} onChange={(e) => setShortItemId(e.target.value)} className="h-12 w-full rounded-xl border border-[#E5E9EF] bg-white px-3 text-[14px] font-semibold text-ink">
                <option value="">Select an item…</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>{it.product?.name} · {it.product?.sku} · need {it.quantity}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-bold text-muted-foreground">Quantity short</label>
              <input type="number" min={1} value={shortQty} onChange={(e) => setShortQty(Math.max(1, Number(e.target.value) || 1))} className="h-12 w-32 rounded-xl border border-[#E5E9EF] bg-white px-3 text-[15px] font-bold text-ink" />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-bold text-muted-foreground">Note (optional)</label>
              <textarea value={shortNote} onChange={(e) => setShortNote(e.target.value)} rows={3} className="w-full rounded-xl border border-[#E5E9EF] bg-white p-3 text-[14px] text-ink" placeholder="What happened? Office will see this." />
            </div>
            <button type="button" disabled={!shortItemId} onClick={submitShortfall} className="h-14 w-full rounded-xl bg-[#0F2540] text-[15px] font-extrabold text-white disabled:opacity-40">Record shortfall</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionTile({ icon, title, desc, onClick }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-4 rounded-2xl border border-[#E5E9EF] bg-white p-4 text-left hover:bg-[#FAFBFC]">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#F1F4F8]">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-bold text-ink">{title}</div>
        <div className="text-[12.5px] text-muted-foreground">{desc}</div>
      </div>
    </button>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="border-t border-[#F1F4F8] py-2 first:border-t-0">
      <summary className="cursor-pointer list-none text-[13px] font-semibold text-ink">{q}</summary>
      <p className="mt-1 text-[12.5px] text-muted-foreground">{a}</p>
    </details>
  );
}
