import { useEffect, useState } from "react";
import { Plus, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBBD, formatDate } from "@/lib/format";
import { PaymentStatusBadge } from "@/components/abl/payments/PaymentStatusBadge";
import { PaymentMethodChip } from "@/components/abl/payments/PaymentMethodChip";
import { RecordPaymentModal } from "@/components/abl/payments/RecordPaymentModal";
import { PaymentDetailDrawer } from "@/components/abl/payments/PaymentDetailDrawer";
import type { PaymentMethod, PaymentStatus } from "@/lib/payments";

type Payment = {
  id: string; payment_number: string | null;
  amount: number; payment_date: string;
  payment_method: PaymentMethod; reference: string | null;
  status: PaymentStatus;
};
type AllocSummary = Record<string, { orderNumbers: string[]; onAccount: boolean }>;
type Summary = {
  total_invoiced: number;
  total_paid: number;
  balance_owed: number;
  available_credit: number;
  last_payment_date: string | null;
  last_payment_amount: number | null;
  count_overdue_invoices: number;
};
type Invoice = {
  id: string;
  order_number: string | null;
  invoice_number: string | null;
  total: number;
  invoiced_at: string | null;
  due_date: Date | null;
  paid_so_far: number;
  outstanding: number;
};

interface Props {
  customerId: string;
  paymentTermsDays: number;
  onDataChanged?: () => void;
}

export function CustomerPaymentsTab({ customerId, paymentTermsDays, onDataChanged }: Props) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [allocSummary, setAllocSummary] = useState<AllocSummary>({});
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [recordOpen, setRecordOpen] = useState<{ open: boolean; orderId?: string }>({ open: false });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const load = async () => {
    const [{ data: s }, { data: p }, { data: o }] = await Promise.all([
      supabase.from("customer_account_summary").select("*").eq("customer_id", customerId).maybeSingle(),
      supabase.from("payments").select("id, payment_number, amount, payment_date, payment_method, reference, status")
        .eq("customer_id", customerId).order("payment_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("orders").select("id, order_number, invoice_number, total, invoiced_at, status")
        .eq("customer_id", customerId).eq("status", "invoiced"),
    ]);
    setSummary(s as Summary | null);
    const paymentRows = (p ?? []).map((r: any) => ({ ...r, amount: Number(r.amount) })) as Payment[];
    setPayments(paymentRows);

    // Fetch allocations for these payments
    if (paymentRows.length) {
      const { data: a } = await supabase
        .from("payment_allocations")
        .select("payment_id, amount, order:orders(order_number, invoice_number)")
        .in("payment_id", paymentRows.map((x) => x.id));
      const map: AllocSummary = {};
      (a ?? []).forEach((r: any) => {
        const k = r.payment_id;
        if (!map[k]) map[k] = { orderNumbers: [], onAccount: false };
        if (r.order) {
          map[k].orderNumbers.push(r.order.invoice_number ?? r.order.order_number);
        } else {
          map[k].onAccount = true;
        }
      });
      setAllocSummary(map);
    } else {
      setAllocSummary({});
    }

    // Build invoice list with outstanding amounts
    const ids = (o ?? []).map((x: any) => x.id);
    let paidMap: Record<string, number> = {};
    if (ids.length) {
      const { data: allocs } = await supabase
        .from("payment_allocations")
        .select("order_id, amount, payment:payments!inner(status)")
        .in("order_id", ids);
      (allocs ?? []).forEach((r: any) => {
        if (r.payment?.status === "cleared") {
          paidMap[r.order_id] = (paidMap[r.order_id] ?? 0) + Number(r.amount);
        }
      });
    }
    const list: Invoice[] = (o ?? []).map((r: any) => {
      const paid = paidMap[r.id] ?? 0;
      const invAt = r.invoiced_at ? new Date(r.invoiced_at) : null;
      const due = invAt ? new Date(invAt.getTime() + paymentTermsDays * 86400_000) : null;
      return {
        id: r.id, order_number: r.order_number, invoice_number: r.invoice_number,
        total: Number(r.total), invoiced_at: r.invoiced_at, due_date: due,
        paid_so_far: paid, outstanding: Math.max(0, Number(r.total) - paid),
      };
    }).filter((x) => x.outstanding > 0.001)
      .sort((a, b) => (a.invoiced_at ?? "").localeCompare(b.invoiced_at ?? ""));
    setInvoices(list);
  };

  useEffect(() => { load(); }, [customerId]);

  const balance = Number(summary?.balance_owed ?? 0);
  const balColor = balance <= 0 ? "#047857"
    : (summary?.count_overdue_invoices ?? 0) > 0 ? "#B91C1C" : "#B45309";

  const pageRows = payments.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(payments.length / PAGE_SIZE));

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total paid (lifetime)" value={formatBBD(Number(summary?.total_paid ?? 0))} />
        <StatCard label="Total invoiced (lifetime)" value={formatBBD(Number(summary?.total_invoiced ?? 0))} />
        <StatCard label="Balance owed" value={formatBBD(balance)} valueClass="text-[18px]" valueColor={balColor} />
        <StatCard
          label="Last payment"
          value={summary?.last_payment_date
            ? `${formatBBD(Number(summary.last_payment_amount ?? 0))}`
            : "No payments yet"}
          sub={summary?.last_payment_date ? `on ${formatDate(summary.last_payment_date)}` : undefined}
        />
      </div>

      {/* Two columns */}
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        {/* Recent payments */}
        <div className="rounded-xl border border-[#E5E9EF] bg-white">
          <header className="flex items-center justify-between border-b border-[#E5E9EF] px-4 py-3">
            <h3 className="text-[13px] font-bold text-ink">Recent payments</h3>
            <button
              onClick={() => setRecordOpen({ open: true })}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-white"
              style={{ backgroundColor: "#FF6A1A" }}
            >
              <Plus className="h-3.5 w-3.5" /> Record payment
            </button>
          </header>
          {payments.length === 0 ? (
            <div className="py-10 text-center text-[12.5px] text-muted-foreground">No payments recorded yet.</div>
          ) : (
            <>
              <table className="w-full text-[12.5px]">
                <thead className="bg-[#FAFBFC]">
                  <tr>
                    {["Payment #", "Date", "Amount", "Method", "Status", "Allocated to"].map((h, i) => (
                      <th key={i} className={`px-3 py-2 text-[10px] font-semibold uppercase text-[#64748B] ${i === 2 ? "text-right" : "text-left"}`} style={{ letterSpacing: "0.06em" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((p) => {
                    const al = allocSummary[p.id] ?? { orderNumbers: [], onAccount: false };
                    return (
                      <tr key={p.id} className="cursor-pointer border-t border-[#E5E9EF] hover:bg-[#FAFBFC]" onClick={() => setDetailId(p.id)}>
                        <td className="px-3 py-2 font-mono font-semibold text-ink">{p.payment_number}</td>
                        <td className="px-3 py-2 text-[#64748B]">{formatDate(p.payment_date)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-ink">{formatBBD(Number(p.amount))}</td>
                        <td className="px-3 py-2"><PaymentMethodChip method={p.payment_method} /></td>
                        <td className="px-3 py-2"><PaymentStatusBadge status={p.status} /></td>
                        <td className="px-3 py-2">
                          {al.orderNumbers.length === 0 && al.onAccount && (
                            <span className="font-semibold text-[#B45309]">On account</span>
                          )}
                          {al.orderNumbers.length > 0 && (
                            <span className="text-[11.5px] text-ink">
                              {al.orderNumbers.slice(0, 2).join(", ")}
                              {al.orderNumbers.length > 2 && (
                                <span className="ml-1 text-[10.5px] font-semibold text-[#FF6A1A]">+{al.orderNumbers.length - 2} more</span>
                              )}
                              {al.onAccount && <span className="ml-1 text-[10.5px] text-[#B45309]">+ on acct</span>}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-[#E5E9EF] px-4 py-2 text-[11.5px]">
                  <span className="text-[#64748B]">Page {page + 1} of {totalPages}</span>
                  <div className="flex gap-1">
                    <button disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-md border border-[#E5E9EF] bg-white px-2 py-1 font-semibold disabled:opacity-40">Prev</button>
                    <button disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)} className="rounded-md border border-[#E5E9EF] bg-white px-2 py-1 font-semibold disabled:opacity-40">Next</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Outstanding invoices */}
        <div className="rounded-xl border border-[#E5E9EF] bg-white">
          <header className="border-b border-[#E5E9EF] px-4 py-3">
            <h3 className="text-[13px] font-bold text-ink">Outstanding invoices ({invoices.length})</h3>
          </header>
          {invoices.length === 0 ? (
            <div className="grid place-items-center py-10 text-center">
              <CheckCircle2 className="h-8 w-8 text-[#10B981]" />
              <div className="mt-2 text-[12.5px] font-semibold text-ink">All invoices paid</div>
              <div className="text-[11px] text-muted-foreground">Account is clear.</div>
            </div>
          ) : (
            <ul className="divide-y divide-[#E5E9EF]">
              {invoices.map((inv) => {
                const now = Date.now();
                let border = "#10B981"; // green
                let dueLabel = inv.due_date ? formatDate(inv.due_date) : "—";
                let dueColor = "#64748B";
                if (inv.due_date) {
                  const diff = inv.due_date.getTime() - now;
                  if (diff < 0) { border = "#EF4444"; dueColor = "#B91C1C"; }
                  else if (diff < 7 * 86400_000) { border = "#F59E0B"; dueColor = "#B45309"; }
                }
                return (
                  <li key={inv.id} className="flex items-center justify-between px-4 py-3" style={{ borderLeft: `3px solid ${border}` }}>
                    <div>
                      <div className="font-mono text-[12.5px] font-semibold text-ink">{inv.invoice_number ?? inv.order_number}</div>
                      <div className="text-[10.5px] text-[#64748B]">
                        {formatDate(inv.invoiced_at)} · due <span style={{ color: dueColor, fontWeight: 600 }}>{dueLabel}</span>
                      </div>
                      <button
                        onClick={() => setRecordOpen({ open: true, orderId: inv.id })}
                        className="mt-1 text-[11px] font-semibold text-[#FF6A1A] hover:underline"
                      >
                        Apply payment →
                      </button>
                    </div>
                    <div className="text-right">
                      <div className="text-[13px] font-bold text-ink">{formatBBD(inv.outstanding)}</div>
                      <div className="text-[10.5px] text-[#64748B]">
                        of {formatBBD(inv.total)}
                        {inv.paid_so_far > 0 && ` · ${formatBBD(inv.paid_so_far)} paid`}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <RecordPaymentModal
        open={recordOpen.open}
        customerId={customerId}
        preAllocateOrderId={recordOpen.orderId}
        onClose={() => setRecordOpen({ open: false })}
        onSuccess={() => { load(); onDataChanged?.(); }}
      />
      {detailId && (
        <PaymentDetailDrawer
          paymentId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={() => { load(); onDataChanged?.(); }}
        />
      )}
    </div>
  );
}

function StatCard({
  label, value, sub, valueClass, valueColor,
}: { label: string; value: string; sub?: string; valueClass?: string; valueColor?: string }) {
  return (
    <div className="rounded-xl border border-[#E5E9EF] bg-white p-3">
      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[#64748B]">{label}</div>
      <div className={`mt-1.5 font-extrabold text-ink ${valueClass ?? "text-[16px]"}`} style={{ letterSpacing: "-0.02em", color: valueColor }}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[10.5px] text-[#64748B]">{sub}</div>}
    </div>
  );
}
