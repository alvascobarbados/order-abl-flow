
CREATE POLICY orders_staff_update ON public.orders
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'office'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'office'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role));
