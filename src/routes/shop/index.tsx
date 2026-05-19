import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/abl/AppHeader";
import { ProductCard, type ProductRow } from "@/components/abl/ProductCard";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/shop/")({ component: CatalogPage });

const CATEGORIES = ["All", "Containers", "Cutlery", "Bowls", "Clamshells", "Cups & Lids", "Bags", "Napkins", "Cleaning"] as const;
type Sort = "popular" | "name" | "price_asc" | "price_desc";

function CatalogPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("popular");

  useEffect(() => {
    supabase
      .from("products")
      .select("id, sku, name, description, category, pack_size, pack_unit, case_price, unit_price, image_url, stock_status")
      .eq("is_active", true)
      .then(({ data }) => {
        setProducts((data ?? []) as unknown as ProductRow[]);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = products.filter(p =>
      (category === "All" || p.category === category) &&
      (!inStockOnly || p.stock_status !== "out_of_stock") &&
      (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
    );
    switch (sort) {
      case "name":       list = [...list].sort((a, b) => a.name.localeCompare(b.name)); break;
      case "price_asc":  list = [...list].sort((a, b) => Number(a.case_price) - Number(b.case_price)); break;
      case "price_desc": list = [...list].sort((a, b) => Number(b.case_price) - Number(a.case_price)); break;
    }
    return list;
  }, [products, search, category, inStockOnly, sort]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader search={search} onSearchChange={setSearch} />

      <div className="sticky top-[57px] z-30 border-b border-border bg-background md:top-[65px]">
        <div className="mx-auto max-w-7xl overflow-x-auto px-4 py-3">
          <div className="flex gap-2">
            {CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                  category === c
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-ink hover:border-primary/40"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            Showing <span className="font-semibold text-ink">{filtered.length}</span> of {products.length} products
          </div>
          <div className="flex items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Switch checked={inStockOnly} onCheckedChange={setInStockOnly} />
              <span className="text-muted-foreground">In stock only</span>
            </label>
            <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
              <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="popular">Popular</SelectItem>
                <SelectItem value="name">Name (A–Z)</SelectItem>
                <SelectItem value="price_asc">Price (low → high)</SelectItem>
                <SelectItem value="price_desc">Price (high → low)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-secondary" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
            No products match your filters.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {filtered.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </main>
    </div>
  );
}
