import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCart } from "@/hooks/use-cart";
import { supabase } from "@/integrations/supabase/client";
import { formatBBD, splitVatInclusive } from "@/lib/format";
import { toast } from "sonner";

export function PlaceOrderModal({ open, onOpenChange }: { open: boolean; onOpenChange: (b: boolean) => void }) {
  const { lines, total, close: closeCart, clearLocal } = useCart();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<{ id: string; company_name: string; delivery_address: string | null } | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Dev mode: always use the first customer.
    supabase
      .from("customers")
      .select("id, company_name, delivery_address")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setCustomer(data));
  }, [open]);

  const { subtotal, vat } = splitVatInclusive(total);

  const onConfirm = async () => {
    if (!customer || lines.length === 0) return;
    setSubmitting(true);
    try {
      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          customer_id: customer.id,
          status: "pending_approval",
          subtotal,
          vat_amount: vat,
          total,
          delivery_notes: notes || null,
        })
        .select("id, order_number")
        .single();
      if (error) throw error;

      const items = lines.map(l => ({
        order_id: order.id,
        product_id: l.product_id,
        quantity: l.quantity,
        unit_price_at_order: Number(l.product.case_price),
        line_total: Number(l.product.case_price) * l.quantity,
      }));
      const { error: itemsErr } = await supabase.from("order_items").insert(items);
      if (itemsErr) throw itemsErr;

      clearLocal();
      onOpenChange(false);
      closeCart();
      toast.success(`Order ${order.order_number} placed. Our team will review it shortly.`);
      navigate({ to: "/shop/orders/$orderNumber", params: { orderNumber: order.order_number! } });
    } catch (e: any) {
      console.error(e);
      toast.error(e.message ?? "Could not place order");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirm your order</DialogTitle>
          <DialogDescription>
            Submit this order to ABL. Our team will review and approve it before picking.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="rounded-lg border border-border bg-secondary/40 p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Delivery to</div>
            <div className="mt-1 font-semibold text-ink">{customer?.company_name ?? "—"}</div>
            <div className="text-muted-foreground">{customer?.delivery_address ?? "Address on file"}</div>
          </div>

          <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
            {lines.map(l => (
              <li key={l.id} className="flex justify-between">
                <span className="truncate pr-2"><span className="font-mono text-[11px] text-muted-foreground">{l.product.sku}</span> · {l.quantity} × {l.product.name}</span>
                <span className="shrink-0 font-medium">{formatBBD(Number(l.product.case_price) * l.quantity)}</span>
              </li>
            ))}
          </ul>

          <dl className="space-y-1 border-t border-border pt-3">
            <div className="flex justify-between text-muted-foreground"><dt>Subtotal</dt><dd>{formatBBD(subtotal)}</dd></div>
            <div className="flex justify-between text-muted-foreground"><dt>VAT (17.5%)</dt><dd>{formatBBD(vat)}</dd></div>
            <div className="flex justify-between text-base font-bold text-ink"><dt>Total</dt><dd>{formatBBD(total)}</dd></div>
          </dl>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Delivery notes (optional)</label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Anything we should know? e.g., delivery time preferences, gate code..."
              rows={3}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <button onClick={() => onOpenChange(false)} className="text-sm text-muted-foreground hover:text-ink">
            ← Back to cart
          </button>
          <Button onClick={onConfirm} disabled={submitting || lines.length === 0} className="h-11 bg-accent px-6 text-accent-foreground hover:bg-accent/90">
            {submitting ? "Placing…" : "Confirm order"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
