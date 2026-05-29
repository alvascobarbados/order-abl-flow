
-- 1) Grant SELECT on the customer_delivery_info view to authenticated users.
-- The view is security_invoker=on, so the underlying customers RLS policies
-- (including customers_driver_select) still apply per-user. Drivers will only
-- see rows for customers tied to their assigned/loadable orders. Financial
-- columns (credit_limit, current_balance) are excluded by the view itself.
GRANT SELECT ON public.customer_delivery_info TO authenticated;

-- 2) Backfill driver_profile_id on orders where only driver_name was set.
-- The app is being switched to key on driver_profile_id (stable id), but
-- existing rows may only have driver_name. Match by profile.full_name.
UPDATE public.orders o
SET driver_profile_id = p.id
FROM public.profiles p
WHERE o.driver_profile_id IS NULL
  AND o.driver_name IS NOT NULL
  AND p.role = 'delivery'
  AND p.full_name = o.driver_name;

-- 3) Index to speed up driver-scoped order lookups going forward.
CREATE INDEX IF NOT EXISTS idx_orders_driver_profile_id
  ON public.orders (driver_profile_id)
  WHERE driver_profile_id IS NOT NULL;
