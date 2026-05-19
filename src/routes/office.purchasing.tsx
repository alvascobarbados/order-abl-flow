import { createFileRoute } from "@tanstack/react-router";
import { PurchasingPage } from "@/components/abl/office/purchasing/PurchasingPage";

export const Route = createFileRoute("/office/purchasing")({
  validateSearch: (s: Record<string, unknown>) => ({
    tab: typeof s.tab === "string" ? s.tab : undefined,
    new: typeof s.new === "string" ? s.new : undefined,
  }),
  component: PurchasingPage,
});
