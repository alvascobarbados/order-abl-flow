import { useEffect, useMemo, useState } from "react";
import { X, Search, Check, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBBD, formatDate } from "@/lib/format";
import {
  PAYMENT_METHODS, defaultStatusForMethod, referenceLabel,
  type PaymentMethod, type PaymentStatus,
} from "@/lib/payments";
import { toast } from "sonner";

type CustomerOpt = { id: string; company_name: string; customer_number: string | null };
type Invoice = {
  id: string;
  order_number: string | null;
  invoice_number: string | null;
  total: number;
  invoiced_at: string | null;
  paid_so_far: number;
  outstanding: number;
};

type Allocation = { order_id: string; amount: number };
type Mode = "auto" | "manual" | "on_account";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: (paymentId: string, paymentNumber: string) => void;
  /** lock to a customer */
  customerId?: string;
  /** pre-select an invoice to allocate to */
  preAllocateOrderId?: string;
}

export function RecordPaymentModal({ open, onClose, onSuccess, customerId, preAllocateOrderId }: Props) {
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customerId ?? "");
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustList, setShowCustList] = useState(false);

  const [amount, setAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [status, setStatus] = useState<PaymentStatus>("cleared");
  const [statusOverridden, setStatusOverridden] = useState(false);
  const [notes, setNotes] = useState("");

  const [mode, setMode] = useState<Mode>(preAllocateOrderId ? "manual" : "auto");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [manualAlloc, setManualAlloc] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setSelectedCustomerId(customerId ?? "");
    setCustomerSearch("");
    setAmount("");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setMethod("cash");
    setReference("");
    setStatus("cleared");
    setStatusOverridden(false);
    setNotes("");
    setMode(preAllocateOrderId ? "manual" : "auto");
    setManualAlloc({});
  }, [open, customerId, preAllocateOrderId]);

  // Load customers list
  useEffect(() => {
    if (!open || customerId) return;
    supabase
      .from("customers")
      .select("id, company_name, customer_number")
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("company_name")
      .then(({ data }) => setCustomers((data ?? []) as CustomerOpt[]));
  }, [open, customerId]);

  // Load outstanding invoices for selected customer
  useEffect(() => {
    if (!open || !selectedCustomerId) { setInvoices([]); return; }
    (async () => {
      const { data: orders } = await supabase
        .from("orders")
        .select("id, order_number, invoice_number, total, invoiced_at, status")
        .eq("customer_id", selectedCustomerId)
        .eq("status", "invoiced")
        .order("invoiced_at", { ascending: true });

      const ids = (orders ?? []).map((o) => o.id);
      let paidMap: Record<string, number> = {};
      if (ids.length) {
        const { data: allocs } = await supabase
          .from("payment_allocations")
          .select("order_id, amount, payment:payments!inner(status)")
          .in("order_id", ids);
        (allocs ?? []).forEach((a: any) => {
          if (a.payment?.status === "cleared") {
            paidMap[a.order_id] = (paidMap[a.order_id] ?? 0) + Number(a.amount);
          }
        });
      }
      const list: Invoice[] = (orders ?? []).map((o: any) => {
        const paid = paidMap[o.id] ?? 0;
        return {
          id: o.id,
          order_number: o.order_number,
          invoice_number: o.invoice_number,
          total: Number(o.total),
          invoiced_at: o.invoiced_at,
          paid_so_far: paid,
          outstanding: Math.max(0, Number(o.total) - paid),
        };
      }).filter((i) => i.outstanding > 0.001);
      setInvoices(list);
      if (preAllocateOrderId) {
        const inv = list.find((i) => i.id === preAllocateOrderId);
        if (inv) {
          setManualAlloc({ [inv.id]: inv.outstanding.toFixed(2) });
          setAmount(inv.outstanding.toFixed(2));
        }
      }
    })();
  }, [open, selectedCustomerId, preAllocateOrderId]);

  // Method change resets default status (unless user overrode)
  useEffect(() => {
    if (!statusOverridden) setStatus(defaultStatusForMethod(method));
  }, [method, statusOverridden]);

  const amountNum = parseFloat(amount) || 0;
  const refLabel = referenceLabel(method);

  // Auto allocation preview
  const autoAllocations: { invoice: Invoice; applied: number; remaining: number }[] = useMemo(() => {
    if (mode !== "auto") return [];
    let left = amountNum;
    const out: { invoice: Invoice; applied: number; remaining: number }[] = [];
    for (const inv of invoices) {
      const apply = Math.min(left, inv.outstanding);
      out.push({ invoice: inv, applied: apply, remaining: inv.outstanding - apply });
      left -= apply;
      if (left <= 0.001) break;
    }
    return out;
  }, [mode, amountNum, invoices]);

  const totalAllocated = useMemo(() => {
    if (mode === "on_account") return 0;
    if (mode === "auto") return autoAllocations.reduce((s, a) => s + a.applied, 0);
    return Object.values(manualAlloc).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  }, [mode, autoAllocations, manualAlloc]);

  const remainingUnallocated = amountNum - totalAllocated;

  // Validation
  const issues: string[] = [];
  if (!selectedCustomerId) issues.push("Select a customer");
  if (amountNum <= 0) issues.push("Amount must be greater than zero");
  if (paymentDate > new Date().toISOString().slice(0, 10)) issues.push("Payment date can't be in the future");
  if (mode !== "on_account" && Math.abs(remainingUnallocated) > 0.01) {
    issues.push(`Allocations must equal payment amount (off by ${formatBBD(Math.abs(remainingUnallocated))})`);
  }
  if (mode === "manual") {
    for (const inv of invoices) {
      const v = parseFloat(manualAlloc[inv.id] ?? "0") || 0;
      if (v > inv.outstanding + 0.01) {
        issues.push(`Allocation to ${inv.invoice_number ?? inv.order_number} exceeds outstanding ${formatBBD(inv.outstanding)}`);
        break;
      }
    }
  }
  if (refLabel.required && !reference.trim()) issues.push(`${refLabel.label} is required`);

  const warnings: string[] = [];
  if (method === "cheque" && !reference.trim()) warnings.push("Recording a cheque without a number — please add the cheque # if you have it.");

  const canSubmit = issues.length === 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { data: payment, error } = await supabase
        .from("payments")
        .insert({
          customer_id: selectedCustomerId,
          amount: amountNum,
          payment_date: paymentDate,
          payment_method: method,
          reference: reference.trim() || null,
          notes: notes.trim() || null,
          status,
        })
        .select()
        .single();
      if (error || !payment) throw error;

      // Build allocations
      let allocsToInsert: { payment_id: string; order_id: string | null; amount: number }[] = [];
      if (mode === "on_account") {
        allocsToInsert.push({ payment_id: payment.id, order_id: null, amount: amountNum });
      } else if (mode === "auto") {
        allocsToInsert = autoAllocations
          .filter((a) => a.applied > 0.001)
          .map((a) => ({ payment_id: payment.id, order_id: a.invoice.id, amount: Math.round(a.applied * 100) / 100 }));
        const allocSum = allocsToInsert.reduce((s, a) => s + a.amount, 0);
        const remainder = Math.round((amountNum - allocSum) * 100) / 100;
        if (remainder > 0.001) {
          allocsToInsert.push({ payment_id: payment.id, order_id: null, amount: remainder });
        }
      } else {
        // manual
        for (const inv of invoices) {
          const v = parseFloat(manualAlloc[inv.id] ?? "0") || 0;
          if (v > 0.001) allocsToInsert.push({ payment_id: payment.id, order_id: inv.id, amount: Math.round(v * 100) / 100 });
        }
        const allocSum = allocsToInsert.reduce((s, a) => s + a.amount, 0);
        const remainder = Math.round((amountNum - allocSum) * 100) / 100;
        if (remainder > 0.001) {
          allocsToInsert.push({ payment_id: payment.id, order_id: null, amount: remainder });
        }
      }

      if (allocsToInsert.length) {
        const { error: allocErr } = await supabase.from("payment_allocations").insert(allocsToInsert);
        if (allocErr) throw allocErr;
      }

      toast.success(`Payment ${payment.payment_number} recorded · ${formatBBD(amountNum)} applied`);
      onSuccess?.(payment.id, payment.payment_number);
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const lockedCustomer = customers.find((c) => c.id === selectedCustomerId)
    ?? (customerId ? { id: customerId, company_name: "Loading…", customer_number: null } : null);

  const filteredCust = customers.filter((c) =>
    !customerSearch.trim() ||
    c.company_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.customer_number ?? "").toLowerCase().includes(customerSearch.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        {/* Sticky header */}
        <header className="flex items-center justify-between border-b border-[#E5E9EF] px-6 py-4">
          <div>
            <h3 className="text-[18px] font-extrabold text-ink" style={{ letterSpacing: "-0.015em" }}>
              Record payment
            </h3>
            {lockedCustomer && customerId && (
              <div className="mt-0.5 text-[12.5px] text-[#64748B]">
                For <span className="font-semibold text-ink">{lockedCustomer.company_name}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-[#64748B] hover:bg-[#F1F4F8] hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Section 1 */}
          <div className="space-y-4">
            <Section title="Payment details">
              {!customerId && (
                <div>
                  <Label>Customer *</Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]" />
                    <input
                      value={selectedCustomerId
                        ? customers.find((c) => c.id === selectedCustomerId)?.company_name ?? ""
                        : customerSearch}
                      onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomerId(""); setShowCustList(true); }}
                      onFocus={() => setShowCustList(true)}
                      placeholder="Search customer…"
                      className="h-10 w-full rounded-lg border border-[#E5E9EF] bg-white pl-9 pr-3 text-[13px] outline-none focus:border-[#0F2540]"
                    />
                    {showCustList && !selectedCustomerId && (
                      <div className="absolute z-30 mt-1 max-h-[240px] w-full overflow-y-auto rounded-lg border border-[#E5E9EF] bg-white shadow-lg">
                        {filteredCust.length === 0 ? (
                          <div className="px-3 py-2 text-[12px] text-muted-foreground">No matches</div>
                        ) : filteredCust.slice(0, 50).map((c) => (
                          <button
                            key={c.id}
                            onClick={() => { setSelectedCustomerId(c.id); setShowCustList(false); }}
                            className="block w-full px-3 py-2 text-left text-[12.5px] hover:bg-[#FAFBFC]"
                          >
                            <span className="font-semibold text-ink">{c.company_name}</span>
                            <span className="ml-2 font-mono text-[10.5px] text-[#64748B]">{c.customer_number}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Amount (BBD$) *</Label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="h-11 w-full rounded-lg border border-[#E5E9EF] bg-white px-3 text-[18px] font-extrabold text-ink outline-none focus:border-[#0F2540]"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  />
                </div>
                <div>
                  <Label>Payment date *</Label>
                  <input
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="h-11 w-full rounded-lg border border-[#E5E9EF] bg-white px-3 text-[13px] outline-none focus:border-[#0F2540]"
                  />
                </div>
              </div>

              <div>
                <Label>Method *</Label>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map((m) => {
                    const Icon = m.icon;
                    const active = method === m.value;
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => { setMethod(m.value); setStatusOverridden(false); }}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[12.5px] font-semibold transition ${
                          active
                            ? "border-[#0B1A2E] bg-[#0B1A2E] text-white"
                            : "border-[#E5E9EF] bg-white text-ink hover:bg-[#FAFBFC]"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{refLabel.label}{refLabel.required && " *"}</Label>
                  <input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="h-10 w-full rounded-lg border border-[#E5E9EF] bg-white px-3 text-[13px] font-mono outline-none focus:border-[#0F2540]"
                  />
                </div>
                <div>
                  <Label>Status</Label>
                  <select
                    value={status}
                    onChange={(e) => { setStatus(e.target.value as PaymentStatus); setStatusOverridden(true); }}
                    className="h-10 w-full rounded-lg border border-[#E5E9EF] bg-white px-3 text-[13px] outline-none focus:border-[#0F2540]"
                  >
                    <option value="cleared">Cleared</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>

              <div>
                <Label>Internal notes (optional)</Label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-[#E5E9EF] bg-white p-2.5 text-[13px] outline-none focus:border-[#0F2540]"
                />
              </div>
            </Section>

            {/* Section 2: allocation */}
            <Section title="How to apply this payment?">
              <div className="flex gap-1.5">
                {(["auto", "manual", "on_account"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-[12.5px] font-semibold transition ${
                      mode === m
                        ? "border-[#FF6A1A] bg-[#FFF4EC] text-[#9A3412]"
                        : "border-[#E5E9EF] bg-white text-ink hover:bg-[#FAFBFC]"
                    }`}
                  >
                    {m === "auto" ? "Auto-apply (oldest first)" : m === "manual" ? "Manual" : "On account"}
                  </button>
                ))}
              </div>

              {mode === "on_account" && (
                <div className="rounded-lg border border-dashed border-[#E5E9EF] bg-[#FAFBFC] p-4 text-[12.5px] text-[#64748B]">
                  This payment will sit as an unallocated credit on the customer's account. You can apply it to a future invoice anytime.
                </div>
              )}

              {mode === "auto" && (
                <div className="rounded-lg border border-[#E5E9EF] bg-[#FAFBFC] p-3">
                  {invoices.length === 0 ? (
                    <p className="py-2 text-center text-[12.5px] text-muted-foreground">
                      No outstanding invoices — the full amount will sit on account.
                    </p>
                  ) : amountNum <= 0 ? (
                    <p className="py-2 text-center text-[12.5px] text-muted-foreground">Enter an amount to see allocation preview.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {autoAllocations.map(({ invoice, applied, remaining }) => {
                        const isFull = applied >= invoice.outstanding - 0.001;
                        return (
                          <li key={invoice.id} className="flex items-center justify-between text-[12.5px]">
                            <span className="font-mono text-ink">
                              {formatBBD(applied)} → {invoice.invoice_number ?? invoice.order_number}
                            </span>
                            <span className={`text-[11px] ${isFull ? "text-[#047857]" : "text-[#B45309]"}`}>
                              {applied === 0 ? "untouched" : isFull ? "fully paid" : `partial — ${formatBBD(remaining)} still owed`}
                            </span>
                          </li>
                        );
                      })}
                      {remainingUnallocated > 0.001 && (
                        <li className="border-t border-[#E5E9EF] pt-1.5 text-[12px] text-[#B45309]">
                          {formatBBD(remainingUnallocated)} will sit on account
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              )}

              {mode === "manual" && (
                <div className="rounded-lg border border-[#E5E9EF]">
                  {invoices.length === 0 ? (
                    <div className="p-4 text-center text-[12.5px] text-muted-foreground">No outstanding invoices.</div>
                  ) : (
                    <table className="w-full text-[12.5px]">
                      <thead className="bg-[#FAFBFC]">
                        <tr>
                          <th className="px-3 py-2 text-left text-[10.5px] font-semibold uppercase text-[#64748B]" style={{ letterSpacing: "0.06em" }}>Invoice</th>
                          <th className="px-3 py-2 text-right text-[10.5px] font-semibold uppercase text-[#64748B]" style={{ letterSpacing: "0.06em" }}>Outstanding</th>
                          <th className="px-3 py-2 text-right text-[10.5px] font-semibold uppercase text-[#64748B]" style={{ letterSpacing: "0.06em" }}>Apply</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map((inv) => (
                          <tr key={inv.id} className="border-t border-[#E5E9EF]">
                            <td className="px-3 py-2">
                              <div className="font-mono font-semibold text-ink">{inv.invoice_number ?? inv.order_number}</div>
                              <div className="text-[10.5px] text-[#64748B]">{formatDate(inv.invoiced_at)}</div>
                            </td>
                            <td className="px-3 py-2 text-right font-mono">{formatBBD(inv.outstanding)}</td>
                            <td className="px-3 py-2 text-right">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max={inv.outstanding}
                                value={manualAlloc[inv.id] ?? ""}
                                onChange={(e) => setManualAlloc({ ...manualAlloc, [inv.id]: e.target.value })}
                                placeholder="0.00"
                                className="h-8 w-[100px] rounded-md border border-[#E5E9EF] bg-white px-2 text-right font-mono text-[12px] outline-none focus:border-[#0F2540]"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {mode !== "on_account" && (
                <div className="flex items-center justify-between rounded-lg bg-[#FAFBFC] px-3 py-2 text-[12.5px]">
                  <span className="text-[#64748B]">Total allocated</span>
                  <span className="font-semibold">
                    <span className="font-mono">{formatBBD(totalAllocated)}</span>
                    <span className="mx-1 text-[#94A3B8]">of</span>
                    <span className="font-mono">{formatBBD(amountNum)}</span>
                    {Math.abs(remainingUnallocated) < 0.01 && amountNum > 0
                      ? <Check className="ml-2 inline h-3.5 w-3.5 text-[#10B981]" />
                      : amountNum > 0
                        ? <AlertCircle className="ml-2 inline h-3.5 w-3.5 text-[#F59E0B]" />
                        : null}
                  </span>
                </div>
              )}
            </Section>

            {warnings.length > 0 && (
              <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-2.5 text-[12px] text-[#92400E]">
                {warnings.map((w) => <div key={w}>⚠ {w}</div>)}
              </div>
            )}
            {issues.length > 0 && amountNum > 0 && (
              <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-2.5 text-[12px] text-[#B91C1C]">
                {issues.map((w) => <div key={w}>• {w}</div>)}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between gap-3 border-t border-[#E5E9EF] bg-[#FAFBFC] px-6 py-3">
          <span className="text-[10.5px] text-[#94A3B8]">Payment will appear in the customer's account immediately</span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-[#E5E9EF] bg-white px-4 py-2 text-[13px] font-semibold text-ink hover:bg-[#FAFBFC]"
            >Cancel</button>
            <button
              disabled={!canSubmit}
              onClick={handleSubmit}
              className="rounded-lg px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: "#FF6A1A" }}
            >{submitting ? "Recording…" : "Record payment"}</button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#E5E9EF] bg-white p-4">
      <h4 className="text-[13px] font-bold text-ink">{title}</h4>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-[11px] font-semibold text-ink">{children}</label>;
}
