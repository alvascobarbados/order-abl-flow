import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderRoleView } from "@/components/abl/PlaceholderRoleView";

export const Route = createFileRoute("/office")({
  component: () => <PlaceholderRoleView title="Office view — coming soon" blurb="Order approvals, invoicing, and customer account management will live here." />,
});
