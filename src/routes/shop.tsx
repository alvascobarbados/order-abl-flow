import { Outlet, createFileRoute } from "@tanstack/react-router";
import { CartDrawer } from "@/components/abl/CartDrawer";

export const Route = createFileRoute("/shop")({
  component: () => (
    <>
      <Outlet />
      <CartDrawer />
    </>
  ),
});
