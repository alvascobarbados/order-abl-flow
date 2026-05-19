import { Link } from "@tanstack/react-router";
import { Search, ShoppingCart, User, Zap } from "lucide-react";
import { SwitchRoleButton } from "./SwitchRoleButton";
import { ViewingAsSwitcher } from "./ViewingAsSwitcher";
import { useCart } from "@/hooks/use-cart";

export function AppHeader({
  search,
  onSearchChange,
}: {
  search?: string;
  onSearchChange?: (v: string) => void;
}) {
  const { count, toggle } = useCart();

  return (
    <>
      {/* Sticky top banner */}
      <div className="sticky top-0 z-50 bg-[#0F2540] text-white">
        <div className="flex items-center justify-center gap-2 py-[10px] text-[11px] font-bold uppercase tracking-[0.08em]">
          <Zap className="h-3 w-3 text-[#FF6A1A]" fill="#FF6A1A" strokeWidth={0} />
          <span>Same Day Delivery · Orders before 10am</span>
        </div>
      </div>

      <header className="sticky top-[33px] z-40 border-b border-[#E5E9EF] bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-4 px-6 py-[14px]">
          <Link to="/shop" className="flex shrink-0 items-baseline gap-2">
            <span className="text-[22px] font-bold leading-none text-[#0B1A2E]">ABL</span>
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#64748B]">
              Distribution
            </span>
          </Link>

          <div className="mx-auto w-full max-w-[520px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              <input
                value={search ?? ""}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder="Search products, SKUs, categories..."
                className="h-10 w-full rounded-[10px] border border-[#E5E9EF] bg-[#FAFBFC] pl-10 pr-14 text-sm text-ink outline-none transition placeholder:text-[#94A3B8] focus:border-[#0F2540] focus:bg-white"
              />
              <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-[#E5E9EF] bg-white px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#64748B]">
                ⌘K
              </kbd>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <ViewingAsSwitcher />
            <Link
              to="/shop/account"
              className="grid h-10 w-10 place-items-center rounded-lg text-[#0B1A2E] hover:bg-[#FAFBFC]"
              aria-label="Account"
            >
              <User className="h-5 w-5" strokeWidth={1.75} />
            </Link>
            <button
              type="button"
              onClick={toggle}
              className="relative grid h-10 w-10 place-items-center rounded-lg text-[#0B1A2E] hover:bg-[#FAFBFC]"
              aria-label="Cart"
            >
              <ShoppingCart className="h-5 w-5" strokeWidth={1.75} />
              {count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#FF6A1A] px-1 text-[10px] font-bold text-white">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>
            <SwitchRoleButton className="ml-1" />
          </div>
        </div>
      </header>
    </>
  );
}
