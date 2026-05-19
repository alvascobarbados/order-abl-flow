
-- Order-level pack/pick tracking
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS picked_by_profile_id uuid,
  ADD COLUMN IF NOT EXISTS packed_by_profile_id uuid,
  ADD COLUMN IF NOT EXISTS carton_count integer,
  ADD COLUMN IF NOT EXISTS pack_notes text,
  ADD COLUMN IF NOT EXISTS pack_photo_url text,
  ADD COLUMN IF NOT EXISTS picking_paused_at timestamptz;

-- Per-line pick progress
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS picked_quantity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shortfall_quantity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shortfall_note text,
  ADD COLUMN IF NOT EXISTS picked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_scan_at timestamptz;

-- Allow order_items UPDATE so pickers can mark quantities
DROP POLICY IF EXISTS order_items_staff_update ON public.order_items;
CREATE POLICY order_items_staff_update ON public.order_items
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS dev_anon_order_items_update ON public.order_items;
CREATE POLICY dev_anon_order_items_update ON public.order_items
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- New shortfall stock movement type
DO $$ BEGIN
  ALTER TYPE public.stock_movement_type ADD VALUE IF NOT EXISTS 'shortfall';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Picking events log
CREATE TABLE IF NOT EXISTS public.picking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  order_item_id uuid,
  event_type text NOT NULL CHECK (event_type IN (
    'pick_started','item_scanned','item_picked_manually','item_undone',
    'shortfall_marked','pause','resume','pack_started','pack_completed',
    'item_added_off_order','supervisor_requested','damage_reported'
  )),
  quantity integer,
  picker_profile_id uuid,
  meta jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS picking_events_order_idx ON public.picking_events(order_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS picking_events_picker_idx ON public.picking_events(picker_profile_id, occurred_at DESC);

ALTER TABLE public.picking_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS picking_events_staff_all ON public.picking_events;
CREATE POLICY picking_events_staff_all ON public.picking_events
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'warehouse'))
  WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'warehouse'));

DROP POLICY IF EXISTS dev_anon_picking_events_all ON public.picking_events;
CREATE POLICY dev_anon_picking_events_all ON public.picking_events
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Move stock decrement from 'delivered' to 'packed'
DROP TRIGGER IF EXISTS trg_order_delivered_decrement_stock ON public.orders;

CREATE OR REPLACE FUNCTION public.on_order_packed_decrement_stock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE r RECORD;
BEGIN
  IF NEW.status = 'packed' AND OLD.status IS DISTINCT FROM 'packed' THEN
    FOR r IN SELECT oi.product_id,
                    SUM(GREATEST(0, COALESCE(oi.picked_quantity, oi.quantity) - COALESCE(oi.shortfall_quantity,0)))::int AS qty,
                    SUM(COALESCE(oi.shortfall_quantity,0))::int AS short_qty,
                    BOOL_OR(COALESCE(oi.shortfall_quantity,0) > 0) AS has_short
             FROM public.order_items oi
             WHERE oi.order_id = NEW.id
             GROUP BY oi.product_id LOOP
      IF r.qty > 0 THEN
        PERFORM public.apply_stock_movement(r.product_id, 'sold'::public.stock_movement_type, -r.qty,
          'Order packed', COALESCE(NEW.order_number, NEW.id::text), NEW.packed_by_profile_id);
      END IF;
      IF r.short_qty > 0 THEN
        PERFORM public.apply_stock_movement(r.product_id, 'shortfall'::public.stock_movement_type, 0,
          'Shortfall on pack', COALESCE(NEW.order_number, NEW.id::text), NEW.packed_by_profile_id);
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $function$;

CREATE TRIGGER trg_order_packed_decrement_stock
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.on_order_packed_decrement_stock();

-- Warehouse role policies on orders (more flexible than the existing narrow ones)
DROP POLICY IF EXISTS orders_warehouse_select ON public.orders;
CREATE POLICY orders_warehouse_select ON public.orders
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'warehouse')
         AND status = ANY (ARRAY['approved'::order_status,'picking'::order_status,'packed'::order_status,'out_for_delivery'::order_status]));

DROP POLICY IF EXISTS orders_warehouse_update ON public.orders;
CREATE POLICY orders_warehouse_update ON public.orders
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'warehouse')
         AND status = ANY (ARRAY['approved'::order_status,'picking'::order_status,'packed'::order_status]))
  WITH CHECK (public.has_role(auth.uid(),'warehouse')
         AND status = ANY (ARRAY['picking'::order_status,'packed'::order_status]));
