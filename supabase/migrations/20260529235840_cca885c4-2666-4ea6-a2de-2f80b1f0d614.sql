-- Driver-scoped policies on driver_shifts: a driver can create/update only their own shift rows.
CREATE POLICY driver_shifts_driver_insert ON public.driver_shifts
FOR INSERT TO authenticated
WITH CHECK (driver_profile_id = auth.uid() AND has_role(auth.uid(), 'delivery'::app_role));

CREATE POLICY driver_shifts_driver_update ON public.driver_shifts
FOR UPDATE TO authenticated
USING (driver_profile_id = auth.uid() AND has_role(auth.uid(), 'delivery'::app_role))
WITH CHECK (driver_profile_id = auth.uid() AND has_role(auth.uid(), 'delivery'::app_role));