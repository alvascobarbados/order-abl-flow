import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Role = "customer" | "sales" | "office" | "warehouse" | "driver";

export const ROLE_META: Record<Role, { label: string; home: string }> = {
  customer:  { label: "Customer",    home: "/shop" },
  sales:     { label: "Sales Rep",   home: "/sales" },
  office:    { label: "Office Staff", home: "/office" },
  warehouse: { label: "Warehouse",   home: "/warehouse" },
  driver:    { label: "Driver",      home: "/driver" },
};

interface RoleCtx {
  role: Role | null;
  setRole: (r: Role | null) => void;
}

const Ctx = createContext<RoleCtx | undefined>(undefined);
const KEY = "abl_active_role";

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = window.localStorage.getItem(KEY) as Role | null;
    if (v) setRoleState(v);
  }, []);

  const setRole = (r: Role | null) => {
    setRoleState(r);
    if (typeof window === "undefined") return;
    if (r) window.localStorage.setItem(KEY, r);
    else window.localStorage.removeItem(KEY);
  };

  return <Ctx.Provider value={{ role, setRole }}>{children}</Ctx.Provider>;
}

export function useRole() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
