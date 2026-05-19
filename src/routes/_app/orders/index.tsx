import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/abl/AppHeader";
import { OrderStatusBadge, type OrderStatus } from "@/components/abl/OrderStatusBadge";
import { formatBBD, formatDate } from "@/lib/format";
import { ChevronRight, FileText } from "lucide-react";

export const Route = createFileRoute("/_app/orders/")({ component: OrdersListPage });

interface OrderRow {
  id: string;
  order_number: string;
  status: OrderStatus;
  total: number;
  placed_at: string;
  invoice_number: string | null;
}

function OrdersListPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("orders")
      .select("id, order_number, status, total, placed_at, invoice_number")
      .order("placed_at", { ascending: false })
      .then(({ data }) => {
        setOrders((data ?? []) as OrderRow[]);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink">My orders</h1>
            <p className="mt-1 text-sm text-muted-foreground">All orders placed from your account.</p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-secondary" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-16 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-4 text-sm text-muted-foreground">No orders yet. Browse the catalog to place your first one.</p>
            <Link to="/" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">Go to catalog →</Link>
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {orders.map(o => (
              <li key={o.id}>
                <Link
                  to="/orders/$orderNumber"
                  params={{ orderNumber: o.order_number }}
                  className="flex items-center gap-4 px-5 py-4 transition hover:bg-secondary/40"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-semibold text-ink">{o.order_number}</span>
                      {o.invoice_number && (
                        <span className="font-mono text-xs text-muted-foreground">· {o.invoice_number}</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{formatDate(o.placed_at)}</div>
                  </div>
                  <div className="text-sm font-semibold text-ink">{formatBBD(Number(o.total))}</div>
                  <OrderStatusBadge status={o.status} />
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
