-- Enable realtime broadcasts for the tables we'll subscribe to from the UI.
-- Wrapped in DO blocks so re-running is idempotent.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['orders','payments','payment_allocations','delivery_events','picking_events','activity_log','stock_movements','customers','products']
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN
      -- already in publication, ignore
      NULL;
    END;
    BEGIN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END LOOP;
END $$;