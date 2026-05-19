-- 1. New enum for delivery sub-status
DO $$ BEGIN
  CREATE TYPE public.delivery_status_detail AS ENUM (
    'delivered',
    'left_at_door',
    'refused',
    'failed_no_one_home',
    'failed_wrong_address',
    'rescheduled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Order columns for delivery
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS signature_image_url text,
  ADD COLUMN IF NOT EXISTS delivery_photo_url text,
  ADD COLUMN IF NOT EXISTS delivery_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_delivery_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_status_detail public.delivery_status_detail,
  ADD COLUMN IF NOT EXISTS route_sequence integer;

-- 3. driver_shifts table
CREATE TABLE IF NOT EXISTS public.driver_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_profile_id uuid,
  driver_name text,
  shift_date date NOT NULL DEFAULT CURRENT_DATE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  vehicle_id text,
  deliveries_count integer NOT NULL DEFAULT 0,
  cash_expected numeric NOT NULL DEFAULT 0,
  cash_counted numeric NOT NULL DEFAULT 0,
  variance numeric GENERATED ALWAYS AS (cash_counted - cash_expected) STORED,
  cheques_count integer NOT NULL DEFAULT 0,
  cheques_total numeric NOT NULL DEFAULT 0,
  cards_total numeric NOT NULL DEFAULT 0,
  account_total numeric NOT NULL DEFAULT 0,
  notes text,
  variance_resolved boolean NOT NULL DEFAULT false,
  variance_resolved_by uuid,
  variance_resolved_at timestamptz,
  variance_resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_shifts_driver_date
  ON public.driver_shifts(driver_profile_id, shift_date DESC);

DROP TRIGGER IF EXISTS trg_driver_shifts_updated_at ON public.driver_shifts;
CREATE TRIGGER trg_driver_shifts_updated_at
  BEFORE UPDATE ON public.driver_shifts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.driver_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS driver_shifts_self ON public.driver_shifts;
CREATE POLICY driver_shifts_self ON public.driver_shifts
  FOR ALL TO authenticated
  USING (driver_profile_id = auth.uid())
  WITH CHECK (driver_profile_id = auth.uid());

DROP POLICY IF EXISTS driver_shifts_staff_select ON public.driver_shifts;
CREATE POLICY driver_shifts_staff_select ON public.driver_shifts
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS driver_shifts_staff_update ON public.driver_shifts;
CREATE POLICY driver_shifts_staff_update ON public.driver_shifts
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS dev_anon_driver_shifts_all ON public.driver_shifts;
CREATE POLICY dev_anon_driver_shifts_all ON public.driver_shifts
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- 4. delivery_events table
CREATE TABLE IF NOT EXISTS public.delivery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  driver_profile_id uuid,
  driver_name text,
  event_type text NOT NULL,
  notes text,
  latitude numeric,
  longitude numeric,
  meta jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_events_order ON public.delivery_events(order_id, occurred_at);

ALTER TABLE public.delivery_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS delivery_events_driver_insert ON public.delivery_events;
CREATE POLICY delivery_events_driver_insert ON public.delivery_events
  FOR INSERT TO authenticated
  WITH CHECK (
    driver_profile_id = auth.uid()
    AND public.has_role(auth.uid(), 'delivery'::public.app_role)
  );

DROP POLICY IF EXISTS delivery_events_driver_select ON public.delivery_events;
CREATE POLICY delivery_events_driver_select ON public.delivery_events
  FOR SELECT TO authenticated
  USING (driver_profile_id = auth.uid() OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS dev_anon_delivery_events_all ON public.delivery_events;
CREATE POLICY dev_anon_delivery_events_all ON public.delivery_events
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- 5. Extend the orders delivery RLS to also include 'delivered' (so the Done tab works)
DROP POLICY IF EXISTS orders_delivery_select ON public.orders;
CREATE POLICY orders_delivery_select ON public.orders
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'delivery'::public.app_role)
    AND status IN ('packed','out_for_delivery','delivered','paid')
    AND (driver_profile_id IS NULL OR driver_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS orders_delivery_update ON public.orders;
CREATE POLICY orders_delivery_update ON public.orders
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'delivery'::public.app_role)
    AND status IN ('packed','out_for_delivery')
    AND (driver_profile_id IS NULL OR driver_profile_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'delivery'::public.app_role)
    AND status IN ('packed','out_for_delivery','delivered')
  );

-- 6. Storage bucket for signatures (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-signatures', 'delivery-signatures', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS delivery_signatures_staff_read ON storage.objects;
CREATE POLICY delivery_signatures_staff_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'delivery-signatures'
    AND (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'delivery'::public.app_role))
  );

DROP POLICY IF EXISTS delivery_signatures_driver_insert ON storage.objects;
CREATE POLICY delivery_signatures_driver_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'delivery-signatures'
    AND public.has_role(auth.uid(), 'delivery'::public.app_role)
  );

-- Dev-mode anon policies so the role-picker preview can save signatures
DROP POLICY IF EXISTS dev_anon_delivery_signatures_read ON storage.objects;
CREATE POLICY dev_anon_delivery_signatures_read ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'delivery-signatures');

DROP POLICY IF EXISTS dev_anon_delivery_signatures_insert ON storage.objects;
CREATE POLICY dev_anon_delivery_signatures_insert ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'delivery-signatures');
