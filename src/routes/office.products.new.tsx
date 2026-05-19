import { createFileRoute } from "@tanstack/react-router";
import { OfficeComingSoon } from "@/components/abl/office/OfficeComingSoon";

export const Route = createFileRoute("/office/products/new")({
  component: () => <OfficeComingSoon title="New product" blurb="Product creation form — coming soon." />,
});
