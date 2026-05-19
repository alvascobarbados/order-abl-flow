export type OrderStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "picking"
  | "packed"
  | "out_for_delivery"
  | "delivered"
  | "invoiced"
  | "paid"
  | "cancelled";

interface Style {
  label: string;
  bg: string;
  text: string;
  pulse?: boolean;
}

const MAP: Record<OrderStatus, Style> = {
  draft:            { label: "Draft",            bg: "#F1F4F8", text: "#64748B" },
  pending_approval: { label: "Pending approval", bg: "#FEF3C7", text: "#B45309", pulse: true },
  approved:         { label: "Approved",         bg: "#DBEAFE", text: "#1E40AF" },
  picking:          { label: "Picking",          bg: "#E0E7FF", text: "#3730A3" },
  packed:           { label: "Packed",           bg: "#EDE9FE", text: "#6D28D9" },
  out_for_delivery: { label: "Out for delivery", bg: "#F3E8FF", text: "#7E22CE" },
  delivered:        { label: "Delivered",        bg: "#D1FAE5", text: "#047857" },
  invoiced:         { label: "Invoiced",         bg: "#EDE9FE", text: "#6D28D9" },
  paid:             { label: "Paid",             bg: "#F1F4F8", text: "#64748B" },
  cancelled:        { label: "Cancelled",        bg: "#FEE2E2", text: "#B91C1C" },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const s = MAP[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {s.pulse && (
        <span className="relative grid h-1.5 w-1.5 place-items-center">
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
            style={{ backgroundColor: s.text }}
          />
          <span
            className="relative inline-flex h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: s.text }}
          />
        </span>
      )}
      {s.label}
    </span>
  );
}
