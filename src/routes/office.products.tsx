import { createFileRoute } from "@tanstack/react-router";
import { OfficeComingSoon } from "@/components/abl/office/OfficeComingSoon";

export const Route = createFileRoute("/office/products")({
  component: () => <OfficeComingSoon title="Products & Inventory" blurb="Product catalog management, stock levels, and inventory adjustments." />,
});
