import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderRoleView } from "@/components/abl/PlaceholderRoleView";

export const Route = createFileRoute("/sales")({
  component: () => <PlaceholderRoleView title="Sales Rep view — coming soon" blurb="Account books, customer activity, and rep-specific tools will live here." />,
});
