import { useState } from "react";
import { ShoppingCart, Package, Loader2 } from "lucide-react";
import { ProductImageFallback } from "./ProductImageFallback";
import { useCart } from "@/hooks/use-cart";
import { supabase } from "@/integrations/supabase/client";
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

const STOCK = {
  in_stock: { label: "In stock", dot: "#10B981", halo: "#ECFDF5", text: "#0B1A2E" },
  low_stock: { label: "Low stock", dot: "#F59E0B", halo: "#FFFBEB", text: "#B45309" },
  out_of_stock: { label: "Sold out", dot: "#E11D48", halo: "#FFF1F2", text: "#E11D48" },
} as const;

export function ProductCard({ product }: { product: ProductRow }) {
  const { add, customerId } = useCart();
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const soldOut = product.stock_status === "out_of_stock";
  const stock = STOCK[product.stock_status];

  const caseNum = Number(product.case_price).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const unitNum = Number(product.unit_price).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const packSize = Number(product.pack_size).toLocaleString("en-US");

  const onAdd = async () => {
    if (busy) return;
    const clean = Math.max(1, Math.min(999, Math.floor(qty)));
    setBusy(true);
    try {
      await add(product.id, clean);
      toast.success(`Added to cart`, {
        description: `${packSize} × ${product.name}`,
        duration: 2500,
      });
      setQty(1);
    } finally {
      setBusy(false);
    }
  };

  const onNotify = async () => {
    if (!customerId) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("stock_notification_requests")
        .insert({ customer_id: customerId, product_id: product.id });
      if (error) throw error;
      toast.success("We'll let you know when it's back", {
        description: `${product.sku} · ${product.name}`,
        duration: 2500,
      });
    } catch (e: any) {
      toast.error(e.message ?? "Could not save request");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="group flex flex-col overflow-hidden rounded-[12px] border border-[#E5E9EF] bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-[#CBD5E1] hover:shadow-[0_8px_24px_-12px_rgba(15,37,64,0.18)]">
      <div
        className={`relative aspect-square border-b border-[#EEF1F5] bg-white ${
          soldOut ? "opacity-50 grayscale" : ""
        }`}
      >
        <span className="absolute left-2 top-2 z-10 rounded-[5px] border border-[#E5E9EF] bg-white/80 px-1.5 py-0.5 font-mono text-[9.5px] font-medium text-[#64748B] backdrop-blur">
          {product.sku}
        </span>
        <span
          className="absolute right-2 top-2 z-10 inline-flex items-center gap-1.5 rounded-full border border-[#E5E9EF] bg-white px-2 py-[3px] text-[10.5px] font-semibold"
          style={{ color: stock.text }}
        >
          <span
            className="h-[5px] w-[5px] rounded-full"
            style={{ backgroundColor: stock.dot, boxShadow: `0 0 0 3px ${stock.halo}` }}
          />
          {stock.label}
        </span>

        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-contain p-3"
          />
        ) : (
          <ProductImageFallback sku={product.sku} category={product.category} />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-[10px]">
        <h3 className="line-clamp-2 min-h-[34px] text-[13px] font-bold leading-[1.3] tracking-[-0.01em] text-[#0B1A2E] md:text-[14px]">
          {product.name}
        </h3>

        <span className="inline-flex w-fit items-center gap-1 self-start rounded-[5px] bg-[#F1F4F8] px-[7px] py-[3px] text-[10.5px] font-semibold text-[#0F2540]">
          <Package className="h-3 w-3" strokeWidth={2} />
          {packSize} / {product.pack_unit}
        </span>

        <div className="border-t border-dashed border-[#E5E9EF] pt-1.5">
          <div className="flex items-baseline gap-1 text-[16px] font-extrabold leading-tight tracking-[-0.02em] text-[#0B1A2E] md:text-[18px]">
            <span className="text-[10px] font-medium text-[#64748B]">BBD$</span>
            <span>{caseNum}</span>
            <span className="text-[10.5px] font-medium text-[#64748B]">/case</span>
          </div>
          <div className="text-[10.5px] text-[#64748B]">
            <span className="font-bold text-[#0B1A2E]">${unitNum}</span>
            /unit · incl. VAT
          </div>
        </div>

        <div className="mt-1 grid grid-cols-[78px_1fr] gap-1.5">
          <div
            className={`grid h-[34px] grid-cols-[24px_1fr_24px] items-center rounded-[7px] border border-[#E5E9EF] ${
              soldOut ? "pointer-events-none opacity-40" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="grid h-full place-items-center text-[#64748B] hover:text-[#0B1A2E]"
              aria-label="Decrease"
            >
              −
            </button>
            <input
              type="text"
              inputMode="numeric"
              value={qty}
              onChange={(e) => {
                const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
                setQty(Number.isFinite(n) ? Math.min(999, Math.max(1, n)) : 1);
              }}
              className="h-full w-full border-0 bg-transparent text-center text-[12px] font-bold text-[#0B1A2E] outline-none"
            />
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(999, q + 1))}
              className="grid h-full place-items-center text-[#64748B] hover:text-[#0B1A2E]"
              aria-label="Increase"
            >
              +
            </button>
          </div>

          {soldOut ? (
            <button
              type="button"
              onClick={onNotify}
              disabled={busy}
              className="inline-flex h-[34px] cursor-not-allowed items-center justify-center rounded-[7px] bg-[#F1F4F8] text-[12px] font-semibold text-[#64748B] disabled:opacity-60"
            >
              Notify
            </button>
          ) : (
            <button
              type="button"
              onClick={onAdd}
              disabled={busy}
              className="inline-flex h-[34px] items-center justify-center gap-1 rounded-[7px] bg-[#0F2540] text-[12px] font-semibold text-white transition hover:bg-[#1A3556] disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-[13px] w-[13px] animate-spin" />
              ) : (
                <>
                  <ShoppingCart className="h-[13px] w-[13px]" strokeWidth={2} />
                  Add
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
