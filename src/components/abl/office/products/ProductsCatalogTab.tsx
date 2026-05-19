import { useMemo, useState, useRef, useEffect } from "react";
import { Search, X, MoreHorizontal, LayoutGrid, List, Pencil } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { formatBBD } from "@/lib/format";
import { resolveImageUrl, timeAgo, type ProductFull, type Category } from "@/lib/products";
import { ProductImageFallback } from "@/components/abl/ProductImageFallback";
import { StockChip } from "@/components/abl/StockChip";
import { ProductCard, type ProductRow } from "@/components/abl/ProductCard";

type View = "table" | "grid";
type StockFilter = "all" | "in_stock" | "low_stock" | "out_of_stock";
type ActiveFilter = "active" | "all" | "inactive";

export function ProductsCatalogTab({
  products, categories, onOpen, onAction,
}: {
  products: ProductFull[];
  categories: Category[];
  onOpen: (id: string) => void;
  onAction: (action: "edit" | "duplicate" | "adjust" | "toggle" | "archive", p: ProductFull) => void;
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [stock, setStock] = useState<StockFilter>("all");
  const [active, setActive] = useState<ActiveFilter>("active");
  const [view, setView] = useState<View>("table");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setOpenMenu(null); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = useMemo(() => {
    let out = products.filter((p) => !p.archived_at);
    if (active === "active") out = out.filter((p) => p.is_active);
    else if (active === "inactive") out = out.filter((p) => !p.is_active);
    if (cat !== "all") out = out.filter((p) => p.category === cat);
    if (stock !== "all") out = out.filter((p) => p.stock_status === stock);
    const q = search.trim().toLowerCase();
    if (q) {
      out = out.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q),
      );
    }
    return out;
  }, [products, search, cat, stock, active]);

  const hasFilter = search || cat !== "all" || stock !== "all" || active !== "active";
  const clear = () => { setSearch(""); setCat("all"); setStock("all"); setActive("active"); };

  return (
    <div>
      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative max-w-[360px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, SKU, description..."
            className="h-9 w-full rounded-lg border border-border bg-card pl-8 pr-3 text-[13px] outline-none focus:border-[#0B1A2E]/30"
          />
        </div>

        <select value={cat} onChange={(e) => setCat(e.target.value)} className="h-9 rounded-lg border border-border bg-card px-2.5 text-[12.5px]">
          <option value="all">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>

        <select value={stock} onChange={(e) => setStock(e.target.value as StockFilter)} className="h-9 rounded-lg border border-border bg-card px-2.5 text-[12.5px]">
          <option value="all">All stock</option>
          <option value="in_stock">In stock</option>
          <option value="low_stock">Low stock</option>
          <option value="out_of_stock">Sold out</option>
        </select>

        <select value={active} onChange={(e) => setActive(e.target.value as ActiveFilter)} className="h-9 rounded-lg border border-border bg-card px-2.5 text-[12.5px]">
          <option value="active">Active only</option>
          <option value="all">All</option>
          <option value="inactive">Inactive only</option>
        </select>

        {hasFilter && (
          <button onClick={clear} className="inline-flex h-9 items-center gap-1 px-2 text-[12px] font-semibold text-[#0B1A2E] hover:underline">
            <X className="h-3 w-3" /> Clear filters
          </button>
        )}

        <div className="ml-auto inline-flex overflow-hidden rounded-lg border border-border bg-card">
          <button onClick={() => setView("table")} className={`grid h-9 w-9 place-items-center ${view === "table" ? "bg-[#0B1A2E] text-white" : "text-muted-foreground hover:text-ink"}`} aria-label="Table view">
            <List className="h-4 w-4" />
          </button>
          <button onClick={() => setView("grid")} className={`grid h-9 w-9 place-items-center ${view === "grid" ? "bg-[#0B1A2E] text-white" : "text-muted-foreground hover:text-ink"}`} aria-label="Grid view">
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <div className="text-[14px] font-semibold text-ink">No products match your filters.</div>
          {hasFilter && (
            <button onClick={clear} className="mt-2 text-[12.5px] font-semibold text-[#FF6A1A] hover:underline">Clear filters</button>
          )}
        </div>
      ) : view === "table" ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full">
            <thead className="bg-[#F8FAFC]">
              <tr className="border-b border-border">
                <Th>Image</Th>
                <Th>SKU</Th>
                <Th>Name</Th>
                <Th>Pack</Th>
                <Th className="text-right">Case</Th>
                <Th className="text-right">Unit</Th>
                <Th>Stock</Th>
                <Th className="text-right">On hand</Th>
                <Th>Updated</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const img = resolveImageUrl(p);
                return (
                  <tr key={p.id} onClick={() => onOpen(p.id)} className="cursor-pointer border-b border-border last:border-0 hover:bg-[#F8FAFC]">
                    <td className="p-2 align-middle">
                      <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-md border border-border bg-white">
                        {img ? <img src={img} alt={p.name} className="h-full w-full object-contain p-1" /> : (
                          <span className="font-mono text-[10px] font-bold text-muted-foreground">{p.sku.slice(0, 2)}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-2 align-middle font-mono text-[12px] font-bold text-ink">{p.sku}</td>
                    <td className="p-2 align-middle">
                      <div className="text-[13.5px] font-bold text-ink leading-tight">{p.name}</div>
                      <div className="mt-0.5 text-[11.5px] text-muted-foreground">{p.category}</div>
                    </td>
                    <td className="p-2 align-middle text-[12.5px] text-ink">{p.pack_size.toLocaleString()} / {p.pack_unit}</td>
                    <td className="p-2 align-middle text-right font-mono text-[12.5px] font-semibold text-ink">{formatBBD(Number(p.case_price))}</td>
                    <td className="p-2 align-middle text-right font-mono text-[11.5px] text-muted-foreground">{formatBBD(Number(p.unit_price))}</td>
                    <td className="p-2 align-middle"><StockChip status={p.stock_status} /></td>
                    <td className="p-2 align-middle text-right">
                      <div className={`font-mono text-[13px] font-bold ${p.track_inventory ? "text-ink" : "text-muted-foreground/60"}`}>
                        {p.track_inventory ? p.on_hand.toLocaleString() : "—"}
                      </div>
                      {p.track_inventory && p.reorder_point > 0 && (
                        <div className="text-[10.5px] text-muted-foreground">RP {p.reorder_point}</div>
                      )}
                    </td>
                    <td className="p-2 align-middle text-[11.5px] text-muted-foreground">{timeAgo(p.updated_at)}</td>
                    <td className="p-2 align-middle">
                      <div className="relative" ref={openMenu === p.id ? menuRef : undefined}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === p.id ? null : p.id); }}
                          className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-[#F1F4F8] hover:text-ink"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {openMenu === p.id && (
                          <div className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
                            <MenuItem onClick={() => { setOpenMenu(null); onOpen(p.id); }}>View</MenuItem>
                            <MenuItem onClick={() => { setOpenMenu(null); navigate({ to: "/office/products/$id/edit", params: { id: p.id } }); }}>Edit</MenuItem>
                            <MenuItem onClick={() => { setOpenMenu(null); onAction("duplicate", p); }}>Duplicate</MenuItem>
                            <MenuItem onClick={() => { setOpenMenu(null); onAction("adjust", p); }}>Adjust stock</MenuItem>
                            <MenuItem onClick={() => { setOpenMenu(null); onAction("toggle", p); }}>
                              {p.is_active ? "Deactivate" : "Activate"}
                            </MenuItem>
                            <MenuItem danger onClick={() => { setOpenMenu(null); onAction("archive", p); }}>Archive</MenuItem>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <div key={p.id} className="group relative" onClick={() => onOpen(p.id)}>
              <ProductCard product={toProductRow(p)} />
              <button
                onClick={(e) => { e.stopPropagation(); navigate({ to: "/office/products/$id/edit", params: { id: p.id } }); }}
                className="absolute right-2 top-2 z-20 grid h-8 w-8 place-items-center rounded-full border border-border bg-white text-ink opacity-0 shadow transition group-hover:opacity-100"
                aria-label="Edit"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-2 py-2.5 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ${className}`}>
      {children}
    </th>
  );
}

function MenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`block w-full px-3 py-2 text-left text-[12.5px] font-medium hover:bg-[#F1F4F8] ${danger ? "text-[#E11D48]" : "text-ink"}`}
    >
      {children}
    </button>
  );
}

function toProductRow(p: ProductFull): ProductRow {
  return {
    id: p.id, sku: p.sku, name: p.name, description: p.description,
    category: p.category, pack_size: p.pack_size, pack_unit: p.pack_unit,
    case_price: Number(p.case_price), unit_price: Number(p.unit_price),
    image_url: resolveImageUrl(p), stock_status: p.stock_status,
  };
}
