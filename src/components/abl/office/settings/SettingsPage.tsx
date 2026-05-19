import { useEffect, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { TabbedShell, PlaceholderPanel } from "../TabbedShell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

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

function CompanyPanel() {
  const [autoInvoice, setAutoInvoice] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("system_settings").select("auto_invoice_on_packed").eq("id", 1).maybeSingle();
      setAutoInvoice((data as any)?.auto_invoice_on_packed ?? true);
    })();
  }, []);

  const toggle = async () => {
    if (autoInvoice == null) return;
    const next = !autoInvoice;
    setSaving(true);
    setAutoInvoice(next);
    const { error } = await supabase.from("system_settings").update({ auto_invoice_on_packed: next }).eq("id", 1);
    setSaving(false);
    if (error) { toast.error(error.message); setAutoInvoice(!next); return; }
    toast.success(next ? "Auto-invoicing enabled" : "Auto-invoicing disabled");
  };

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-[14px] font-extrabold text-ink">Company profile</h3>
        <p className="mt-1 text-[12.5px] text-muted-foreground">ABL Distribution · Foodservice Supply · Barbados. Editable fields coming next.</p>
      </section>

      <section className="rounded-xl border border-border bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-[14px] font-extrabold text-ink">Auto-invoice on packing</h3>
              {autoInvoice && <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-bold text-[#047857]"><CheckCircle2 className="h-3 w-3" /> ON</span>}
            </div>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              When enabled, packed orders are automatically assigned an invoice number with a printable PDF and QR code.
              Disable to invoice manually after delivery.
            </p>
          </div>
          <button
            type="button"
            onClick={toggle}
            disabled={autoInvoice == null || saving}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${autoInvoice ? "bg-[#10B981]" : "bg-[#CBD5E1]"} disabled:opacity-60`}
            aria-pressed={!!autoInvoice}
            aria-label="Toggle auto-invoice on packing"
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${autoInvoice ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
      </section>
    </div>
  );
}
