
-- Dev-phase anon access (will be removed when real auth returns)
CREATE POLICY "dev_anon_products_select" ON public.products
  FOR SELECT TO anon USING (is_active = true);

CREATE POLICY "dev_anon_customers_select" ON public.customers
  FOR SELECT TO anon USING (true);

CREATE POLICY "dev_anon_orders_select" ON public.orders
  FOR SELECT TO anon USING (true);

CREATE POLICY "dev_anon_orders_insert" ON public.orders
  FOR INSERT TO anon WITH CHECK (status = 'pending_approval'::order_status);

CREATE POLICY "dev_anon_orders_update" ON public.orders
  FOR UPDATE TO anon
  USING (status = 'pending_approval'::order_status)
  WITH CHECK (status IN ('pending_approval'::order_status, 'cancelled'::order_status));

CREATE POLICY "dev_anon_order_items_select" ON public.order_items
  FOR SELECT TO anon USING (true);

CREATE POLICY "dev_anon_order_items_insert" ON public.order_items
  FOR INSERT TO anon WITH CHECK (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.status = 'pending_approval'::order_status)
  );
