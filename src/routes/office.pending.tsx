import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/office/pending")({
  component: () => <Navigate to="/office/orders" search={{ tab: "pending" } as any} replace />,
});
