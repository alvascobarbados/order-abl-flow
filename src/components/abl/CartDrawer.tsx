import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { formatBBD, splitVatInclusive } from "@/lib/format";
import { ProductImageFallback } from "./ProductImageFallback";
import { useState } from "react";
import { PlaceOrderModal } from "./PlaceOrderModal";

export function CartDrawer() {
  const { isOpen, close, lines, total, setQty, remove } = useCart();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { subtotal, vat } = splitVatInclusive(total);

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(o) => (o ? null : close())}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border px-5 py-4">
            <SheetTitle className="flex items-center gap-2 text-base">
              <ShoppingBag className="h-4 w-4" /> Your cart
              <span className="ml-auto text-xs font-normal text-muted-foreground">{lines.length} item{lines.length === 1 ? "" : "s"}</span>
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {lines.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
                <ShoppingBag className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Your cart is empty.<br/>Browse the catalog to start an order.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {lines.map(l => (
                  <li key={l.id} className="flex gap-3 px-5 py-4">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-white">
                      {l.product.image_url ? (
                        <img src={l.product.image_url} alt={l.product.name} className="h-full w-full object-contain p-1" />
                      ) : (
                        <ProductImageFallback sku={l.product.sku} category={l.product.category} />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium leading-snug text-ink">{l.product.name}</div>
                          <div className="font-mono text-[10px] tracking-wider text-muted-foreground">{l.product.sku}</div>
                        </div>
                        <button onClick={() => remove(l.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <div className="flex items-center rounded-md border border-border">
                          <button onClick={() => setQty(l.id, l.quantity - 1)} className="grid h-7 w-7 place-items-center text-muted-foreground hover:text-ink">
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="min-w-[2ch] text-center text-xs font-semibold tabular-nums">{l.quantity}</span>
                          <button onClick={() => setQty(l.id, l.quantity + 1)} className="grid h-7 w-7 place-items-center text-muted-foreground hover:text-ink">
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="text-sm font-semibold text-ink">{formatBBD(Number(l.product.case_price) * l.quantity)}</div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {lines.length > 0 && (
            <div className="border-t border-border bg-secondary/50 p-5">
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground"><dt>Subtotal</dt><dd>{formatBBD(subtotal)}</dd></div>
                <div className="flex justify-between text-muted-foreground"><dt>VAT (17.5%)</dt><dd>{formatBBD(vat)}</dd></div>
                <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-bold text-ink"><dt>Total</dt><dd>{formatBBD(total)}</dd></div>
              </dl>
              <Button onClick={() => setConfirmOpen(true)} className="mt-4 h-11 w-full bg-accent text-accent-foreground hover:bg-accent/90">
                Place order
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
      <PlaceOrderModal open={confirmOpen} onOpenChange={setConfirmOpen} />
    </>
  );
}
