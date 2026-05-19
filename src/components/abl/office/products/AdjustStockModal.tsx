import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { applyStockMovement, MOVEMENT_LABEL, type MovementType, type ProductFull } from "@/lib/products";
import { toast } from "sonner";

const TYPES: Array<{ type: MovementType; sign: 1 | -1 | 0; warn?: string }> = [
  { type: "received", sign: 1 },
  { type: "sold", sign: -1, warn: "Sales are usually tracked automatically from orders." },
  { type: "damaged", sign: -1 },
  { type: "count_correction", sign: 0 },
  { type: "customer_return", sign: 1 },
  { type: "internal_use", sign: -1 },
  { type: "other", sign: 0 },
];

export function AdjustStockModal({ product, onClose, onDone }: {
  product: ProductFull; onClose: () => void; onDone: () => void;
}) {
  const [type, setType] = useState<MovementType>("received");
  const [qty, setQty] = useState<number>(1);
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);

  const cfg = TYPES.find((t) => t.type === type)!;
  const signed = cfg.sign === 0
    ? qty // count_correction & other can be ±, default to + (UI allows negative typing)
    : cfg.sign * Math.abs(qty);
  const newBalance = Math.max(0, product.on_hand + signed);
  const reasonRequired = type === "damaged" || type === "count_correction";

  const submit = async () => {
    if (!qty || qty === 0) { toast.error("Enter a quantity"); return; }
    if (reasonRequired && !reason.trim()) { toast.error("A reason is required"); return; }
    setBusy(true);
    try {
      await applyStockMovement({
        product_id: product.id,
        movement_type: type,
        quantity: signed,
        reason: reason.trim() || null,
        reference: reference.trim() || null,
      });
      toast.success("Stock adjusted");
      onDone();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to adjust stock");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[560px] overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between border-b border-border p-5">
          <div>
            <div className="text-[18px] font-extrabold text-ink">Adjust stock</div>
            <div className="mt-1 text-[12.5px] text-muted-foreground">
              <span className="font-semibold text-ink">{product.name}</span> · on hand <span className="font-mono font-bold text-ink">{product.on_hand}</span>
            </div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-[#F1F4F8] hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Adjustment type</div>
            <div className="flex flex-wrap gap-1.5">
              {TYPES.map((t) => (
                <button
                  key={t.type}
                  onClick={() => setType(t.type)}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                    type === t.type ? "bg-[#0B1A2E] text-white" : "border border-border bg-card text-[#64748B] hover:text-ink"
                  }`}
                >
                  {MOVEMENT_LABEL[t.type]}
                </button>
              ))}
            </div>
            {cfg.warn && (
              <div className="mt-2 flex items-start gap-2 rounded-md bg-warning-soft p-2 text-[11.5px] text-[color:var(--warning)]">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <span>{cfg.warn}</span>
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Quantity {cfg.sign === 0 ? "(use − for decreases)" : cfg.sign > 0 ? "(positive)" : "(will be deducted)"}
            </label>
            <Input
              type="number"
              value={qty}
              onChange={(e) => setQty(parseInt(e.target.value, 10) || 0)}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Reason / notes {reasonRequired && <span className="text-[#E11D48]">*</span>}
            </label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional explanation..." className="mt-1" rows={2} />
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Reference (optional)</label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Order #, PO #, etc." className="mt-1" />
          </div>

          <div className="rounded-md border border-dashed border-border bg-[#F8FAFC] p-3 text-center font-mono text-[13px]">
            <span className="text-muted-foreground">Current {product.on_hand}</span>
            <span className="mx-2 text-muted-foreground">→</span>
            <span className={`font-bold ${signed >= 0 ? "text-[color:var(--success)]" : "text-[#E11D48]"}`}>New {newBalance}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border bg-[#F8FAFC] p-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="bg-[#0B1A2E] hover:bg-[#1A3556]">
            {busy ? "Saving..." : "Save adjustment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
