-- =========================================================================
-- PART 4: Drop all dev_anon_* policies (22 total)
-- =========================================================================
DROP POLICY IF EXISTS "dev_anon_products_select" ON public.products;
DROP POLICY IF EXISTS "dev_anon_products_insert" ON public.products;
DROP POLICY IF EXISTS "dev_anon_products_update" ON public.products;
DROP POLICY IF EXISTS "dev_anon_products_delete" ON public.products;

DROP POLICY IF EXISTS "dev_anon_customers_select" ON public.customers;
DROP POLICY IF EXISTS "dev_anon_customers_insert" ON public.customers;
DROP POLICY IF EXISTS "dev_anon_customers_update" ON public.customers;

DROP POLICY IF EXISTS "dev_anon_orders_select" ON public.orders;
DROP POLICY IF EXISTS "dev_anon_orders_insert" ON public.orders;
DROP POLICY IF EXISTS "dev_anon_orders_update" ON public.orders;

DROP POLICY IF EXISTS "dev_anon_order_items_select" ON public.order_items;
DROP POLICY IF EXISTS "dev_anon_order_items_insert" ON public.order_items;
DROP POLICY IF EXISTS "dev_anon_order_items_update" ON public.order_items;

DROP POLICY IF EXISTS "dev_anon_cart_select" ON public.cart;
DROP POLICY IF EXISTS "dev_anon_cart_insert" ON public.cart;
DROP POLICY IF EXISTS "dev_anon_cart_update" ON public.cart;
DROP POLICY IF EXISTS "dev_anon_cart_delete" ON public.cart;

DROP POLICY IF EXISTS "dev_anon_categories_select" ON public.categories;
DROP POLICY IF EXISTS "dev_anon_categories_insert" ON public.categories;
DROP POLICY IF EXISTS "dev_anon_categories_update" ON public.categories;
DROP POLICY IF EXISTS "dev_anon_categories_delete" ON public.categories;

DROP POLICY IF EXISTS "dev_anon_stock_movements_select" ON public.stock_movements;
DROP POLICY IF EXISTS "dev_anon_stock_movements_insert" ON public.stock_movements;

DROP POLICY IF EXISTS "dev_anon_stock_notify_select" ON public.stock_notification_requests;
DROP POLICY IF EXISTS "dev_anon_stock_notify_insert" ON public.stock_notification_requests;

-- Other open-to-anon policies discovered in audit
DROP POLICY IF EXISTS "dev_anon_profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "dev_anon_profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "dev_anon_activity_log_select" ON public.activity_log;
DROP POLICY IF EXISTS "dev_anon_activity_log_insert" ON public.activity_log;
DROP POLICY IF EXISTS "dev_anon_allocations_select" ON public.payment_allocations;
DROP POLICY IF EXISTS "dev_anon_allocations_insert" ON public.payment_allocations;
DROP POLICY IF EXISTS "dev_anon_allocations_update" ON public.payment_allocations;
DROP POLICY IF EXISTS "dev_anon_allocations_delete" ON public.payment_allocations;
DROP POLICY IF EXISTS "dev_anon_payments_select" ON public.payments;
DROP POLICY IF EXISTS "dev_anon_payments_insert" ON public.payments;
DROP POLICY IF EXISTS "dev_anon_payments_update" ON public.payments;
DROP POLICY IF EXISTS "dev_anon_payments_delete" ON public.payments;
DROP POLICY IF EXISTS "dev_anon_picking_events_all" ON public.picking_events;
DROP POLICY IF EXISTS "dev_anon_delivery_events_all" ON public.delivery_events;
DROP POLICY IF EXISTS "dev_anon_driver_shifts_all" ON public.driver_shifts;
DROP POLICY IF EXISTS "dev_anon_settings_all" ON public.system_settings;

-- =========================================================================
-- PART 5: Tighten real policies
-- =========================================================================

-- system_settings: only admin can write (was: any staff)
DROP POLICY IF EXISTS "settings_staff_write" ON public.system_settings;
CREATE POLICY "settings_admin_write" ON public.system_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- profiles: admin can update anyone (including role); selfupdate already prevents role change
CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- delivery_events: allow office/admin staff to insert as well (for back-office corrections)
CREATE POLICY "delivery_events_staff_insert" ON public.delivery_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

-- =========================================================================
-- PART 6: Storage bucket RLS tightening
-- =========================================================================

-- invoices bucket: was public-read. Now require auth to read. Owners/staff write.
UPDATE storage.buckets SET public = false WHERE id = 'invoices';

DROP POLICY IF EXISTS "invoices_public_read" ON storage.objects;
DROP POLICY IF EXISTS "invoices_authenticated_read" ON storage.objects;
CREATE POLICY "invoices_authenticated_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'invoices');

DROP POLICY IF EXISTS "invoices_staff_write" ON storage.objects;
CREATE POLICY "invoices_staff_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'invoices' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "invoices_staff_update" ON storage.objects;
CREATE POLICY "invoices_staff_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'invoices' AND public.is_staff(auth.uid()));

-- delivery-signatures bucket: private; readable by staff + the uploading driver, writable by drivers and staff
DROP POLICY IF EXISTS "signatures_read" ON storage.objects;
CREATE POLICY "signatures_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'delivery-signatures' AND (public.is_staff(auth.uid()) OR owner = auth.uid()));

DROP POLICY IF EXISTS "signatures_insert" ON storage.objects;
CREATE POLICY "signatures_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'delivery-signatures'
    AND (public.has_role(auth.uid(), 'delivery') OR public.is_staff(auth.uid()))
  );

-- product-images bucket left public-read (catalog browsing). Write requires staff.
DROP POLICY IF EXISTS "product_images_staff_write" ON storage.objects;
CREATE POLICY "product_images_staff_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "product_images_staff_update" ON storage.objects;
CREATE POLICY "product_images_staff_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "product_images_staff_delete" ON storage.objects;
CREATE POLICY "product_images_staff_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND public.is_staff(auth.uid()));