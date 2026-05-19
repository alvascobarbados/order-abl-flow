import { createFileRoute } from "@tanstack/react-router";
import { ProductsPage } from "@/components/abl/office/products/ProductsPage";

export const Route = createFileRoute("/office/products")({
  component: ProductsPage,
  validateSearch: (s: Record<string, unknown>) => ({
    tab: (s.tab as string | undefined) ?? undefined,
    open: (s.open as string | undefined) ?? undefined,
  }),
});
