import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import { useNavigate } from "@tanstack/react-router";
import { X, Pencil, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBBD, formatDate } from "@/lib/format";
import { resolveImageUrl, timeAgo, MOVEMENT_LABEL, type ProductFull, type StockMovement } from "@/lib/products";
import { StockChip } from "@/components/abl/StockChip";
import { Button } from "@/components/ui/button";
import { ProductImageManager } from "./ProductImageManager";
import { toast } from "sonner";

type Tab = "overview" | "stock" | "pricing" | "images" | "activity";

export function ProductDetailDrawer({ productId, onClose, onAdjustStock, onChanged }: {
  productId: string;
  onClose: () => void;
  onAdjustStock: (p: ProductFull) => void;
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");

  const productQuery = useQuery({
    queryKey: qk.productById(productId),
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("id", productId).maybeSingle();
      if (error) throw error;
      return data as unknown as ProductFull | null;
    },
    staleTime: 10_000,
  });

  const movementsQuery = useQuery({
    queryKey: qk.stockMovements(productId),
    queryFn: async () => {
      const { data, error } = await supabase.from("stock_movements")
        .select("*").eq("product_id", productId)
        .order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as StockMovement[];
    },
    staleTime: 10_000,
  });

  const activityQuery = useQuery({
    queryKey: ["product-activity", productId],
    queryFn: async () => {
      const { data, error } = await supabase.from("activity_log")
        .select("id, description, created_at").eq("related_product_id", productId)
        .order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; description: string; created_at: string }>;
    },
    staleTime: 10_000,
  });

  const product = productQuery.data ?? null;
  const movements = movementsQuery.data ?? [];
  const activity = activityQuery.data ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: qk.productById(productId) });
    queryClient.invalidateQueries({ queryKey: qk.stockMovements(productId) });
    queryClient.invalidateQueries({ queryKey: ["product-activity", productId] });
    queryClient.invalidateQueries({ queryKey: qk.products() });
  };

  const toggleMutation = useMutation({
    mutationFn: async () => {
      if (!product) throw new Error("No product");
      const { error } = await supabase.from("products").update({ is_active: !product.is_active }).eq("id", product.id);
      if (error) throw error;
      return product.is_active ? "Deactivated" : "Activated";
    },
    onSuccess: (msg) => { toast.success(msg); invalidate(); onChanged(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const imagesMutation = useMutation({
    mutationFn: async (input: { primary: string | null; secondary: string[] }) => {
      if (!product) throw new Error("No product");
      const { error } = await supabase.from("products")
        .update({ primary_image_url: input.primary, image_url: input.primary, secondary_image_urls: input.secondary })
        .eq("id", product.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Images saved"); invalidate(); onChanged(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  if (!product) {
    return (
      <div className="fixed inset-0 z-50 flex" onClick={onClose}>
        <div className="flex-1 bg-black/40" />
        <div className="grid w-[760px] place-items-center bg-card" onClick={(e) => e.stopPropagation()}>
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const toggleActive = () => toggleMutation.mutate();
  const saveImages = (primary: string | null, secondary: string[]) => imagesMutation.mutate({ primary, secondary });

  const img = resolveImageUrl(product);

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/40" />
      <div className="flex w-[760px] flex-col bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Sticky header */}
        <div className="sticky top-0 z-10 border-b border-border bg-card p-5">
          <div className="flex items-start gap-4">
            <div className="grid h-20 w-20 flex-shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-white">
              {img ? <img src={img} alt={product.name} className="h-full w-full object-contain p-1.5" /> : (
                <span className="font-mono text-[12px] font-bold text-muted-foreground">{product.sku.slice(0, 3)}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-[22px] font-extrabold leading-tight text-ink" style={{ letterSpacing: "-0.02em" }}>{product.name}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[11px] font-bold text-muted-foreground">{product.sku}</span>
                    <span className="rounded bg-[#F1F4F8] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#0F2540]">{product.category}</span>
                    <StockChip status={product.stock_status} />
                  </div>
                </div>
                <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-[#F1F4F8] hover:text-ink">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => navigate({ to: "/office/products/$id/edit", params: { id: product.id } })}>
                  <Pencil className="h-3 w-3" /> Edit
                </Button>
                <Button size="sm" variant="outline" onClick={toggleActive}>
                  {product.is_active ? "Deactivate" : "Activate"}
                </Button>
                <Button size="sm" onClick={() => onAdjustStock(product)} className="bg-[#0B1A2E] hover:bg-[#1A3556]">Adjust stock</Button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-1">
            {(["overview", "stock", "pricing", "images", "activity"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                  tab === t ? "bg-[#0B1A2E] text-white" : "text-[#64748B] hover:bg-[#F1F4F8] hover:text-ink"
                }`}
              >
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === "overview" && <OverviewTab product={product} />}
          {tab === "stock" && <StockTab product={product} movements={movements} onAdjust={() => onAdjustStock(product)} />}
          {tab === "pricing" && <PricingTab product={product} />}
          {tab === "images" && (
            <ProductImageManager
              productIdHint={product.id}
              primary={product.primary_image_url}
              secondary={product.secondary_image_urls}
              onChange={({ primary, secondary }) => saveImages(primary, secondary)}
            />
          )}
          {tab === "activity" && <ActivityTab events={activity} />}
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ product }: { product: ProductFull }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card title="Product info">
          <Row k="SKU" v={product.sku} mono />
          <Row k="Category" v={product.category} />
          <Row k="Pack" v={`${product.pack_size.toLocaleString()} / ${product.pack_unit}`} />
          <Row k="Barcode" v={product.barcode ?? "—"} mono />
          <Row k="Supplier SKU" v={product.supplier_sku ?? "—"} mono />
          <Row k="Description" v={product.description ?? "—"} />
        </Card>
        <Card title="Pricing">
          <Row k="Case price" v={formatBBD(Number(product.case_price))} />
          <Row k="Unit price" v={formatBBD(Number(product.unit_price))} />
          <Row k="VAT" v={product.vat_inclusive ? "Inclusive" : "Exclusive"} />
        </Card>
      </div>
    </div>
  );
}

function StockTab({ product, movements, onAdjust }: { product: ProductFull; movements: StockMovement[]; onAdjust: () => void }) {
  const velocity = movements.filter((m) => m.movement_type === "sold" && Date.now() - new Date(m.created_at).getTime() < 28 * 86400_000)
    .reduce((s, m) => s + Math.abs(m.quantity), 0) / 4;
  const days = velocity > 0 ? (product.on_hand / (velocity / 7)).toFixed(1) : "—";
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-2">
        <Metric label="On hand" value={product.on_hand} />
        <Metric label="Reorder point" value={product.reorder_point} />
        <Metric label="Reorder qty" value={product.reorder_quantity} />
        <Metric label="Days of stock" value={days} />
        <Metric label="Weekly velocity" value={velocity.toFixed(1)} />
      </div>
      <Button onClick={onAdjust} className="bg-[#0B1A2E] hover:bg-[#1A3556]">Adjust stock</Button>
      <Card title="Stock movements">
        {movements.length === 0 ? (
          <div className="py-6 text-center text-[12px] text-muted-foreground">No movements yet.</div>
        ) : (
          <div className="space-y-1">
            {movements.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div className="flex items-center gap-2.5">
                  {m.quantity >= 0
                    ? <ArrowUp className="h-3.5 w-3.5 text-[color:var(--success)]" />
                    : <ArrowDown className="h-3.5 w-3.5 text-[#E11D48]" />}
                  <div>
                    <div className="text-[12.5px] font-semibold text-ink">{MOVEMENT_LABEL[m.movement_type]}</div>
                    <div className="text-[10.5px] text-muted-foreground">{formatDate(m.created_at)} · {m.reference ?? m.reason ?? "—"}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-[13px] font-bold ${m.quantity >= 0 ? "text-[color:var(--success)]" : "text-[#E11D48]"}`}>
                    {m.quantity > 0 ? "+" : ""}{m.quantity}
                  </div>
                  <div className="text-[10.5px] text-muted-foreground">→ {m.balance_after}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function PricingTab({ product }: { product: ProductFull }) {
  return (
    <div className="space-y-4">
      <Card title="Current pricing">
        <div className="text-[36px] font-extrabold text-ink" style={{ letterSpacing: "-0.02em" }}>{formatBBD(Number(product.case_price))}</div>
        <div className="text-[12px] text-muted-foreground">per {product.pack_unit} · {formatBBD(Number(product.unit_price))} / unit{product.vat_inclusive ? " · incl. VAT" : ""}</div>
      </Card>
      <div className="rounded-xl border border-dashed border-border bg-[#F8FAFC] p-6 text-center text-[12.5px] text-muted-foreground">
        Tier pricing coming soon
      </div>
    </div>
  );
}

function ActivityTab({ events }: { events: Array<{ id: string; description: string; created_at: string }> }) {
  if (events.length === 0) return <div className="rounded-md border border-dashed border-border p-6 text-center text-[12px] text-muted-foreground">No activity yet</div>;
  return (
    <div className="space-y-2">
      {events.map((e) => (
        <div key={e.id} className="rounded-md border border-border p-3">
          <div className="text-[12.5px] text-ink">{e.description}</div>
          <div className="mt-0.5 text-[10.5px] text-muted-foreground">{timeAgo(e.created_at)}</div>
        </div>
      ))}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border py-1.5 last:border-0">
      <span className="text-[12px] text-muted-foreground">{k}</span>
      <span className={`text-right text-[12.5px] text-ink ${mono ? "font-bold" : "font-semibold"}`}>{v}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border p-3 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-[18px] font-extrabold text-ink">{value}</div>
    </div>
  );
}
