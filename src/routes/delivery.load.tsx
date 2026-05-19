import { createFileRoute } from "@tanstack/react-router";
import { LoadVanPage } from "@/components/abl/delivery/LoadVanPage";

export const Route = createFileRoute("/delivery/load")({
  component: LoadVanPage,
});
