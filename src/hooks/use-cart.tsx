import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCustomer } from "@/hooks/use-active-customer";

export interface CartLine {
  id: string;            // cart row id
  product_id: string;
  quantity: number;
  product: {
    id: string;
    sku: string;
    name: string;
    case_price: number;
    unit_price: number;
    pack_size: number;
    pack_unit: string;
    image_url: string | null;
    stock_status: "in_stock" | "low_stock" | "out_of_stock";
    category: string;
  };
}

interface CartCtx {
  customerId: string | null;
  lines: CartLine[];
  count: number;
  itemCount: number;
  total: number;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  loadingLineIds: Set<string>;
  add: (productId: string, qty?: number) => Promise<void>;
  setQty: (lineId: string, qty: number) => Promise<void>;
  remove: (lineId: string) => Promise<void>;
  clearForCustomer: () => Promise<void>;
  reload: () => Promise<void>;
}

const Ctx = createContext<CartCtx | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { activeCustomerId } = useActiveCustomer();
  const customerId = activeCustomerId;
  const [lines, setLines] = useState<CartLine[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loadingLineIds, setLoadingLineIds] = useState<Set<string>>(new Set());


  const reload = useCallback(async () => {
    if (!customerId) return;
    const { data, error } = await supabase
      .from("cart")
      .select(
        "id, product_id, quantity, product:products(id, sku, name, case_price, unit_price, pack_size, pack_unit, image_url, stock_status, category)",
      )
      .eq("customer_id", customerId)
      .order("added_at", { ascending: true });
    if (error) {
      console.error("Cart load failed", error);
      return;
    }
    setLines(((data ?? []) as unknown) as CartLine[]);
  }, [customerId]);

  useEffect(() => {
    if (customerId) reload();
  }, [customerId, reload]);

  const markLoading = (id: string, on: boolean) => {
    setLoadingLineIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const add = async (productId: string, qty = 1) => {
    if (!customerId) return;
    const clean = Math.max(1, Math.min(999, Math.floor(qty)));
    const existing = lines.find((l) => l.product_id === productId);
    if (existing) {
      const nextQty = Math.min(999, existing.quantity + clean);
      // Optimistic
      setLines((prev) =>
        prev.map((l) =>
          l.product_id === productId ? { ...l, quantity: nextQty } : l,
        ),
      );
      const { error } = await supabase
        .from("cart")
        .update({ quantity: nextQty })
        .eq("id", existing.id);
      if (error) {
        console.error(error);
        await reload();
      }
    } else {
      const { data, error } = await supabase
        .from("cart")
        .insert({
          customer_id: customerId,
          product_id: productId,
          quantity: clean,
        })
        .select(
          "id, product_id, quantity, product:products(id, sku, name, case_price, unit_price, pack_size, pack_unit, image_url, stock_status, category)",
        )
        .single();
      if (error) {
        console.error(error);
        await reload();
        return;
      }
      setLines((prev) => [...prev, (data as unknown) as CartLine]);
    }
  };

  const setQty = async (lineId: string, qty: number) => {
    const clean = Math.max(0, Math.min(999, Math.floor(qty)));
    if (clean === 0) {
      await remove(lineId);
      return;
    }
    setLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, quantity: clean } : l)),
    );
    markLoading(lineId, true);
    const { error } = await supabase
      .from("cart")
      .update({ quantity: clean })
      .eq("id", lineId);
    markLoading(lineId, false);
    if (error) {
      console.error(error);
      await reload();
    }
  };

  const remove = async (lineId: string) => {
    const snapshot = lines;
    setLines((prev) => prev.filter((l) => l.id !== lineId));
    const { error } = await supabase.from("cart").delete().eq("id", lineId);
    if (error) {
      console.error(error);
      setLines(snapshot);
    }
  };

  const clearForCustomer = async () => {
    if (!customerId) return;
    setLines([]);
    const { error } = await supabase
      .from("cart")
      .delete()
      .eq("customer_id", customerId);
    if (error) {
      console.error(error);
      await reload();
    }
  };

  const value = useMemo<CartCtx>(() => {
    const count = lines.reduce((s, l) => s + l.quantity, 0);
    const total = lines.reduce(
      (s, l) => s + l.quantity * Number(l.product.case_price),
      0,
    );
    return {
      customerId,
      lines,
      count,
      itemCount: lines.length,
      total,
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: () => setIsOpen((o) => !o),
      loadingLineIds,
      add,
      setQty,
      remove,
      clearForCustomer,
      reload,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, lines, isOpen, loadingLineIds]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
