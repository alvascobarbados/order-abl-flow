import { PAYMENT_METHOD_MAP, type PaymentMethod } from "@/lib/payments";

export function PaymentMethodChip({ method }: { method: PaymentMethod }) {
  const m = PAYMENT_METHOD_MAP[method];
  const Icon = m.icon;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-[#F1F4F8] px-2 py-0.5 text-[11.5px] font-semibold text-ink">
      <Icon className="h-3 w-3 text-[#64748B]" />
      {m.label}
    </span>
  );
}
