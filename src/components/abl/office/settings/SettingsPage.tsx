import { useEffect, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { TabbedShell, PlaceholderPanel } from "../TabbedShell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, Save } from "lucide-react";

type Tab = "company" | "team" | "pricing-tiers" | "tax-vat" | "payment-terms" | "vehicles" | "locations" | "integrations" | "audit-log";

const TABS: Array<{ key: Tab; label: string; title: string; body: string }> = [
  { key: "company",        label: "Company",        title: "Company",        body: "Company profile, branding, logo." },
  { key: "team",           label: "Team",           title: "Team",           body: "Office staff, sales reps, pickers, drivers — coming next." },
  { key: "pricing-tiers",  label: "Pricing tiers",  title: "Pricing tiers",  body: "Manage tiered pricing rules for each customer band." },
  { key: "tax-vat",        label: "Tax & VAT",      title: "Tax & VAT",      body: "VAT rate and tax-exempt customer rules." },
  { key: "payment-terms",  label: "Payment terms",  title: "Payment terms",  body: "Default credit terms and presets (Net 7, 14, 30…)." },
  { key: "vehicles",       label: "Vehicles",       title: "Vehicles",       body: "Delivery fleet, registration, capacity." },
  { key: "locations",      label: "Locations",      title: "Locations",      body: "Warehouses, depots, and pickup points." },
  { key: "integrations",   label: "Integrations",   title: "Integrations",   body: "Connect accounting, WhatsApp, and other tools." },
  { key: "audit-log",      label: "Audit log",      title: "Audit log",      body: "Filtered view of activity_log — coming next." },
];

export function SettingsPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { tab?: Tab };
  const [tab, setTab] = useState<Tab>(search.tab ?? "company");
  const current = TABS.find((t) => t.key === tab)!;

  return (
    <TabbedShell
      eyebrow="ADMIN · SETTINGS"
      title="Settings"
      blurb="Configure company-wide preferences, team access, and integrations."
      tabs={TABS.map((t) => ({ key: t.key, label: t.label }))}
      activeKey={tab}
      onTabChange={(k) => {
        setTab(k as Tab);
        navigate({ to: "/office/settings", search: { tab: k } as any, replace: true });
      }}
    >
      {tab === "company" ? <CompanyPanel /> : <PlaceholderPanel title={current.title} body={current.body} />}
    </TabbedShell>
  );
}

type Form = {
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  bank_name: string;
  bank_account: string;
  bank_branch: string;
  vat_rate: number;
  auto_invoice_on_packed: boolean;
};

const EMPTY: Form = {
  company_name: "", company_address: "", company_phone: "", company_email: "",
  bank_name: "", bank_account: "", bank_branch: "",
  vat_rate: 17.5, auto_invoice_on_packed: true,
};

function CompanyPanel() {
  const [form, setForm] = useState<Form | null>(null);
  const [original, setOriginal] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("company_name, company_address, company_phone, company_email, bank_name, bank_account, bank_branch, vat_rate, auto_invoice_on_packed")
        .eq("id", 1).maybeSingle();
      const v: Form = {
        ...EMPTY,
        ...(data as any ?? {}),
        bank_name: (data as any)?.bank_name ?? "",
        bank_account: (data as any)?.bank_account ?? "",
        bank_branch: (data as any)?.bank_branch ?? "",
        vat_rate: Number((data as any)?.vat_rate ?? 17.5),
        auto_invoice_on_packed: (data as any)?.auto_invoice_on_packed ?? true,
      };
      setForm(v); setOriginal(v);
    })();
  }, []);

  if (!form || !original) {
    return <div className="text-[13px] text-muted-foreground">Loading…</div>;
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(original);

  const update = (patch: Partial<Form>) => setForm((f) => f ? { ...f, ...patch } : f);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("system_settings").update({
      company_name: form.company_name.trim(),
      company_address: form.company_address.trim(),
      company_phone: form.company_phone.trim(),
      company_email: form.company_email.trim(),
      bank_name: form.bank_name.trim() || null,
      bank_account: form.bank_account.trim() || null,
      bank_branch: form.bank_branch.trim() || null,
      vat_rate: form.vat_rate,
      auto_invoice_on_packed: form.auto_invoice_on_packed,
    }).eq("id", 1);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setOriginal(form);
    toast.success("Company settings saved");
  };

  return (
    <div className="space-y-6">
      <Section title="Company profile" subtitle="Shown on every invoice and customer-facing document.">
        <Grid>
          <Field label="Company name"><Input value={form.company_name} onChange={(v) => update({ company_name: v })} /></Field>
          <Field label="Phone"><Input value={form.company_phone} onChange={(v) => update({ company_phone: v })} /></Field>
          <Field label="Email"><Input type="email" value={form.company_email} onChange={(v) => update({ company_email: v })} /></Field>
          <Field label="VAT rate (%)"><Input type="number" step="0.1" value={String(form.vat_rate)} onChange={(v) => update({ vat_rate: Number(v) || 0 })} /></Field>
          <Field label="Address" full>
            <textarea
              value={form.company_address}
              onChange={(e) => update({ company_address: e.target.value })}
              rows={2}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-[13px] text-ink focus:border-ink focus:outline-none"
            />
          </Field>
        </Grid>
      </Section>

      <Section title="Bank details" subtitle="Printed on the bottom of every invoice under Payment information.">
        <Grid>
          <Field label="Bank name"><Input value={form.bank_name} onChange={(v) => update({ bank_name: v })} placeholder="e.g. RBC Royal Bank" /></Field>
          <Field label="Account number"><Input value={form.bank_account} onChange={(v) => update({ bank_account: v })} placeholder="e.g. 100-123456-7" /></Field>
          <Field label="Branch"><Input value={form.bank_branch} onChange={(v) => update({ bank_branch: v })} placeholder="e.g. Broad Street" /></Field>
        </Grid>
      </Section>

      <Section title="Document settings" subtitle="Controls how invoices are generated as orders move through the pipeline.">
        <div className="rounded-xl border border-border bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-[13.5px] font-extrabold text-ink">Auto-invoice on packing</h4>
                {form.auto_invoice_on_packed && <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-bold text-[#047857]"><CheckCircle2 className="h-3 w-3" /> ON</span>}
              </div>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                When enabled, packed orders are automatically assigned an invoice number with a printable PDF and QR code.
                Disable to invoice manually after delivery.
              </p>
            </div>
            <button
              type="button"
              onClick={() => update({ auto_invoice_on_packed: !form.auto_invoice_on_packed })}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${form.auto_invoice_on_packed ? "bg-[#10B981]" : "bg-[#CBD5E1]"}`}
              aria-pressed={form.auto_invoice_on_packed}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${form.auto_invoice_on_packed ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        </div>
      </Section>

      {/* Sticky save bar */}
      <div className="sticky bottom-3 z-10 flex items-center justify-end gap-3 rounded-xl border border-border bg-white/95 px-4 py-3 backdrop-blur">
        <span className="text-[12px] text-muted-foreground">{dirty ? "Unsaved changes" : "All changes saved"}</span>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[14px] font-extrabold text-ink">{title}</h3>
      {subtitle && <p className="mt-1 text-[12.5px] text-muted-foreground">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}
function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
function Input({ value, onChange, type = "text", step, placeholder }: { value: string; onChange: (v: string) => void; type?: string; step?: string; placeholder?: string }) {
  return (
    <input
      type={type} step={step} value={value} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-border bg-card px-3 py-2 text-[13px] text-ink focus:border-ink focus:outline-none"
    />
  );
}
