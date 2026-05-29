
-- Tighten is_staff() to office/admin/warehouse only. Drivers get explicit
-- narrow policies for the data they actually need on the road.
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1 from public.profiles
    where id = _user_id
      and role in ('office'::public.app_role, 'admin'::public.app_role, 'warehouse'::public.app_role)
  )
$$;

-- Drivers: read customers tied to orders they can work (assigned or unassigned)
DROP POLICY IF EXISTS customers_driver_select ON public.customers;
CREATE POLICY customers_driver_select ON public.customers
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'delivery'::public.app_role)
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.customer_id = customers.id
      AND o.status IN ('packed'::public.order_status,'out_for_delivery'::public.order_status,'delivered'::public.order_status,'paid'::public.order_status)
      AND (o.driver_profile_id IS NULL OR o.driver_profile_id = auth.uid())
  )
);

-- Drivers: read order_items for their deliverable orders
DROP POLICY IF EXISTS order_items_driver_select ON public.order_items;
CREATE POLICY order_items_driver_select ON public.order_items
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'delivery'::public.app_role)
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.status IN ('packed'::public.order_status,'out_for_delivery'::public.order_status,'delivered'::public.order_status,'paid'::public.order_status)
      AND (o.driver_profile_id IS NULL OR o.driver_profile_id = auth.uid())
  )
);

-- Drivers: insert COD payments they receive themselves
DROP POLICY IF EXISTS payments_driver_insert ON public.payments;
CREATE POLICY payments_driver_insert ON public.payments
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'delivery'::public.app_role)
  AND received_by_profile_id = auth.uid()
);
