import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDriver } from "@/hooks/use-driver";
import { DeliveryShell } from "./DeliveryShell";
import { formatBBD } from "@/lib/format";
import { toast } from "sonner";

type Alloc = {
  amount: number;
  payment: { id: string; payment_method: string; reference: string | null; status: string } | null;
  order: { id: string; order_number: string; customer: { company_name: string } | null } | null;
};

export function EndShiftPage() {
  const { driverName, vehicleId } = useDriver();
  const navigate = useNavigate();
  const [allocs, setAllocs] = useState<Alloc[]>([]);
  const [deliveriesCount, setDeliveriesCount] = useState(0);
  const [accountTotal, setAccountTotal] = useState(0);
  const [cashCounted, setCashCounted] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const { data: ords } = await supabase.from("orders")
        .select("id, total, allocations:payment_allocations(amount, payment:payments(id, payment_method, reference, status), order:orders(id, order_number, customer:customers(company_name)))")
        .eq("driver_name", driverName).in("status", ["delivered", "paid"])
        .gte("delivered_at", start.toISOString());

      const a: Alloc[] = [];
      let acct = 0;
      for (const o of (ords ?? []) as any[]) {
        const sum = (o.allocations ?? []).reduce((s: number, x: any) => s + Number(x.amount), 0);
        for (const al of (o.allocations ?? [])) a.push(al as Alloc);
        const remainder = Number(o.total) - sum;
        if (remainder > 0.01) acct += remainder;
      }
      setAllocs(a);
      setAccountTotal(acct);
      setDeliveriesCount((ords ?? []).length);
    })();
  }, [driverName]);

  const totals = useMemo(() => {
    let cash = 0, cheque = 0, card = 0, chequeCount = 0;
    const cheques: { id: string; ref: string | null; amount: number; payee: string | null }[] = [];
    for (const a of allocs) {
      const m = a.payment?.payment_method;
      if (m === "cash") cash += Number(a.amount);
      else if (m === "cheque") {
        cheque += Number(a.amount); chequeCount += 1;
        cheques.push({ id: a.payment?.id ?? "", ref: a.payment?.reference ?? null, amount: Number(a.amount), payee: a.order?.customer?.company_name ?? null });
      } else if (m === "card") card += Number(a.amount);
    }
    return { cash, cheque, card, chequeCount, cheques };
  }, [allocs]);

  const handIn = totals.cash + totals.cheque;
  const cashNum = Number(cashCounted || 0);
  const variance = cashNum - totals.cash;
  const varianceAbs = Math.abs(variance);

  let varianceUi: { tone: "ok" | "warn" | "bad"; msg: string } = { tone: "ok", msg: "Enter the cash you're holding" };
  if (cashCounted !== "") {
    if (varianceAbs < 0.01) varianceUi = { tone: "ok", msg: `Counts match · ${formatBBD(totals.cash)} expected and counted` };
    else if (varianceAbs / Math.max(1, totals.cash) < 0.01) varianceUi = { tone: "warn", msg: `Off by ${formatBBD(varianceAbs)} — please recount` };
    else varianceUi = { tone: "bad", msg: `Off by ${formatBBD(varianceAbs)} — report to office before submitting` };
  }

  const submit = async () => {
    if (cashCounted === "") { toast.error("Enter the cash count"); return; }
    setSubmitting(true);
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("driver_shifts").insert({
      driver_name: driverName,
      shift_date: today,
      ended_at: new Date().toISOString(),
      vehicle_id: vehicleId,
      deliveries_count: deliveriesCount,
      cash_expected: totals.cash,
      cash_counted: cashNum,
      cheques_count: totals.chequeCount,
      cheques_total: totals.cheque,
      cards_total: totals.card,
      account_total: accountTotal,
      notes: notes.trim() || null,
    });
    if (error) { toast.error(error.message); setSubmitting(false); return; }
    await supabase.from("activity_log").insert({
      event_type: "driver_shift_end",
      description: `End of shift submitted by ${driverName} · ${formatBBD(handIn)} handed in · variance ${formatBBD(variance)}`,
    });
    toast.success("Shift submitted");
    setTimeout(() => navigate({ to: "/" }), 1200);
  };

  return (
    <DeliveryShell title="End of shift" back={{ to: "/delivery" }} subtitle={`${driverName} · ${new Date().toLocaleDateString()}`}>
      <section className="mb-4 rounded-2xl bg-white p-5 shadow-[0_1px_0_#E5E9EF]">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Deliveries completed</div>
        <div className="font-mono text-[36px] font-extrabold leading-none text-ink">{deliveriesCount}</div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Box label="Cash" value={formatBBD(totals.cash)} tint="#ECFDF5" />
          <Box label={`Cheques · ${totals.chequeCount}`} value={formatBBD(totals.cheque)} tint="#EFF6FF" />
          <Box label="Cards" value={formatBBD(totals.card)} tint="#FDF4FF" />
          <Box label="On account" value={formatBBD(accountTotal)} tint="#F1F4F8" />
        </div>

        <div className="mt-4 rounded-xl bg-[#FFF8F2] p-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#9A3412]">Hand to office</div>
          <div className="font-mono text-[24px] font-extrabold text-[#9A3412]">{formatBBD(handIn)}</div>
        </div>
      </section>

      <section className="mb-4 rounded-2xl bg-white p-4 shadow-[0_1px_0_#E5E9EF]">
        <label className="text-[13px] font-extrabold text-ink">Cash counted in hand</label>
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-[#E5E9EF] bg-white px-3 py-2 focus-within:border-[#10B981]">
          <span className="font-mono text-[14px] font-bold text-muted-foreground">BBD$</span>
          <input value={cashCounted} inputMode="decimal" onChange={(e) => setCashCounted(e.target.value)}
            className="w-full bg-transparent font-mono text-[22px] font-extrabold text-ink outline-none" placeholder="0.00" />
        </div>
        <div className={`mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] font-semibold ${
          varianceUi.tone === "ok" ? "bg-[#ECFDF5] text-[#047857]"
          : varianceUi.tone === "warn" ? "bg-[#FFFBEB] text-[#92400E]"
          : "bg-[#FEE2E2] text-[#B91C1C]"
        }`}>
          {varianceUi.tone === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {varianceUi.msg}
        </div>
      </section>

      {totals.cheques.length > 0 && (
        <section className="mb-4 rounded-2xl bg-white p-4 shadow-[0_1px_0_#E5E9EF]">
          <div className="text-[13px] font-extrabold text-ink">Cheques collected</div>
          <ul className="mt-2 space-y-1.5">
            {totals.cheques.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#E5E9EF] px-3 py-2 text-[12.5px]">
                <span className="font-mono font-bold text-ink">#{c.ref ?? "—"}</span>
                <span className="truncate text-muted-foreground">{c.payee}</span>
                <span className="font-mono font-bold text-ink">{formatBBD(c.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-4 rounded-2xl bg-white p-4 shadow-[0_1px_0_#E5E9EF]">
        <label className="text-[13px] font-extrabold text-ink">Anything to flag?</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
          placeholder="Vehicle issues, customer complaints, missing items…"
          className="mt-2 w-full rounded-xl border border-[#E5E9EF] bg-white p-3 text-[13.5px] text-ink outline-none focus:border-[#10B981]" />
      </section>

      <button type="button" onClick={submit} disabled={submitting}
        className="flex h-14 w-full items-center justify-center rounded-xl bg-[#FF6A1A] text-[16px] font-extrabold text-white shadow-lg disabled:opacity-50">
        {submitting ? "Submitting…" : "Submit end of shift"}
      </button>
    </DeliveryShell>
  );
}

function Box({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: tint }}>
      <div className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-[14.5px] font-extrabold text-ink">{value}</div>
    </div>
  );
}
