import { Link } from "@tanstack/react-router";
import { ShoppingCart, Search, FileText, UserCircle } from "lucide-react";
import { Logo } from "./Logo";
import { SwitchRoleButton } from "./SwitchRoleButton";
import { useCart } from "@/hooks/use-cart";

export function AppHeader({ search, onSearchChange }: { search?: string; onSearchChange?: (v: string) => void }) {
  const { count, toggle } = useCart();

  return (
    <>
      <div className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 py-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.18em]">
          Same Day Delivery · Orders before 10am
        </div>
      </div>
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Link to="/shop" className="shrink-0"><Logo /></Link>

          <div className="relative ml-4 hidden flex-1 md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search ?? ""}
              onChange={e => onSearchChange?.(e.target.value)}
              placeholder="Search products, SKUs, categories…"
              className="h-10 w-full rounded-lg border border-input bg-secondary/40 pl-10 pr-3 text-sm outline-none transition focus:border-primary focus:bg-card"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link to="/shop/account" className="hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-secondary sm:inline-flex">
              <UserCircle className="h-4 w-4" /> Account
            </Link>
            <Link to="/shop/orders" className="hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-secondary sm:inline-flex">
              <FileText className="h-4 w-4" /> Orders
            </Link>
            <button
              onClick={toggle}
              className="relative grid h-10 w-10 place-items-center rounded-lg text-ink hover:bg-secondary"
              aria-label="Open cart"
            >
              <ShoppingCart className="h-5 w-5" />
              {count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
                  {count}
                </span>
              )}
            </button>
            <SwitchRoleButton className="ml-1" />
          </div>
        </div>

        <div className="border-t border-border bg-card md:hidden">
          <div className="relative px-4 py-2">
            <Search className="pointer-events-none absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search ?? ""}
              onChange={e => onSearchChange?.(e.target.value)}
              placeholder="Search products, SKUs, categories…"
              className="h-9 w-full rounded-lg border border-input bg-secondary/40 pl-9 pr-3 text-sm outline-none focus:border-primary focus:bg-card"
            />
          </div>
        </div>
      </header>
    </>
  );
}
