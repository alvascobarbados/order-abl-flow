import { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { TabbedShell, PlaceholderPanel } from "../TabbedShell";

type Tab = "purchase-orders" | "receiving" | "suppliers" | "history";

export function PurchasingPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { tab?: Tab };
  const [tab, setTab] = useState<Tab>(search.tab ?? "purchase-orders");

  const panel = {
    "purchase-orders": { t: "Purchase orders", b: "Create and track POs to suppliers. Coming soon." },
    "receiving":       { t: "Receiving",       b: "Receive incoming inventory against open POs. Coming soon." },
    "suppliers":       { t: "Suppliers",       b: "Manage supplier list and contact info. Coming soon." },
    "history":         { t: "History",         b: "Past received deliveries with audit trail. Coming soon." },
  }[tab];

  return (
    <TabbedShell
      eyebrow="SUPPLY · PURCHASING"
      title="Purchasing"
      blurb="Purchase orders, supplier deliveries, and inbound stock receipts."
      tabs={[
        { key: "purchase-orders", label: "Purchase orders" },
        { key: "receiving",       label: "Receiving" },
        { key: "suppliers",       label: "Suppliers" },
        { key: "history",         label: "History" },
      ]}
      activeKey={tab}
      onTabChange={(k) => {
        setTab(k as Tab);
        navigate({ to: "/office/purchasing", search: { tab: k } as any, replace: true });
      }}
    >
      <PlaceholderPanel title={panel.t} body={panel.b} />
    </TabbedShell>
  );
}
