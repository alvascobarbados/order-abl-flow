import { useNavigate } from "@tanstack/react-router";
import { X, ShoppingBag, Minus, Plus, Loader2 } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { formatBBD, splitVatInclusive } from "@/lib/format";
import { ProductImageFallback } from "./ProductImageFallback";

export function CartDrawer() {
  const { isOpen, close, lines, total, setQty, remove, loadingLineIds } = useCart();
  const navigate = useNavigate();
  const { subtotal } = splitVatInclusive(total);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={close}
        className={`fixed inset-0 z-[60] bg-black/50 transition-opacity ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      {/* Drawer */}
      <aside
        role="dialog"
        aria-label="Your cart"
        className={`fixed inset-y-0 right-0 z-[61] flex w-full flex-col bg-white shadow-2xl transition-transform sm:w-[440px] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[#E5E9EF] px-5 py-4">
          <h2 className="text-[15px] font-bold text-[#0B1A2E]">Your cart</h2>
          <span className="rounded-full bg-[#F1F4F8] px-2 py-0.5 text-[11px] font-semibold text-[#64748B]">
            {lines.length} {lines.length === 1 ? "item" : "items"}
          </span>
          <button
            type="button"
            onClick={close}
            className="ml-auto grid h-8 w-8 place-items-center rounded-md text-[#64748B] hover:bg-[#FAFBFC] hover:text-[#0B1A2E]"
            aria-label="Close cart"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
              <ShoppingBag className="h-12 w-12 text-[#CBD5E1]" strokeWidth={1.5} />
              <div>
                <p className="text-[14px] font-semibold text-[#0B1A2E]">Your cart is empty</p>
                <p className="mt-1 text-[12.5px] text-[#64748B]">
                  Browse the catalog to start an order
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="mt-2 text-[12px] font-semibold text-[#64748B] underline-offset-2 hover:text-[#0B1A2E] hover:underline"
              >
                Close
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-[#EEF1F5]">
              {lines.map((l) => {
                const lineTotal = Number(l.product.case_price) * l.quantity;
                const saving = loadingLineIds.has(l.id);
                return (
                  <li key={l.id} className="flex gap-3 px-5 py-4">
                    <div className="h-[60px] w-[60px] shrink-0 overflow-hidden rounded-md border border-[#EEF1F5] bg-white">
                      {l.product.image_url ? (
                        <img
                          src={l.product.image_url}
                          alt={l.product.name}
                          className="h-full w-full object-contain p-1"
                        />
                      ) : (
                        <ProductImageFallback
                          sku={l.product.sku}
                          category={l.product.category}
                        />
                      )}
                    </div>

                    <div className="flex flex-1 flex-col gap-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="line-clamp-2 text-[13px] font-bold leading-tight text-[#0B1A2E]">
                            {l.product.name}
                          </div>
                          <div className="mt-0.5 text-[10.5px] text-[#64748B]">
                            {l.product.sku}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => remove(l.id)}
                          className="-mt-1 -mr-1 grid h-6 w-6 place-items-center text-[#94A3B8] hover:text-[#E11D48]"
                          aria-label="Remove"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="mt-auto flex items-center justify-between">
                        <div
                          className={`grid h-[28px] grid-cols-[24px_1fr_24px] items-center rounded-[6px] border border-[#E5E9EF] ${
                            saving ? "opacity-60" : ""
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setQty(l.id, l.quantity - 1)}
                            disabled={saving}
                            className="grid h-full place-items-center text-[#64748B] hover:text-[#0B1A2E]"
                            aria-label="Decrease"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <div className="grid h-full place-items-center text-[12px] font-bold text-[#0B1A2E] tabular-nums">
                            {saving ? (
                              <Loader2 className="h-3 w-3 animate-spin text-[#64748B]" />
                            ) : (
                              l.quantity
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setQty(l.id, l.quantity + 1)}
                            disabled={saving}
                            className="grid h-full place-items-center text-[#64748B] hover:text-[#0B1A2E]"
                            aria-label="Increase"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="text-[13px] font-bold text-[#0B1A2E] tabular-nums">
                          {formatBBD(lineTotal)}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Summary */}
        {lines.length > 0 && (
          <div className="border-t border-[#E5E9EF] bg-[#FAFBFC] px-5 py-4">
            <dl className="space-y-1 text-[13px]">
              <div className="flex justify-between text-[#64748B]">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{formatBBD(subtotal)}</dd>
              </div>
              <div className="flex justify-between text-[#64748B]">
                <dt>VAT (17.5%)</dt>
                <dd>Included</dd>
              </div>
              <div className="mt-2 flex justify-between border-t border-[#E5E9EF] pt-2 text-[18px] font-extrabold text-[#0B1A2E]">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatBBD(total)}</dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={() => {
                close();
                navigate({ to: "/shop/checkout" });
              }}
              className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-[10px] bg-[#FF6A1A] text-[14px] font-bold text-white transition hover:bg-[#E85F12]"
            >
              Review order →
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
