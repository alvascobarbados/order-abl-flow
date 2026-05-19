import { createFileRoute } from "@tanstack/react-router";
import { OfficeComingSoon } from "@/components/abl/office/OfficeComingSoon";

export const Route = createFileRoute("/office/customers")({
  component: () => <OfficeComingSoon title="Customers" blurb="Customer accounts, contacts, credit limits, balances, and order history." />,
});
