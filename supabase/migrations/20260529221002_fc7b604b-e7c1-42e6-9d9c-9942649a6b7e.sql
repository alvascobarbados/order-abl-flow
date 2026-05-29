
CREATE OR REPLACE VIEW public.customer_delivery_info
WITH (security_invoker = on) AS
SELECT
  id,
  company_name,
  delivery_address,
  delivery_city,
  delivery_parish,
  delivery_notes,
  phone
FROM public.customers;

GRANT SELECT ON public.customer_delivery_info TO authenticated;
