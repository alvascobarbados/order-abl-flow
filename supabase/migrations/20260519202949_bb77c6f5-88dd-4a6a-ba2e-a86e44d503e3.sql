
-- 1) Cart table (customer-scoped, separate from per-user carts)
CREATE TABLE IF NOT EXISTS public.cart (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0 AND quantity <= 999),
  added_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, product_id)
);

CREATE INDEX IF NOT EXISTS cart_customer_idx ON public.cart (customer_id);

ALTER TABLE public.cart ENABLE ROW LEVEL SECURITY;

-- Customer can manage their own cart
CREATE POLICY "cart_customer_all"
  ON public.cart FOR ALL
  TO authenticated
  USING (customer_id = public.current_customer_id())
  WITH CHECK (customer_id = public.current_customer_id());

-- Staff can read all carts
CREATE POLICY "cart_staff_select"
  ON public.cart FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- DEV: anon access (matches the temporary dev policies on other tables)
CREATE POLICY "dev_anon_cart_select"
  ON public.cart FOR SELECT TO anon USING (true);
CREATE POLICY "dev_anon_cart_insert"
  ON public.cart FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "dev_anon_cart_update"
  ON public.cart FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "dev_anon_cart_delete"
  ON public.cart FOR DELETE TO anon USING (true);

-- updated_at trigger
DROP TRIGGER IF EXISTS cart_set_updated_at ON public.cart;
CREATE TRIGGER cart_set_updated_at
  BEFORE UPDATE ON public.cart
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Stock notification requests — add customer_id and dev anon access
ALTER TABLE public.stock_notification_requests
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE;

ALTER TABLE public.stock_notification_requests
  ALTER COLUMN user_id DROP NOT NULL;

CREATE POLICY "dev_anon_stock_notify_insert"
  ON public.stock_notification_requests FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "dev_anon_stock_notify_select"
  ON public.stock_notification_requests FOR SELECT TO anon USING (true);

-- 3) Bump order number sequence so the next order is SO-2001
SELECT setval('public.order_number_seq', 2000, true);
