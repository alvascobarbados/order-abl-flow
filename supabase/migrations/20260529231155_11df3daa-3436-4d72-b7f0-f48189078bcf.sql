
DO $$
DECLARE fn text;
BEGIN
  FOR fn IN SELECT unnest(ARRAY[
    'public.log_order_insert()',
    'public.log_order_status_change()',
    'public.log_order_cancel_or_restore()',
    'public.log_customer_insert()',
    'public.log_customer_update()',
    'public.log_product_stock_change()',
    'public.log_auto_invoice_on_pack()',
    'public.on_payment_insert()',
    'public.on_payment_status_change_after()',
    'public.on_order_delivered_decrement_stock()',
    'public.on_order_packed_decrement_stock()',
    'public.recompute_order_paid_status(uuid)',
    'public.apply_stock_movement(uuid, public.stock_movement_type, integer, text, text, uuid)'
  ]) LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
END $$;
