import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useRequireRole } from "@/hooks/use-role";

function WarehouseLayout() {
  useRequireRole(["warehouse", "admin"]);
  return <Outlet />;
}

export const Route = createFileRoute("/warehouse")({
  component: WarehouseLayout,
});
