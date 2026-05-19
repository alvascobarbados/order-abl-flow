import { createFileRoute } from "@tanstack/react-router";
import { OfficeDashboard } from "@/components/abl/office/OfficeDashboard";

export const Route = createFileRoute("/office/")({
  component: OfficeDashboard,
});
