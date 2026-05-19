import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export interface CartLine {
  id: string;
  product_id: string;
  quantity: number;
  product: {
    id: string;
    sku: string;
    name: string;
    case_price: number;
    pack_size: number;
    image_url: string | null;
    stock_status: "in_stock" | "low_stock" | "out_of_stock";
    category: string;
  };
}

interface CartCtx {
  lines: CartLine[];
  count: number;
  total: number;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  add: (productId: string, qty?: number) => Promise<void>;
  setQty: (lineId: string, qty: number) => Promise<void>;
  remove: (lineId: string) => Promise<void>;
  clearLocal: () => void;
  reload: () => Promise<void>;
}

const Ctx = createContext<CartCtx | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [cartId, setCartId] = useState<string | null>(null);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const ensuring = useRef(false);

  const ensureCart = useCallback(async (uid: string): Promise<string | null> => {
    if (ensuring.current) return cartId;
    ensuring.current = true;
    try {
      const { data: existing } = await supabase.from("carts").select("id").eq("user_id", uid).maybeSingle();
      if (existing?.id) {
        setCartId(existing.id);
        return existing.id;
      }
      const { data: created, error } = await supabase
        .from("carts")
        .insert({ user_id: uid })
        .select("id")
        .single();
      if (error) {
        console.error(error);
        return null;
      }
      setCartId(created.id);
      return created.id;
    } finally {
      ensuring.current = false;
    }
  }, [cartId]);

  const reload = useCallback(async () => {
    if (!session?.user?.id) return;
    const id = cartId ?? (await ensureCart(session.user.id));
    if (!id) return;
    const { data } = await supabase
      .from("cart_items")
      .select("id, product_id, quantity, product:products(id, sku, name, case_price, pack_size, image_url, stock_status, category)")
      .eq("cart_id", id);
    setLines((data ?? []) as unknown as CartLine[]);
  }, [session?.user?.id, cartId, ensureCart]);

  useEffect(() => {
    if (session?.user?.id) {
      ensureCart(session.user.id).then(() => reload());
    } else {
      setCartId(null);
      setLines([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const add = async (productId: string, qty = 1) => {
    if (!session?.user?.id) return;
    const id = cartId ?? (await ensureCart(session.user.id));
    if (!id) return;
    const existing = lines.find(l => l.product_id === productId);
    if (existing) {
      await supabase.from("cart_items").update({ quantity: existing.quantity + qty }).eq("id", existing.id);
    } else {
      await supabase.from("cart_items").insert({ cart_id: id, product_id: productId, quantity: qty });
    }
    await reload();
  };

  const setQty = async (lineId: string, qty: number) => {
    if (qty <= 0) {
      await remove(lineId);
      return;
    }
    await supabase.from("cart_items").update({ quantity: qty }).eq("id", lineId);
    await reload();
  };

  const remove = async (lineId: string) => {
    await supabase.from("cart_items").delete().eq("id", lineId);
    setLines(prev => prev.filter(l => l.id !== lineId));
  };

  const clearLocal = () => setLines([]);

  const value = useMemo<CartCtx>(() => {
    const count = lines.reduce((s, l) => s + l.quantity, 0);
    const total = lines.reduce((s, l) => s + l.quantity * Number(l.product.case_price), 0);
    return {
      lines, count, total, isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: () => setIsOpen(o => !o),
      add, setQty, remove, clearLocal, reload,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, isOpen]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
