import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderRoleView } from "@/components/abl/PlaceholderRoleView";

export const Route = createFileRoute("/driver")({
  component: () => <PlaceholderRoleView title="Driver view — coming soon" blurb="Today's runs, delivery confirmations and proof-of-delivery capture will live here." />,
});
