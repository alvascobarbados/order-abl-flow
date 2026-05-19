-- 1. system_settings (single row)
CREATE TABLE IF NOT EXISTS public.system_settings (
  id smallint PRIMARY KEY DEFAULT 1,
  auto_invoice_on_packed boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT system_settings_singleton CHECK (id = 1)
);
INSERT INTO public.system_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS settings_read_all ON public.system_settings;
CREATE POLICY settings_read_all ON public.system_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS settings_staff_write ON public.system_settings;
CREATE POLICY settings_staff_write ON public.system_settings FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS dev_anon_settings_all ON public.system_settings;
CREATE POLICY dev_anon_settings_all ON public.system_settings FOR ALL TO anon USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_system_settings_updated_at ON public.system_settings;
CREATE TRIGGER trg_system_settings_updated_at BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. invoice PDF columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS invoice_pdf_url text,
  ADD COLUMN IF NOT EXISTS invoice_pdf_generated_at timestamptz;

-- 3. auto-invoice when packed
CREATE OR REPLACE FUNCTION public.auto_invoice_on_pack()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  _enabled boolean;
  _terms int;
  _c_name text;
BEGIN
  IF NEW.status = 'packed' AND OLD.status IS DISTINCT FROM 'packed' THEN
    SELECT auto_invoice_on_packed INTO _enabled FROM public.system_settings WHERE id = 1;
    IF COALESCE(_enabled, true) AND NEW.invoice_number IS NULL THEN
      NEW.invoice_number := 'INV-' || nextval('public.invoice_number_seq')::text;
      NEW.invoiced_at := COALESCE(NEW.invoiced_at, now());
      IF NEW.due_date IS NULL THEN
        SELECT payment_terms_days INTO _terms FROM public.customers WHERE id = NEW.customer_id;
        NEW.due_date := (COALESCE(NEW.invoiced_at, now())::date) + COALESCE(_terms, 30);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_auto_invoice_on_pack ON public.orders;
CREATE TRIGGER trg_auto_invoice_on_pack
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.auto_invoice_on_pack();

-- 4. activity log entry when auto-invoiced (after trigger)
CREATE OR REPLACE FUNCTION public.log_auto_invoice_on_pack()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE c_name text;
BEGIN
  IF NEW.status = 'packed'
     AND OLD.status IS DISTINCT FROM 'packed'
     AND NEW.invoice_number IS NOT NULL
     AND OLD.invoice_number IS NULL THEN
    SELECT company_name INTO c_name FROM public.customers WHERE id = NEW.customer_id;
    INSERT INTO public.activity_log (event_type, description, related_order_id, related_customer_id)
    VALUES ('order_auto_invoiced',
      'Order ' || COALESCE(NEW.order_number, '?') || ' auto-invoiced as ' || NEW.invoice_number ||
      ' upon packing · ' || COALESCE(c_name, 'customer'),
      NEW.id, NEW.customer_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_auto_invoice_on_pack ON public.orders;
CREATE TRIGGER trg_log_auto_invoice_on_pack
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_auto_invoice_on_pack();

-- 5. invoices storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS invoices_public_read ON storage.objects;
CREATE POLICY invoices_public_read ON storage.objects
  FOR SELECT USING (bucket_id = 'invoices');

DROP POLICY IF EXISTS invoices_staff_insert ON storage.objects;
CREATE POLICY invoices_staff_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'invoices' AND (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'warehouse'::app_role)));

DROP POLICY IF EXISTS invoices_staff_update ON storage.objects;
CREATE POLICY invoices_staff_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'invoices' AND public.is_staff(auth.uid()))
  WITH CHECK (bucket_id = 'invoices' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS dev_anon_invoices_insert ON storage.objects;
CREATE POLICY dev_anon_invoices_insert ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'invoices');

DROP POLICY IF EXISTS dev_anon_invoices_update ON storage.objects;
CREATE POLICY dev_anon_invoices_update ON storage.objects
  FOR UPDATE TO anon USING (bucket_id = 'invoices') WITH CHECK (bucket_id = 'invoices');
