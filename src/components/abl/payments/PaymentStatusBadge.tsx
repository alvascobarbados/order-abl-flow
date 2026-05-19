import { Clock } from "lucide-react";
import { STATUS_STYLE, type PaymentStatus } from "@/lib/payments";

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ backgroundColor: s.bg, color: s.fg, textDecoration: s.strike ? "line-through" : undefined }}
    >
      {status === "pending" && <Clock className="h-3 w-3" />}
      {s.pulse && status !== "pending" && (
        <span className="relative grid h-1.5 w-1.5 place-items-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ backgroundColor: s.fg }} />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.fg }} />
        </span>
      )}
      {s.label}
    </span>
  );
}
