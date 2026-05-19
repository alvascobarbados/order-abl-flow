import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/abl/AppHeader";
import { formatBBD } from "@/lib/format";
import { useActiveCustomer } from "@/hooks/use-active-customer";

export const Route = createFileRoute("/shop/account")({ component: AccountPage });

interface CustomerRow {
  id: string;
  company_name: string;
  billing_address: string | null;
  delivery_address: string | null;
  phone: string | null;
  credit_limit: number;
  current_balance: number;
  payment_terms_days: number;
}

function AccountPage() {
  const { activeCustomerId } = useActiveCustomer();
  const [customer, setCustomer] = useState<CustomerRow | null>(null);

  useEffect(() => {
    if (!activeCustomerId) return;
    supabase
      .from("customers")
      .select("id, company_name, billing_address, delivery_address, phone, credit_limit, current_balance, payment_terms_days")
      .eq("id", activeCustomerId)
      .maybeSingle()
      .then(({ data }) => setCustomer(data as CustomerRow | null));
  }, [activeCustomerId]);

  const availableCredit = customer ? Number(customer.credit_limit) - Number(customer.current_balance) : 0;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold text-ink">Account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Company information on file with ABL.</p>

        <div className="mt-4 rounded-lg border border-dashed border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
          Dev mode — viewing the first customer in the database. Real per-user accounts return when auth is re-enabled.
        </div>

        {customer && (
          <section className="mt-6 rounded-xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Company</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Company name" value={customer.company_name} />
              <Field label="Phone" value={customer.phone ?? "—"} />
              <Field label="Billing address" value={customer.billing_address ?? "—"} />
              <Field label="Delivery address" value={customer.delivery_address ?? "—"} />
              <Field label="Payment terms" value={`Net ${customer.payment_terms_days} days`} />
              <Field label="Credit limit" value={formatBBD(Number(customer.credit_limit))} />
              <Field label="Current balance" value={formatBBD(Number(customer.current_balance))} />
              <Field label="Available credit" value={formatBBD(availableCredit)} highlight />
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Company details, addresses, credit limit, and payment terms are managed by ABL office staff. Contact your sales rep to make changes.</p>
          </section>
        )}
      </main>
    </div>
  );
}

function Field({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-sm ${highlight ? "font-bold text-[color:var(--success)]" : "font-medium text-ink"}`}>{value}</div>
    </div>
  );
}
