import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Pencil, AlertTriangle } from "lucide-react";
import { AppHeader } from "@/components/abl/AppHeader";
import { ProductImageFallback } from "@/components/abl/ProductImageFallback";
import { useCart } from "@/hooks/use-cart";
import { formatBBD, splitVatInclusive } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/shop/checkout")({ component: CheckoutPage });

interface Customer {
  id: string;
  company_name: string;
  delivery_address: string | null;
  phone: string | null;
  credit_limit: number;
  current_balance: number;
  payment_terms_days: number;
}

function CheckoutPage() {
  const { lines, total, open: openCart, clearForCustomer, customerId } = useCart();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [notes, setNotes] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    if (!customerId) return;
    supabase
      .from("customers")
      .select("id, company_name, delivery_address, phone, credit_limit, current_balance, payment_terms_days")
      .eq("id", customerId)
      .maybeSingle()
      .then(({ data }) => setCustomer(data as Customer | null));
  }, [customerId]);

  const { subtotal, vat } = useMemo(() => splitVatInclusive(total), [total]);

  const availableCredit = customer
    ? Number(customer.credit_limit) - Number(customer.current_balance)
    : 0;
  const exceedsCredit = customer ? total > availableCredit : false;
  const canPlace = lines.length > 0 && lines.every((l) => Number.isInteger(l.quantity) && l.quantity > 0);

  const placeOrder = async () => {
    if (!customer || !canPlace) return;
    setPlacing(true);
    try {
      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          customer_id: customer.id,
          status: "pending_approval",
          subtotal,
          vat_amount: vat,
          total,
          delivery_notes: notes.trim() || null,
        })
        .select("id, order_number")
        .single();
      if (error) throw error;

      const items = lines.map((l) => ({
        order_id: order.id,
        product_id: l.product_id,
        quantity: l.quantity,
        unit_price_at_order: Number(l.product.case_price),
        line_total: Number(l.product.case_price) * l.quantity,
      }));
      const { error: itemsErr } = await supabase.from("order_items").insert(items);
      if (itemsErr) throw itemsErr;

      await clearForCustomer();
      setConfirmOpen(false);
      toast.success(`Order ${order.order_number} placed`, {
        description: "Our team will review shortly.",
        duration: 4000,
      });
      navigate({
        to: "/shop/orders/$orderNumber",
        params: { orderNumber: order.order_number! },
      });
    } catch (e: any) {
      console.error(e);
      toast.error(e.message ?? "Could not place order");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F7F9]">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Link
          to="/shop"
          className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-[#64748B] hover:text-[#0B1A2E]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to catalog
        </Link>

        <h1 className="text-[24px] font-extrabold tracking-tight text-[#0B1A2E]">Review order</h1>
        <p className="mt-1 text-[13px] text-[#64748B]">
          Check the details below, then place your order. Our team will confirm.
        </p>

        {lines.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-[#E5E9EF] bg-white p-12 text-center">
            <p className="text-[14px] text-[#64748B]">Your cart is empty.</p>
            <Link
              to="/shop"
              className="mt-3 inline-block text-[13px] font-semibold text-[#0F2540] hover:underline"
            >
              Go to catalog →
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
            {/* LEFT */}
            <div className="flex flex-col gap-5">
              {/* Deliver to */}
              <section className="rounded-xl border border-[#E5E9EF] bg-white p-5">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#64748B]">
                  Deliver to
                </h2>
                <div className="mt-2 text-[15px] font-bold text-[#0B1A2E]">
                  {customer?.company_name ?? "—"}
                </div>
                <div className="mt-1 whitespace-pre-line text-[13px] text-[#64748B]">
                  {customer?.delivery_address ?? "Address on file"}
                </div>
                {customer?.phone && (
                  <div className="mt-1 text-[12px] text-[#64748B]">{customer.phone}</div>
                )}
                <p className="mt-3 text-[11.5px] italic text-[#94A3B8]">
                  To change your delivery address, contact your sales rep.
                </p>
              </section>

              {/* Items */}
              <section className="rounded-xl border border-[#E5E9EF] bg-white">
                <div className="flex items-center justify-between border-b border-[#EEF1F5] px-5 py-4">
                  <h2 className="text-[13px] font-bold text-[#0B1A2E]">
                    Order items ({lines.length})
                  </h2>
                </div>
                <ul className="divide-y divide-[#EEF1F5]">
                  {lines.map((l) => {
                    const lineTotal = Number(l.product.case_price) * l.quantity;
                    return (
                      <li key={l.id} className="grid grid-cols-[60px_1fr_auto] gap-4 px-5 py-4">
                        <div className="h-[60px] w-[60px] overflow-hidden rounded-md border border-[#EEF1F5] bg-white">
                          {l.product.image_url ? (
                            <img
                              src={l.product.image_url}
                              alt={l.product.name}
                              className="h-full w-full object-contain p-1"
                            />
                          ) : (
                            <ProductImageFallback
                              sku={l.product.sku}
                              category={l.product.category}
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] font-bold text-[#0B1A2E]">{l.product.name}</div>
                          <div className="mt-0.5 text-[10.5px] text-[#64748B]">
                            {l.product.sku}
                          </div>
                          <div className="mt-1 inline-flex items-center gap-1 rounded-[5px] bg-[#F1F4F8] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#0F2540]">
                            {Number(l.product.pack_size).toLocaleString()} / {l.product.pack_unit}
                          </div>
                          <div className="mt-1 text-[11.5px] text-[#64748B]">
                            {l.quantity} × {formatBBD(Number(l.product.case_price))}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[13px] font-bold text-[#0B1A2E] tabular-nums">
                            {formatBBD(lineTotal)}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="border-t border-[#EEF1F5] px-5 py-3 text-right">
                  <button
                    type="button"
                    onClick={openCart}
                    className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#0F2540] hover:underline"
                  >
                    <Pencil className="h-3 w-3" /> Edit cart
                  </button>
                </div>
              </section>

              {/* Notes */}
              <section className="rounded-xl border border-[#E5E9EF] bg-white p-5">
                <h2 className="text-[13px] font-bold text-[#0B1A2E]">Notes for our team (optional)</h2>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                  placeholder="Gate code, preferred delivery time, special handling instructions..."
                  className="mt-3 h-28 w-full resize-none rounded-[8px] border border-[#E5E9EF] bg-[#FAFBFC] p-3 text-[13px] text-[#0B1A2E] outline-none placeholder:text-[#94A3B8] focus:border-[#0F2540] focus:bg-white"
                />
                <div className="mt-1 text-right text-[10.5px] text-[#94A3B8]">
                  {notes.length} / 500
                </div>
              </section>
            </div>

            {/* RIGHT */}
            <div className="lg:sticky lg:top-[100px] lg:self-start">
              <section className="rounded-xl border border-[#E5E9EF] bg-white p-5">
                <h2 className="text-[13px] font-bold text-[#0B1A2E]">Order summary</h2>

                <dl className="mt-4 space-y-1.5 text-[13px]">
                  <div className="flex justify-between text-[#64748B]">
                    <dt>Subtotal</dt>
                    <dd className="tabular-nums">{formatBBD(subtotal)}</dd>
                  </div>
                  <div className="flex justify-between text-[#94A3B8]">
                    <dt>VAT (17.5%) included</dt>
                    <dd className="tabular-nums">{formatBBD(vat)}</dd>
                  </div>
                </dl>
                <div className="mt-3 flex items-baseline justify-between border-t border-[#E5E9EF] pt-3">
                  <span className="text-[13px] font-semibold text-[#0B1A2E]">Total</span>
                  <span className="text-[20px] font-extrabold tracking-tight text-[#0F2540] tabular-nums">
                    {formatBBD(total)}
                  </span>
                </div>

                {customer && (
                  <div className="mt-4 rounded-[8px] bg-[#FAFBFC] p-3 text-[12px]">
                    <div className="font-semibold text-[#0B1A2E]">Charged to your account</div>
                    <div className="mt-0.5 text-[#64748B]">
                      {customer.company_name} · Net {customer.payment_terms_days} terms
                    </div>
                    <div className="mt-1.5 text-[#64748B]">
                      Available credit:{" "}
                      <span className="font-semibold text-[#0B1A2E]">
                        {formatBBD(Math.max(0, availableCredit))}
                      </span>
                    </div>
                    {exceedsCredit && (
                      <div className="mt-2 flex items-start gap-1.5 rounded-[6px] bg-[#FFFBEB] p-2 text-[11.5px] text-[#B45309]">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>
                          This order exceeds your available credit. Our team may follow up before approval.
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  disabled={!canPlace}
                  onClick={() => setConfirmOpen(true)}
                  className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-[10px] bg-[#FF6A1A] text-[14px] font-bold text-white transition hover:bg-[#E85F12] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Place order
                </button>
                <p className="mt-2 text-center text-[10.5px] text-[#94A3B8]">
                  You'll receive a confirmation. Our team typically approves orders within 1 hour during business hours.
                </p>

                <button
                  type="button"
                  onClick={openCart}
                  className="mt-3 inline-flex w-full items-center justify-center gap-1 text-[12px] font-semibold text-[#64748B] hover:text-[#0B1A2E]"
                >
                  ← Back to cart
                </button>
              </section>
            </div>
          </div>
        )}
      </main>

      {/* Confirm modal */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Place this order?</DialogTitle>
            <DialogDescription>
              Total <span className="font-bold text-[#0B1A2E]">{formatBBD(total)}</span> will be
              charged to {customer?.company_name ?? "your account"} on Net{" "}
              {customer?.payment_terms_days ?? 30} terms.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              disabled={placing}
              className="rounded-[8px] px-4 py-2 text-[13px] font-semibold text-[#64748B] hover:bg-[#FAFBFC]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={placeOrder}
              disabled={placing}
              className="rounded-[8px] bg-[#FF6A1A] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#E85F12] disabled:opacity-60"
            >
              {placing ? "Placing…" : "Yes, place order"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
