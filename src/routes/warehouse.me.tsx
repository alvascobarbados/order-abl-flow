import { createFileRoute } from "@tanstack/react-router";
import { MeStatsPage } from "@/components/abl/warehouse/MeStatsPage";

export const Route = createFileRoute("/warehouse/me")({
  component: MeStatsPage,
});
