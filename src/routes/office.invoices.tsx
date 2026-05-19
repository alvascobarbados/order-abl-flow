import { createFileRoute } from "@tanstack/react-router";
import { OfficeComingSoon } from "@/components/abl/office/OfficeComingSoon";

export const Route = createFileRoute("/office/invoices")({
  component: () => <OfficeComingSoon title="Invoices" blurb="Generated invoices, payment tracking, and accounts receivable." />,
});
