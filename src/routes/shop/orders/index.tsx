import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/abl/AppHeader";
import { OrderStatusBadge, type OrderStatus } from "@/components/abl/OrderStatusBadge";
import { formatBBD, formatDate } from "@/lib/format";
import { useActiveCustomer } from "@/hooks/use-active-customer";

export const Route = createFileRoute("/shop/orders/")({ component: OrdersListPage });

interface OrderRow {
  id: string;
  order_number: string;
  status: OrderStatus;
  total: number;
  placed_at: string;
  invoice_number: string | null;
  item_count: number;
}

type Filter = "all" | "active" | "completed" | "cancelled";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const COMPLETED: OrderStatus[] = ["delivered", "invoiced", "paid"];

function OrdersListPage() {
  const { activeCustomerId } = useActiveCustomer();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (!activeCustomerId) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select(
          "id, order_number, status, total, placed_at, invoice_number, items:order_items(quantity)",
        )
        .eq("customer_id", activeCustomerId)
        .order("placed_at", { ascending: false });
      const mapped: OrderRow[] = (data ?? []).map((o: any) => ({
        id: o.id,
        order_number: o.order_number,
        status: o.status,
        total: Number(o.total),
        placed_at: o.placed_at,
        invoice_number: o.invoice_number,
        item_count: (o.items ?? []).reduce(
          (s: number, it: { quantity: number }) => s + it.quantity,
          0,
        ),
      }));
      setOrders(mapped);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (filter === "all") return true;
      if (filter === "cancelled") return o.status === "cancelled";
      if (filter === "completed") return COMPLETED.includes(o.status);
      // active = anything not delivered/paid/cancelled
      return !COMPLETED.includes(o.status) && o.status !== "cancelled";
    });
  }, [orders, filter]);

  return (
    <div className="min-h-screen bg-[#F6F7F9]">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-[24px] font-extrabold tracking-tight text-[#0B1A2E]">Your orders</h1>
          <p className="mt-1 text-[13px] text-[#64748B]">
            All orders placed from your account.
          </p>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition ${
                  active
                    ? "border-[#0F2540] bg-[#0F2540] text-white"
                    : "border-[#E5E9EF] bg-white text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0B1A2E]"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-white" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#E5E9EF] bg-white p-16 text-center">
            <FileText className="mx-auto h-10 w-10 text-[#CBD5E1]" strokeWidth={1.5} />
            <p className="mt-4 text-[13px] text-[#64748B]">
              No orders yet. Browse the catalog to place your first order.
            </p>
            <Link
              to="/shop"
              className="mt-4 inline-block text-[13px] font-semibold text-[#0F2540] hover:underline"
            >
              Go to catalog →
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-[#EEF1F5] overflow-hidden rounded-xl border border-[#E5E9EF] bg-white">
            {filtered.map((o) => (
              <li key={o.id}>
                <Link
                  to="/shop/orders/$orderNumber"
                  params={{ orderNumber: o.order_number }}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 px-5 py-4 transition hover:bg-[#FAFBFC]"
                >
                  <div>
                    <div className="font-mono text-[13px] font-bold text-[#0B1A2E]">
                      {o.order_number}
                    </div>
                    {o.invoice_number && (
                      <div className="mt-0.5 font-mono text-[10.5px] text-[#94A3B8]">
                        {o.invoice_number}
                      </div>
                    )}
                  </div>
                  <div className="hidden text-[12px] text-[#64748B] sm:block">
                    {formatDate(o.placed_at)}
                  </div>
                  <div className="hidden text-[12px] text-[#64748B] md:block">
                    {o.item_count} item{o.item_count === 1 ? "" : "s"}
                  </div>
                  <div className="text-[13px] font-bold text-[#0B1A2E] tabular-nums">
                    {formatBBD(o.total)}
                  </div>
                  <div className="flex items-center gap-2">
                    <OrderStatusBadge status={o.status} />
                    <ChevronRight className="h-4 w-4 text-[#CBD5E1]" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
