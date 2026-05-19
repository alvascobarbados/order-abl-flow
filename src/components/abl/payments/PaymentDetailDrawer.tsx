import { useEffect, useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBBD, formatDate } from "@/lib/format";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { PaymentMethodChip } from "./PaymentMethodChip";
import type { PaymentMethod, PaymentStatus } from "@/lib/payments";
import { toast } from "sonner";

type Payment = {
  id: string;
  payment_number: string | null;
  customer_id: string;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  status: PaymentStatus;
  cleared_at: string | null;
  created_at: string;
};
type Alloc = {
  id: string;
  amount: number;
  order_id: string | null;
  order_number: string | null;
  invoice_number: string | null;
  order_total: number | null;
};
type Customer = { id: string; company_name: string; customer_number: string | null };

interface Props {
  paymentId: string;
  onClose: () => void;
  onChanged?: () => void;
}

export function PaymentDetailDrawer({ paymentId, onClose, onChanged }: Props) {
  const [payment, setPayment] = useState<Payment | null>(null);
  const [allocs, setAllocs] = useState<Alloc[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [acting, setActing] = useState(false);
  const [confirm, setConfirm] = useState<null | { kind: "clear" | "bounce" | "cancel"; affectsOrders: number }>(null);

  const load = async () => {
    const { data: p } = await supabase.from("payments").select("*").eq("id", paymentId).maybeSingle();
    if (!p) return;
    setPayment(p as Payment);
    const { data: c } = await supabase
      .from("customers").select("id, company_name, customer_number").eq("id", (p as Payment).customer_id).maybeSingle();
    setCustomer(c as Customer | null);
    const { data: a } = await supabase
      .from("payment_allocations")
      .select("id, amount, order_id, order:orders(order_number, invoice_number, total)")
      .eq("payment_id", paymentId);
    setAllocs((a ?? []).map((r: any) => ({
      id: r.id, amount: Number(r.amount), order_id: r.order_id,
      order_number: r.order?.order_number ?? null,
      invoice_number: r.order?.invoice_number ?? null,
      order_total: r.order?.total != null ? Number(r.order.total) : null,
    })));
  };

  useEffect(() => { load(); }, [paymentId]);

  const updateStatus = async (newStatus: PaymentStatus) => {
    if (!payment) return;
    setActing(true);
    const patch: any = { status: newStatus };
    if (newStatus === "cleared") patch.cleared_at = new Date().toISOString();
    const { error } = await supabase.from("payments").update(patch).eq("id", payment.id);
    setActing(false);
    setConfirm(null);
    if (error) return toast.error(error.message);
    toast.success(`Payment marked as ${newStatus}`);
    load();
    onChanged?.();
  };

  if (!payment) {
    return (
      <div className="fixed inset-0 z-[60] bg-black/40">
        <div className="absolute right-0 top-0 flex h-full w-full max-w-[600px] flex-col bg-white p-6">
          <button onClick={onClose} className="self-end"><X className="h-5 w-5 text-[#64748B]" /></button>
        </div>
      </div>
    );
  }

  const allocatedToOrders = allocs.filter((a) => a.order_id);
  const onAccount = allocs.find((a) => !a.order_id);

  return (
    <div className="fixed inset-0 z-[60] bg-black/40" onClick={onClose}>
      <div
        className="absolute right-0 top-0 flex h-full w-full max-w-[600px] flex-col bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b border-[#E5E9EF] px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[18px] font-extrabold text-ink">{payment.payment_number}</span>
                <PaymentStatusBadge status={payment.status} />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-[28px] font-extrabold text-ink" style={{ letterSpacing: "-0.02em" }}>
                  {formatBBD(Number(payment.amount))}
                </span>
                <PaymentMethodChip method={payment.payment_method} />
              </div>
              {customer && (
                <div className="mt-1 text-[13px] text-[#64748B]">
                  from <span className="font-semibold text-ink">{customer.company_name}</span>
                  <span className="ml-2 font-mono text-[11px]">{customer.customer_number}</span>
                </div>
              )}
            </div>
            <button onClick={onClose} className="rounded-md p-1.5 text-[#64748B] hover:bg-[#F1F4F8] hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-[#E5E9EF] bg-[#FAFBFC] p-4 text-[12.5px]">
            <Meta k="Date received" v={formatDate(payment.payment_date)} />
            <Meta k="Recorded" v={new Date(payment.created_at).toLocaleString("en-GB")} />
            <Meta k="Reference" v={payment.reference || "—"} mono />
            <Meta k="Cleared at" v={payment.cleared_at ? new Date(payment.cleared_at).toLocaleString("en-GB") : "—"} />
          </div>

          {payment.notes && (
            <div className="rounded-lg border border-[#E5E9EF] bg-white p-3">
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[#64748B]">Internal notes</div>
              <p className="mt-1 whitespace-pre-line text-[13px] text-ink">{payment.notes}</p>
            </div>
          )}

          {/* Allocations */}
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Allocations</div>
            <div className="overflow-hidden rounded-xl border border-[#E5E9EF]">
              <table className="w-full text-[13px]">
                <thead className="bg-[#FAFBFC]">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10.5px] font-semibold uppercase text-[#64748B]" style={{ letterSpacing: "0.06em" }}>Invoice</th>
                    <th className="px-3 py-2 text-right text-[10.5px] font-semibold uppercase text-[#64748B]" style={{ letterSpacing: "0.06em" }}>Order total</th>
                    <th className="px-3 py-2 text-right text-[10.5px] font-semibold uppercase text-[#64748B]" style={{ letterSpacing: "0.06em" }}>Applied</th>
                  </tr>
                </thead>
                <tbody>
                  {allocatedToOrders.length === 0 && !onAccount && (
                    <tr><td colSpan={3} className="px-3 py-4 text-center text-[12px] text-muted-foreground">No allocations.</td></tr>
                  )}
                  {allocatedToOrders.map((a) => (
                    <tr key={a.id} className="border-t border-[#E5E9EF]">
                      <td className="px-3 py-2 text-[12px] font-semibold text-ink">
                        {a.invoice_number ?? a.order_number}
                      </td>
                      <td className="px-3 py-2 text-right text-[#64748B]">
                        {a.order_total != null ? formatBBD(a.order_total) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-ink">{formatBBD(a.amount)}</td>
                    </tr>
                  ))}
                  {onAccount && (
                    <tr className="border-t border-[#E5E9EF] bg-[#FFFBEB]">
                      <td className="px-3 py-2 text-[12.5px] font-semibold text-[#92400E]">On account (unallocated credit)</td>
                      <td className="px-3 py-2 text-right text-[#64748B]">—</td>
                      <td className="px-3 py-2 text-right font-semibold text-[#92400E]">{formatBBD(onAccount.amount)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Actions */}
        <footer className="border-t border-[#E5E9EF] bg-[#FAFBFC] px-6 py-3">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {payment.status === "pending" && (
              <>
                <button
                  onClick={() => setConfirm({ kind: "cancel", affectsOrders: 0 })}
                  className="rounded-lg border border-[#E5E9EF] bg-white px-3 py-2 text-[12.5px] font-semibold text-ink hover:bg-[#FAFBFC]"
                >Cancel payment</button>
                <button
                  onClick={() => setConfirm({ kind: "clear", affectsOrders: allocatedToOrders.length })}
                  className="rounded-lg px-3 py-2 text-[12.5px] font-semibold text-white"
                  style={{ backgroundColor: "#10B981" }}
                >Mark as cleared</button>
              </>
            )}
            {(payment.status === "pending" || payment.status === "cleared") && (
              <button
                onClick={() => setConfirm({ kind: "bounce", affectsOrders: allocatedToOrders.length })}
                className="rounded-lg border border-[#FECACA] bg-white px-3 py-2 text-[12.5px] font-semibold text-[#B91C1C] hover:bg-[#FEF2F2]"
              >Mark as bounced</button>
            )}
            {(payment.status === "bounced" || payment.status === "cancelled") && (
              <span className="text-[12px] text-[#64748B]">No actions available for {payment.status} payments.</span>
            )}
          </div>
        </footer>
      </div>

      {confirm && (
        <ConfirmModal
          kind={confirm.kind}
          affectsOrders={confirm.affectsOrders}
          paymentNumber={payment.payment_number ?? ""}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            if (confirm.kind === "clear") updateStatus("cleared");
            if (confirm.kind === "bounce") updateStatus("bounced");
            if (confirm.kind === "cancel") updateStatus("cancelled");
          }}
          loading={acting}
        />
      )}
    </div>
  );
}

function Meta({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wider text-[#64748B]">{k}</div>
      <div className={`mt-0.5 text-ink ${mono ? "" : ""}`}>{v}</div>
    </div>
  );
}

function ConfirmModal({
  kind, affectsOrders, paymentNumber, onConfirm, onCancel, loading,
}: {
  kind: "clear" | "bounce" | "cancel";
  affectsOrders: number;
  paymentNumber: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const cfg = {
    clear:  { title: `Mark ${paymentNumber} as cleared?`, body: `This will deposit the funds and may auto-mark ${affectsOrders} invoice(s) as paid.`, label: "Mark cleared", danger: false },
    bounce: { title: `Mark ${paymentNumber} as bounced?`, body: `Any invoices that became paid because of this payment (${affectsOrders}) will revert to invoiced. The customer's balance will recompute automatically.`, label: "Mark bounced", danger: true },
    cancel: { title: `Cancel ${paymentNumber}?`, body: "Allocations will be removed. The payment record stays for audit. This cannot be undone.", label: "Cancel payment", danger: true },
  }[kind];

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        {cfg.danger && (
          <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold text-[#B91C1C]">
            <AlertTriangle className="h-4 w-4" /> Warning
          </div>
        )}
        <h4 className="text-[15px] font-bold text-ink">{cfg.title}</h4>
        <p className="mt-2 text-[13px] text-[#64748B]">{cfg.body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-md border border-[#E5E9EF] bg-white px-3 py-2 text-[13px] font-semibold text-ink hover:bg-[#FAFBFC]">
            Back
          </button>
          <button
            disabled={loading}
            onClick={onConfirm}
            className="rounded-md px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: cfg.danger ? "#B91C1C" : "#10B981" }}
          >{loading ? "Working…" : cfg.label}</button>
        </div>
      </div>
    </div>
  );
}
