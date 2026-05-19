export type OrderStatus =
  | "draft" | "pending_approval" | "approved" | "picking" | "packed"
  | "out_for_delivery" | "delivered" | "invoiced" | "paid" | "cancelled";

const MAP: Record<OrderStatus, { label: string; cls: string }> = {
  draft:            { label: "Draft",            cls: "bg-muted text-muted-foreground" },
  pending_approval: { label: "Pending approval", cls: "bg-warning-soft text-[color:var(--warning)]" },
  approved:         { label: "Approved",         cls: "bg-blue-50 text-blue-700" },
  picking:          { label: "Picking",          cls: "bg-blue-50 text-blue-700" },
  packed:           { label: "Packed",           cls: "bg-blue-50 text-blue-700" },
  out_for_delivery: { label: "Out for delivery", cls: "bg-blue-50 text-blue-700" },
  delivered:        { label: "Delivered",        cls: "bg-success-soft text-[color:var(--success)]" },
  invoiced:         { label: "Invoiced",         cls: "bg-purple-50 text-purple-700" },
  paid:             { label: "Paid",             cls: "bg-muted text-muted-foreground" },
  cancelled:        { label: "Cancelled",        cls: "bg-error-soft text-[color:var(--error)]" },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const c = MAP[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${c.cls}`}>
      {c.label}
    </span>
  );
}
