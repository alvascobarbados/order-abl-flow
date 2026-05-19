
-- =========================================
-- Payments layer
-- =========================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.payment_method AS ENUM ('cash', 'cheque', 'bank_transfer', 'card', 'credit_note', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('pending', 'cleared', 'bounced', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Sequence
CREATE SEQUENCE IF NOT EXISTS public.payment_number_seq START 1001;

-- Add paid_at to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number text UNIQUE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method public.payment_method NOT NULL,
  reference text,
  received_by_profile_id uuid REFERENCES public.profiles(id),
  notes text,
  status public.payment_status NOT NULL DEFAULT 'cleared',
  cleared_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON public.payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON public.payments(payment_date);

-- payment_allocations table
CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_allocations_payment ON public.payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_allocations_order ON public.payment_allocations(order_id);

-- Auto-assign payment number
CREATE OR REPLACE FUNCTION public.assign_payment_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.payment_number IS NULL THEN
    NEW.payment_number := 'PMT-' || nextval('public.payment_number_seq')::text;
  END IF;
  -- For cleared status, default cleared_at
  IF NEW.status = 'cleared' AND NEW.cleared_at IS NULL THEN
    NEW.cleared_at := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_assign_payment_number ON public.payments;
CREATE TRIGGER trg_assign_payment_number
BEFORE INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.assign_payment_number();

DROP TRIGGER IF EXISTS trg_payments_updated_at ON public.payments;
CREATE TRIGGER trg_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: when payment status changes to cleared, set cleared_at; recompute order paid status
CREATE OR REPLACE FUNCTION public.on_payment_status_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  alloc RECORD;
  paid_sum numeric;
  ord RECORD;
BEGIN
  -- Set cleared_at when moving into cleared
  IF NEW.status = 'cleared' AND (OLD.status IS DISTINCT FROM 'cleared') AND NEW.cleared_at IS NULL THEN
    NEW.cleared_at := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_payment_status_change ON public.payments;
CREATE TRIGGER trg_payment_status_change
BEFORE UPDATE ON public.payments
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.on_payment_status_change();

-- Function to recompute paid status for an order based on cleared allocations
CREATE OR REPLACE FUNCTION public.recompute_order_paid_status(_order_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  ord RECORD;
  paid_sum numeric;
  c_name text;
BEGIN
  SELECT o.*, c.company_name INTO ord
  FROM public.orders o
  LEFT JOIN public.customers c ON c.id = o.customer_id
  WHERE o.id = _order_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(SUM(pa.amount), 0)
  INTO paid_sum
  FROM public.payment_allocations pa
  JOIN public.payments p ON p.id = pa.payment_id
  WHERE pa.order_id = _order_id AND p.status = 'cleared';

  IF paid_sum >= ord.total AND ord.status IN ('invoiced', 'delivered') THEN
    UPDATE public.orders SET status = 'paid', paid_at = COALESCE(paid_at, now()) WHERE id = _order_id;
    INSERT INTO public.activity_log (event_type, description, related_order_id, related_customer_id)
    VALUES ('invoice_paid',
      COALESCE(ord.invoice_number, ord.order_number) || ' fully paid · ' || COALESCE(ord.company_name, 'customer'),
      _order_id, ord.customer_id);
  ELSIF paid_sum < ord.total AND ord.status = 'paid' THEN
    -- Revert paid → invoiced if cleared payments no longer cover total
    UPDATE public.orders SET status = 'invoiced', paid_at = NULL WHERE id = _order_id;
  END IF;
END $$;

-- Trigger: after payment_allocations change, recompute affected orders
CREATE OR REPLACE FUNCTION public.on_allocation_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.order_id IS NOT NULL THEN PERFORM public.recompute_order_paid_status(OLD.order_id); END IF;
    RETURN OLD;
  ELSE
    IF NEW.order_id IS NOT NULL THEN PERFORM public.recompute_order_paid_status(NEW.order_id); END IF;
    IF TG_OP = 'UPDATE' AND OLD.order_id IS DISTINCT FROM NEW.order_id AND OLD.order_id IS NOT NULL THEN
      PERFORM public.recompute_order_paid_status(OLD.order_id);
    END IF;
    RETURN NEW;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_allocation_change ON public.payment_allocations;
CREATE TRIGGER trg_allocation_change
AFTER INSERT OR UPDATE OR DELETE ON public.payment_allocations
FOR EACH ROW EXECUTE FUNCTION public.on_allocation_change();

-- Trigger: after a payment status change, recompute every order it touches
CREATE OR REPLACE FUNCTION public.on_payment_status_change_after()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE r RECORD; c_name text;
BEGIN
  FOR r IN SELECT DISTINCT order_id FROM public.payment_allocations WHERE payment_id = NEW.id AND order_id IS NOT NULL LOOP
    PERFORM public.recompute_order_paid_status(r.order_id);
  END LOOP;
  SELECT company_name INTO c_name FROM public.customers WHERE id = NEW.customer_id;
  IF NEW.status = 'cleared' AND OLD.status IS DISTINCT FROM 'cleared' THEN
    INSERT INTO public.activity_log (event_type, description, related_customer_id)
    VALUES ('payment_cleared',
      'Payment ' || COALESCE(NEW.payment_number, '?') || ' cleared · ' ||
      'BBD$ ' || to_char(NEW.amount, 'FM999,999,990.00') || ' from ' || COALESCE(c_name, 'customer'),
      NEW.customer_id);
  ELSIF NEW.status = 'bounced' AND OLD.status IS DISTINCT FROM 'bounced' THEN
    INSERT INTO public.activity_log (event_type, description, related_customer_id)
    VALUES ('payment_bounced',
      'Payment ' || COALESCE(NEW.payment_number, '?') || ' bounced · BBD$ ' ||
      to_char(NEW.amount, 'FM999,999,990.00') || ' from ' || COALESCE(c_name, 'customer'),
      NEW.customer_id);
  ELSIF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    INSERT INTO public.activity_log (event_type, description, related_customer_id)
    VALUES ('payment_cancelled',
      'Payment ' || COALESCE(NEW.payment_number, '?') || ' cancelled · ' || COALESCE(c_name, 'customer'),
      NEW.customer_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_payment_status_change_after ON public.payments;
CREATE TRIGGER trg_payment_status_change_after
AFTER UPDATE ON public.payments
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.on_payment_status_change_after();

-- Log payment_recorded on insert
CREATE OR REPLACE FUNCTION public.on_payment_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE c_name text; method_label text;
BEGIN
  SELECT company_name INTO c_name FROM public.customers WHERE id = NEW.customer_id;
  method_label := replace(NEW.payment_method::text, '_', ' ');
  INSERT INTO public.activity_log (event_type, description, related_customer_id, actor_profile_id)
  VALUES ('payment_recorded',
    'Payment ' || COALESCE(NEW.payment_number, '?') || ' recorded · BBD$ ' ||
    to_char(NEW.amount, 'FM999,999,990.00') || ' from ' || COALESCE(c_name, 'customer') || ' via ' || method_label,
    NEW.customer_id, NEW.received_by_profile_id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_payment_insert ON public.payments;
CREATE TRIGGER trg_payment_insert
AFTER INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.on_payment_insert();

-- View: customer_account_summary
CREATE OR REPLACE VIEW public.customer_account_summary AS
WITH inv AS (
  SELECT customer_id,
         SUM(total) AS total_invoiced,
         COUNT(*) FILTER (WHERE status IN ('invoiced','paid')) AS invoiced_count
  FROM public.orders
  WHERE status IN ('invoiced', 'paid')
  GROUP BY customer_id
),
paid AS (
  SELECT customer_id,
         SUM(amount) AS total_paid
  FROM public.payments
  WHERE status = 'cleared'
  GROUP BY customer_id
),
last_p AS (
  SELECT DISTINCT ON (customer_id)
    customer_id, payment_date AS last_payment_date, amount AS last_payment_amount
  FROM public.payments
  WHERE status = 'cleared'
  ORDER BY customer_id, payment_date DESC, created_at DESC
),
oldest AS (
  SELECT o.customer_id,
         MIN(o.invoiced_at) AS oldest_unpaid_invoiced_at
  FROM public.orders o
  WHERE o.status = 'invoiced' AND o.invoiced_at IS NOT NULL
  GROUP BY o.customer_id
),
overdue AS (
  SELECT o.customer_id,
         COUNT(*) AS count_overdue_invoices
  FROM public.orders o
  JOIN public.customers c ON c.id = o.customer_id
  WHERE o.status = 'invoiced'
    AND o.invoiced_at IS NOT NULL
    AND (o.invoiced_at + (c.payment_terms_days || ' days')::interval) < now()
  GROUP BY o.customer_id
)
SELECT
  c.id AS customer_id,
  COALESCE(inv.total_invoiced, 0)::numeric(12,2) AS total_invoiced,
  COALESCE(paid.total_paid, 0)::numeric(12,2) AS total_paid,
  (COALESCE(inv.total_invoiced, 0) - COALESCE(paid.total_paid, 0))::numeric(12,2) AS balance_owed,
  (c.credit_limit - (COALESCE(inv.total_invoiced, 0) - COALESCE(paid.total_paid, 0)))::numeric(12,2) AS available_credit,
  CASE WHEN oldest.oldest_unpaid_invoiced_at IS NOT NULL
       THEN EXTRACT(DAY FROM (now() - oldest.oldest_unpaid_invoiced_at))::int
       ELSE NULL END AS oldest_unpaid_invoice_age_days,
  COALESCE(overdue.count_overdue_invoices, 0)::int AS count_overdue_invoices,
  last_p.last_payment_date,
  last_p.last_payment_amount
FROM public.customers c
LEFT JOIN inv ON inv.customer_id = c.id
LEFT JOIN paid ON paid.customer_id = c.id
LEFT JOIN last_p ON last_p.customer_id = c.id
LEFT JOIN oldest ON oldest.customer_id = c.id
LEFT JOIN overdue ON overdue.customer_id = c.id;

GRANT SELECT ON public.customer_account_summary TO anon, authenticated;

-- =========================================
-- RLS
-- =========================================
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

-- Office/admin full access
CREATE POLICY payments_office_all ON public.payments
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY allocations_office_all ON public.payment_allocations
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- Customer self-read
CREATE POLICY payments_customer_select ON public.payments
  FOR SELECT TO authenticated
  USING (customer_id = public.current_customer_id());

CREATE POLICY allocations_customer_select ON public.payment_allocations
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payments p WHERE p.id = payment_allocations.payment_id AND p.customer_id = public.current_customer_id()));

-- Dev anon
CREATE POLICY dev_anon_payments_select ON public.payments FOR SELECT TO anon USING (true);
CREATE POLICY dev_anon_payments_insert ON public.payments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY dev_anon_payments_update ON public.payments FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY dev_anon_payments_delete ON public.payments FOR DELETE TO anon USING (true);

CREATE POLICY dev_anon_allocations_select ON public.payment_allocations FOR SELECT TO anon USING (true);
CREATE POLICY dev_anon_allocations_insert ON public.payment_allocations FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY dev_anon_allocations_update ON public.payment_allocations FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY dev_anon_allocations_delete ON public.payment_allocations FOR DELETE TO anon USING (true);
