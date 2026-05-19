
-- Enums
create type public.app_role as enum ('customer','office','warehouse','delivery','admin');
create type public.pricing_tier as enum ('standard','volume','key_account');
create type public.stock_status as enum ('in_stock','low_stock','out_of_stock');
create type public.order_status as enum ('draft','pending_approval','approved','picking','packed','out_for_delivery','delivered','invoiced','paid','cancelled');

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  role public.app_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

-- Role helper (security definer, avoids recursive RLS)
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = _user_id and role = _role)
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = _user_id and role <> 'customer')
$$;

-- customers
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_profile_id uuid references public.profiles(id) on delete set null,
  billing_address text,
  delivery_address text,
  phone text,
  credit_limit numeric(12,2) not null default 0,
  current_balance numeric(12,2) not null default 0,
  pricing_tier public.pricing_tier not null default 'standard',
  payment_terms_days integer not null default 30,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.customers enable row level security;
create index on public.customers(contact_profile_id);
create trigger customers_updated before update on public.customers for each row execute function public.set_updated_at();

-- Resolve current user's customer id (used by RLS without recursion)
create or replace function public.current_customer_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.customers where contact_profile_id = auth.uid() limit 1
$$;

-- products
create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  description text,
  category text not null,
  pack_size integer not null,
  pack_unit text not null default 'case',
  case_price numeric(10,2) not null,
  unit_price numeric(10,4) not null,
  image_url text,
  stock_status public.stock_status not null default 'in_stock',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.products enable row level security;
create trigger products_updated before update on public.products for each row execute function public.set_updated_at();

-- Sequences for order/invoice numbering
create sequence public.order_number_seq start 2001;
create sequence public.invoice_number_seq start 4001;

-- orders
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  placed_by_profile_id uuid references public.profiles(id) on delete set null,
  status public.order_status not null default 'pending_approval',
  subtotal numeric(12,2) not null default 0,
  vat_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  placed_at timestamptz not null default now(),
  approved_at timestamptz,
  picked_at timestamptz,
  delivered_at timestamptz,
  invoiced_at timestamptz,
  invoice_number text unique,
  delivery_notes text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.orders enable row level security;
create index on public.orders(customer_id);
create index on public.orders(status);
create trigger orders_updated before update on public.orders for each row execute function public.set_updated_at();

create or replace function public.assign_order_number()
returns trigger language plpgsql as $$
begin
  if new.order_number is null then
    new.order_number := 'SO-' || nextval('public.order_number_seq')::text;
  end if;
  return new;
end $$;
create trigger orders_assign_number before insert on public.orders for each row execute function public.assign_order_number();

create or replace function public.assign_invoice_number()
returns trigger language plpgsql as $$
begin
  if new.status = 'invoiced' and (old.status is distinct from 'invoiced') and new.invoice_number is null then
    new.invoice_number := 'INV-' || nextval('public.invoice_number_seq')::text;
    new.invoiced_at := coalesce(new.invoiced_at, now());
  end if;
  return new;
end $$;
create trigger orders_assign_invoice before update on public.orders for each row execute function public.assign_invoice_number();

-- order_items
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price_at_order numeric(10,2) not null,
  line_total numeric(12,2) not null,
  created_at timestamptz not null default now()
);
alter table public.order_items enable row level security;
create index on public.order_items(order_id);

-- carts (one per user)
create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.carts enable row level security;
create trigger carts_updated before update on public.carts for each row execute function public.set_updated_at();

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(cart_id, product_id)
);
alter table public.cart_items enable row level security;
create trigger cart_items_updated before update on public.cart_items for each row execute function public.set_updated_at();

-- stock notifications
create table public.stock_notification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz
);
alter table public.stock_notification_requests enable row level security;

-- Handle new auth user: insert profile row
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'customer')
  ) on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ===== RLS POLICIES =====

-- profiles: self read/update; staff read all; role cannot be changed by self
create policy "profiles_self_select" on public.profiles for select to authenticated
  using (id = auth.uid()); -- users see their own profile
create policy "profiles_staff_select" on public.profiles for select to authenticated
  using (public.is_staff(auth.uid())); -- office/admin/etc read all profiles
create policy "profiles_self_update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));
  -- users update their own row but cannot change their role

-- customers: customer reads own record; staff reads all
create policy "customers_self_select" on public.customers for select to authenticated
  using (contact_profile_id = auth.uid()); -- customer sees their own customer record
create policy "customers_staff_select" on public.customers for select to authenticated
  using (public.is_staff(auth.uid())); -- staff sees all
create policy "customers_admin_write" on public.customers for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
  -- only admins create/update customer records

-- products: any authenticated user reads active products; admin writes
create policy "products_read_active" on public.products for select to authenticated
  using (is_active = true or public.is_staff(auth.uid())); -- customers see active only; staff see all
create policy "products_admin_write" on public.products for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- orders
create policy "orders_customer_select" on public.orders for select to authenticated
  using (customer_id = public.current_customer_id()); -- customer sees only their own orders
create policy "orders_staff_select" on public.orders for select to authenticated
  using (public.is_staff(auth.uid())); -- staff sees all orders
create policy "orders_customer_insert" on public.orders for insert to authenticated
  with check (
    customer_id = public.current_customer_id()
    and placed_by_profile_id = auth.uid()
    and status = 'pending_approval'
  ); -- customer can only place orders for their own customer record
create policy "orders_customer_cancel" on public.orders for update to authenticated
  using (customer_id = public.current_customer_id() and status = 'pending_approval')
  with check (customer_id = public.current_customer_id() and status in ('pending_approval','cancelled'));
  -- customer can update their order only while pending_approval; allowed change is to cancel

-- order_items: mirror parent order access
create policy "order_items_customer_select" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = public.current_customer_id()));
create policy "order_items_staff_select" on public.order_items for select to authenticated
  using (public.is_staff(auth.uid()));
create policy "order_items_customer_insert" on public.order_items for insert to authenticated
  with check (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = public.current_customer_id() and o.status = 'pending_approval'));

-- carts: owner only
create policy "carts_owner_all" on public.carts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "cart_items_owner_all" on public.cart_items for all to authenticated
  using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()));

-- stock notifications: owner insert/read, staff read all
create policy "stock_notify_owner" on public.stock_notification_requests for all to authenticated
  using (user_id = auth.uid() or public.is_staff(auth.uid()))
  with check (user_id = auth.uid());
