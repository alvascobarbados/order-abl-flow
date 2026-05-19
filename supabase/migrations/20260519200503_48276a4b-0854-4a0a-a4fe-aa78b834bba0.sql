
alter function public.set_updated_at() set search_path = public;
alter function public.assign_order_number() set search_path = public;
alter function public.assign_invoice_number() set search_path = public;

-- Lock down direct execute on security-definer helpers; RLS policies still use them internally
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.is_staff(uuid) from public, anon;
revoke execute on function public.current_customer_id() from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
