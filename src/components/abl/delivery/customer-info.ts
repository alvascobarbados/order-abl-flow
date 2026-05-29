import { supabase } from "@/integrations/supabase/client";

export type DeliveryCustomer = {
  id: string;
  company_name: string;
  delivery_address: string | null;
  delivery_city: string | null;
  delivery_parish: string | null;
  delivery_notes: string | null;
  phone: string | null;
};

/**
 * Fetch customer delivery info for a set of customer ids in a single query,
 * then return a Map keyed by id so callers can merge into orders in JS.
 *
 * Replaces the fragile `customer:customer_delivery_info!customer_id(...)`
 * FK-embedded read — PostgREST cannot reliably resolve an FK embed on a view.
 */
export async function fetchCustomerInfoMap(
  customerIds: string[],
): Promise<Map<string, DeliveryCustomer>> {
  const map = new Map<string, DeliveryCustomer>();
  if (customerIds.length === 0) return map;
  const uniq = Array.from(new Set(customerIds));
  const { data, error } = await supabase
    .from("customer_delivery_info")
    .select("id, company_name, delivery_address, delivery_city, delivery_parish, delivery_notes, phone")
    .in("id", uniq);
  if (error) throw new Error(error.message);
  for (const c of (data ?? []) as DeliveryCustomer[]) map.set(c.id, c);
  return map;
}
