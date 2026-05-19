import { createFileRoute } from "@tanstack/react-router";
import { OfficeComingSoon } from "@/components/abl/office/OfficeComingSoon";

export const Route = createFileRoute("/office/orders")({
  component: () => <OfficeComingSoon title="All Orders" blurb="Searchable, filterable list of every order across all statuses, with bulk actions." />,
});
