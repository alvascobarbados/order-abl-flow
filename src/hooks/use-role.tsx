import { useCallback, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/hooks/use-auth";

// UI roles shown in the role picker. Maps onto a seeded auth account
// (Part 2 seed migration). "sales" reuses the office role but signs in as Marlon.
export type Role = "customer" | "sales" | "office" | "warehouse" | "driver" | "admin";

export const ROLE_META: Record<Role, { label: string; home: string }> = {
  customer:  { label: "Customer",     home: "/shop" },
  sales:     { label: "Sales Rep",    home: "/office" },
  office:    { label: "Office Staff", home: "/office" },
  warehouse: { label: "Warehouse",    home: "/warehouse" },
  driver:    { label: "Driver",       home: "/delivery" },
  admin:     { label: "Admin",        home: "/office" },
};

// Dev-only credentials seeded by supabase/migrations/*seed_test_accounts.sql.
// These accounts exist ONLY in dev/test environments. Never repurpose for prod.
export const ROLE_CREDENTIALS: Record<Role, { email: string; password: string }> = {
  office:    { email: "sarah@abl.test",      password: "DevPass2026!Sarah"  },
  sales:     { email: "marlon@abl.test",     password: "DevPass2026!Marlon" },
  warehouse: { email: "andre@abl.test",      password: "DevPass2026!Andre"  },
  driver:    { email: "neal@abl.test",       password: "DevPass2026!Neal"   },
  customer:  { email: "buzo@test.customer",  password: "DevPass2026!Buzo"   },
  admin:     { email: "admin@abl.test",      password: "DevPass2026!Admin"  },
};

// Maps profile.role (DB enum) → UI Role. The DB doesn't model "sales"
// separately from "office"; sales just signs in as a different office staffer.
function profileRoleToUiRole(r: AppRole | null | undefined): Role | null {
  if (!r) return null;
  if (r === "office" || r === "warehouse" || r === "delivery" || r === "customer" || r === "admin") {
    return r === "delivery" ? "driver" : r;
  }
  return null;
}

export function useRole() {
  const { profile, signOut: authSignOut } = useAuth();
  const role: Role | null = profileRoleToUiRole(profile?.role);
  return { role, signOut: authSignOut };
}

/** Sign in as the seeded user mapped to the picker role. */
export function useSignInAsRole() {
  return useCallback(async (r: Role) => {
    const creds = ROLE_CREDENTIALS[r];
    const { error } = await supabase.auth.signInWithPassword(creds);
    if (error) throw error;
  }, []);
}

/**
 * Component-level route gate. If auth is loaded and the user's role does not
 * satisfy `expected`, redirect to "/" (role picker).
 *
 * Admin always passes. `expected` can be a single role or a list.
 * Pass `null` to require only that the user is signed in.
 */
export function useRequireRole(expected: AppRole | AppRole[] | null) {
  const { loading, session, profile } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (!session || !profile) {
      navigate({ to: "/" });
      return;
    }
    if (profile.role === "admin") return; // admin sees everything
    if (expected === null) return;        // only sign-in required
    const allowed = Array.isArray(expected) ? expected : [expected];
    if (!allowed.includes(profile.role)) {
      navigate({ to: "/" });
    }
  }, [loading, session, profile, expected, navigate]);
}
