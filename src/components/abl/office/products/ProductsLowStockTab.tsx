import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { ProductFull } from "@/lib/products";

export function ProductsLowStockTab({ products, onOpen }: { products: ProductFull[]; onOpen: (id: string) => void }) {
  const items = useMemo(() => products.filter((p) => !p.archived_at && p.is_active && (p.stock_status === "low_stock" || p.stock_status === "out_of_stock")), [products]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-[color:var(--success)]" />
        <div className="mt-3 text-[15px] font-bold text-ink">All stock levels healthy</div>
        <div className="mt-1 text-[12.5px] text-muted-foreground">No products below reorder point or out of stock.</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full">
          <thead className="bg-[#F8FAFC]">
            <tr className="border-b border-border">
              <th className="w-8 p-2"> </th>
              <Th>SKU</Th><Th>Name</Th>
              <Th className="text-right">On hand</Th>
              <Th className="text-right">RP</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0 hover:bg-[#F8FAFC]">
                <td className="p-2 text-center"><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} /></td>
                <td className="cursor-pointer p-2 font-mono text-[12px] font-bold text-ink" onClick={() => onOpen(p.id)}>{p.sku}</td>
                <td className="cursor-pointer p-2" onClick={() => onOpen(p.id)}>
                  <div className="text-[13px] font-semibold text-ink">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground">{p.category}</div>
                </td>
                <td className={`p-2 text-right font-mono text-[16px] font-extrabold ${p.on_hand === 0 ? "text-[#E11D48]" : "text-[color:var(--warning)]"}`}>{p.on_hand}</td>
                <td className="p-2 text-right font-mono text-[12px] text-muted-foreground">{p.reorder_point}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-[13px] font-bold text-ink">{selected.size} selected</div>
        <p className="mt-1 text-[11.5px] text-muted-foreground">Bulk-create a purchase order for the selected items.</p>
        <Button className="mt-3 w-full bg-[#0B1A2E] hover:bg-[#1A3556]" disabled={selected.size === 0} onClick={() => toast.info("PO creation coming with Purchasing build")}>
          Create purchase order
        </Button>
      </div>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-2 py-2.5 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ${className}`}>{children}</th>;
}
