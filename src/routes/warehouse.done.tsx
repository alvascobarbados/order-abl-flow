import { createFileRoute } from "@tanstack/react-router";
import { DonePage } from "@/components/abl/warehouse/DonePage";

export const Route = createFileRoute("/warehouse/done")({
  component: DonePage,
});
