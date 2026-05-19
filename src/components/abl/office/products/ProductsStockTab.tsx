import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { ProductFull } from "@/lib/products";
import { StockChip } from "@/components/abl/StockChip";

export function ProductsStockTab({ products, onOpen }: { products: ProductFull[]; onOpen: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [belowRP, setBelowRP] = useState(false);
  const [oos, setOos] = useState(false);
  const [sort, setSort] = useState<"urgent" | "az" | "lowest">("urgent");

  const filtered = useMemo(() => {
    let out = products.filter((p) => !p.archived_at && p.is_active && p.track_inventory);
    const q = search.trim().toLowerCase();
    if (q) out = out.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    if (belowRP) out = out.filter((p) => p.on_hand <= p.reorder_point);
    if (oos) out = out.filter((p) => p.on_hand === 0);
    if (sort === "az") out = [...out].sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "lowest") out = [...out].sort((a, b) => a.on_hand - b.on_hand);
    else out = [...out].sort((a, b) => {
      const aLow = a.on_hand <= a.reorder_point ? 0 : 1;
      const bLow = b.on_hand <= b.reorder_point ? 0 : 1;
      if (aLow !== bLow) return aLow - bLow;
      return a.on_hand - b.on_hand;
    });
    return out;
  }, [products, search, belowRP, oos, sort]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative max-w-[360px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="h-9 w-full rounded-lg border border-border bg-card pl-8 pr-3 text-[13px] outline-none" />
        </div>
        <Toggle on={belowRP} setOn={setBelowRP}>Below reorder point</Toggle>
        <Toggle on={oos} setOn={setOos}>Out of stock</Toggle>
        <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="ml-auto h-9 rounded-lg border border-border bg-card px-2.5 text-[12.5px]">
          <option value="urgent">Most urgent</option>
          <option value="az">A → Z</option>
          <option value="lowest">Lowest stock</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full">
          <thead className="bg-[#F8FAFC]">
            <tr className="border-b border-border">
              <Th>SKU</Th><Th>Name</Th>
              <Th className="text-right">On hand</Th>
              <Th className="text-right">RP</Th>
              <Th className="text-right">Reorder qty</Th>
              <Th>Status</Th>
              <Th className="text-right">Suggested order</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const onHandColor = p.on_hand === 0 ? "text-[#E11D48]" : p.on_hand <= p.reorder_point ? "text-[color:var(--warning)]" : "text-[color:var(--success)]";
              const suggested = p.on_hand < p.reorder_point ? Math.max(0, p.reorder_quantity - p.on_hand) : 0;
              return (
                <tr key={p.id} onClick={() => onOpen(p.id)} className="cursor-pointer border-b border-border last:border-0 hover:bg-[#F8FAFC]">
                  <td className="p-2 font-mono text-[12px] font-bold text-ink">{p.sku}</td>
                  <td className="p-2">
                    <div className="text-[13px] font-semibold text-ink">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground">{p.category}</div>
                  </td>
                  <td className={`p-2 text-right font-mono text-[16px] font-extrabold ${onHandColor}`}>{p.on_hand}</td>
                  <td className="p-2 text-right font-mono text-[12px] text-muted-foreground">{p.reorder_point}</td>
                  <td className="p-2 text-right font-mono text-[12px] text-muted-foreground">{p.reorder_quantity}</td>
                  <td className="p-2"><StockChip status={p.stock_status} /></td>
                  <td className="p-2 text-right font-mono text-[12.5px] font-semibold text-ink">{suggested > 0 ? `+${suggested}` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="p-8 text-center text-[12.5px] text-muted-foreground">No products match.</div>}
      </div>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-2 py-2.5 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ${className}`}>{children}</th>;
}

function Toggle({ on, setOn, children }: { on: boolean; setOn: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <button onClick={() => setOn(!on)} className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${on ? "bg-[#0B1A2E] text-white" : "border border-border bg-card text-[#64748B] hover:text-ink"}`}>
      {children}
    </button>
  );
}
