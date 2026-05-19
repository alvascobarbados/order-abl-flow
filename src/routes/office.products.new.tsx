import { createFileRoute } from "@tanstack/react-router";
import { ProductForm } from "@/components/abl/office/products/ProductForm";

export const Route = createFileRoute("/office/products/new")({ component: NewProductPage });

function NewProductPage() {
  return (
    <>
      <div className="mb-5">
        <div className="text-[10.5px] uppercase text-muted-foreground" style={{ letterSpacing: "0.12em" }}>OFFICE · PRODUCTS</div>
        <h1 className="mt-1 text-[24px] font-extrabold text-ink" style={{ letterSpacing: "-0.02em" }}>New product</h1>
      </div>
      <ProductForm />
    </>
  );
}
