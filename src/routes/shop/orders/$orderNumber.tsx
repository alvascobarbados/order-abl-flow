import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/abl/AppHeader";
import { OrderStatusBadge, type OrderStatus } from "@/components/abl/OrderStatusBadge";
import { formatBBD, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Check, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/shop/orders/$orderNumber")({ component: OrderDetailPage });

const STAGES: { key: OrderStatus; label: string }[] = [
  { key: "pending_approval", label: "Placed" },
  { key: "approved",         label: "Approved" },
  { key: "picking",          label: "Picking" },
  { key: "packed",           label: "Packed" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "delivered",        label: "Delivered" },
  { key: "invoiced",         label: "Invoiced" },
];

const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i])) as Record<OrderStatus, number>;

interface OrderDetail {
  id: string;
  order_number: string;
  invoice_number: string | null;
  status: OrderStatus;
  subtotal: number; vat_amount: number; total: number;
  placed_at: string; approved_at: string | null; picked_at: string | null;
  delivered_at: string | null; invoiced_at: string | null;
  delivery_notes: string | null;
  items: Array<{
    id: string; quantity: number; unit_price_at_order: number; line_total: number;
    product: { sku: string; name: string };
  }>;
}

function OrderDetailPage() {
  const { orderNumber } = Route.useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from("orders")
      .select("id, order_number, invoice_number, status, subtotal, vat_amount, total, placed_at, approved_at, picked_at, delivered_at, invoiced_at, delivery_notes, items:order_items(id, quantity, unit_price_at_order, line_total, product:products(sku, name))")
      .eq("order_number", orderNumber)
      .maybeSingle();
    setOrder(data as unknown as OrderDetail);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [orderNumber]);

  const cancel = async () => {
    if (!order) return;
    if (!confirm("Cancel this order? This cannot be undone.")) return;
    const { error } = await supabase.from("orders").update({ status: "cancelled" }).eq("id", order.id);
    if (error) toast.error(error.message);
    else { toast.success("Order cancelled."); load(); }
  };

  if (loading) return <div className="min-h-screen bg-background"><AppHeader /><div className="mx-auto max-w-4xl px-4 py-12 text-sm text-muted-foreground">Loading…</div></div>;
  if (!order) return <div className="min-h-screen bg-background"><AppHeader /><div className="mx-auto max-w-4xl px-4 py-12 text-center text-sm text-muted-foreground">Order not found.</div></div>;

  const currentIdx = STAGE_INDEX[order.status] ?? -1;
  const isInvoiced = order.status === "invoiced" || order.status === "paid";
  const canCancel = order.status === "pending_approval";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <button onClick={() => navigate({ to: "/shop/orders" })} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back to orders
        </button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-mono text-2xl font-bold text-ink">{order.order_number}</h1>
              <OrderStatusBadge status={order.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Placed {formatDate(order.placed_at)}</p>
          </div>
          <div className="flex gap-2">
            {canCancel && (
              <Button variant="outline" onClick={cancel} className="text-destructive hover:text-destructive">
                <XCircle className="mr-1.5 h-4 w-4" /> Cancel order
              </Button>
            )}
            {isInvoiced && (
              <Button className="bg-primary hover:bg-primary-dark">
                <Download className="mr-1.5 h-4 w-4" /> Download PDF
              </Button>
            )}
          </div>
        </div>

        {isInvoiced && order.invoice_number && (
          <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-purple-700">Invoice</div>
            <div className="font-mono text-lg font-bold text-purple-900">{order.invoice_number}</div>
          </div>
        )}

        {order.status !== "cancelled" && (
          <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card p-5">
            <ol className="flex min-w-[640px] items-center gap-2">
              {STAGES.map((s, i) => {
                const done = i < currentIdx;
                const active = i === currentIdx;
                return (
                  <li key={s.key} className="flex flex-1 flex-col items-center text-center">
                    <div className={`grid h-8 w-8 place-items-center rounded-full border-2 ${
                      done ? "border-success bg-success text-white"
                      : active ? "border-primary bg-primary text-white"
                      : "border-border bg-card text-muted-foreground"
                    }`}>
                      {done ? <Check className="h-4 w-4" /> : <span className="text-xs font-semibold">{i+1}</span>}
                    </div>
                    <div className={`mt-2 text-[11px] font-medium ${active ? "text-ink" : "text-muted-foreground"}`}>{s.label}</div>
                    {i < STAGES.length - 1 && <div className={`mt-[-22px] h-0.5 w-full ${done ? "bg-success" : "bg-border"}`} style={{ marginLeft: "50%", width: "100%" }} />}
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 text-right font-medium">Qty</th>
                <th className="px-5 py-3 text-right font-medium">Unit price</th>
                <th className="px-5 py-3 text-right font-medium">Line total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {order.items.map(it => (
                <tr key={it.id}>
                  <td className="px-5 py-3">
                    <div className="font-medium text-ink">{it.product.name}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">{it.product.sku}</div>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">{it.quantity}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{formatBBD(Number(it.unit_price_at_order))}</td>
                  <td className="px-5 py-3 text-right font-semibold tabular-nums">{formatBBD(Number(it.line_total))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-secondary/30">
              <tr><td colSpan={3} className="px-5 py-2 text-right text-muted-foreground">Subtotal</td><td className="px-5 py-2 text-right tabular-nums">{formatBBD(Number(order.subtotal))}</td></tr>
              <tr><td colSpan={3} className="px-5 py-2 text-right text-muted-foreground">VAT (17.5%)</td><td className="px-5 py-2 text-right tabular-nums">{formatBBD(Number(order.vat_amount))}</td></tr>
              <tr><td colSpan={3} className="px-5 py-3 text-right font-bold text-ink">Total</td><td className="px-5 py-3 text-right text-base font-bold text-ink tabular-nums">{formatBBD(Number(order.total))}</td></tr>
            </tfoot>
          </table>
        </div>

        {order.delivery_notes && (
          <div className="mt-6 rounded-xl border border-border bg-card p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Delivery notes</div>
            <p className="mt-1 text-sm text-ink">{order.delivery_notes}</p>
          </div>
        )}
      </main>
    </div>
  );
}
