
-- 1. New columns on orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS assigned_picker_name text,
  ADD COLUMN IF NOT EXISTS picking_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS packed_at timestamptz,
  ADD COLUMN IF NOT EXISTS driver_name text,
  ADD COLUMN IF NOT EXISTS driver_profile_id uuid,
  ADD COLUMN IF NOT EXISTS vehicle_id text,
  ADD COLUMN IF NOT EXISTS dispatched_at timestamptz,
  ADD COLUMN IF NOT EXISTS eta timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_to_name text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS restored_at timestamptz,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS placed_on_behalf boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS previous_status public.order_status;

-- 2. Invoice sequence starts at 4001
SELECT setval('public.invoice_number_seq', 4000, true)
  WHERE (SELECT last_value FROM public.invoice_number_seq) < 4000;

-- 3. Trigger to assign invoice number AND due date when moving into 'invoiced'
CREATE OR REPLACE FUNCTION public.assign_invoice_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
DECLARE terms int;
BEGIN
  IF NEW.status = 'invoiced' AND (OLD.status IS DISTINCT FROM 'invoiced') THEN
    IF NEW.invoice_number IS NULL THEN
      NEW.invoice_number := 'INV-' || nextval('public.invoice_number_seq')::text;
    END IF;
    NEW.invoiced_at := COALESCE(NEW.invoiced_at, now());
    IF NEW.due_date IS NULL THEN
      SELECT payment_terms_days INTO terms FROM public.customers WHERE id = NEW.customer_id;
      NEW.due_date := (COALESCE(NEW.invoiced_at, now())::date) + COALESCE(terms, 30);
    END IF;
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS orders_assign_invoice_number ON public.orders;
CREATE TRIGGER orders_assign_invoice_number
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.assign_invoice_number();

-- 4. Status transition validation
CREATE OR REPLACE FUNCTION public.validate_order_status_transition()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
DECLARE allowed public.order_status[];
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  allowed := CASE OLD.status
    WHEN 'draft'            THEN ARRAY['pending_approval','cancelled']::public.order_status[]
    WHEN 'pending_approval' THEN ARRAY['approved','cancelled']::public.order_status[]
    WHEN 'approved'         THEN ARRAY['picking','cancelled']::public.order_status[]
    WHEN 'picking'          THEN ARRAY['packed','cancelled']::public.order_status[]
    WHEN 'packed'           THEN ARRAY['out_for_delivery','picking','cancelled']::public.order_status[]
    WHEN 'out_for_delivery' THEN ARRAY['delivered','packed','cancelled']::public.order_status[]
    WHEN 'delivered'        THEN ARRAY['invoiced','cancelled']::public.order_status[]
    WHEN 'invoiced'         THEN ARRAY['paid','cancelled']::public.order_status[]
    WHEN 'paid'             THEN ARRAY[]::public.order_status[]
    WHEN 'cancelled'        THEN ARRAY['pending_approval','approved','picking','packed','out_for_delivery','delivered','invoiced']::public.order_status[]
    ELSE ARRAY[]::public.order_status[]
  END;

  IF NOT (NEW.status = ANY(allowed)) THEN
    RAISE EXCEPTION 'Invalid status transition: % → %', OLD.status, NEW.status;
  END IF;

  -- stamp transition timestamps
  IF NEW.status = 'approved'         AND NEW.approved_at IS NULL         THEN NEW.approved_at := now(); END IF;
  IF NEW.status = 'picking'          AND NEW.picking_started_at IS NULL  THEN NEW.picking_started_at := now(); END IF;
  IF NEW.status = 'packed'           AND NEW.packed_at IS NULL           THEN NEW.packed_at := now(); END IF;
  IF NEW.status = 'out_for_delivery' AND NEW.dispatched_at IS NULL       THEN NEW.dispatched_at := now(); END IF;
  IF NEW.status = 'delivered'        AND NEW.delivered_at IS NULL        THEN NEW.delivered_at := now(); END IF;
  IF NEW.status = 'cancelled'        AND NEW.cancelled_at IS NULL        THEN
    NEW.cancelled_at := now();
    NEW.previous_status := OLD.status;
  END IF;
  IF OLD.status = 'cancelled' AND NEW.status <> 'cancelled' AND NEW.restored_at IS NULL THEN
    NEW.restored_at := now();
  END IF;

  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS orders_validate_transition ON public.orders;
CREATE TRIGGER orders_validate_transition
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_order_status_transition();

-- 5. Log cancel + restore events with reason
CREATE OR REPLACE FUNCTION public.log_order_cancel_or_restore()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
DECLARE c_name text;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    SELECT company_name INTO c_name FROM public.customers WHERE id = NEW.customer_id;
    INSERT INTO public.activity_log (event_type, description, related_order_id, related_customer_id, actor_profile_id)
    VALUES ('order_cancelled',
      'Order ' || COALESCE(NEW.order_number,'?') || ' cancelled · ' || COALESCE(c_name,'customer') ||
      COALESCE(' · reason: ' || NEW.cancellation_reason, ''),
      NEW.id, NEW.customer_id, NEW.approved_by_profile_id);
  ELSIF OLD.status = 'cancelled' AND NEW.status <> 'cancelled' THEN
    SELECT company_name INTO c_name FROM public.customers WHERE id = NEW.customer_id;
    INSERT INTO public.activity_log (event_type, description, related_order_id, related_customer_id, actor_profile_id)
    VALUES ('order_restored',
      'Order ' || COALESCE(NEW.order_number,'?') || ' restored to ' || NEW.status::text || ' · ' || COALESCE(c_name,'customer'),
      NEW.id, NEW.customer_id, NEW.approved_by_profile_id);
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS orders_log_cancel_restore ON public.orders;
CREATE TRIGGER orders_log_cancel_restore
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_cancel_or_restore();

-- 6. Re-attach the existing status change logger if missing
DROP TRIGGER IF EXISTS orders_log_status_change ON public.orders;
CREATE TRIGGER orders_log_status_change
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_status_change();

DROP TRIGGER IF EXISTS orders_log_insert ON public.orders;
CREATE TRIGGER orders_log_insert
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_insert();

DROP TRIGGER IF EXISTS orders_assign_order_number ON public.orders;
CREATE TRIGGER orders_assign_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.assign_order_number();

DROP TRIGGER IF EXISTS orders_set_updated_at ON public.orders;
CREATE TRIGGER orders_set_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS orders_deliver_decrement_stock ON public.orders;
CREATE TRIGGER orders_deliver_decrement_stock
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.on_order_delivered_decrement_stock();

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_orders_status         ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_placed_at      ON public.orders (placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_delivered_at   ON public.orders (delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id    ON public.orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_invoice_number ON public.orders (invoice_number);
CREATE INDEX IF NOT EXISTS idx_orders_due_date       ON public.orders (due_date);

-- 8. Role-based RLS (additive — keep dev_anon + existing staff/admin)
DROP POLICY IF EXISTS orders_warehouse_select ON public.orders;
CREATE POLICY orders_warehouse_select ON public.orders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'warehouse') AND status IN ('approved','picking','packed','out_for_delivery'));

DROP POLICY IF EXISTS orders_warehouse_update ON public.orders;
CREATE POLICY orders_warehouse_update ON public.orders FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'warehouse') AND status IN ('picking','packed'))
  WITH CHECK (public.has_role(auth.uid(),'warehouse') AND status IN ('picking','packed','out_for_delivery'));

DROP POLICY IF EXISTS orders_delivery_select ON public.orders;
CREATE POLICY orders_delivery_select ON public.orders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'delivery') AND status IN ('packed','out_for_delivery'));

DROP POLICY IF EXISTS orders_delivery_update ON public.orders;
CREATE POLICY orders_delivery_update ON public.orders FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'delivery') AND status = 'out_for_delivery')
  WITH CHECK (public.has_role(auth.uid(),'delivery') AND status IN ('out_for_delivery','delivered'));
