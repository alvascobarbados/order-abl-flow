
-- ===== Categories table =====
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_read_all" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories_staff_write" ON public.categories FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "dev_anon_categories_select" ON public.categories FOR SELECT TO anon USING (true);
CREATE POLICY "dev_anon_categories_insert" ON public.categories FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "dev_anon_categories_update" ON public.categories FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "dev_anon_categories_delete" ON public.categories FOR DELETE TO anon USING (true);

-- Seed from existing distinct product categories
INSERT INTO public.categories (name, sort_order)
SELECT DISTINCT category, (ROW_NUMBER() OVER (ORDER BY category))::int * 10
FROM public.products
WHERE category IS NOT NULL
ON CONFLICT (name) DO NOTHING;

-- ===== Stock status override enum =====
DO $$ BEGIN
  CREATE TYPE public.stock_status_override AS ENUM ('auto','in_stock','low_stock','out_of_stock');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== Movement type enum =====
DO $$ BEGIN
  CREATE TYPE public.stock_movement_type AS ENUM
    ('received','sold','damaged','count_correction','customer_return','internal_use','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===== Products extensions =====
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS on_hand integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reorder_point integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reorder_quantity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lead_time_days integer,
  ADD COLUMN IF NOT EXISTS track_inventory boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS stock_status_override public.stock_status_override NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS bin_location text,
  ADD COLUMN IF NOT EXISTS cost_price numeric,
  ADD COLUMN IF NOT EXISTS vat_inclusive boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS supplier_sku text,
  ADD COLUMN IF NOT EXISTS supplier_name text,
  ADD COLUMN IF NOT EXISTS primary_image_url text,
  ADD COLUMN IF NOT EXISTS secondary_image_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by_profile_id uuid,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Backfill primary_image_url from legacy image_url
UPDATE public.products SET primary_image_url = image_url WHERE primary_image_url IS NULL AND image_url IS NOT NULL;

-- Backfill on_hand reasonably so existing rows aren't all 0
UPDATE public.products
SET on_hand = CASE
  WHEN stock_status = 'out_of_stock' THEN 0
  WHEN stock_status = 'low_stock' THEN 8
  ELSE 100
END,
reorder_point = CASE WHEN stock_status = 'low_stock' THEN 10 ELSE 20 END,
reorder_quantity = 50
WHERE on_hand = 0 AND reorder_point = 0;

-- Allow office to update products (currently only admin can write)
DROP POLICY IF EXISTS "products_staff_write" ON public.products;
CREATE POLICY "products_staff_write" ON public.products FOR ALL TO authenticated
  USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));

DROP POLICY IF EXISTS "dev_anon_products_insert" ON public.products;
DROP POLICY IF EXISTS "dev_anon_products_update" ON public.products;
DROP POLICY IF EXISTS "dev_anon_products_delete" ON public.products;
CREATE POLICY "dev_anon_products_insert" ON public.products FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "dev_anon_products_update" ON public.products FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "dev_anon_products_delete" ON public.products FOR DELETE TO anon USING (true);

-- ===== Stock status resolver function =====
CREATE OR REPLACE FUNCTION public.resolve_stock_status(
  _on_hand integer, _reorder_point integer, _override public.stock_status_override, _track boolean
) RETURNS public.stock_status
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _override = 'in_stock' THEN 'in_stock'::public.stock_status
    WHEN _override = 'low_stock' THEN 'low_stock'::public.stock_status
    WHEN _override = 'out_of_stock' THEN 'out_of_stock'::public.stock_status
    WHEN _track IS FALSE THEN 'in_stock'::public.stock_status
    WHEN _on_hand <= 0 THEN 'out_of_stock'::public.stock_status
    WHEN _on_hand <= COALESCE(_reorder_point, 0) THEN 'low_stock'::public.stock_status
    ELSE 'in_stock'::public.stock_status
  END;
$$;

-- Auto-update stock_status before insert/update on products
CREATE OR REPLACE FUNCTION public.products_recompute_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.stock_status := public.resolve_stock_status(NEW.on_hand, NEW.reorder_point, NEW.stock_status_override, NEW.track_inventory);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_products_recompute_status ON public.products;
CREATE TRIGGER trg_products_recompute_status
  BEFORE INSERT OR UPDATE OF on_hand, reorder_point, stock_status_override, track_inventory
  ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_recompute_status();

-- Recompute status for existing rows
UPDATE public.products SET on_hand = on_hand;

-- ===== Stock movements table =====
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  movement_type public.stock_movement_type NOT NULL,
  quantity integer NOT NULL,
  reason text,
  reference text,
  recorded_by_profile_id uuid,
  balance_after integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id, created_at DESC);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_movements_staff_select" ON public.stock_movements FOR SELECT TO authenticated
  USING (is_staff(auth.uid()));
CREATE POLICY "stock_movements_staff_insert" ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "dev_anon_stock_movements_select" ON public.stock_movements FOR SELECT TO anon USING (true);
CREATE POLICY "dev_anon_stock_movements_insert" ON public.stock_movements FOR INSERT TO anon WITH CHECK (true);

-- Apply stock movement: adjusts products.on_hand atomically + stamps balance_after + logs activity
CREATE OR REPLACE FUNCTION public.apply_stock_movement(
  _product_id uuid,
  _movement_type public.stock_movement_type,
  _quantity integer,
  _reason text DEFAULT NULL,
  _reference text DEFAULT NULL,
  _recorded_by uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  new_balance integer;
  movement_id uuid;
  p_name text;
BEGIN
  UPDATE public.products SET on_hand = GREATEST(0, on_hand + _quantity)
    WHERE id = _product_id RETURNING on_hand, name INTO new_balance, p_name;

  INSERT INTO public.stock_movements (product_id, movement_type, quantity, reason, reference, recorded_by_profile_id, balance_after)
  VALUES (_product_id, _movement_type, _quantity, _reason, _reference, _recorded_by, new_balance)
  RETURNING id INTO movement_id;

  INSERT INTO public.activity_log (event_type, description, related_product_id, actor_profile_id)
  VALUES (
    'stock_movement_' || _movement_type::text,
    'Stock ' || (CASE WHEN _quantity >= 0 THEN '+' ELSE '' END) || _quantity::text ||
      ' · ' || COALESCE(p_name, 'product') || ' · ' || replace(_movement_type::text, '_', ' ') ||
      ' · balance now ' || new_balance::text,
    _product_id, _recorded_by
  );

  RETURN movement_id;
END $$;

-- ===== Decrement stock when orders are delivered =====
CREATE OR REPLACE FUNCTION public.on_order_delivered_decrement_stock()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered' THEN
    FOR r IN SELECT oi.product_id, SUM(oi.quantity)::int AS qty
             FROM public.order_items oi
             WHERE oi.order_id = NEW.id
             GROUP BY oi.product_id LOOP
      PERFORM public.apply_stock_movement(r.product_id, 'sold'::public.stock_movement_type, -r.qty,
        'Order delivered', COALESCE(NEW.order_number, NEW.id::text), NEW.approved_by_profile_id);
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_order_delivered_stock ON public.orders;
CREATE TRIGGER trg_order_delivered_stock
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.on_order_delivered_decrement_stock();

-- ===== View: products_with_stock_info =====
CREATE OR REPLACE VIEW public.products_with_stock_info AS
SELECT
  p.*,
  COALESCE(velocity.weekly_velocity, 0) AS avg_weekly_velocity,
  CASE
    WHEN COALESCE(velocity.weekly_velocity, 0) > 0
      THEN ROUND((p.on_hand::numeric / (velocity.weekly_velocity / 7.0))::numeric, 1)
    ELSE NULL
  END AS days_of_stock
FROM public.products p
LEFT JOIN LATERAL (
  SELECT SUM(ABS(sm.quantity))::numeric / 4.0 AS weekly_velocity
  FROM public.stock_movements sm
  WHERE sm.product_id = p.id
    AND sm.movement_type = 'sold'
    AND sm.created_at > now() - interval '28 days'
) velocity ON true;

-- ===== Storage bucket for product images =====
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
DROP POLICY IF EXISTS "Product images public read" ON storage.objects;
CREATE POLICY "Product images public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Authenticated write
DROP POLICY IF EXISTS "Product images staff write" ON storage.objects;
CREATE POLICY "Product images staff write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images');
DROP POLICY IF EXISTS "Product images staff update" ON storage.objects;
CREATE POLICY "Product images staff update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images');
DROP POLICY IF EXISTS "Product images staff delete" ON storage.objects;
CREATE POLICY "Product images staff delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images');

-- Anon write for dev role-picker flow
DROP POLICY IF EXISTS "Product images anon write" ON storage.objects;
CREATE POLICY "Product images anon write" ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'product-images');
DROP POLICY IF EXISTS "Product images anon update" ON storage.objects;
CREATE POLICY "Product images anon update" ON storage.objects FOR UPDATE TO anon
  USING (bucket_id = 'product-images');
DROP POLICY IF EXISTS "Product images anon delete" ON storage.objects;
CREATE POLICY "Product images anon delete" ON storage.objects FOR DELETE TO anon
  USING (bucket_id = 'product-images');
