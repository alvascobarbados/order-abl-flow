import { useState } from "react";
import { Minus, Plus, ShoppingCart, BellRing, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBBD, formatPackSize } from "@/lib/format";
import { ProductImageFallback } from "./ProductImageFallback";
import { StockChip } from "./StockChip";
import { useCart } from "@/hooks/use-cart";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export interface ProductRow {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string;
  pack_size: number;
  pack_unit: string;
  case_price: number;
  unit_price: number;
  image_url: string | null;
  stock_status: "in_stock" | "low_stock" | "out_of_stock";
}

export function ProductCard({ product }: { product: ProductRow }) {
  const { add } = useCart();
  const { session } = useAuth();
  const [qty, setQty] = useState(1);
  const soldOut = product.stock_status === "out_of_stock";

  const onAdd = async () => {
    await add(product.id, qty);
    toast.success(`Added ${qty} × ${product.sku} to cart`);
    setQty(1);
  };

  const onNotify = async () => {
    if (!session?.user?.id) return;
    await supabase.from("stock_notification_requests").insert({
      user_id: session.user.id,
      product_id: product.id,
    });
    toast.success(`We'll let ABL know you're waiting on ${product.sku}.`);
  };

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px_rgba(15,37,64,0.18)]">
      <div className={`relative aspect-square overflow-hidden bg-white ${soldOut ? "opacity-50" : ""}`}>
        <span className="absolute left-2 top-2 z-10 rounded-md bg-white/85 px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wider text-primary backdrop-blur">
          {product.sku}
        </span>
        <span className="absolute right-2 top-2 z-10">
          <StockChip status={product.stock_status} />
        </span>
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="h-full w-full object-contain p-4" />
        ) : (
          <ProductImageFallback sku={product.sku} category={product.category} />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="line-clamp-2 min-h-[2.75rem] text-sm font-semibold leading-snug text-ink">
            {product.name}
          </h3>
          <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
            <Box className="h-3 w-3" />
            {formatPackSize(product.pack_size)} / {product.pack_unit}
          </span>
        </div>

        <div className="mt-auto">
          <div className="text-lg font-bold tracking-tight text-ink">
            {formatBBD(Number(product.case_price))}
            <span className="ml-1 text-xs font-medium text-muted-foreground">/case</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {formatBBD(Number(product.unit_price)).replace("BBD$ ", "$")}/unit · incl. VAT
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border">
            <button
              type="button"
              disabled={soldOut || qty <= 1}
              onClick={() => setQty(q => Math.max(1, q - 1))}
              className="grid h-9 w-9 place-items-center text-muted-foreground hover:text-ink disabled:opacity-40"
              aria-label="Decrease quantity"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-[2ch] text-center text-sm font-semibold tabular-nums">{qty}</span>
            <button
              type="button"
              disabled={soldOut}
              onClick={() => setQty(q => q + 1)}
              className="grid h-9 w-9 place-items-center text-muted-foreground hover:text-ink disabled:opacity-40"
              aria-label="Increase quantity"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {soldOut ? (
            <Button onClick={onNotify} variant="outline" className="flex-1 gap-1.5">
              <BellRing className="h-4 w-4" /> Notify
            </Button>
          ) : (
            <Button onClick={onAdd} className="flex-1 gap-1.5 bg-primary hover:bg-primary-dark">
              <ShoppingCart className="h-4 w-4" /> Add
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
