import { createFileRoute, Outlet } from "@tanstack/react-router";
import { CartDrawer } from "@/components/abl/CartDrawer";
import { useRequireRole } from "@/hooks/use-role";

function ShopLayout() {
  // Customer storefront: customers + admin (admin for QA/preview).
  useRequireRole(["customer", "admin"]);
  return (
    <>
      <Outlet />
      <CartDrawer />
    </>
  );
}

export const Route = createFileRoute("/shop")({
  component: ShopLayout,
});
