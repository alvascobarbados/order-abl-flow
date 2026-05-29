import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/abl/Logo";
import { ROLE_META, useSignInAsRole, type Role } from "@/hooks/use-role";
import { useAuth } from "@/hooks/use-auth";
import { ShoppingBag, Briefcase, ClipboardList, Boxes, Truck, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({ component: RolePicker });

const ROLES: { role: Role; icon: typeof ShoppingBag; description: string }[] = [
  { role: "customer",  icon: ShoppingBag,    description: "Browse the catalog and place orders (Buzo Osteria)" },
  { role: "sales",     icon: Briefcase,      description: "Marlon Best — manage accounts and orders" },
  { role: "office",    icon: ClipboardList,  description: "Sarah Clarke — approvals, invoicing, accounts" },
  { role: "warehouse", icon: Boxes,          description: "Andre Williams — pick lists and stock" },
  { role: "driver",    icon: Truck,          description: "Neal Phillips — today's deliveries" },
  { role: "admin",     icon: ShieldCheck,    description: "Full system access — settings + everything" },
];

function RolePicker() {
  const { session, profile, loading, signOut } = useAuth();
  const signInAs = useSignInAsRole();
  const navigate = useNavigate();
  const [pending, setPending] = useState<Role | null>(null);

  // If already signed in when landing here, route to that role's home.
  useEffect(() => {
    if (loading || pending) return;
    if (session && profile) {
      const home =
        profile.role === "delivery" ? "/delivery" :
        profile.role === "warehouse" ? "/warehouse" :
        profile.role === "customer" ? "/shop" :
        "/office";
      navigate({ to: home });
    }
  }, [loading, session, profile, pending, navigate]);

  const choose = async (r: Role) => {
    setPending(r);
    try {
      // If a different user is signed in, sign them out first.
      if (session) await signOut();
      await signInAs(r);
      navigate({ to: ROLE_META[r].home });
    } catch (e: any) {
      toast.error(e?.message ?? "Sign in failed");
      setPending(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 py-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.18em]">
          Dev mode · Pick a role to sign in as the matching test account
        </div>
      </div>
      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="text-center">
          <Logo className="mx-auto items-center" />
          <h1 className="mt-8 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Who's signing in today?</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Each role signs you in as a real test user. You can switch any time from the top of every page.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map(({ role, icon: Icon, description }) => {
            const meta = ROLE_META[role];
            const isPending = pending === role;
            const disabled = pending !== null;
            return (
              <button
                key={role}
                onClick={() => choose(role)}
                disabled={disabled}
                className="group flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-6 text-left transition hover:-translate-y-0.5 hover:border-primary hover:shadow-lg disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:border-border disabled:hover:shadow-none"
              >
                <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground">
                  {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
                </div>
                <div>
                  <div className="text-base font-bold text-ink">{meta.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{description}</div>
                </div>
                <span className="mt-auto text-xs font-semibold text-primary group-hover:underline">
                  {isPending ? "Signing in…" : `Open ${meta.label.toLowerCase()} view →`}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-12 text-center text-xs text-muted-foreground">
          Production sign-in lives at <a href="/sign-in" className="font-semibold text-primary hover:underline">/sign-in</a>.
        </p>
      </main>
    </div>
  );
}
