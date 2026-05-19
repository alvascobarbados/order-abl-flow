import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBBD } from "@/lib/format";
import { Modal, ModalFooter } from "./OrderActionModals";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

type Customer = { id: string; company_name: string; current_balance: number; credit_limit: number; payment_terms_days: number; delivery_address: string | null };
type Product = { id: string; name: string; sku: string; pack_size: number; unit_price: number; case_price: number; primary_image_url: string | null; image_url: string | null };

export function NewOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: (orderId: string) => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("customers").select("id, company_name, current_balance, credit_limit, payment_terms_days, delivery_address").is("deleted_at", null).order("company_name").then(({ data }) => setCustomers((data as any) ?? []));
    supabase.from("products").select("id, name, sku, pack_size, unit_price, case_price, primary_image_url, image_url").eq("is_active", true).order("name").then(({ data }) => setProducts((data as any) ?? []));
  }, []);

  const customer = customers.find((c) => c.id === customerId) ?? null;

  const filteredCustomers = useMemo(
    () => customers.filter((c) => c.company_name.toLowerCase().includes(customerSearch.toLowerCase())),
    [customers, customerSearch],
  );
  const filteredProducts = useMemo(
    () => products.filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase())).slice(0, 25),
    [products, productSearch],
  );

  const cartLines = Object.entries(cart)
    .map(([pid, qty]) => ({ product: products.find((p) => p.id === pid)!, qty }))
    .filter((l) => l.product && l.qty > 0);
  const total = cartLines.reduce((s, l) => s + Number(l.product.case_price) * l.qty, 0);

  const insufficientCredit = customer && (Number(customer.current_balance) + total > Number(customer.credit_limit));

  const placeOrder = async () => {
    if (!customer || cartLines.length === 0) return;
    setBusy(true);
    const VAT = 0.175;
    const subtotal = Math.round((total / (1 + VAT)) * 100) / 100;
    const vat = Math.round((total - subtotal) * 100) / 100;
    const { data: ord, error } = await supabase
      .from("orders")
      .insert({
        customer_id: customer.id,
        status: "approved" as const,
        subtotal, vat_amount: vat, total,
        delivery_notes: deliveryNotes || null,
        placed_on_behalf: true,
        approved_at: new Date().toISOString(),
      } as any)
      .select("id")
      .single();
    if (error || !ord) { setBusy(false); toast.error(error?.message ?? "Could not create order"); return; }

    const items = cartLines.map((l) => ({
      order_id: ord.id, product_id: l.product.id, quantity: l.qty,
      unit_price_at_order: Number(l.product.case_price),
      line_total: Math.round(Number(l.product.case_price) * l.qty * 100) / 100,
    }));
    const { error: ierr } = await supabase.from("order_items").insert(items as any);
    setBusy(false);
    if (ierr) { toast.error(ierr.message); return; }
    toast.success("Order placed on behalf of customer");
    onCreated(ord.id);
  };

  return (
    <Modal title={`New order · Step ${step} of 3`} onClose={onClose} width={680}>
      <div className="flex items-center gap-2 border-b border-border bg-secondary/30 px-5 py-2 text-[11.5px] font-semibold text-muted-foreground">
        <StepPill n={1} label="Customer" active={step >= 1} />
        <span>→</span><StepPill n={2} label="Items" active={step >= 2} />
        <span>→</span><StepPill n={3} label="Confirm" active={step >= 3} />
      </div>

      <div className="min-h-[320px] px-5 py-4">
        {step === 1 && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Search customers…" autoFocus
                className="w-full rounded-md border border-border bg-card py-2 pl-8 pr-3 text-[13px] text-ink focus:border-ink focus:outline-none" />
            </div>
            <div className="max-h-[280px] overflow-y-auto rounded-md border border-border">
              {filteredCustomers.map((c) => {
                const sel = c.id === customerId;
                return (
                  <button key={c.id} onClick={() => setCustomerId(c.id)}
                    className={`flex w-full items-center justify-between border-b border-border px-3 py-2 text-left text-[13px] hover:bg-secondary ${sel ? "bg-secondary" : ""}`}>
                    <span className="font-semibold text-ink">{c.company_name}</span>
                    <span className="text-[11.5px] text-muted-foreground">
                      Bal {formatBBD(Number(c.current_balance))} · Limit {formatBBD(Number(c.credit_limit))}
                    </span>
                  </button>
                );
              })}
            </div>
            {customer && Number(customer.current_balance) >= Number(customer.credit_limit) * 0.8 && (
              <div className="rounded-md border border-[#FEF3C7] bg-[#FFFBEB] px-3 py-2 text-[12px] text-[#B45309]">
                Heads up: this customer is close to or over their credit limit.
              </div>
            )}
          </div>
        )}
        {step === 2 && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Search products…"
                  className="w-full rounded-md border border-border bg-card py-2 pl-8 pr-3 text-[13px] text-ink focus:border-ink focus:outline-none" />
              </div>
              <div className="max-h-[280px] overflow-y-auto rounded-md border border-border">
                {filteredProducts.map((p) => (
                  <button key={p.id} onClick={() => setCart((c) => ({ ...c, [p.id]: (c[p.id] ?? 0) + 1 }))}
                    className="flex w-full items-center justify-between border-b border-border px-3 py-2 text-left text-[12.5px] hover:bg-secondary">
                    <div>
                      <div className="font-semibold text-ink">{p.name}</div>
                      <div className="font-mono text-[10.5px] text-muted-foreground">{p.sku} · pack {p.pack_size}</div>
                    </div>
                    <div className="text-right text-[11.5px]">
                      <div className="font-semibold">{formatBBD(Number(p.case_price))}</div>
                      <div className="text-muted-foreground">+ add</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase text-muted-foreground" style={{ letterSpacing: "0.08em" }}>Cart ({cartLines.length})</div>
              <div className="max-h-[280px] space-y-1.5 overflow-y-auto">
                {cartLines.length === 0 && <div className="rounded-md border border-dashed border-border p-6 text-center text-[12px] text-muted-foreground">No items yet</div>}
                {cartLines.map((l) => (
                  <div key={l.product.id} className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-[12px]">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-ink">{l.product.name}</div>
                      <div className="text-[10px] text-muted-foreground">{formatBBD(Number(l.product.case_price))}</div>
                    </div>
                    <input type="number" min={0} value={l.qty}
                      onChange={(e) => setCart((c) => ({ ...c, [l.product.id]: Math.max(0, parseInt(e.target.value) || 0) }))}
                      className="w-14 rounded border border-border px-1.5 py-0.5 text-right text-[12px]" />
                    <div className="w-20 text-right font-semibold">{formatBBD(Number(l.product.case_price) * l.qty)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-[13px]">
                <span className="text-muted-foreground">Running total</span>
                <span className="font-bold text-ink">{formatBBD(total)}</span>
              </div>
            </div>
          </div>
        )}
        {step === 3 && customer && (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="text-[11px] font-semibold uppercase text-muted-foreground" style={{ letterSpacing: "0.08em" }}>Customer</div>
              <div className="mt-0.5 font-semibold text-ink">{customer.company_name}</div>
              <div className="text-[12px] text-muted-foreground">{customer.delivery_address ?? "No delivery address"}</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="text-[11px] font-semibold uppercase text-muted-foreground" style={{ letterSpacing: "0.08em" }}>{cartLines.length} lines · {formatBBD(total)}</div>
              <ul className="mt-1.5 space-y-0.5 text-[12.5px]">
                {cartLines.map((l) => (
                  <li key={l.product.id} className="flex justify-between">
                    <span>{l.qty} × {l.product.name}</span>
                    <span className="font-semibold">{formatBBD(Number(l.product.case_price) * l.qty)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase text-muted-foreground" style={{ letterSpacing: "0.08em" }}>Delivery notes (optional)</span>
              <textarea value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} rows={2}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-[13px]" />
            </label>
            <div className="rounded-md border border-[#FEF3C7] bg-[#FFFBEB] px-3 py-2 text-[12px] text-[#B45309]">
              This order will appear in the customer's history marked as placed on behalf by office staff. It skips Pending and goes straight to Approved.
            </div>
            {insufficientCredit && (
              <div className="rounded-md border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#B91C1C]">
                This order would put the customer over their credit limit ({formatBBD(Number(customer.credit_limit))}).
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border bg-secondary/40 px-5 py-3">
        <button onClick={onClose} className="rounded-md border border-border bg-card px-3 py-1.5 text-[12.5px] font-semibold text-ink hover:bg-secondary">Cancel</button>
        <div className="flex gap-2">
          {step > 1 && (
            <button onClick={() => setStep((s) => (s - 1) as any)} className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-[12.5px] font-semibold text-ink hover:bg-secondary">
              <ChevronLeft className="h-3.5 w-3.5" /> Back
            </button>
          )}
          {step < 3 && (
            <button
              onClick={() => setStep((s) => (s + 1) as any)}
              disabled={(step === 1 && !customer) || (step === 2 && cartLines.length === 0)}
              className="inline-flex items-center gap-1 rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50">
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
          {step === 3 && (
            <button onClick={placeOrder} disabled={busy || cartLines.length === 0}
              className="rounded-md bg-[#10B981] px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50">
              {busy ? "Placing…" : "Place order on behalf"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function StepPill({ n, label, active }: { n: number; label: string; active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 ${active ? "bg-ink text-white" : "border border-border bg-card text-muted-foreground"}`}>
      <span className="">{n}</span> {label}
    </span>
  );
}
