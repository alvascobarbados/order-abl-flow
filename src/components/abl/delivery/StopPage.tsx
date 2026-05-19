import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { MapPin, Navigation, HelpCircle, Banknote, CreditCard, FileText, Wallet, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDriver } from "@/hooks/use-driver";
import { DeliveryShell } from "./DeliveryShell";
import { SignaturePad, type SignaturePadHandle } from "./SignaturePad";
import { HelpDrawer, type HelpAction } from "./HelpDrawer";
import { formatBBD } from "@/lib/format";
import { fmtFullAddress } from "./util";
import { toast } from "sonner";

type PaymentMethod = "cash" | "cheque" | "card" | "account";

type StopData = {
  id: string;
  order_number: string;
  invoice_number: string | null;
  status: string;
  total: number;
  delivery_notes: string | null;
  customer: {
    id: string; company_name: string;
    delivery_address: string | null; delivery_city: string | null; delivery_parish: string | null;
    delivery_notes: string | null; phone: string | null;
  } | null;
  items: { id: string; quantity: number; product: { name: string; pack_size: number | null; pack_unit: string | null } | null }[];
  route_position?: { index: number; total: number };
};

export function StopPage({ orderId }: { orderId: string }) {
  const { driverName, vehicleId } = useDriver();
  const navigate = useNavigate();
  const [data, setData] = useState<StopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [itemsOpen, setItemsOpen] = useState(false);

  const sigRef = useRef<SignaturePadHandle>(null);
  const [, forceSig] = useState(0);
  const [signerName, setSignerName] = useState("");
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [cardAuth, setCardAuth] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: o } = await supabase.from("orders")
        .select("id, order_number, invoice_number, status, total, delivery_notes, customer:customers(id, company_name, delivery_address, delivery_city, delivery_parish, delivery_notes, phone), items:order_items(id, quantity, product:products(name, pack_size, pack_unit))")
        .eq("id", orderId).maybeSingle();

      const { data: route } = await supabase.from("orders")
        .select("id, route_sequence").eq("driver_name", driverName).eq("status", "out_for_delivery")
        .order("route_sequence", { ascending: true, nullsFirst: false });

      const idx = (route as any[] | null)?.findIndex((r) => r.id === orderId) ?? -1;
      const stopInfo = idx >= 0 ? { index: idx + 1, total: (route as any[]).length } : undefined;

      const d = o as any;
      if (d) {
        setData({ ...d, route_position: stopInfo });
        setSignerName(d.customer?.company_name ?? "");
        setAmount(Number(d.total).toFixed(2));

        await supabase.from("delivery_events").insert({
          order_id: orderId, driver_name: driverName, event_type: "arrived",
          notes: `Driver arrived at ${d.customer?.company_name ?? "customer"}`,
        });
      }
      setLoading(false);
    })();
  }, [orderId, driverName]);

  const addr = useMemo(() => fmtFullAddress(data?.customer ?? null), [data]);

  const itemsSummary = useMemo(() => {
    if (!data) return "";
    const total = data.items.length;
    const cases = data.items.reduce((s, it) => s + (it.quantity ?? 0), 0);
    return `${total} line${total === 1 ? "" : "s"} · ${cases} cases`;
  }, [data]);

  const onMethod = (m: PaymentMethod) => {
    setMethod(m);
    if (m === "account") setAmount("0.00");
    else if (data) setAmount(Number(data.total).toFixed(2));
  };

  const canConfirm =
    !!data && !submitting &&
    !sigRef.current?.isEmpty?.() &&
    signerName.trim().length > 0 &&
    method != null &&
    (method !== "cheque" || chequeNumber.trim().length > 0);

  const handleHelp = async (a: HelpAction) => {
    setHelpOpen(false);
    if (!data) return;
    if (a === "call_customer" && data.customer?.phone) {
      window.location.href = `tel:${data.customer.phone}`;
      return;
    }
    if (a === "call_dispatch") {
      window.location.href = "tel:+12465550100"; return;
    }
    if (a === "refused") {
      const reason = window.prompt("Reason for refusal? (Damaged / Wrong order / Changed mind / Other)") || "Refused by customer";
      await supabase.from("orders").update({
        status: "packed", driver_name: null, vehicle_id: null, route_sequence: null,
        delivery_status_detail: "refused" as any,
        delivery_attempts: 1, last_delivery_attempt_at: new Date().toISOString(),
      }).eq("id", data.id);
      await supabase.from("delivery_events").insert({
        order_id: data.id, driver_name: driverName, event_type: "refused", notes: reason,
      });
      toast.error("Refused — order returned to warehouse");
      navigate({ to: "/delivery" });
      return;
    }
    if (a === "not_here") {
      const choice = window.prompt("Reschedule or Leave at door? Type 'reschedule' or 'leave'") || "";
      if (choice.toLowerCase().startsWith("l")) {
        await supabase.from("orders").update({
          delivery_status_detail: "left_at_door" as any,
          delivery_attempts: 1, last_delivery_attempt_at: new Date().toISOString(),
        }).eq("id", data.id);
        await supabase.from("delivery_events").insert({
          order_id: data.id, driver_name: driverName, event_type: "left_at_door",
          notes: "Left at door — photo capture stubbed",
        });
        toast("Marked as left at door");
      } else {
        await supabase.from("orders").update({
          status: "packed", driver_name: null, vehicle_id: null, route_sequence: null,
          delivery_status_detail: "rescheduled" as any,
          delivery_attempts: 1, last_delivery_attempt_at: new Date().toISOString(),
        }).eq("id", data.id);
        await supabase.from("delivery_events").insert({
          order_id: data.id, driver_name: driverName, event_type: "rescheduled", notes: "Returning to warehouse for re-attempt",
        });
        toast("Rescheduled — order back to warehouse");
        navigate({ to: "/delivery" });
      }
      return;
    }
    if (a === "vehicle_issue") {
      const note = window.prompt(`Vehicle ${vehicleId} — describe the issue:`) || "Unspecified issue";
      await supabase.from("delivery_events").insert({
        order_id: data.id, driver_name: driverName, event_type: "help_requested",
        notes: `Vehicle ${vehicleId}: ${note}`,
      });
      toast.success("Reported to dispatch");
      return;
    }
    // damaged / wrong_address: just log
    await supabase.from("delivery_events").insert({
      order_id: data.id, driver_name: driverName, event_type: "help_requested", notes: a,
    });
    toast("Reported to dispatch");
  };

  const confirmDelivery = async () => {
    if (!data || !canConfirm) return;
    setSubmitting(true);
    try {
      const sigData = sigRef.current?.toDataURL();
      let sigUrl: string | null = null;
      if (sigData) {
        const blob = await (await fetch(sigData)).blob();
        const path = `signatures/${data.id}/${Date.now()}.png`;
        const up = await supabase.storage.from("delivery-signatures").upload(path, blob, { contentType: "image/png" });
        if (up.error) throw up.error;
        sigUrl = up.data.path;
      }

      const amountNum = Math.max(0, Number(amount) || 0);

      const { error: ordErr } = await supabase.from("orders").update({
        status: "delivered",
        delivered_at: new Date().toISOString(),
        delivered_to_name: signerName.trim(),
        signature_image_url: sigUrl,
        delivery_status_detail: "delivered" as any,
        delivery_attempts: 1,
        last_delivery_attempt_at: new Date().toISOString(),
      }).eq("id", data.id);
      if (ordErr) throw ordErr;

      if (method !== "account") {
        const dbMethod = method === "card" ? "card" : method === "cheque" ? "cheque" : "cash";
        const status = method === "cheque" ? "pending" : "cleared";
        const reference = method === "cheque" ? chequeNumber.trim() : (method === "card" ? cardAuth.trim() || null : null);

        const { data: pmt, error: pmtErr } = await supabase.from("payments").insert({
          customer_id: data.customer!.id,
          amount: amountNum,
          payment_method: dbMethod as any,
          status: status as any,
          payment_date: new Date().toISOString().slice(0, 10),
          reference,
          notes: `Collected at delivery by ${driverName} · ${vehicleId}`,
        }).select("id").single();
        if (pmtErr) throw pmtErr;

        await supabase.from("payment_allocations").insert({
          payment_id: pmt.id, order_id: data.id, amount: amountNum,
        });

        await supabase.from("delivery_events").insert({
          order_id: data.id, driver_name: driverName, event_type: "payment_collected",
          notes: `${dbMethod.toUpperCase()} ${formatBBD(amountNum)}`,
          meta: { method: dbMethod, amount: amountNum, reference } as any,
        });
      } else {
        await supabase.from("delivery_events").insert({
          order_id: data.id, driver_name: driverName, event_type: "payment_collected",
          notes: "On account — no money collected",
          meta: { method: "account", amount: 0 } as any,
        });
      }

      await supabase.from("delivery_events").insert({
        order_id: data.id, driver_name: driverName, event_type: "delivered",
        notes: `Signed by ${signerName.trim()}`,
      });

      toast.success(`Delivered to ${data.customer?.company_name} · ${method === "account" ? "On account" : formatBBD(amountNum)}`);
      setTimeout(() => navigate({ to: "/delivery" }), 1400);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not confirm delivery");
      setSubmitting(false);
    }
  };

  const openMaps = () => {
    if (!data?.customer) return;
    const q = encodeURIComponent([addr.line1, addr.line2].filter(Boolean).join(", "));
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank");
  };

  if (loading || !data) {
    return (
      <DeliveryShell title="Loading stop…" back={{ to: "/delivery" }}>
        <div className="h-[160px] animate-pulse rounded-2xl bg-white/60" />
      </DeliveryShell>
    );
  }

  const stopLabel = data.route_position ? `Stop ${data.route_position.index} of ${data.route_position.total}` : "Delivery";

  return (
    <DeliveryShell
      title={stopLabel}
      subtitle={data.customer?.company_name ?? undefined}
      back={{ to: "/delivery" }}
      right={
        <button type="button" onClick={() => setHelpOpen(true)} aria-label="Help"
          className="grid h-10 w-10 place-items-center rounded-xl text-[#E11D48] hover:bg-[#FEE2E2]">
          <HelpCircle className="h-5 w-5" strokeWidth={2} />
        </button>
      }
    >
      {/* Address */}
      <section className="mb-3 rounded-2xl border border-[#E5E9EF] bg-white p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FEE2E2]">
            <MapPin className="h-5 w-5 text-[#E11D48]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-extrabold leading-tight text-ink">{addr.line1}</div>
            {addr.line2 && <div className="text-[12.5px] text-muted-foreground">{addr.line2}</div>}
          </div>
          <button type="button" onClick={openMaps}
            className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl bg-[#0B1A2E] px-3 text-[12px] font-extrabold text-white shadow-sm">
            <Navigation className="h-4 w-4" /> Navigate
          </button>
        </div>
      </section>

      {/* Order summary */}
      <section className="mb-3 rounded-2xl border border-[#E5E9EF] bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {data.invoice_number ? "Invoice" : "Order"}
            </div>
            <div className="font-mono text-[14px] font-bold text-ink">{data.invoice_number ?? data.order_number}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total</div>
            <div className="font-mono text-[20px] font-extrabold text-ink">{formatBBD(Number(data.total))}</div>
          </div>
        </div>
        <button type="button" onClick={() => setItemsOpen((v) => !v)}
          className="mt-2 text-[12.5px] font-semibold text-muted-foreground hover:text-ink">
          {data.items.length} items · tap to {itemsOpen ? "hide" : "view"}
        </button>
        {itemsOpen && (
          <ul className="mt-2 space-y-1 border-t border-[#F1F4F8] pt-2 text-[12.5px]">
            {data.items.map((it) => (
              <li key={it.id} className="flex justify-between gap-2">
                <span className="truncate text-ink">{it.product?.name ?? "—"}</span>
                <span className="shrink-0 font-mono text-muted-foreground">×{it.quantity}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-1 text-[11.5px] text-muted-foreground">{itemsSummary}</div>
      </section>

      {data.delivery_notes && (
        <section className="mb-3 rounded-2xl bg-[#FFFBEB] p-3 text-[12.5px] text-[#92400E]">
          <div className="mb-0.5 font-bold uppercase tracking-wider text-[10.5px]">Notes from customer</div>
          {data.delivery_notes}
        </section>
      )}

      {/* Signature */}
      <section className="mb-3 rounded-2xl border border-[#E5E9EF] bg-white p-4">
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-[13px] font-extrabold text-ink">Customer signature</label>
          <button type="button" onClick={() => { sigRef.current?.clear(); forceSig((n) => n + 1); }}
            className="text-[11.5px] font-semibold text-muted-foreground hover:text-ink">
            Clear
          </button>
        </div>
        <SignaturePad ref={sigRef} />
        <label className="mt-3 block text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
          Customer name to confirm
        </label>
        <input value={signerName} onChange={(e) => setSignerName(e.target.value)}
          className="mt-1 h-12 w-full rounded-xl border border-[#E5E9EF] bg-white px-3 text-[15px] font-semibold text-ink outline-none focus:border-[#10B981]" />
      </section>

      {/* Payment */}
      <section className="mb-3 rounded-2xl border border-[#E5E9EF] bg-white p-4">
        <label className="text-[13px] font-extrabold text-ink">Payment received</label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <PayBtn active={method === "cash"} onClick={() => onMethod("cash")} icon={<Banknote className="h-5 w-5" />}>Cash</PayBtn>
          <PayBtn active={method === "card"} onClick={() => onMethod("card")} icon={<CreditCard className="h-5 w-5" />}>Card</PayBtn>
          <PayBtn active={method === "cheque"} onClick={() => onMethod("cheque")} icon={<FileText className="h-5 w-5" />}>Cheque</PayBtn>
          <PayBtn active={method === "account"} onClick={() => onMethod("account")} icon={<Wallet className="h-5 w-5" />}>Account</PayBtn>
        </div>

        <label className="mt-3 block text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Amount collected</label>
        <div className="mt-1 flex items-center gap-2 rounded-xl border border-[#E5E9EF] bg-white px-3 py-2 focus-within:border-[#10B981]">
          <span className="font-mono text-[14px] font-bold text-muted-foreground">BBD$</span>
          <input
            value={amount}
            inputMode="decimal"
            disabled={method === "account"}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-transparent font-mono text-[22px] font-extrabold text-ink outline-none disabled:text-muted-foreground"
          />
        </div>

        {method === "cheque" && (
          <div className="mt-3">
            <label className="block text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Cheque number</label>
            <input value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)}
              className="mt-1 h-12 w-full rounded-xl border border-[#E5E9EF] bg-white px-3 font-mono text-[15px] font-semibold text-ink outline-none focus:border-[#10B981]" />
          </div>
        )}
        {method === "card" && (
          <div className="mt-3">
            <label className="block text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Authorization code (optional)</label>
            <input value={cardAuth} onChange={(e) => setCardAuth(e.target.value)}
              className="mt-1 h-12 w-full rounded-xl border border-[#E5E9EF] bg-white px-3 font-mono text-[15px] font-semibold text-ink outline-none focus:border-[#10B981]" />
          </div>
        )}
        {method === "account" && (
          <p className="mt-2 rounded-lg bg-[#EFF6FF] px-3 py-2 text-[12px] text-[#1D4ED8]">
            This order will be added to the customer's running balance.
          </p>
        )}
      </section>

      <div className="sticky bottom-3 z-20 pt-2">
        <button
          type="button"
          onClick={confirmDelivery}
          disabled={!canConfirm}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#10B981] text-[16px] font-extrabold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Confirming…" : "Confirm delivery →"}
        </button>
        <button
          type="button"
          onClick={() => navigate({ to: "/delivery" })}
          className="mx-auto mt-2 block text-[12px] font-semibold text-muted-foreground hover:text-ink"
        >
          Save &amp; step back
        </button>
      </div>

      <HelpDrawer
        open={helpOpen}
        onOpenChange={setHelpOpen}
        customerPhone={data.customer?.phone}
        customerName={data.customer?.company_name}
        deliveryNotes={data.delivery_notes}
        onAction={handleHelp}
      />
    </DeliveryShell>
  );
}

function PayBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex h-16 items-center justify-center gap-2 rounded-xl border text-[14px] font-extrabold transition ${
        active ? "border-[#10B981] bg-[#10B981] text-white shadow-sm"
        : "border-[#E5E9EF] bg-white text-ink hover:bg-[#FAFBFC]"
      }`}>
      {icon} {children}
    </button>
  );
}
