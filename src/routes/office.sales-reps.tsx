import { createFileRoute } from "@tanstack/react-router";
import { OfficeComingSoon } from "@/components/abl/office/OfficeComingSoon";

export const Route = createFileRoute("/office/sales-reps")({
  component: () => <OfficeComingSoon title="Sales Reps" blurb="Manage sales rep accounts, customer assignments, and performance." />,
});
