import { createFileRoute } from "@tanstack/react-router";
import { OfficeComingSoon } from "@/components/abl/office/OfficeComingSoon";

export const Route = createFileRoute("/office/reports")({
  component: () => <OfficeComingSoon title="Reports" blurb="Sales, fulfillment, and operational reports across any date range." />,
});
