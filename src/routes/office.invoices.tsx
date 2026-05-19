import { createFileRoute } from "@tanstack/react-router";
import { InvoicesPage } from "@/components/abl/office/invoices/InvoicesPage";

export const Route = createFileRoute("/office/invoices")({
  validateSearch: (s: Record<string, unknown>) => ({
    tab: typeof s.tab === "string" ? s.tab : undefined,
  }),
  component: InvoicesPage,
});
