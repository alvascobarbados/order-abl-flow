import { useEffect, useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { CheckCircle2, ChevronRight, Camera, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePicker } from "@/hooks/use-picker";
import { WarehouseShell, UrgencyChip } from "./WarehouseShell";
import { urgencyOf } from "./util";

type Item = { id: string; quantity: number; picked_quantity: number; shortfall_quantity: number; product: { name: string; sku: string } | null };
type Order = { id: string; order_number: string; placed_at: string; delivery_notes: string | null; customer: { company_name: string; delivery_address: string | null; pricing_tier: string | null } | null };

export function PackPage({ orderId }: { orderId: string }) {
  const navigate = useNavigate();
  const { pickerName } = usePicker();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [check1, setCheck1] = useState(false);
  const [check2, setCheck2] = useState(false);
  const [check3, setCheck3] = useState(false);
  const [cartonCount, setCartonCount] = useState(1);
  const [notes, setNotes] = useState("");
  const [photoTaken, setPhotoTaken] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: o }, { data: oi }] = await Promise.all([
        supabase.from("orders").select("id, order_number, placed_at, delivery_notes, customer:customers(company_name, delivery_address, pricing_tier)").eq("id", orderId).maybeSingle(),
        supabase.from("order_items").select("id, quantity, picked_quantity, shortfall_quantity, product:products(name, sku)").eq("order_id", orderId),
      ]);
      setOrder(o as any);
      setItems((oi as any) ?? []);
      await supabase.from("picking_events").insert({ order_id: orderId, event_type: "pack_started", meta: { picker: pickerName } });
    })();
  }, [orderId, pickerName]);

  if (!order) {
    return <WarehouseShell title="Loading…" back={{ to: "/warehouse" }}><div className="h-64 animate-pulse rounded-2xl bg-white/60" /></WarehouseShell>;
  }

  const linesCount = items.length;
  const casesTotal = items.reduce((s, i) => s + Math.max(0, i.picked_quantity), 0);
  const shortfalls = items.filter((i) => i.shortfall_quantity > 0).length;
  const needsCustomerNoteAck = !!order.delivery_notes;
  const canConfirm = check1 && check2 && (!needsCustomerNoteAck || check3) && cartonCount > 0 && !submitting;

  const takePhoto = async () => {
    // Try camera capture for the pack photo via input[type=file] accept image/*
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*"; (input as any).capture = "environment";
    input.onchange = () => { if (input.files && input.files[0]) { setPhotoTaken(true); toast.success("Photo captured"); } };
    input.click();
  };

  const confirm = async () => {
    setSubmitting(true);
    const update: any = {
      status: "packed",
      packed_at: new Date().toISOString(),
      carton_count: cartonCount,
      pack_notes: notes || null,
    };
    const { error } = await supabase.from("orders").update(update).eq("id", orderId);
    if (error) { toast.error(error.message); setSubmitting(false); return; }
    await supabase.from("picking_events").insert({ order_id: orderId, event_type: "pack_completed", quantity: cartonCount, meta: { picker: pickerName, notes } });
    setSuccess(true);
    setTimeout(() => {
      toast.success(`Done · ${order.order_number} is ready for dispatch`);
      navigate({ to: "/warehouse" });
    }, 1800);
  };

  const unpack = async () => {
    await supabase.from("orders").update({ status: "picking", packed_at: null }).eq("id", orderId);
    toast("Returned to picking");
    navigate({ to: "/warehouse/pick/$orderId", params: { orderId } });
  };

  const urgency = urgencyOf({ placed_at: order.placed_at, customer: order.customer } as any);

  if (success) {
    return (
      <WarehouseShell title="Packed">
        <div className="mx-auto max-w-md rounded-3xl bg-white p-10 text-center shadow-[0_1px_0_#E5E9EF]">
          <div className="mx-auto grid h-20 w-20 animate-[zoom_0.5s_ease-out] place-items-center rounded-full bg-[#10B981]">
            <CheckCircle2 className="h-12 w-12 text-white" />
          </div>
          <div className="mt-5 text-[24px] font-extrabold tracking-tight text-ink">Packed!</div>
          <p className="mt-1 text-[14px] text-muted-foreground">{order.order_number} is ready for dispatch.</p>
        </div>
      </WarehouseShell>
    );
  }

  return (
    <WarehouseShell title={`Pack ${order.order_number}`} subtitle={order.customer?.company_name ?? ""} back={{ to: "/warehouse/pick/$orderId", label: "" }}>
      <div className="mb-4 flex items-center gap-2">
        <UrgencyChip kind={urgency} />
        <span className="font-mono text-[12px] font-bold text-muted-foreground">{order.order_number}</span>
      </div>

      <section className="mb-5 rounded-2xl bg-white p-5 shadow-[0_1px_0_#E5E9EF]">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#ECFDF5]"><CheckCircle2 className="h-7 w-7 text-[#047857]" /></div>
          <div className="min-w-0 flex-1">
            <div className="text-[20px] font-extrabold text-ink">Ready to pack</div>
            <div className="mt-1 text-[14px] text-muted-foreground">{linesCount} lines · {casesTotal} total cases{shortfalls > 0 ? ` · ${shortfalls} shortfall${shortfalls > 1 ? "s" : ""}` : ""}</div>
            <div className="mt-3 text-[14px] font-bold text-ink">{order.customer?.company_name}</div>
            {order.customer?.delivery_address && <div className="text-[12.5px] text-muted-foreground">{order.customer.delivery_address}</div>}
          </div>
        </div>
      </section>

      <section className="mb-5 rounded-2xl bg-white p-5 shadow-[0_1px_0_#E5E9EF]">
        <div className="mb-3 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Verify before sending</div>
        <CheckRow checked={check1} onChange={setCheck1} label="All items match the pick list" />
        <CheckRow checked={check2} onChange={setCheck2} label="Items are sealed and properly labeled" />
        {needsCustomerNoteAck && (
          <div>
            <CheckRow checked={check3} onChange={setCheck3} label="Customer-specific notes reviewed" />
            <div className="ml-12 mt-1 rounded-xl bg-[#FFFBEB] px-3 py-2 text-[12.5px] text-[#92400E]">{order.delivery_notes}</div>
          </div>
        )}
        <div className="mt-3 flex items-center gap-3">
          <button type="button" onClick={takePhoto} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-[13.5px] font-bold ${photoTaken ? "border-[#10B981] bg-[#ECFDF5] text-[#047857]" : "border-[#E5E9EF] bg-white text-ink hover:bg-[#FAFBFC]"}`}>
            <Camera className="h-4 w-4" /> {photoTaken ? "Photo captured" : "Photo of packed order (optional)"}
          </button>
        </div>
      </section>

      <section className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-[200px_1fr]">
        <div className="rounded-2xl bg-white p-4 shadow-[0_1px_0_#E5E9EF]">
          <label className="block text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Cartons</label>
          <div className="mt-2 flex items-center gap-2">
            <button type="button" onClick={() => setCartonCount(Math.max(1, cartonCount - 1))} className="grid h-12 w-12 place-items-center rounded-xl border border-[#E5E9EF] text-[18px] font-bold">−</button>
            <input type="number" min={1} value={cartonCount} onChange={(e) => setCartonCount(Math.max(1, Number(e.target.value) || 1))} className="h-12 w-20 rounded-xl border border-[#E5E9EF] bg-white text-center text-[20px] font-extrabold text-ink" />
            <button type="button" onClick={() => setCartonCount(cartonCount + 1)} className="grid h-12 w-12 place-items-center rounded-xl border border-[#E5E9EF] text-[18px] font-bold">+</button>
          </div>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-[0_1px_0_#E5E9EF]">
          <label className="block text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Notes for driver (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-[#E5E9EF] bg-white p-3 text-[14px] text-ink" placeholder="Fragile · stack upright · leave at side door…" />
        </div>
      </section>

      <button type="button" disabled={!canConfirm} onClick={confirm} className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-[#FF6A1A] text-[17px] font-extrabold text-white shadow-sm transition active:scale-[0.99] disabled:bg-[#CBD5E1] disabled:opacity-80">
        Confirm packed · Send to dispatch <ChevronRight className="h-5 w-5" />
      </button>
      <div className="mt-3 text-center">
        <button type="button" onClick={unpack} className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-muted-foreground hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Unpack — return to picking
        </button>
      </div>
    </WarehouseShell>
  );
}

function CheckRow({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center gap-4 rounded-xl px-2 py-3 text-left hover:bg-[#FAFBFC]">
      <span className={`grid h-8 w-8 place-items-center rounded-lg border-2 transition ${checked ? "border-[#10B981] bg-[#10B981] text-white" : "border-[#CBD5E1] bg-white"}`}>
        {checked && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
      </span>
      <span className="text-[15px] font-bold text-ink">{label}</span>
    </button>
  );
}
