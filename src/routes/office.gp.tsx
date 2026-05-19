import { createFileRoute } from "@tanstack/react-router";
import { OfficeComingSoon } from "@/components/abl/office/OfficeComingSoon";

export const Route = createFileRoute("/office/gp")({
  component: () => <OfficeComingSoon title="GP Analysis" blurb="Gross-profit analysis by product, category, customer, and rep." />,
});
