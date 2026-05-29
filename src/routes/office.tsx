import { createFileRoute, Outlet } from "@tanstack/react-router";
import { OfficeShell } from "@/components/abl/office/OfficeShell";
import { useRequireRole } from "@/hooks/use-role";

function OfficeLayout() {
  useRequireRole(["office", "admin"]);
  return (
    <OfficeShell>
      <Outlet />
    </OfficeShell>
  );
}

export const Route = createFileRoute("/office")({
  component: OfficeLayout,
});
