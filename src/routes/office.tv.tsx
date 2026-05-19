import { createFileRoute } from "@tanstack/react-router";
import { OfficeComingSoon } from "@/components/abl/office/OfficeComingSoon";

export const Route = createFileRoute("/office/tv")({
  component: () => <OfficeComingSoon title="TV Dashboard" blurb="Wall-display view designed for the warehouse TV screen." />,
});
