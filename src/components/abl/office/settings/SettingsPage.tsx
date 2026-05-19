import { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { TabbedShell, PlaceholderPanel } from "../TabbedShell";

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
      <PlaceholderPanel title={current.title} body={current.body} />
    </TabbedShell>
  );
}
