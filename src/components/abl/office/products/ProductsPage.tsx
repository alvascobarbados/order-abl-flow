import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Plus, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TabbedShell } from "@/components/abl/office/TabbedShell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ProductsCatalogTab } from "./ProductsCatalogTab";
import { ProductsStockTab } from "./ProductsStockTab";
import { ProductsCategoriesTab } from "./ProductsCategoriesTab";
import { ProductsLowStockTab } from "./ProductsLowStockTab";
import { ProductsArchivedTab } from "./ProductsArchivedTab";
import { ProductDetailDrawer } from "./ProductDetailDrawer";
import { AdjustStockModal } from "./AdjustStockModal";
import type { Category, ProductFull } from "@/lib/products";

type TabKey = "catalog" | "stock" | "categories" | "low_stock" | "archived";

export function ProductsPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { tab?: TabKey; open?: string };
  const [tab, setTab] = useState<TabKey>(search.tab ?? "catalog");
  const [products, setProducts] = useState<ProductFull[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [drawerId, setDrawerId] = useState<string | null>(search.open ?? null);
  const [adjustTarget, setAdjustTarget] = useState<ProductFull | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const reload = async () => {
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("sort_order", { ascending: true }),
    ]);
    setProducts((p ?? []) as unknown as ProductFull[]);
    setCategories((c ?? []) as Category[]);
  };

  useEffect(() => { reload(); }, []);

  const counts = useMemo(() => {
    const active = products.filter((p) => !p.archived_at && p.is_active).length;
    const inactive = products.filter((p) => !p.archived_at && !p.is_active).length;
    const low = products.filter((p) => !p.archived_at && p.stock_status === "low_stock").length;
    const oos = products.filter((p) => !p.archived_at && p.stock_status === "out_of_stock").length;
    const archived = products.filter((p) => !!p.archived_at).length;
    return { active, inactive, low, oos, archived, alerts: low + oos };
  }, [products]);

  const handleAction = async (action: "edit" | "duplicate" | "adjust" | "toggle" | "archive", p: ProductFull) => {
    if (action === "edit") navigate({ to: "/office/products/$id/edit", params: { id: p.id } });
    else if (action === "adjust") setAdjustTarget(p);
    else if (action === "toggle") {
      const { error } = await supabase.from("products").update({ is_active: !p.is_active }).eq("id", p.id);
      if (error) toast.error(error.message); else { toast.success(p.is_active ? "Deactivated" : "Activated"); reload(); }
    } else if (action === "archive") {
      const { error } = await supabase.from("products").update({ archived_at: new Date().toISOString(), is_active: false }).eq("id", p.id);
      if (error) toast.error(error.message); else { toast.success("Archived"); reload(); }
    } else if (action === "duplicate") {
      const { id, sku, created_at, updated_at, ...rest } = p as any;
      const { error } = await supabase.from("products").insert({ ...rest, sku: `${sku}-COPY`, name: `${p.name} (copy)` });
      if (error) toast.error(error.message); else { toast.success("Duplicated"); reload(); }
    }
  };

  return (
    <>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[10.5px] uppercase text-muted-foreground" style={{ letterSpacing: "0.12em" }}>OFFICE</div>
          <h1 className="mt-1 text-[24px] font-extrabold text-ink" style={{ letterSpacing: "-0.02em" }}>Products & Inventory</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            <span className="font-semibold text-ink">{counts.active}</span> active · <span>{counts.inactive}</span> inactive · <span className="font-semibold text-[color:var(--warning)]">{counts.low}</span> low stock · <span className="font-semibold text-[#E11D48]">{counts.oos}</span> out of stock
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" /> Import CSV</Button>
          <Button onClick={() => navigate({ to: "/office/products/new" })} className="bg-[#0B1A2E] hover:bg-[#1A3556]"><Plus className="h-4 w-4" /> New product</Button>
        </div>
      </div>

      <TabbedShell
        eyebrow=""
        title=""
        activeKey={tab}
        onTabChange={(k) => setTab(k as TabKey)}
        tabs={[
          { key: "catalog", label: "Catalog", count: counts.active + counts.inactive },
          { key: "stock", label: "Stock levels" },
          { key: "categories", label: "Categories", count: categories.length },
          { key: "low_stock", label: "Low stock alerts", count: counts.alerts },
          { key: "archived", label: "Archived", count: counts.archived, muted: true },
        ]}
      >
        {tab === "catalog" && <ProductsCatalogTab products={products} categories={categories} onOpen={setDrawerId} onAction={handleAction} />}
        {tab === "stock" && <ProductsStockTab products={products} onOpen={setDrawerId} />}
        {tab === "categories" && <ProductsCategoriesTab categories={categories} products={products} onChanged={reload} />}
        {tab === "low_stock" && <ProductsLowStockTab products={products} onOpen={setDrawerId} />}
        {tab === "archived" && <ProductsArchivedTab products={products} onChanged={reload} />}
      </TabbedShell>

      {drawerId && (
        <ProductDetailDrawer
          productId={drawerId}
          onClose={() => setDrawerId(null)}
          onAdjustStock={(p) => setAdjustTarget(p)}
          onChanged={reload}
        />
      )}

      {adjustTarget && (
        <AdjustStockModal product={adjustTarget} onClose={() => setAdjustTarget(null)} onDone={() => { setAdjustTarget(null); reload(); }} />
      )}

      {importOpen && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4" onClick={() => setImportOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[420px] rounded-xl border border-border bg-card p-6 text-center shadow-2xl">
            <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
            <div className="mt-2 text-[16px] font-extrabold text-ink">Import CSV</div>
            <p className="mt-1 text-[12.5px] text-muted-foreground">Bulk CSV import is coming soon.</p>
            <Button className="mt-4" variant="outline" onClick={() => setImportOpen(false)}>Close</Button>
          </div>
        </div>
      )}
    </>
  );
}
