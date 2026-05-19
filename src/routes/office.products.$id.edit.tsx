import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProductForm } from "@/components/abl/office/products/ProductForm";
import type { ProductFull } from "@/lib/products";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/office/products/$id/edit")({ component: EditProductPage });

function EditProductPage() {
  const { id } = Route.useParams();
  const [product, setProduct] = useState<ProductFull | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("products").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      setProduct((data ?? null) as unknown as ProductFull | null);
      setLoading(false);
    });
  }, [id]);

  return (
    <>
      <div className="mb-5">
        <div className="font-mono text-[10.5px] uppercase text-muted-foreground" style={{ letterSpacing: "0.12em" }}>OFFICE · PRODUCTS</div>
        <h1 className="mt-1 text-[24px] font-extrabold text-ink" style={{ letterSpacing: "-0.02em" }}>{product ? product.name : "Edit product"}</h1>
      </div>
      {loading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : product ? <ProductForm initial={product} productId={id} /> : <div>Not found.</div>}
    </>
  );
}
