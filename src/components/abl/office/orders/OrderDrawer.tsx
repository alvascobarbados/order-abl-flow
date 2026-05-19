import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBBD, formatDate } from "@/lib/format";
import { OrderStatusBadge, type OrderStatus } from "@/components/abl/OrderStatusBadge";
import { PIPELINE, pipelineIndex, timeAgo } from "@/lib/orders";
import { RecordPaymentModal } from "@/components/abl/payments/RecordPaymentModal";
import { openInvoicePdf } from "@/lib/invoices/generate";
import { toast } from "sonner";
import type { OrderRow, CustomerLite } from "./types";

type Item = { id: string; quantity: number; unit_price_at_order: number; line_total: number; product: { name: string; sku: string; pack_size: number; primary_image_url: string | null; image_url: string | null } | null };
type Activity = { id: string; event_type: string; description: string; created_at: string; actor_profile_id: string | null };
type Allocation = { id: string; amount: number; payment: { payment_number: string; payment_date: string; payment_method: string; status: string } };

type Tab = "details" | "timeline" | "payments" | "activity";

export function OrderDrawer({
  order, customer, onClose, onAction, onOrderUpdated,
}: {
  order: OrderRow;
  customer?: CustomerLite;
  onClose: () => void;
  onAction: (kind: string) => void;
  onOrderUpdated: () => void;
}) {
  const [tab, setTab] = useState<Tab>("details");
  const [items, setItems] = useState<Item[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [notes, setNotes] = useState(order.internal_notes ?? "");
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);

  useEffect(() => {
    setNotes(order.internal_notes ?? "");
    supabase.from("order_items")
      .select("id, quantity, unit_price_at_order, line_total, product:products(name, sku, pack_size, primary_image_url, image_url)")
      .eq("order_id", order.id)
      .then(({ data }) => setItems((data as any) ?? []));
    supabase.from("activity_log")
      .select("id, event_type, description, created_at, actor_profile_id")
      .eq("related_order_id", order.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => setActivity((data as any) ?? []));
    supabase.from("payment_allocations")
      .select("id, amount, payment:payments(payment_number, payment_date, payment_method, status)")
      .eq("order_id", order.id)
      .then(({ data }) => setAllocations((data as any) ?? []));
  }, [order.id, order.internal_notes]);

  const saveNotes = async () => {
    if (notes === (order.internal_notes ?? "")) return;
    await supabase.from("orders").update({ internal_notes: notes }).eq("id", order.id);
    toast.success("Notes saved");
    onOrderUpdated();
  };

  const paidSum = allocations
    .filter((a) => a.payment?.status === "cleared")
    .reduce((s, a) => s + Number(a.amount), 0);
  const balance = Math.max(0, Number(order.total) - paidSum);

  const actionButtons = renderActionButtons(order, onAction);

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
        <aside className="flex h-full w-[720px] max-w-full flex-col bg-background shadow-2xl" onClick={(e) => e.stopPropagation()}>
          {/* sticky header */}
          <header className="sticky top-0 z-10 border-b border-border bg-card px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10.5px] uppercase text-muted-foreground" style={{ letterSpacing: "0.12em" }}>ORDER DETAIL</div>
                <div className="mt-1 flex items-center gap-2.5">
                  <span className="font-mono text-[22px] font-extrabold text-ink">{order.order_number}</span>
                  <OrderStatusBadge status={order.status} />
                </div>
                <div className="mt-1.5 text-[13px] text-ink font-semibold">{customer?.company_name ?? "—"}</div>
                <div className="text-[11.5px] text-muted-foreground">
                  Placed {timeAgo(order.placed_at)} · {order.placed_on_behalf ? "by office" : "by customer"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {order.invoice_number && (
                  <button
                    type="button"
                    onClick={() => openInvoicePdf(order.id, { print: true })}
                    title="Print invoice"
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-2.5 py-1 text-[12px] font-semibold text-ink hover:bg-[#F1F5F9]"
                  >
                    <Printer className="h-3.5 w-3.5" /> Print
                  </button>
                )}
                {actionButtons}
                <button onClick={onClose} className="rounded-md border border-border px-2.5 py-1 text-[12px] font-semibold text-ink hover:bg-secondary">× Close</button>
              </div>
            </div>
            {/* pipeline mini */}
            <PipelineMini status={order.status} />
            {/* drawer tabs */}
            <div className="mt-3 flex gap-1">
              {([
                ["details","Details"],["timeline","Timeline"],
                ["payments","Payments & invoicing"],["activity","Activity & notes"],
              ] as const).map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)}
                  className={`rounded-md px-3 py-1.5 text-[12px] font-semibold ${tab === k ? "bg-ink text-white" : "text-muted-foreground hover:text-ink"}`}>
                  {label}
                </button>
              ))}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            {tab === "details" && (
              <DetailsTab order={order} customer={customer} items={items} notes={notes} setNotes={setNotes} onSaveNotes={saveNotes} />
            )}
            {tab === "timeline" && <TimelineTab order={order} activity={activity} />}
            {tab === "payments" && (
              <PaymentsTab order={order} allocations={allocations} balance={balance} paidSum={paidSum}
                onRecord={() => setRecordPaymentOpen(true)} />
            )}
            {tab === "activity" && (
              <ActivityTab activity={activity} notes={notes} setNotes={setNotes} onSaveNotes={saveNotes} />
            )}
          </div>
        </aside>
      </div>

      {recordPaymentOpen && customer && (
        <RecordPaymentModal
          open={recordPaymentOpen}
          customerId={customer.id}
          preAllocateOrderId={order.id}
          onClose={() => setRecordPaymentOpen(false)}
          onSuccess={() => { setRecordPaymentOpen(false); onOrderUpdated(); }}
        />
      )}
    </>
  );
}

function PipelineMini({ status }: { status: OrderStatus }) {
  if (status === "cancelled") {
    return <div className="mt-3 text-[11px] font-semibold uppercase text-[#B91C1C]" style={{ letterSpacing: "0.08em" }}>Cancelled</div>;
  }
  const idx = pipelineIndex(status);
  return (
    <div className="mt-3 flex items-center gap-1.5">
      {PIPELINE.map((s, i) => {
        const reached = i <= idx;
        return (
          <div key={s} className="flex items-center gap-1.5">
            <span
              className="grid h-2 w-2 place-items-center rounded-full"
              style={{ backgroundColor: reached ? "#0B1A2E" : "#E5E7EB" }}
              title={s.replace(/_/g, " ")}
            />
            {i < PIPELINE.length - 1 && <span className="h-px w-3" style={{ backgroundColor: reached && i < idx ? "#0B1A2E" : "#E5E7EB" }} />}
          </div>
        );
      })}
    </div>
  );
}

function DetailsTab({ order, customer, items, notes, setNotes, onSaveNotes }: {
  order: OrderRow; customer?: CustomerLite; items: Item[]; notes: string; setNotes: (v: string) => void; onSaveNotes: () => void;
}) {
  const subtotal = Number(order.subtotal ?? 0);
  const vat = Number(order.vat_amount ?? 0);
  return (
    <div className="space-y-5">
      {order.rejection_reason && (
        <div className="rounded-md border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12.5px] text-[#B91C1C]">
          <strong>Rejection reason:</strong> {order.rejection_reason}
        </div>
      )}
      <section>
        <SectionTitle>Items</SectionTitle>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-[12.5px]">
            <thead className="bg-secondary/40">
              <tr className="text-left text-[10.5px] uppercase text-muted-foreground" style={{ letterSpacing: "0.08em" }}>
                <th className="px-2 py-2"></th><th className="px-2 py-2">Product</th>
                <th className="px-2 py-2 text-right">Qty</th>
                <th className="px-2 py-2 text-right">Unit</th>
                <th className="px-2 py-2 text-right">Line</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const img = it.product?.primary_image_url ?? it.product?.image_url;
                return (
                  <tr key={it.id} className="border-t border-border">
                    <td className="px-2 py-2">
                      <div className="h-10 w-10 overflow-hidden rounded bg-secondary">
                        {img && <img src={img} alt="" className="h-full w-full object-cover" />}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-semibold text-ink">{it.product?.name ?? "—"}</div>
                      <div className="font-mono text-[10.5px] text-muted-foreground">{it.product?.sku} · pack {it.product?.pack_size}</div>
                    </td>
                    <td className="px-2 py-2 text-right">{it.quantity}</td>
                    <td className="px-2 py-2 text-right">{formatBBD(Number(it.unit_price_at_order))}</td>
                    <td className="px-2 py-2 text-right font-semibold">{formatBBD(Number(it.line_total))}</td>
                  </tr>
                );
              })}
              {items.length === 0 && <tr><td colSpan={5} className="px-2 py-6 text-center text-muted-foreground">No items</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <SectionTitle>Totals</SectionTitle>
          <Row label="Subtotal" value={formatBBD(subtotal)} />
          <Row label="VAT (informational)" value={formatBBD(vat)} muted />
          <div className="mt-2 border-t border-border pt-2">
            <Row label="Total" value={formatBBD(Number(order.total))} bold />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <SectionTitle>Delivery</SectionTitle>
          <div className="text-[12.5px] text-ink">{customer?.delivery_address ?? "—"}</div>
          {order.delivery_notes && (
            <div className="mt-2 rounded-md bg-secondary/40 p-2 text-[12px] text-muted-foreground">
              <strong>Customer note:</strong> {order.delivery_notes}
            </div>
          )}
        </div>
      </section>

      <section>
        <SectionTitle>Internal notes</SectionTitle>
        <textarea
          value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={onSaveNotes}
          rows={3} placeholder="Visible to office staff only…"
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-[13px] text-ink focus:border-ink focus:outline-none"
        />
      </section>
    </div>
  );
}

function TimelineTab({ order, activity }: { order: OrderRow; activity: Activity[] }) {
  if (activity.length === 0) {
    return <div className="text-center text-[13px] text-muted-foreground py-10">No activity yet.</div>;
  }
  return (
    <ol className="relative space-y-4 border-l-2 border-border pl-5">
      {activity.map((a) => (
        <li key={a.id} className="relative">
          <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-background" style={{ backgroundColor: eventColor(a.event_type) }} />
          <div className="text-[13px] font-semibold text-ink">{a.description}</div>
          <div className="text-[11.5px] text-muted-foreground">{new Date(a.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</div>
        </li>
      ))}
    </ol>
  );
}

function PaymentsTab({ order, allocations, balance, paidSum, onRecord }: {
  order: OrderRow; allocations: Allocation[]; balance: number; paidSum: number; onRecord: () => void;
}) {
  const hasInvoice = !!order.invoice_number;
  const overdue = order.due_date && new Date(order.due_date) < new Date() && balance > 0;
  return (
    <div className="space-y-5">
      {/* Invoice document panel */}
      <div className="rounded-lg border border-border bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <SectionTitle>Invoice document</SectionTitle>
          {hasInvoice && (
            <span className="font-mono text-[11px] text-muted-foreground">{order.invoice_number}</span>
          )}
        </div>
        {hasInvoice ? (
          <InvoiceActions orderId={order.id} />
        ) : (
          <p className="text-[12.5px] text-muted-foreground">
            No invoice yet. Invoices are generated automatically when an order is packed
            (or manually via "Mark invoiced" once delivered).
          </p>
        )}
      </div>

      {/* Money summary */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Invoice" value={order.invoice_number ?? "—"} mono />
        <Stat label="Invoice date" value={formatDate(order.invoiced_at)} />
        <Stat label="Due date" value={formatDate(order.due_date)} highlight={overdue ? "#B91C1C" : undefined} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total" value={formatBBD(Number(order.total))} />
        <Stat label="Paid" value={formatBBD(paidSum)} highlight="#047857" />
        <Stat label="Balance" value={formatBBD(balance)} highlight={balance > 0 ? "#B45309" : "#047857"} bold />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <SectionTitle>Allocations</SectionTitle>
          {balance > 0 && hasInvoice && (
            <button onClick={onRecord} className="rounded-md bg-ink px-3 py-1.5 text-[12px] font-semibold text-white">Record payment</button>
          )}
        </div>
        {allocations.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-6 text-center text-[12.5px] text-muted-foreground">No payments allocated yet.</div>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead className="bg-secondary/40 text-left text-[10.5px] uppercase text-muted-foreground" style={{ letterSpacing: "0.08em" }}>
              <tr><th className="px-2 py-2">Payment</th><th className="px-2 py-2">Date</th><th className="px-2 py-2">Method</th><th className="px-2 py-2">Status</th><th className="px-2 py-2 text-right">Applied</th></tr>
            </thead>
            <tbody>
              {allocations.map((a) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="px-2 py-2 font-mono">{a.payment?.payment_number}</td>
                  <td className="px-2 py-2">{formatDate(a.payment?.payment_date)}</td>
                  <td className="px-2 py-2 capitalize">{a.payment?.payment_method?.replace(/_/g, " ")}</td>
                  <td className="px-2 py-2 capitalize">{a.payment?.status}</td>
                  <td className="px-2 py-2 text-right font-semibold">{formatBBD(Number(a.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function InvoiceActions({ orderId }: { orderId: string }) {
  const [busy, setBusy] = useState<"download" | "print" | "regen" | null>(null);
  const run = async (kind: "download" | "print" | "regen") => {
    setBusy(kind);
    try {
      if (kind === "download") {
        const url = await (await import("@/lib/invoices/generate")).getOrGenerateInvoicePdf(orderId);
        window.open(url, "_blank");
      } else if (kind === "print") {
        await (await import("@/lib/invoices/generate")).openInvoicePdf(orderId, { print: true });
      } else {
        await (await import("@/lib/invoices/generate")).openInvoicePdf(orderId, { regenerate: true });
        toast.success("Invoice regenerated");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={() => run("download")} disabled={!!busy}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50">
        Download PDF
      </button>
      <button onClick={() => run("print")} disabled={!!busy}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-[12px] font-semibold text-ink hover:bg-secondary disabled:opacity-50">
        <Printer className="h-3.5 w-3.5" /> Print
      </button>
      <button onClick={() => run("regen")} disabled={!!busy}
        className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:text-ink disabled:opacity-50">
        Regenerate
      </button>
    </div>
  );
}

function ActivityTab({ activity, notes, setNotes, onSaveNotes }: {
  activity: Activity[]; notes: string; setNotes: (v: string) => void; onSaveNotes: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <SectionTitle>Internal notes</SectionTitle>
        <textarea
          value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={onSaveNotes}
          rows={3} placeholder="Add a note for the team…"
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-[13px] text-ink focus:border-ink focus:outline-none"
        />
      </div>
      <div>
        <SectionTitle>Activity</SectionTitle>
        {activity.length === 0 ? (
          <div className="text-center text-[12.5px] text-muted-foreground py-6">No activity yet.</div>
        ) : (
          <ul className="space-y-2">
            {activity.slice().reverse().map((a) => (
              <li key={a.id} className="rounded-md border border-border bg-card px-3 py-2">
                <div className="text-[13px] text-ink">{a.description}</div>
                <div className="text-[11px] text-muted-foreground">{new Date(a.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// Action buttons in the drawer header — depend on status
function renderActionButtons(order: OrderRow, onAction: (k: string) => void) {
  const Btn = ({ k, label, color = "#0B1A2E" }: { k: string; label: string; color?: string }) => (
    <button onClick={() => onAction(k)} className="rounded-md px-3 py-1.5 text-[12px] font-semibold text-white" style={{ backgroundColor: color }}>
      {label}
    </button>
  );
  const Ghost = ({ k, label, color }: { k: string; label: string; color?: string }) => (
    <button onClick={() => onAction(k)} className="rounded-md border border-border bg-card px-3 py-1.5 text-[12px] font-semibold hover:bg-secondary" style={{ color }}>
      {label}
    </button>
  );
  switch (order.status) {
    case "pending_approval":  return (<><Ghost k="reject" label="Reject" color="#B91C1C" /><Btn k="approve" label="Approve" color="#10B981" /></>);
    case "approved":          return (<><Ghost k="cancel" label="Cancel" color="#B91C1C" /><Btn k="send-to-warehouse" label="Send to warehouse" /></>);
    case "picking":           return (<><Ghost k="cancel" label="Cancel" color="#B91C1C" /><Btn k="mark-packed" label="Mark packed" color="#6D28D9" /></>);
    case "packed":            return (<Btn k="assign-driver" label="Assign to driver" color="#7E22CE" />);
    case "out_for_delivery":  return (<Btn k="mark-delivered" label="Mark delivered" color="#10B981" />);
    case "delivered":         return (<Btn k="mark-invoiced" label="Mark invoiced" color="#BE185D" />);
    case "invoiced":          return (<Btn k="mark-paid" label="Mark paid" color="#10B981" />);
    case "cancelled":         return (<Ghost k="restore" label="Restore" />);
    default:                  return null;
  }
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[10.5px] uppercase text-muted-foreground" style={{ letterSpacing: "0.08em" }}>{children}</div>;
}
function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-[12.5px]">
      <span className={muted ? "text-muted-foreground" : "text-ink"}>{label}</span>
      <span className={bold ? "font-bold text-ink" : ""}>{value}</span>
    </div>
  );
}
function Stat({ label, value, mono, bold, highlight }: { label: string; value: string; mono?: boolean; bold?: boolean; highlight?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[10.5px] uppercase text-muted-foreground" style={{ letterSpacing: "0.08em" }}>{label}</div>
      <div className={`mt-1 text-[15px] ${bold ? "font-extrabold" : "font-semibold"} ${mono ? "" : ""}`} style={{ color: highlight ?? "#0F172A" }}>{value}</div>
    </div>
  );
}
function eventColor(type: string) {
  if (type.startsWith("order_status_approved") || type === "order_placed") return "#10B981";
  if (type.includes("cancel")) return "#B91C1C";
  if (type.includes("invoiced") || type.includes("paid")) return "#BE185D";
  if (type.includes("delivered")) return "#047857";
  return "#0B1A2E";
}
