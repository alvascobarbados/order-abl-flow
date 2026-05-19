import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/abl/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { formatBBD } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/account")({ component: AccountPage });

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
  const { profile, session, refresh } = useAuth();
  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [newPw, setNewPw] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setPhone(profile?.phone ?? "");
  }, [profile]);

  useEffect(() => {
    if (!session?.user?.id) return;
    supabase
      .from("customers")
      .select("id, company_name, billing_address, delivery_address, phone, credit_limit, current_balance, payment_terms_days")
      .eq("contact_profile_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => setCustomer(data as CustomerRow | null));
  }, [session?.user?.id]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName, phone }).eq("id", session!.user.id);
    if (error) toast.error(error.message);
    else { toast.success("Profile updated."); await refresh(); }
    if (newPw) {
      const { error: pwErr } = await supabase.auth.updateUser({ password: newPw });
      if (pwErr) toast.error(pwErr.message);
      else { toast.success("Password updated."); setNewPw(""); }
    }
    setSaving(false);
  };

  const availableCredit = customer ? Number(customer.credit_limit) - Number(customer.current_balance) : 0;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold text-ink">Account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your contact details and password.</p>

        {customer && (
          <section className="mt-6 rounded-xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Company</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Company name" value={customer.company_name} />
              <Field label="Email" value={profile?.email ?? ""} />
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

        <form onSubmit={saveProfile} className="mt-6 rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Your details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">Contact name</Label>
              <Input id="name" value={fullName} onChange={e => setFullName(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} className="mt-1.5" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="pw">New password (leave blank to keep current)</Label>
              <Input id="pw" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} className="mt-1.5" minLength={8} />
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary-dark">
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
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
