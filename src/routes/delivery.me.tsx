import { createFileRoute } from "@tanstack/react-router";
import { MeStatsPage } from "@/components/abl/delivery/MeStatsPage";

export const Route = createFileRoute("/delivery/me")({
  component: MeStatsPage,
});
