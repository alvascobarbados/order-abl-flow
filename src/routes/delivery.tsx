import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useRequireRole } from "@/hooks/use-role";

function DeliveryLayout() {
  useRequireRole(["delivery", "admin"]);
  return <Outlet />;
}

export const Route = createFileRoute("/delivery")({
  component: DeliveryLayout,
});
