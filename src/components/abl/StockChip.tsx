type Status = "in_stock" | "low_stock" | "out_of_stock";

const CONFIG: Record<Status, { label: string; dot: string; cls: string }> = {
  in_stock:     { label: "In stock",   dot: "bg-success", cls: "bg-success-soft text-[color:var(--success)]" },
  low_stock:    { label: "Low stock",  dot: "bg-warning", cls: "bg-warning-soft text-[color:var(--warning)]" },
  out_of_stock: { label: "Sold out",   dot: "bg-error",   cls: "bg-error-soft text-[color:var(--error)]" },
};

export function StockChip({ status }: { status: Status }) {
  const c = CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${c.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}
