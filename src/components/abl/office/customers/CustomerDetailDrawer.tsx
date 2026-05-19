import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { X, Mail, Phone, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBBD, formatDate } from "@/lib/format";
import { OrderStatusBadge, type OrderStatus } from "@/components/abl/OrderStatusBadge";
import { TierChip } from "./TierChip";
import { toast } from "sonner";
import type { CustomerRow } from "./CustomersTable";
import { CustomerPaymentsTab } from "./CustomerPaymentsTab";

type Order = {
  id: string;
  order_number: string | null;
  status: OrderStatus;
  total: number;
  placed_at: string;
  item_count: number;
};
type Profile = { id: string; email: string | null; full_name: string | null };
type Activity = { id: string; description: string; created_at: string; event_type: string };

export function CustomerDetailDrawer({
  customerId, onClose, onChanged,
}: { customerId: string; onClose: () => void; onChanged: () => void }) {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [contact, setContact] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [tab, setTab] = useState<"overview" | "orders" | "payments" | "activity">("overview");
  const [orderFilter, setOrderFilter] = useState<"all" | "active" | "completed" | "cancelled">("all");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: c } = await supabase.from("customers").select("*").eq("id", customerId).maybeSingle();
      if (!alive || !c) return;
      setCustomer(c as unknown as CustomerRow);
      setNotes((c as any).notes ?? "");

      if ((c as any).contact_profile_id) {
        const { data: p } = await supabase
          .from("profiles").select("id, email, full_name").eq("id", (c as any).contact_profile_id).maybeSingle();
        if (alive) setContact(p as Profile | null);
      } else {
        setContact(null);
      }

      const { data: o } = await supabase
        .from("orders")
        .select("id, order_number, status, total, placed_at, items:order_items(quantity)")
        .eq("customer_id", customerId)
        .order("placed_at", { ascending: false });
      if (alive) {
        setOrders((o ?? []).map((r: any) => ({
          id: r.id, order_number: r.order_number, status: r.status,
          total: Number(r.total), placed_at: r.placed_at,
          item_count: (r.items ?? []).reduce((s: number, it: any) => s + it.quantity, 0),
        })));
      }

      const { data: a } = await supabase
        .from("activity_log")
        .select("id, description, created_at, event_type")
        .eq("related_customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (alive) setActivity((a ?? []) as Activity[]);
    })();
    return () => { alive = false; };
  }, [customerId]);

  const saveNotes = async () => {
    if (!customer) return;
    if ((notes ?? "") === (customer.notes ?? "")) return;
    const { error } = await supabase.from("customers").update({ notes }).eq("id", customer.id);
    if (error) toast.error(error.message);
    else { toast.success("Notes saved"); onChanged(); }
  };

  const COMPLETED: OrderStatus[] = ["delivered", "invoiced", "paid"];
  const filteredOrders = useMemo(() => orders.filter((o) => {
    if (orderFilter === "all") return true;
    if (orderFilter === "cancelled") return o.status === "cancelled";
    if (orderFilter === "completed") return COMPLETED.includes(o.status);
    return !COMPLETED.includes(o.status) && o.status !== "cancelled";
  }), [orders, orderFilter]);

  if (!customer) {
    return (
      <div className="fixed inset-0 z-[55] bg-black/40">
        <div className="absolute right-0 top-0 flex h-full w-full max-w-[720px] flex-col bg-white p-6">
          <button onClick={onClose} className="self-end text-[#64748B] hover:text-ink"><X className="h-5 w-5" /></button>
          <div className="mt-10 text-center text-[13px] text-muted-foreground">Loading…</div>
        </div>
      </div>
    );
  }

  const balance = Number(customer.current_balance);
  const limit = Number(customer.credit_limit);
  const available = limit - balance;
  const availPct = limit > 0 ? Math.min(100, Math.max(0, (balance / limit) * 100)) : 0;
  const availColor = available < 0 ? "#B91C1C" : (limit > 0 && available / limit < 0.2) ? "#B45309" : "#047857";
  const sameAddr = customer.delivery_address_same_as_billing || (
    !customer.delivery_address && !customer.delivery_city
  );

  return (
    <div className="fixed inset-0 z-[55] bg-black/40" onClick={onClose}>
      <div
        className="absolute right-0 top-0 flex h-full w-full max-w-[720px] flex-col bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="border-b border-[#E5E9EF] px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-[22px] font-extrabold text-ink" style={{ letterSpacing: "-0.02em" }}>
                  {customer.company_name}
                </h2>
                <TierChip tier={customer.pricing_tier} />
              </div>
              <div className="mt-1 flex items-center gap-3 text-[12px] text-[#64748B]">
                <span className="font-mono">{customer.customer_number}</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: customer.is_active ? "#10B981" : "#94A3B8" }} />
                  {customer.is_active ? "Active" : "Inactive"}
                </span>
                <span>Customer since {formatDate(customer.created_at)}</span>
              </div>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <button
                onClick={() => navigate({ to: "/office/customers/$id/edit", params: { id: customer.id } })}
                className="rounded-md border border-[#E5E9EF] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink hover:bg-[#FAFBFC]"
              >Edit</button>
              <button
                onClick={() => toast.info("Place order on behalf coming next")}
                className="rounded-md border border-[#E5E9EF] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink hover:bg-[#FAFBFC]"
              >Place order on behalf</button>
              <button onClick={onClose} className="ml-1 rounded-md p-1.5 text-[#64748B] hover:bg-[#F1F4F8] hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-1 border-b border-[#E5E9EF] -mb-4">
            {[
              { k: "overview", label: "Overview" },
              { k: "orders", label: `Orders (${orders.length})` },
              { k: "payments", label: "Payments" },
              { k: "activity", label: "Activity & Notes" },
            ].map((t) => (
              <button
                key={t.k}
                onClick={() => setTab(t.k as any)}
                className={`relative px-3 py-2 text-[13px] font-semibold transition ${
                  tab === t.k ? "text-ink" : "text-[#64748B] hover:text-ink"
                }`}
              >
                {t.label}
                {tab === t.k && (
                  <span className="absolute -bottom-px left-0 right-0 h-[2px] rounded-t" style={{ backgroundColor: "#FF6A1A" }} />
                )}
              </button>
            ))}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === "overview" && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Account card */}
                <div className="rounded-xl border border-[#E5E9EF] bg-white p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Account</div>
                  <div className="mt-3 space-y-2 text-[13px]">
                    <Row label="Credit limit" value={formatBBD(limit)} />
                    <Row label="Balance owed" value={formatBBD(balance)} valueClass={balance > 0 ? "text-[#B91C1C] font-semibold" : ""} />
                    <Row label="Payment terms" value={`Net ${customer.payment_terms_days}`} />
                    <div className="flex items-center justify-between">
                      <span className="text-[#64748B]">Tier</span>
                      <TierChip tier={customer.pricing_tier} />
                    </div>
                  </div>
                  <div className="mt-4 border-t border-[#E5E9EF] pt-3">
                    <div className="text-[10.5px] uppercase tracking-wider text-[#64748B]">Available credit</div>
                    <div className="mt-1 text-[22px] font-extrabold" style={{ color: availColor }}>
                      {formatBBD(available)}
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#F1F4F8]">
                      <div className="h-full rounded-full" style={{ width: `${availPct}%`, backgroundColor: availColor }} />
                    </div>
                  </div>
                </div>

                {/* Contact card */}
                <div className="rounded-xl border border-[#E5E9EF] bg-white p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Contact</div>
                  <div className="mt-3 space-y-2 text-[13px]">
                    <div className="font-bold text-ink">{contact?.full_name ?? "—"}</div>
                    {contact?.email && (
                      <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-[#0F2540] hover:underline">
                        <Mail className="h-3.5 w-3.5" /> {contact.email}
                      </a>
                    )}
                    {customer.phone && (
                      <a href={`tel:${customer.phone}`} className="flex items-center gap-1.5 text-[#0F2540] hover:underline">
                        <Phone className="h-3.5 w-3.5" /> {customer.phone}
                      </a>
                    )}
                  </div>
                  <div className="mt-4 border-t border-[#E5E9EF] pt-3 text-[12px]">
                    {contact ? (
                      <span className="text-[#64748B]">Linked user: <span className="text-ink">{contact.email}</span></span>
                    ) : (
                      <span className="text-[#64748B]">No login created · <button className="font-semibold text-[#FF6A1A] hover:underline" onClick={() => navigate({ to: "/office/customers/$id/edit", params: { id: customer.id } })}>Create login</button></span>
                    )}
                  </div>
                </div>

                {/* Addresses card */}
                <div className="rounded-xl border border-[#E5E9EF] bg-white p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Addresses</div>
                  <div className="mt-3 text-[12.5px]">
                    <div className="font-semibold text-ink">Billing</div>
                    <div className="mt-0.5 whitespace-pre-line text-[#64748B]">{formatAddr(customer, "billing")}</div>
                    <div className="mt-3 font-semibold text-ink">Delivery</div>
                    <div className="mt-0.5 whitespace-pre-line text-[#64748B]">
                      {sameAddr ? "Same as billing" : formatAddr(customer, "delivery")}
                    </div>
                    {customer.delivery_notes && (
                      <div className="mt-2 rounded-md bg-[#FFFBEB] px-2 py-1 text-[11.5px] text-[#92400E]">
                        Note: {customer.delivery_notes}
                      </div>
                    )}
                  </div>
                </div>

                {/* Sales rep card */}
                <div className="rounded-xl border border-[#E5E9EF] bg-white p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Sales rep</div>
                  <div className="mt-3 text-[13px]">
                    <div className="font-bold text-ink">{customer.sales_rep_name ?? "Unassigned"}</div>
                    <button
                      onClick={() => navigate({ to: "/office/customers/$id/edit", params: { id: customer.id } })}
                      className="mt-1 text-[12px] font-semibold text-[#FF6A1A] hover:underline"
                    >
                      Reassign
                    </button>
                  </div>
                  <div className="mt-4 border-t border-[#E5E9EF] pt-3 text-[11.5px] text-[#94A3B8]">
                    Visit tracking coming soon
                  </div>
                </div>
              </div>

              {/* Recent orders */}
              <div className="rounded-xl border border-[#E5E9EF] bg-white p-4">
                <div className="mb-2 flex items-baseline justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Recent orders</div>
                  <button
                    onClick={() => setTab("orders")}
                    className="text-[11.5px] font-semibold text-[#FF6A1A] hover:underline"
                  >View all →</button>
                </div>
                {orders.length === 0 ? (
                  <div className="py-6 text-center text-[12.5px] text-muted-foreground">No orders yet.</div>
                ) : (
                  <ul className="space-y-2">
                    {orders.slice(0, 5).map((o) => (
                      <li key={o.id} className="flex items-center justify-between rounded-lg border border-[#E5E9EF] px-3 py-2">
                        <div className="flex items-center gap-3">
                          <span className="rounded bg-[#F1F4F8] px-2 py-0.5 font-mono text-[11px] font-semibold text-ink">{o.order_number}</span>
                          <span className="text-[12px] text-[#64748B]">{formatDate(o.placed_at)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <OrderStatusBadge status={o.status} />
                          <span className="w-[90px] text-right text-[12.5px] font-semibold text-ink">{formatBBD(o.total)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {tab === "orders" && (
            <div>
              <div className="mb-3 flex gap-1.5">
                {(["all", "active", "completed", "cancelled"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setOrderFilter(k)}
                    className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
                      orderFilter === k
                        ? "bg-[#0B1A2E] text-white"
                        : "border border-[#E5E9EF] bg-white text-[#64748B] hover:text-ink"
                    }`}
                  >{k[0].toUpperCase() + k.slice(1)}</button>
                ))}
              </div>
              <div className="overflow-hidden rounded-xl border border-[#E5E9EF]">
                <table className="w-full text-[13px]">
                  <thead className="bg-[#FAFBFC]">
                    <tr>
                      {["Order", "Date", "Items", "Total", "Status", ""].map((h, i) => (
                        <th key={i} className={`px-3 py-2.5 text-[10.5px] font-semibold uppercase text-[#64748B] ${i === 3 ? "text-right" : "text-left"}`} style={{ letterSpacing: "0.06em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.length === 0 ? (
                      <tr><td colSpan={6} className="py-8 text-center text-[12.5px] text-muted-foreground">No orders in this view.</td></tr>
                    ) : filteredOrders.map((o) => (
                      <tr key={o.id} className="border-t border-[#E5E9EF]">
                        <td className="px-3 py-2.5 font-mono text-[12px] font-semibold text-ink">{o.order_number}</td>
                        <td className="px-3 py-2.5 text-[12px] text-[#64748B]">{formatDate(o.placed_at)}</td>
                        <td className="px-3 py-2.5 text-[12px] text-[#64748B]">{o.item_count}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-ink">{formatBBD(o.total)}</td>
                        <td className="px-3 py-2.5"><OrderStatusBadge status={o.status} /></td>
                        <td className="px-3 py-2.5 text-right"><ChevronRight className="ml-auto h-4 w-4 text-[#CBD5E1]" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "payments" && (
            <CustomerPaymentsTab
              customerId={customer.id}
              paymentTermsDays={customer.payment_terms_days ?? 30}
              onDataChanged={onChanged}
            />
          )}

          {tab === "activity" && (
            <div className="space-y-5">
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Internal notes</div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={saveNotes}
                  placeholder="Visible only to office/admin staff. Auto-saves on blur."
                  rows={4}
                  className="w-full rounded-lg border border-[#E5E9EF] bg-[#FAFBFC] p-3 text-[13px] outline-none focus:border-[#0F2540] focus:bg-white"
                />
              </div>
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Activity</div>
                {activity.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#E5E9EF] py-6 text-center text-[12.5px] text-muted-foreground">No activity yet.</div>
                ) : (
                  <ul className="space-y-2">
                    {activity.map((a) => (
                      <li key={a.id} className="rounded-lg border border-[#E5E9EF] p-3">
                        <div className="text-[12.5px] text-ink">{a.description}</div>
                        <div className="mt-0.5 text-[10.5px] text-[#64748B]">{new Date(a.created_at).toLocaleString("en-GB")}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#64748B]">{label}</span>
      <span className={`text-ink ${valueClass ?? ""}`}>{value}</span>
    </div>
  );
}

function formatAddr(c: CustomerRow, kind: "billing" | "delivery"): string {
  if (kind === "billing") {
    const parts = [c.billing_address, [c.billing_city, c.billing_parish].filter(Boolean).join(", "), c.billing_postal].filter(Boolean);
    return parts.length ? parts.join("\n") : "—";
  }
  const parts = [c.delivery_address, [c.delivery_city, c.delivery_parish].filter(Boolean).join(", "), c.delivery_postal].filter(Boolean);
  return parts.length ? parts.join("\n") : "—";
}
