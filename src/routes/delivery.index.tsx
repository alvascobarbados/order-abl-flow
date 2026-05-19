import { createFileRoute } from "@tanstack/react-router";
import { RoutePage } from "@/components/abl/delivery/RoutePage";

export const Route = createFileRoute("/delivery/")({
  component: RoutePage,
});
