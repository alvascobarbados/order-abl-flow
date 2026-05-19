import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderRoleView } from "@/components/abl/PlaceholderRoleView";

export const Route = createFileRoute("/warehouse")({
  component: () => <PlaceholderRoleView title="Warehouse view — coming soon" blurb="Pick lists, packing, stock counts and reorder alerts will live here." />,
});
