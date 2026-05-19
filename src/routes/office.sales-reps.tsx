import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/office/sales-reps")({
  component: () => <Navigate to="/office/settings" search={{ tab: "team" } as any} replace />,
});
