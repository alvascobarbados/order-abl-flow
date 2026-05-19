import { createFileRoute } from "@tanstack/react-router";
import { PickPage } from "@/components/abl/warehouse/PickPage";

export const Route = createFileRoute("/warehouse/pick/$orderId")({
  component: () => {
    const { orderId } = Route.useParams();
    return <PickPage orderId={orderId} />;
  },
});
