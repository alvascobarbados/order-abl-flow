import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

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
const KEY = "abl_cart_v1";

interface StoredLine { product_id: string; quantity: number }

function readStore(): StoredLine[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(window.localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function writeStore(lines: StoredLine[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(lines));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<StoredLine[]>([]);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => { setStored(readStore()); }, []);

  const hydrate = useCallback(async (entries: StoredLine[]) => {
    if (entries.length === 0) { setLines([]); return; }
    const ids = entries.map(e => e.product_id);
    const { data } = await supabase
      .from("products")
      .select("id, sku, name, case_price, pack_size, image_url, stock_status, category")
      .in("id", ids);
    const byId = new Map((data ?? []).map(p => [p.id as string, p]));
    setLines(entries
      .filter(e => byId.has(e.product_id))
      .map(e => ({
        id: e.product_id,
        product_id: e.product_id,
        quantity: e.quantity,
        product: byId.get(e.product_id)! as unknown as CartLine["product"],
      })));
  }, []);

  useEffect(() => { hydrate(stored); }, [stored, hydrate]);

  const persist = (next: StoredLine[]) => { writeStore(next); setStored(next); };

  const add = async (productId: string, qty = 1) => {
    const existing = stored.find(s => s.product_id === productId);
    const next = existing
      ? stored.map(s => s.product_id === productId ? { ...s, quantity: s.quantity + qty } : s)
      : [...stored, { product_id: productId, quantity: qty }];
    persist(next);
  };

  const setQty = async (lineId: string, qty: number) => {
    if (qty <= 0) { persist(stored.filter(s => s.product_id !== lineId)); return; }
    persist(stored.map(s => s.product_id === lineId ? { ...s, quantity: qty } : s));
  };

  const remove = async (lineId: string) => {
    persist(stored.filter(s => s.product_id !== lineId));
  };

  const clearLocal = () => persist([]);
  const reload = async () => hydrate(stored);

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
