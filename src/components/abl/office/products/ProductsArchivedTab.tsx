import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ProductFull } from "@/lib/products";

export function ProductsArchivedTab({ products, onChanged }: { products: ProductFull[]; onChanged: () => void }) {
  const items = products.filter((p) => !!p.archived_at);

  const restore = async (id: string) => {
    const { error } = await supabase.from("products").update({ archived_at: null, archived_by_profile_id: null, is_active: true }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Restored"); onChanged(); }
  };

  if (items.length === 0) return <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-[12.5px] text-muted-foreground">No archived products.</div>;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full">
        <thead className="bg-[#F8FAFC]">
          <tr className="border-b border-border">
            <Th>SKU</Th><Th>Name</Th><Th>Archived</Th><Th> </Th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id} className="border-b border-border last:border-0">
              <td className="p-2 font-mono text-[12px] font-bold text-ink">{p.sku}</td>
              <td className="p-2 text-[13px] font-semibold text-ink">{p.name}</td>
              <td className="p-2 text-[12px] text-muted-foreground">{formatDate(p.archived_at)}</td>
              <td className="p-2 text-right"><Button size="sm" variant="outline" onClick={() => restore(p.id)}>Restore</Button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-2 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ${className}`}>{children}</th>;
}
