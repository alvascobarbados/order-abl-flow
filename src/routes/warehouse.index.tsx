import { createFileRoute } from "@tanstack/react-router";
import { QueuePage } from "@/components/abl/warehouse/QueuePage";

export const Route = createFileRoute("/warehouse/")({
  component: QueuePage,
});
