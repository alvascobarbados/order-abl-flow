
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS approved_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  description text NOT NULL,
  related_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  related_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  related_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_log_created_at_idx ON public.activity_log (created_at DESC);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_log_staff_select ON public.activity_log;
CREATE POLICY activity_log_staff_select ON public.activity_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'office')
    )
  );

DROP POLICY IF EXISTS dev_anon_activity_log_select ON public.activity_log;
CREATE POLICY dev_anon_activity_log_select ON public.activity_log
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS dev_anon_activity_log_insert ON public.activity_log;
CREATE POLICY dev_anon_activity_log_insert ON public.activity_log
  FOR INSERT TO anon WITH CHECK (true);

-- Broaden dev anon update for orders so office can approve/transition
DROP POLICY IF EXISTS dev_anon_orders_update ON public.orders;
CREATE POLICY dev_anon_orders_update ON public.orders
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Order insert trigger
CREATE OR REPLACE FUNCTION public.log_order_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE c_name text;
BEGIN
  SELECT company_name INTO c_name FROM public.customers WHERE id = NEW.customer_id;
  INSERT INTO public.activity_log (event_type, description, related_order_id, related_customer_id, actor_profile_id)
  VALUES (
    'order_placed',
    'Order ' || COALESCE(NEW.order_number, '?') || ' placed by ' || COALESCE(c_name, 'customer'),
    NEW.id, NEW.customer_id, NEW.placed_by_profile_id
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_order_insert ON public.orders;
CREATE TRIGGER trg_log_order_insert
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_insert();

-- Order status transition trigger
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE c_name text; status_label text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT company_name INTO c_name FROM public.customers WHERE id = NEW.customer_id;
    status_label := replace(NEW.status::text, '_', ' ');
    INSERT INTO public.activity_log (event_type, description, related_order_id, related_customer_id, actor_profile_id)
    VALUES (
      'order_status_' || NEW.status::text,
      'Order ' || COALESCE(NEW.order_number, '?') || ' for ' || COALESCE(c_name, 'customer') || ' → ' || status_label,
      NEW.id, NEW.customer_id, NEW.approved_by_profile_id
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_order_status_change ON public.orders;
CREATE TRIGGER trg_log_order_status_change
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_status_change();

-- Product stock alert trigger
CREATE OR REPLACE FUNCTION public.log_product_stock_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.stock_status IS DISTINCT FROM OLD.stock_status
     AND NEW.stock_status IN ('low_stock', 'out_of_stock') THEN
    INSERT INTO public.activity_log (event_type, description, related_product_id)
    VALUES (
      'stock_alert_' || NEW.stock_status::text,
      'Stock alert: ' || NEW.name || ' is now ' || replace(NEW.stock_status::text, '_', ' '),
      NEW.id
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_product_stock_change ON public.products;
CREATE TRIGGER trg_log_product_stock_change
  AFTER UPDATE OF stock_status ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.log_product_stock_change();

-- Backfill existing orders
INSERT INTO public.activity_log (event_type, description, related_order_id, related_customer_id, created_at)
SELECT
  'order_placed',
  'Order ' || COALESCE(o.order_number, '?') || ' placed by ' || COALESCE(c.company_name, 'customer'),
  o.id, o.customer_id, o.placed_at
FROM public.orders o
LEFT JOIN public.customers c ON c.id = o.customer_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.activity_log a WHERE a.related_order_id = o.id AND a.event_type = 'order_placed'
);
