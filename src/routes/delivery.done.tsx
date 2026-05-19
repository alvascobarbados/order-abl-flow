import { createFileRoute } from "@tanstack/react-router";
import { DonePage } from "@/components/abl/delivery/DonePage";

export const Route = createFileRoute("/delivery/done")({
  component: DonePage,
});
