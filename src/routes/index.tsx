import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Logo } from "@/components/abl/Logo";
import { ROLE_META, useRole, type Role } from "@/hooks/use-role";
import { ShoppingBag, Briefcase, ClipboardList, Boxes, Truck } from "lucide-react";

export const Route = createFileRoute("/")({ component: RolePicker });

const ROLES: { role: Role; icon: typeof ShoppingBag; description: string }[] = [
  { role: "customer",  icon: ShoppingBag,    description: "Browse the catalog and place orders" },
  { role: "sales",     icon: Briefcase,      description: "Manage customer accounts and orders" },
  { role: "office",    icon: ClipboardList,  description: "Approve orders, invoicing, accounts" },
  { role: "warehouse", icon: Boxes,          description: "Pick lists and stock management" },
  { role: "driver",    icon: Truck,          description: "Today's deliveries and run sheets" },
];

function RolePicker() {
  const { setRole } = useRole();
  const navigate = useNavigate();

  const choose = (r: Role) => {
    setRole(r);
    navigate({ to: ROLE_META[r].home });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 py-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.18em]">
          Dev mode · Pick a role to preview the app
        </div>
      </div>
      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="text-center">
          <Logo className="mx-auto items-center" />
          <h1 className="mt-8 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Who's signing in today?</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Choose a role to preview that view. Auth is bypassed while we're still building — you can switch roles any time from the top of every page.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map(({ role, icon: Icon, description }) => {
            const meta = ROLE_META[role];
            return (
              <button
                key={role}
                onClick={() => choose(role)}
                className="group flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-6 text-left transition hover:-translate-y-0.5 hover:border-primary hover:shadow-lg"
              >
                <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-base font-bold text-ink">{meta.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{description}</div>
                </div>
                <span className="mt-auto text-xs font-semibold text-primary group-hover:underline">Open {meta.label.toLowerCase()} view →</span>
              </button>
            );
          })}
        </div>

        <p className="mt-12 text-center text-xs text-muted-foreground">
          Real sign-in still lives at <a href="/sign-in" className="font-semibold text-primary hover:underline">/sign-in</a> for testing later.
        </p>
      </main>
    </div>
  );
}
