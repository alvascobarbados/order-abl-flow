import { createFileRoute } from "@tanstack/react-router";
import { EndShiftPage } from "@/components/abl/delivery/EndShiftPage";

export const Route = createFileRoute("/delivery/end-shift")({
  component: EndShiftPage,
});
