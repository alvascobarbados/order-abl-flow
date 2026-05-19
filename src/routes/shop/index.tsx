import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Check, PackageSearch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/abl/AppHeader";
import { ProductCard, type ProductRow } from "@/components/abl/ProductCard";
import { FloatingActions } from "@/components/abl/FloatingActions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/shop/")({ component: CatalogPage });

const CATEGORIES = [
  "All",
  "Containers",
  "Cutlery",
  "Bowls",
  "Clamshells",
  "Cups & Lids",
  "Bags",
  "Napkins",
  "Cleaning",
] as const;

type Cat = (typeof CATEGORIES)[number];
type Sort = "popular" | "name" | "price_asc" | "price_desc";

const SORT_LABELS: Record<Sort, string> = {
  popular: "Popular",
  name: "Name (A–Z)",
  price_asc: "Price (low → high)",
  price_desc: "Price (high → low)",
};

function CatalogPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Cat>("Containers");
  const [inStockOnly, setInStockOnly] = useState(true);
  const [sort, setSort] = useState<Sort>("popular");

  useEffect(() => {
    // Pinned to first customer (Cosy Cafe) per dev setup; no per-customer pricing in v1.
    supabase
      .from("products")
      .select(
        "id, sku, name, description, category, pack_size, pack_unit, case_price, unit_price, image_url, stock_status",
      )
      .eq("is_active", true)
      .limit(12)
      .then(({ data }) => {
        setProducts((data ?? []) as unknown as ProductRow[]);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = products.filter(
      (p) =>
        (category === "All" || p.category === category) &&
        (!inStockOnly || p.stock_status !== "out_of_stock") &&
        (!q ||
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)),
    );
    switch (sort) {
      case "name":
        list = [...list].sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "price_asc":
        list = [...list].sort((a, b) => Number(a.case_price) - Number(b.case_price));
        break;
      case "price_desc":
        list = [...list].sort((a, b) => Number(b.case_price) - Number(a.case_price));
        break;
    }
    return list;
  }, [products, search, category, inStockOnly, sort]);

  return (
    <div className="min-h-screen bg-[#F6F7F9]">
      <AppHeader search={search} onSearchChange={setSearch} />

      {/* Category chips nav */}
      <nav className="border-b border-[#E5E9EF] bg-white">
        <div className="mx-auto max-w-7xl overflow-x-auto px-6 py-3">
          <div className="flex gap-2">
            {CATEGORIES.map((c) => {
              const active = category === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`shrink-0 rounded-full border px-[14px] py-[6px] text-[12.5px] font-semibold transition ${
                    active
                      ? "border-[#0F2540] bg-[#0F2540] text-white"
                      : "border-[#E5E9EF] bg-[#FAFBFC] text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0B1A2E]"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Toolbar row */}
      <div className="border-b border-[#E5E9EF] bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-[14px]">
          <div className="flex items-center gap-5">
            <div className="text-[13px] text-[#64748B]">
              Showing <span className="font-bold text-[#0B1A2E]">{filtered.length}</span> of{" "}
              <span className="font-bold text-[#0B1A2E]">{products.length}</span> products
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[#64748B]">
              <button
                type="button"
                role="checkbox"
                aria-checked={inStockOnly}
                onClick={() => setInStockOnly((v) => !v)}
                className={`grid h-4 w-4 place-items-center rounded-[3px] border-[1.5px] transition ${
                  inStockOnly
                    ? "border-[#0F2540] bg-[#0F2540]"
                    : "border-[#CBD5E1] bg-white hover:border-[#0F2540]"
                }`}
              >
                {inStockOnly && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
              </button>
              <span>In stock only</span>
            </label>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#E5E9EF] bg-white px-3 py-1.5 text-[13px] text-[#64748B] hover:border-[#CBD5E1]">
              Sort: <span className="font-semibold text-[#0B1A2E]">{SORT_LABELS[sort]}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[180px]">
              {(Object.keys(SORT_LABELS) as Sort[]).map((s) => (
                <DropdownMenuItem key={s} onClick={() => setSort(s)}>
                  {SORT_LABELS[s]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Product grid */}
      <main className="mx-auto max-w-7xl px-6 py-6">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-white" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-dashed border-[#E5E9EF] bg-white p-12 text-center">
            <PackageSearch className="h-10 w-10 text-[#CBD5E1]" strokeWidth={1.5} />
            <p className="text-sm text-[#64748B]">
              No products match your filters. Try clearing "In stock only" or selecting a different category.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </main>

      <FloatingActions />
    </div>
  );
}
