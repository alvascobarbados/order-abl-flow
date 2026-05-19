import { createFileRoute, Outlet } from "@tanstack/react-router";
import { OfficeShell } from "@/components/abl/office/OfficeShell";

export const Route = createFileRoute("/office")({
  component: () => (
    <OfficeShell>
      <Outlet />
    </OfficeShell>
  ),
});
