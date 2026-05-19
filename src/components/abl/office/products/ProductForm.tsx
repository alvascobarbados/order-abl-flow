import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProductCard } from "@/components/abl/ProductCard";
import { ProductImageManager } from "./ProductImageManager";
import type { Category, ProductFull, StockStatusOverride } from "@/lib/products";
import { resolveImageUrl } from "@/lib/products";

const schema = z.object({
  sku: z.string().min(1, "SKU required").regex(/^[A-Z0-9-]+$/i, "Alphanumeric & dashes only"),
  name: z.string().min(2, "Name required").max(120),
  description: z.string().max(1000).optional().nullable(),
  category: z.string().min(1, "Category required"),
  barcode: z.string().optional().nullable(),
  supplier_sku: z.string().optional().nullable(),
  is_active: z.boolean(),
  pack_size: z.coerce.number().int().positive("Pack size > 0"),
  pack_unit: z.string().min(1).default("case"),
  case_price: z.coerce.number().positive("Case price > 0"),
  vat_inclusive: z.boolean(),
  cost_price: z.coerce.number().nullable().optional(),
  track_inventory: z.boolean(),
  on_hand: z.coerce.number().int().min(0).optional(),
  reorder_point: z.coerce.number().int().min(0),
  reorder_quantity: z.coerce.number().int().min(0),
  lead_time_days: z.coerce.number().int().min(0).nullable().optional(),
  stock_status_override: z.enum(["auto","in_stock","low_stock","out_of_stock"]),
  bin_location: z.string().optional().nullable(),
  supplier_name: z.string().optional().nullable(),
});

type FormVals = z.infer<typeof schema>;

const blank: FormVals = {
  sku: "", name: "", description: "", category: "",
  barcode: "", supplier_sku: "", is_active: true,
  pack_size: 1, pack_unit: "case",
  case_price: 0, vat_inclusive: true, cost_price: null,
  track_inventory: true, on_hand: 0,
  reorder_point: 0, reorder_quantity: 0, lead_time_days: null,
  stock_status_override: "auto",
  bin_location: "", supplier_name: "",
};

export function ProductForm({ initial, productId }: { initial?: ProductFull | null; productId?: string }) {
  const navigate = useNavigate();
  const isEdit = !!productId;
  const [vals, setVals] = useState<FormVals>(() => initial ? hydrate(initial) : blank);
  const [primary, setPrimary] = useState<string | null>(initial?.primary_image_url ?? initial?.image_url ?? null);
  const [secondary, setSecondary] = useState<string[]>(initial?.secondary_image_urls ?? []);
  const [categories, setCategories] = useState<Category[]>([]);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.from("categories").select("*").order("sort_order", { ascending: true })
      .then(({ data }) => setCategories((data ?? []) as Category[]));
  }, []);

  const set = <K extends keyof FormVals>(k: K, v: FormVals[K]) => setVals((p) => ({ ...p, [k]: v }));

  const unitPrice = useMemo(() => {
    if (!vals.pack_size || vals.pack_size <= 0) return 0;
    return Number(vals.case_price) / vals.pack_size;
  }, [vals.case_price, vals.pack_size]);

  const validate = (): boolean => {
    const r = schema.safeParse(vals);
    if (!r.success) {
      const e: Record<string, string> = {};
      r.error.issues.forEach((i) => { if (i.path[0]) e[String(i.path[0])] = i.message; });
      setErrors(e);
      return false;
    }
    setErrors({});
    return true;
  };

  const save = async (after: "view" | "another" | "list" | "drawer") => {
    if (!validate()) { toast.error("Fix the form errors"); return; }
    setBusy(true);
    try {
      const payload: any = {
        sku: vals.sku.toUpperCase(),
        name: vals.name,
        description: vals.description || null,
        category: vals.category,
        barcode: vals.barcode || null,
        supplier_sku: vals.supplier_sku || null,
        is_active: vals.is_active,
        pack_size: vals.pack_size,
        pack_unit: vals.pack_unit,
        case_price: vals.case_price,
        unit_price: unitPrice,
        vat_inclusive: vals.vat_inclusive,
        cost_price: vals.cost_price ?? null,
        track_inventory: vals.track_inventory,
        reorder_point: vals.reorder_point,
        reorder_quantity: vals.reorder_quantity,
        lead_time_days: vals.lead_time_days ?? null,
        stock_status_override: vals.stock_status_override,
        bin_location: vals.bin_location || null,
        supplier_name: vals.supplier_name || null,
        primary_image_url: primary,
        image_url: primary, // legacy mirror
        secondary_image_urls: secondary,
      };
      if (!isEdit) payload.on_hand = vals.on_hand ?? 0;

      let savedId = productId;
      if (isEdit) {
        const { error } = await supabase.from("products").update(payload).eq("id", productId!);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("products").insert(payload).select("id").single();
        if (error) throw error;
        savedId = data.id;
      }
      toast.success(isEdit ? "Product updated" : "Product created");
      if (after === "another") {
        setVals(blank); setPrimary(null); setSecondary([]);
      } else if (after === "view" && savedId) {
        navigate({ to: "/office/products", search: { open: savedId } as any });
      } else {
        navigate({ to: "/office/products" });
      }
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <Section title="1. Basics">
          <Grid2>
            <Field label="SKU" error={errors.sku}>
              <Input value={vals.sku} onChange={(e) => set("sku", e.target.value.toUpperCase())} placeholder="ECW-CONT-001" />
            </Field>
            <Field label="Category" error={errors.category}>
              <select value={vals.category} onChange={(e) => set("category", e.target.value)} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-[13px]">
                <option value="">Select…</option>
                {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </Field>
          </Grid2>
          <Field label="Product name" error={errors.name}>
            <Input value={vals.name} onChange={(e) => set("name", e.target.value)} placeholder="8oz Foam Container" />
          </Field>
          <Field label="Description">
            <Textarea value={vals.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={3} />
          </Field>
          <Grid2>
            <Field label="Barcode"><Input value={vals.barcode ?? ""} onChange={(e) => set("barcode", e.target.value)} /></Field>
            <Field label="Supplier SKU"><Input value={vals.supplier_sku ?? ""} onChange={(e) => set("supplier_sku", e.target.value)} /></Field>
          </Grid2>
          <label className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
            <input type="checkbox" checked={vals.is_active} onChange={(e) => set("is_active", e.target.checked)} />
            Active — visible to customers
          </label>
        </Section>

        <Section title="2. Pack & units">
          <Grid2>
            <Field label="Pack size" error={errors.pack_size}><Input type="number" value={vals.pack_size} onChange={(e) => set("pack_size", parseInt(e.target.value, 10) || 0)} /></Field>
            <Field label="Pack unit"><Input value={vals.pack_unit} onChange={(e) => set("pack_unit", e.target.value)} /></Field>
          </Grid2>
          <div className="rounded-md bg-[#F1F4F8] px-3 py-2 text-[12px] text-muted-foreground">
            Customers see: <span className="font-bold text-ink">{vals.pack_size.toLocaleString()} / {vals.pack_unit}</span>
          </div>
        </Section>

        <Section title="3. Pricing">
          <Grid2>
            <Field label="Case price (BBD$)" error={errors.case_price}>
              <Input type="number" step="0.01" value={vals.case_price} onChange={(e) => set("case_price", parseFloat(e.target.value) || 0)} />
            </Field>
            <Field label="Unit price (auto)">
              <Input value={unitPrice.toFixed(2)} readOnly className="bg-[#F8FAFC] text-muted-foreground" />
            </Field>
          </Grid2>
          <label className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
            <input type="checkbox" checked={vals.vat_inclusive} onChange={(e) => set("vat_inclusive", e.target.checked)} />
            Price is VAT-inclusive (Barbados standard)
          </label>
        </Section>

        <Section title="4. Stock">
          <label className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
            <input type="checkbox" checked={vals.track_inventory} onChange={(e) => set("track_inventory", e.target.checked)} />
            Track inventory
          </label>
          {vals.track_inventory && (
            <>
              <Grid2>
                {!isEdit && <Field label="Initial on hand"><Input type="number" value={vals.on_hand ?? 0} onChange={(e) => set("on_hand", parseInt(e.target.value, 10) || 0)} /></Field>}
                <Field label="Reorder point"><Input type="number" value={vals.reorder_point} onChange={(e) => set("reorder_point", parseInt(e.target.value, 10) || 0)} /></Field>
              </Grid2>
              <Grid2>
                <Field label="Reorder quantity"><Input type="number" value={vals.reorder_quantity} onChange={(e) => set("reorder_quantity", parseInt(e.target.value, 10) || 0)} /></Field>
                <Field label="Lead time (days)"><Input type="number" value={vals.lead_time_days ?? ""} onChange={(e) => set("lead_time_days", e.target.value ? parseInt(e.target.value, 10) : null)} /></Field>
              </Grid2>
            </>
          )}
          <Field label="Stock status">
            <select value={vals.stock_status_override} onChange={(e) => set("stock_status_override", e.target.value as StockStatusOverride)} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-[13px]">
              <option value="auto">Auto (compute from on-hand)</option>
              <option value="in_stock">Force In Stock</option>
              <option value="low_stock">Force Low Stock</option>
              <option value="out_of_stock">Force Sold Out</option>
            </select>
          </Field>
        </Section>

        <Section title="5. Storage & supplier">
          <Grid2>
            <Field label="Bin location"><Input value={vals.bin_location ?? ""} onChange={(e) => set("bin_location", e.target.value)} placeholder="A-12" /></Field>
            <Field label="Primary supplier"><Input value={vals.supplier_name ?? ""} onChange={(e) => set("supplier_name", e.target.value)} /></Field>
          </Grid2>
        </Section>

        <Section title="6. Images">
          <ProductImageManager
            productIdHint={productId ?? "new"}
            primary={primary}
            secondary={secondary}
            onChange={({ primary: p, secondary: s }) => { setPrimary(p); setSecondary(s); }}
          />
        </Section>
      </div>

      <aside className="space-y-3">
        <div className="sticky top-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">How customers will see this</div>
          <div className="pointer-events-none">
            <ProductCard product={{
              id: "preview", sku: vals.sku || "SKU", name: vals.name || "Product name",
              description: vals.description ?? null, category: vals.category || "—",
              pack_size: vals.pack_size || 1, pack_unit: vals.pack_unit || "case",
              case_price: vals.case_price || 0, unit_price: unitPrice,
              image_url: primary, stock_status: vals.stock_status_override === "auto" ? "in_stock" : (vals.stock_status_override as any),
            }} />
          </div>
          {Object.keys(errors).length > 0 && (
            <div className="mt-3 rounded-md border border-[#FECACA] bg-[#FEF2F2] p-3">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-[#E11D48]">Fix these</div>
              <ul className="space-y-1 text-[11.5px] text-[#7F1D1D]">
                {Object.entries(errors).map(([k, v]) => <li key={k}>· <span className="font-semibold">{k}</span>: {v}</li>)}
              </ul>
            </div>
          )}
        </div>
      </aside>

      <div className="sticky bottom-0 z-10 -mx-6 col-span-full mt-2 flex items-center justify-end gap-2 border-t border-border bg-card/95 px-6 py-3 backdrop-blur">
        <Button variant="ghost" onClick={() => navigate({ to: "/office/products" })}>Cancel</Button>
        {!isEdit && <Button variant="outline" onClick={() => save("another")} disabled={busy}>Save & add another</Button>}
        {isEdit && <Button variant="outline" onClick={() => save("view")} disabled={busy}>Save & view</Button>}
        <Button onClick={() => save("list")} disabled={busy} className="bg-[#0B1A2E] hover:bg-[#1A3556]">
          {busy ? "Saving..." : "Save product"}
        </Button>
      </div>
    </div>
  );
}

function hydrate(p: ProductFull): FormVals {
  return {
    sku: p.sku, name: p.name, description: p.description ?? "",
    category: p.category, barcode: p.barcode ?? "", supplier_sku: p.supplier_sku ?? "",
    is_active: p.is_active,
    pack_size: p.pack_size, pack_unit: p.pack_unit,
    case_price: Number(p.case_price), vat_inclusive: p.vat_inclusive, cost_price: p.cost_price,
    track_inventory: p.track_inventory, on_hand: p.on_hand,
    reorder_point: p.reorder_point, reorder_quantity: p.reorder_quantity,
    lead_time_days: p.lead_time_days, stock_status_override: p.stock_status_override,
    bin_location: p.bin_location ?? "", supplier_name: p.supplier_name ?? "",
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 text-[13px] font-extrabold uppercase tracking-wider text-ink">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
      {error && <div className="mt-1 text-[11px] font-semibold text-[#E11D48]">{error}</div>}
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}
