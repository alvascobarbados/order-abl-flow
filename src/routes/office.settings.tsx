import { createFileRoute } from "@tanstack/react-router";
import { OfficeComingSoon } from "@/components/abl/office/OfficeComingSoon";

export const Route = createFileRoute("/office/settings")({
  component: () => <OfficeComingSoon title="Settings" blurb="Company settings, VAT rate, delivery zones, and user permissions." />,
});
