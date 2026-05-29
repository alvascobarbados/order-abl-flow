import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export interface ActiveCustomer {
  id: string;
  company_name: string;
  customer_number: string | null;
}

interface Ctx {
  activeCustomerId: string | null;
  activeCustomer: ActiveCustomer | null;
  customers: ActiveCustomer[];
  setActiveCustomerId: (id: string) => void;
  reload: () => Promise<void>;
}

const KEY = "abl_active_customer_id";
const ActiveCustomerCtx = createContext<Ctx | undefined>(undefined);

export function ActiveCustomerProvider({ children }: { children: ReactNode }) {
  const { profile, session } = useAuth();
  const [customers, setCustomers] = useState<ActiveCustomer[]>([]);
  const [activeCustomerId, setActiveCustomerIdState] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!session || !profile) {
      setCustomers([]);
      setActiveCustomerIdState(null);
      return;
    }

    // Customers see only their own row. Staff/admin see the full list and
    // can impersonate via ViewingAsSwitcher.
    let query = supabase
      .from("customers")
      .select("id, company_name, customer_number")
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("company_name", { ascending: true });

    if (profile.role === "customer") {
      query = query.eq("contact_profile_id", profile.id);
    }

    const { data } = await query;
    const list = (data ?? []) as ActiveCustomer[];
    setCustomers(list);

    if (profile.role === "customer") {
      // Customer is locked to their own record. Ignore any stored override.
      setActiveCustomerIdState(list[0]?.id ?? null);
      return;
    }

    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(KEY);
    const chosen = stored && list.find((c) => c.id === stored) ? stored : list[0]?.id ?? null;
    setActiveCustomerIdState(chosen);
    if (chosen) window.localStorage.setItem(KEY, chosen);
  }, [profile, session]);

  useEffect(() => { reload(); }, [reload]);

  const setActiveCustomerId = (id: string) => {
    if (profile?.role === "customer") return; // locked
    setActiveCustomerIdState(id);
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, id);
  };

  const activeCustomer = customers.find((c) => c.id === activeCustomerId) ?? null;

  return (
    <ActiveCustomerCtx.Provider value={{ activeCustomerId, activeCustomer, customers, setActiveCustomerId, reload }}>
      {children}
    </ActiveCustomerCtx.Provider>
  );
}

export function useActiveCustomer() {
  const ctx = useContext(ActiveCustomerCtx);
  if (!ctx) throw new Error("useActiveCustomer must be used within ActiveCustomerProvider");
  return ctx;
}
