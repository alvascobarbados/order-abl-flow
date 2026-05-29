
-- Customer-reachable order paths fire these logging triggers; they must run with
-- elevated rights so the audit log insert isn't blocked by the customer's RLS.
ALTER FUNCTION public.log_order_insert() SECURITY DEFINER;
ALTER FUNCTION public.log_order_status_change() SECURITY DEFINER;
ALTER FUNCTION public.log_order_cancel_or_restore() SECURITY DEFINER;

-- Same principle for other audit triggers staff/system actions fire — keep them
-- consistent so an invoker without activity_log insert never breaks a write.
ALTER FUNCTION public.log_customer_insert() SECURITY DEFINER;
ALTER FUNCTION public.log_customer_update() SECURITY DEFINER;
ALTER FUNCTION public.log_product_stock_change() SECURITY DEFINER;
ALTER FUNCTION public.log_auto_invoice_on_pack() SECURITY DEFINER;
ALTER FUNCTION public.on_payment_insert() SECURITY DEFINER;
ALTER FUNCTION public.on_payment_status_change_after() SECURITY DEFINER;
ALTER FUNCTION public.apply_stock_movement(uuid, public.stock_movement_type, integer, text, text, uuid) SECURITY DEFINER;
ALTER FUNCTION public.recompute_order_paid_status(uuid) SECURITY DEFINER;
ALTER FUNCTION public.on_order_delivered_decrement_stock() SECURITY DEFINER;
ALTER FUNCTION public.on_order_packed_decrement_stock() SECURITY DEFINER;

-- Drop duplicate triggers (each was registered twice under different names).
DROP TRIGGER IF EXISTS orders_log_insert ON public.orders;
DROP TRIGGER IF EXISTS orders_log_status_change ON public.orders;
DROP TRIGGER IF EXISTS orders_assign_invoice ON public.orders;
DROP TRIGGER IF EXISTS orders_assign_number ON public.orders;
DROP TRIGGER IF EXISTS orders_updated ON public.orders;
DROP TRIGGER IF EXISTS orders_deliver_decrement_stock ON public.orders;
