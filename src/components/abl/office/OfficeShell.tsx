import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/use-role";
import {
  LayoutDashboard, ShoppingBag, Users, Boxes, Truck,
  CreditCard, FileText, BarChart3, TrendingUp, Settings, Repeat,
  Plus, ChevronDown, ShoppingCart, UserPlus, DollarSign, Package, ClipboardList,
} from "lucide-react";
import { RecordPaymentModal } from "@/components/abl/payments/RecordPaymentModal";

type BadgeKind = "orange" | "amber" | "red";

const SECTIONS: Array<{
  label: string;
  items: Array<{
    to: string;
    label: string;
    icon: any;
    exact?: boolean;
    badge?: "pending_orders" | "pending_payments" | "overdue_invoices";
    badgeColor?: BadgeKind;
  }>;
}> = [
  {
    label: "Operations",
    items: [
      { to: "/office", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { to: "/office/orders", label: "Orders", icon: ShoppingBag, badge: "pending_orders", badgeColor: "orange" },
      { to: "/office/customers", label: "Customers", icon: Users },
      { to: "/office/products", label: "Products & Inventory", icon: Boxes },
    ],
  },
  {
    label: "Financial",
    items: [
      { to: "/office/payments", label: "Payments", icon: CreditCard, badge: "pending_payments", badgeColor: "amber" },
      { to: "/office/invoices", label: "Invoices", icon: FileText, badge: "overdue_invoices", badgeColor: "red" },
    ],
  },
  {
    label: "Supply",
    items: [{ to: "/office/purchasing", label: "Purchasing", icon: Truck }],
  },
  {
    label: "Insights",
    items: [
      { to: "/office/reports", label: "Reports", icon: BarChart3 },
      { to: "/office/gp", label: "GP Analysis", icon: TrendingUp },
    ],
  },
];

const BADGE_COLORS: Record<BadgeKind, { bg: string; text: string }> = {
  orange: { bg: "rgba(255, 106, 26, 0.18)", text: "#FFB07A" },
  amber:  { bg: "rgba(245, 158, 11, 0.18)", text: "#FCD34D" },
  red:    { bg: "rgba(239, 68, 68, 0.20)",  text: "#FCA5A5" },
};

export function OfficeShell({ children }: { children: ReactNode }) {
  const { setRole } = useRole();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [counts, setCounts] = useState({ pending_orders: 0, pending_payments: 0, overdue_invoices: 0 });
  const [newOpen, setNewOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const newRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const fetchAll = async () => {
      const [pendingOrdersRes, pendingPaymentsRes, invoicedRes, customersRes] = await Promise.all([
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending_approval"),
        supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("orders").select("id, customer_id, invoiced_at").eq("status", "invoiced"),
        supabase.from("customers").select("id, payment_terms_days"),
      ]);
      const termsMap: Record<string, number> = {};
      (customersRes.data ?? []).forEach((c: any) => { termsMap[c.id] = c.payment_terms_days ?? 30; });
      const today = Date.now();
      let overdue = 0;
      (invoicedRes.data ?? []).forEach((o: any) => {
        if (!o.invoiced_at) return;
        const due = new Date(o.invoiced_at).getTime() + (termsMap[o.customer_id] ?? 30) * 86_400_000;
        if (due < today) overdue++;
      });
      if (!alive) return;
      setCounts({
        pending_orders: pendingOrdersRes.count ?? 0,
        pending_payments: pendingPaymentsRes.count ?? 0,
        overdue_invoices: overdue,
      });
    };
    fetchAll();
    const t = setInterval(fetchAll, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [pathname]);

  // Close +New dropdown on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!newRef.current?.contains(e.target as Node)) setNewOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Cmd/Ctrl+K opens dropdown
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setNewOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  const handleNewItem = (action: () => void) => {
    setNewOpen(false);
    action();
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside
        className="flex w-[240px] flex-shrink-0 flex-col text-white"
        style={{ backgroundColor: "#0B1A2E" }}
      >
        <div className="px-5 pt-5 pb-4">
          <div className="text-[22px] font-extrabold leading-none">ABL</div>
          <div
            className="mt-1 font-mono text-[9.5px] uppercase"
            style={{ color: "#FF6A1A", letterSpacing: "0.2em" }}
          >
            OPERATIONS
          </div>
        </div>

        {/* Profile block */}
        <div className="mx-3 mb-3 flex items-center gap-2.5 rounded-[10px] bg-white/5 p-2.5">
          <div
            className="grid h-9 w-9 place-items-center rounded-full text-[13px] font-bold text-white"
            style={{ background: "linear-gradient(135deg, #FF6A1A, #C2410C)" }}
          >
            SC
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-bold leading-tight">Sarah Clarke</div>
            <div className="text-[11px] text-white/55">Office Manager</div>
          </div>
        </div>

        {/* + New button */}
        <div className="relative mx-3 mb-3" ref={newRef}>
          <button
            onClick={() => setNewOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-[13px] font-semibold text-white transition hover:opacity-90"
            style={{ backgroundColor: "#0B1A2E", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)" }}
          >
            <span className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> New
            </span>
            <ChevronDown className={`h-3.5 w-3.5 transition ${newOpen ? "rotate-180" : ""}`} />
          </button>
          <kbd className="pointer-events-none absolute -bottom-4 left-1/2 -translate-x-1/2 font-mono text-[9px] text-white/30">
            ⌘K
          </kbd>

          {newOpen && (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-lg border border-white/10 bg-[#0F2540] shadow-2xl">
              <NewItem icon={ShoppingCart} label="Order" sub="on behalf of customer" onClick={() => handleNewItem(() => navigate({ to: "/office/orders", search: { tab: "pending", new: "1" } as any }))} />
              <NewItem icon={UserPlus} label="Customer" onClick={() => handleNewItem(() => navigate({ to: "/office/customers/new" }))} />
              <NewItem icon={DollarSign} label="Payment" onClick={() => handleNewItem(() => setPaymentModalOpen(true))} />
              <NewItem icon={Package} label="Product" onClick={() => handleNewItem(() => navigate({ to: "/office/products/new" }))} />
              <NewItem icon={ClipboardList} label="Purchase order" onClick={() => handleNewItem(() => navigate({ to: "/office/purchasing", search: { tab: "purchase-orders", new: "1" } as any }))} />
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          {SECTIONS.map((section, i) => (
            <div key={section.label} className={i === 0 ? "" : "mt-4"}>
              <div className="mb-1.5 flex items-center gap-2 px-3">
                {i > 0 && <div className="h-px flex-1 bg-white/8" style={{ backgroundColor: "rgba(255,255,255,0.08)" }} />}
              </div>
              <div
                className="mb-1 px-3 font-mono text-[9.5px] uppercase"
                style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.2em" }}
              >
                {section.label}
              </div>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <NavRow
                    key={item.to}
                    to={item.to}
                    label={item.label}
                    icon={item.icon}
                    active={isActive(item.to, item.exact)}
                    badgeValue={item.badge ? counts[item.badge] : undefined}
                    badgeColor={item.badgeColor}
                  />
                ))}
              </ul>
            </div>
          ))}

          {/* Settings — pinned at bottom of nav with divider */}
          <div className="mt-4">
            <div className="mx-3 mb-2 h-px" style={{ backgroundColor: "rgba(255,255,255,0.08)" }} />
            <ul className="space-y-0.5">
              <NavRow to="/office/settings" label="Settings" icon={Settings} active={isActive("/office/settings")} />
            </ul>
          </div>
        </nav>

        <div className="border-t border-white/5 px-4 py-3">
          <div className="flex items-center gap-2 text-[11px] text-white/55">
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#10B981" }} />
            All systems operational
          </div>
          <Link
            to="/"
            onClick={() => setRole(null)}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-white/70 hover:text-white"
          >
            <Repeat className="h-3 w-3" /> Switch role
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden px-6 pt-6 pb-16">{children}</main>

      <RecordPaymentModal
        open={paymentModalOpen}
        customerId={null as any}
        onClose={() => setPaymentModalOpen(false)}
        onSuccess={() => setPaymentModalOpen(false)}
      />
    </div>
  );
}

function NavRow({
  to, label, icon: Icon, active, badgeValue, badgeColor = "orange",
}: {
  to: string; label: string; icon: any;
  active?: boolean; badgeValue?: number; badgeColor?: BadgeKind;
}) {
  const colors = BADGE_COLORS[badgeColor];
  return (
    <li>
      <Link
        to={to}
        className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-[9px] text-[13px] font-medium transition ${
          active ? "bg-white/10 font-semibold text-white" : "text-white/65 hover:bg-white/5 hover:text-white"
        }`}
      >
        {active && (
          <span
            className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-x-3 -translate-y-1/2 rounded-full"
            style={{ backgroundColor: "#FF6A1A" }}
          />
        )}
        <Icon className="h-4 w-4 flex-shrink-0 opacity-80" />
        <span className="flex-1 truncate">{label}</span>
        {badgeValue !== undefined && badgeValue > 0 && (
          <span
            className="rounded-full font-mono font-semibold"
            style={{
              backgroundColor: colors.bg, color: colors.text,
              fontSize: "10.5px", padding: "2px 6px",
            }}
          >
            {badgeValue}
          </span>
        )}
      </Link>
    </li>
  );
}

function NewItem({ icon: Icon, label, sub, onClick }: { icon: any; label: string; sub?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-white/85 transition hover:bg-white/8"
    >
      <Icon className="h-4 w-4 text-[#FF6A1A]" />
      <span className="flex-1">
        <span className="font-semibold">{label}</span>
        {sub && <span className="ml-1.5 text-[11px] text-white/45">{sub}</span>}
      </span>
    </button>
  );
}
