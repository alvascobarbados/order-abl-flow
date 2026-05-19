
-- Sequence for customer numbers
CREATE SEQUENCE IF NOT EXISTS public.customer_number_seq START WITH 1001;

-- Add new columns
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS customer_number text UNIQUE,
  ADD COLUMN IF NOT EXISTS trading_name text,
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS billing_city text,
  ADD COLUMN IF NOT EXISTS billing_parish text,
  ADD COLUMN IF NOT EXISTS billing_postal text,
  ADD COLUMN IF NOT EXISTS delivery_address_same_as_billing boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS delivery_city text,
  ADD COLUMN IF NOT EXISTS delivery_parish text,
  ADD COLUMN IF NOT EXISTS delivery_postal text,
  ADD COLUMN IF NOT EXISTS delivery_notes text,
  ADD COLUMN IF NOT EXISTS opening_balance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_exempt boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_id text,
  ADD COLUMN IF NOT EXISTS sales_rep_name text,
  ADD COLUMN IF NOT EXISTS customer_source text,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Auto-assign customer_number on insert
CREATE OR REPLACE FUNCTION public.assign_customer_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.customer_number IS NULL THEN
    NEW.customer_number := 'CUST-' || nextval('public.customer_number_seq')::text;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_assign_customer_number ON public.customers;
CREATE TRIGGER trg_assign_customer_number
  BEFORE INSERT ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.assign_customer_number();

-- Backfill existing customers
UPDATE public.customers
SET customer_number = 'CUST-' || nextval('public.customer_number_seq')::text
WHERE customer_number IS NULL;

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_customers_updated_at ON public.customers;
CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Activity log triggers
CREATE OR REPLACE FUNCTION public.log_customer_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.activity_log (event_type, description, related_customer_id)
  VALUES (
    'customer_created',
    'Customer ' || COALESCE(NEW.customer_number, '?') || ' · ' || NEW.company_name || ' created',
    NEW.id
  );
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.log_customer_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  changes text[] := ARRAY[]::text[];
BEGIN
  IF NEW.company_name IS DISTINCT FROM OLD.company_name THEN
    changes := array_append(changes, 'company name → ' || NEW.company_name);
  END IF;
  IF NEW.credit_limit IS DISTINCT FROM OLD.credit_limit THEN
    changes := array_append(changes, 'credit limit ' || OLD.credit_limit::text || ' → ' || NEW.credit_limit::text);
  END IF;
  IF NEW.pricing_tier IS DISTINCT FROM OLD.pricing_tier THEN
    changes := array_append(changes, 'tier ' || OLD.pricing_tier::text || ' → ' || NEW.pricing_tier::text);
  END IF;
  IF NEW.payment_terms_days IS DISTINCT FROM OLD.payment_terms_days THEN
    changes := array_append(changes, 'payment terms ' || OLD.payment_terms_days::text || ' → ' || NEW.payment_terms_days::text || ' days');
  END IF;
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    changes := array_append(changes, CASE WHEN NEW.is_active THEN 'reactivated' ELSE 'deactivated' END);
  END IF;
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND NEW.deleted_at IS NOT NULL THEN
    changes := array_append(changes, 'archived');
  END IF;

  IF array_length(changes, 1) > 0 THEN
    INSERT INTO public.activity_log (event_type, description, related_customer_id)
    VALUES (
      'customer_updated',
      'Customer ' || COALESCE(NEW.customer_number, '?') || ' · ' || array_to_string(changes, '; '),
      NEW.id
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_customer_insert ON public.customers;
CREATE TRIGGER trg_log_customer_insert
  AFTER INSERT ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.log_customer_insert();

DROP TRIGGER IF EXISTS trg_log_customer_update ON public.customers;
CREATE TRIGGER trg_log_customer_update
  AFTER UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.log_customer_update();

-- Dev anon RLS for full CRUD on customers
DROP POLICY IF EXISTS dev_anon_customers_insert ON public.customers;
CREATE POLICY dev_anon_customers_insert ON public.customers FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS dev_anon_customers_update ON public.customers;
CREATE POLICY dev_anon_customers_update ON public.customers FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Office/admin/sales_rep writes for production
DROP POLICY IF EXISTS customers_staff_write ON public.customers;
CREATE POLICY customers_staff_write ON public.customers FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- Allow anon to insert profiles (for dev "create login" flow)
DROP POLICY IF EXISTS dev_anon_profiles_insert ON public.profiles;
CREATE POLICY dev_anon_profiles_insert ON public.profiles FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS dev_anon_profiles_select ON public.profiles;
CREATE POLICY dev_anon_profiles_select ON public.profiles FOR SELECT TO anon USING (true);
