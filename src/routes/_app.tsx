import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { CartDrawer } from "@/components/abl/CartDrawer";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { loading, session, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/login" });
    } else if (profile && profile.role !== "customer") {
      navigate({ to: "/coming-soon" });
    }
  }, [loading, session, profile, navigate]);

  if (loading || !session || !profile) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (profile.role !== "customer") return null;

  return (
    <>
      <Outlet />
      <CartDrawer />
    </>
  );
}
