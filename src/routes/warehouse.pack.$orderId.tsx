import { createFileRoute } from "@tanstack/react-router";
import { PackPage } from "@/components/abl/warehouse/PackPage";

export const Route = createFileRoute("/warehouse/pack/$orderId")({
  component: () => {
    const { orderId } = Route.useParams();
    return <PackPage orderId={orderId} />;
  },
});
