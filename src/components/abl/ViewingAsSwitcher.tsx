import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { useActiveCustomer } from "@/hooks/use-active-customer";

export function ViewingAsSwitcher() {
  const { customers, activeCustomer, setActiveCustomerId } = useActiveCustomer();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (!activeCustomer) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-[#E5E9EF] bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-[#0B1A2E] hover:bg-[#FAFBFC]"
      >
        <span className="text-[10px] font-medium uppercase tracking-wider text-[#64748B]">Viewing as</span>
        <span className="max-w-[140px] truncate">{activeCustomer.company_name}</span>
        <ChevronDown className="h-3 w-3 text-[#64748B]" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-[260px] rounded-lg border border-[#E5E9EF] bg-white py-1 shadow-lg">
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
            Switch customer
          </div>
          {customers.map((c) => {
            const active = c.id === activeCustomer.id;
            return (
              <button
                key={c.id}
                onClick={() => {
                  setActiveCustomerId(c.id);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] text-[#0B1A2E] hover:bg-[#FAFBFC]"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold">{c.company_name}</div>
                  {c.customer_number && (
                    <div className="font-mono text-[10.5px] text-[#64748B]">{c.customer_number}</div>
                  )}
                </div>
                {active && <Check className="h-3.5 w-3.5 flex-shrink-0 text-[#FF6A1A]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
