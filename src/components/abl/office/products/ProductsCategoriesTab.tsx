import { useState } from "react";
import { Plus, Trash2, Pencil, ArrowUp, ArrowDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { Category, ProductFull } from "@/lib/products";

export function ProductsCategoriesTab({ categories, products, onChanged }: {
  categories: Category[]; products: ProductFull[]; onChanged: () => void;
}) {
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);

  const counts: Record<string, number> = {};
  products.forEach((p) => { counts[p.category] = (counts[p.category] ?? 0) + 1; });

  const move = async (cat: Category, dir: -1 | 1) => {
    const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((c) => c.id === cat.id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from("categories").update({ sort_order: swap.sort_order }).eq("id", cat.id),
      supabase.from("categories").update({ sort_order: cat.sort_order }).eq("id", swap.id),
    ]);
    onChanged();
  };

  const remove = async (cat: Category) => {
    if ((counts[cat.name] ?? 0) > 0) {
      toast.error(`Cannot delete — ${counts[cat.name]} product(s) in this category. Move them first.`);
      return;
    }
    if (!confirm(`Delete category "${cat.name}"?`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", cat.id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); onChanged(); }
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setCreating(true)} className="bg-[#0B1A2E] hover:bg-[#1A3556]"><Plus className="h-4 w-4" /> New category</Button>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full">
          <thead className="bg-[#F8FAFC]">
            <tr className="border-b border-border">
              <Th>Order</Th><Th>Name</Th><Th className="text-right"># products</Th><Th> </Th>
            </tr>
          </thead>
          <tbody>
            {[...categories].sort((a, b) => a.sort_order - b.sort_order).map((c, i, arr) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className="p-2">
                  <div className="flex items-center gap-1">
                    <button onClick={() => move(c, -1)} disabled={i === 0} className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-[#F1F4F8] disabled:opacity-30"><ArrowUp className="h-3 w-3" /></button>
                    <button onClick={() => move(c, 1)} disabled={i === arr.length - 1} className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-[#F1F4F8] disabled:opacity-30"><ArrowDown className="h-3 w-3" /></button>
                    <span className="ml-1 font-mono text-[10.5px] text-muted-foreground">{c.sort_order}</span>
                  </div>
                </td>
                <td className="p-2 text-[13.5px] font-bold text-ink">{c.name}</td>
                <td className="p-2 text-right font-mono text-[12.5px] text-ink">{counts[c.name] ?? 0}</td>
                <td className="p-2">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => setEditing(c)} className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-[#F1F4F8] hover:text-ink"><Pencil className="h-3 w-3" /></button>
                    <button onClick={() => remove(c)} className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-[#FEF2F2] hover:text-[#E11D48]"><Trash2 className="h-3 w-3" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <CategoryModal
          category={editing}
          existing={categories}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); onChanged(); }}
        />
      )}
    </div>
  );
}

function CategoryModal({ category, existing, onClose, onSaved }: {
  category: Category | null; existing: Category[]; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [busy, setBusy] = useState(false);
  const nextOrder = (Math.max(0, ...existing.map((c) => c.sort_order)) + 10);

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      if (category) {
        const { error } = await supabase.from("categories").update({ name: name.trim() }).eq("id", category.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("categories").insert({ name: name.trim(), sort_order: nextOrder });
        if (error) throw error;
      }
      toast.success("Saved");
      onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[420px] rounded-xl border border-border bg-card p-5 shadow-2xl">
        <div className="mb-3 text-[16px] font-extrabold text-ink">{category ? "Edit category" : "New category"}</div>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Category name" autoFocus />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="bg-[#0B1A2E] hover:bg-[#1A3556]">Save</Button>
        </div>
      </div>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-2 py-2.5 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ${className}`}>{children}</th>;
}
