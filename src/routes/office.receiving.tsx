import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/office/receiving")({
  component: () => <Navigate to="/office/purchasing" search={{ tab: "receiving" } as any} replace />,
});
