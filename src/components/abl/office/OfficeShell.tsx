import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/use-role";
import {
  LayoutDashboard, Inbox, ShoppingBag, Users, Boxes, Briefcase,
  PackagePlus, FileText, BarChart3, TrendingUp, Settings, Repeat,
} from "lucide-react";

const NAV_TOP = [
  { to: "/office",             label: "Dashboard",             icon: LayoutDashboard, exact: true },
  { to: "/office/pending",     label: "Pending Approval",      icon: Inbox, badge: "pending" as const },
  { to: "/office/orders",      label: "All Orders",            icon: ShoppingBag },
  { to: "/office/customers",   label: "Customers",             icon: Users },
  { to: "/office/products",    label: "Products & Inventory",  icon: Boxes },
  { to: "/office/sales-reps",  label: "Sales Reps",            icon: Briefcase },
  { to: "/office/receiving",   label: "Receiving",             icon: PackagePlus },
  { to: "/office/invoices",    label: "Invoices",              icon: FileText },
];

const NAV_INSIGHTS = [
  { to: "/office/reports",  label: "Reports",     icon: BarChart3 },
  { to: "/office/gp",       label: "GP Analysis", icon: TrendingUp },
  { to: "/office/settings", label: "Settings",    icon: Settings },
];

export function OfficeShell({ children }: { children: ReactNode }) {
  const { setRole } = useRole();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    let alive = true;
    const fetchCount = async () => {
      const { count } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending_approval");
      if (alive) setPendingCount(count ?? 0);
    };
    fetchCount();
    const t = setInterval(fetchCount, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [pathname]);

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar */}
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

        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          <ul className="space-y-0.5">
            {NAV_TOP.map((item) => (
              <NavRow
                key={item.to}
                {...item}
                active={isActive(item.to, item.exact)}
                badgeValue={item.badge === "pending" ? pendingCount : undefined}
              />
            ))}
          </ul>

          <div className="my-3 px-3">
            <div className="border-t border-white/10" />
            <div className="mt-3 font-mono text-[10px] uppercase text-white/40" style={{ letterSpacing: "0.18em" }}>
              Insights
            </div>
          </div>

          <ul className="space-y-0.5">
            {NAV_INSIGHTS.map((item) => (
              <NavRow key={item.to} {...item} active={isActive(item.to)} />
            ))}
          </ul>
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
    </div>
  );
}

function NavRow({
  to, label, icon: Icon, active, badgeValue,
}: {
  to: string; label: string; icon: typeof LayoutDashboard;
  active?: boolean; badgeValue?: number;
}) {
  return (
    <li>
      <Link
        to={to}
        className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-[9px] text-[13px] font-medium transition ${
          active
            ? "bg-white/10 font-semibold text-white"
            : "text-white/65 hover:bg-white/5 hover:text-white"
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
            className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white"
            style={{ backgroundColor: "#FF6A1A" }}
          >
            {badgeValue}
          </span>
        )}
      </Link>
    </li>
  );
}
