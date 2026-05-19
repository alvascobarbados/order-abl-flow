import { createFileRoute } from "@tanstack/react-router";
import { StopPage } from "@/components/abl/delivery/StopPage";

export const Route = createFileRoute("/delivery/stop/$orderId")({
  component: () => {
    const { orderId } = Route.useParams();
    return <StopPage orderId={orderId} />;
  },
});
