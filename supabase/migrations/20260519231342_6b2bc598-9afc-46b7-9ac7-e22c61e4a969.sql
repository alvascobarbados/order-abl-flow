-- 1. New column on orders for the QR payload
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS invoice_qr_code_data text;

-- 2. Extend system_settings with company + bank + VAT fields
ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS company_name    text NOT NULL DEFAULT 'ABL Distribution',
  ADD COLUMN IF NOT EXISTS company_address text NOT NULL DEFAULT 'Bridgetown, Barbados',
  ADD COLUMN IF NOT EXISTS company_phone   text NOT NULL DEFAULT '+1 (246) XXX-XXXX',
  ADD COLUMN IF NOT EXISTS company_email   text NOT NULL DEFAULT 'orders@alvascodistribution.com',
  ADD COLUMN IF NOT EXISTS bank_name       text,
  ADD COLUMN IF NOT EXISTS bank_account    text,
  ADD COLUMN IF NOT EXISTS bank_branch     text,
  ADD COLUMN IF NOT EXISTS vat_rate        numeric NOT NULL DEFAULT 17.5;

-- Ensure singleton row exists (created by earlier migration, safe re-insert)
INSERT INTO public.system_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 3. Update auto-invoice trigger to also stamp invoice_qr_code_data
CREATE OR REPLACE FUNCTION public.auto_invoice_on_pack()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _enabled boolean;
  _terms int;
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
      NEW.invoice_qr_code_data := COALESCE(NEW.invoice_qr_code_data, NEW.invoice_number);
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- 4. One-time backfill: assign invoice numbers to packed orders missing them
DO $$
DECLARE r RECORD; _terms int; _inv text;
BEGIN
  FOR r IN
    SELECT id, customer_id, invoiced_at, packed_at, order_number
    FROM public.orders
    WHERE status = 'packed' AND invoice_number IS NULL
  LOOP
    SELECT payment_terms_days INTO _terms FROM public.customers WHERE id = r.customer_id;
    _inv := 'INV-' || nextval('public.invoice_number_seq')::text;
    UPDATE public.orders SET
      invoice_number = _inv,
      invoiced_at    = COALESCE(r.invoiced_at, r.packed_at, now()),
      due_date       = (COALESCE(r.invoiced_at, r.packed_at, now())::date) + COALESCE(_terms, 30),
      invoice_qr_code_data = _inv
    WHERE id = r.id;
    INSERT INTO public.activity_log (event_type, description, related_order_id, related_customer_id)
    VALUES ('order_auto_invoiced',
      'Order ' || COALESCE(r.order_number, '?') || ' backfill-invoiced as ' || _inv,
      r.id, r.customer_id);
  END LOOP;
END $$;

-- 5. Backfill QR data on any already-invoiced order missing it
UPDATE public.orders
SET invoice_qr_code_data = invoice_number
WHERE invoice_number IS NOT NULL AND invoice_qr_code_data IS NULL;