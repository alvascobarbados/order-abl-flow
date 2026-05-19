
create extension if not exists pgcrypto;

create or replace function pg_temp.mkuser(p_email text, p_password text, p_full_name text, p_role public.app_role)
returns uuid language plpgsql as $$
declare uid uuid;
begin
  select id into uid from auth.users where email = p_email;
  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      p_email, crypt(p_password, gen_salt('bf')), now(),
      jsonb_build_object('provider','email','providers',array['email']),
      jsonb_build_object('full_name', p_full_name, 'role', p_role::text),
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid, jsonb_build_object('sub', uid::text, 'email', p_email), 'email', uid::text, now(), now(), now());
  end if;
  insert into public.profiles(id, email, full_name, role)
  values (uid, p_email, p_full_name, p_role)
  on conflict (id) do update set full_name = excluded.full_name, role = excluded.role, email = excluded.email;
  return uid;
end $$;

do $$
declare cosy uuid; champers uuid; buzo uuid; office uuid;
begin
  cosy     := pg_temp.mkuser('orders@cosycafe.bb',       'Cosy123!',     'Maya Holder',     'customer');
  champers := pg_temp.mkuser('orders@champersrest.bb',   'Champers123!', 'Daniel Bynoe',    'customer');
  buzo     := pg_temp.mkuser('orders@buzoosteria.bb',    'Buzo123!',     'Lucia Marshall',  'customer');
  office   := pg_temp.mkuser('staff@alvascodistribution.com','Office123!','Office Staff',    'office');

  insert into public.customers(company_name, contact_profile_id, billing_address, delivery_address, phone, credit_limit, current_balance, pricing_tier, payment_terms_days, notes)
  select * from (values
    ('Cosy Cafe', cosy, '12 Hastings Main Rd, Christ Church, Barbados','12 Hastings Main Rd, Christ Church, Barbados','+1-246-555-0142', 5000::numeric, 1240.50::numeric, 'standard'::public.pricing_tier, 30, 'Pays reliably.'),
    ('Champers Restaurant', champers, 'Skeetes Hill, Christ Church, Barbados','Skeetes Hill, Christ Church, Barbados','+1-246-555-0177', 12000::numeric, 3402.10::numeric, 'volume'::public.pricing_tier, 30, 'High volume seafood spot.'),
    ('Buzo Osteria', buzo, 'Holetown, St James, Barbados','Holetown, St James, Barbados','+1-246-555-0190', 8000::numeric, 0::numeric, 'standard'::public.pricing_tier, 30, null)
  ) v
  where not exists (select 1 from public.customers c where c.contact_profile_id = v.column2);
end $$;

insert into public.products (sku, name, description, category, pack_size, pack_unit, case_price, unit_price, stock_status) values
('ECW-PP-3OZ','3oz Hinged Lid PP Container','Sauce/portion container with attached lid.','Containers',1000,'case',100.00,0.1000,'in_stock'),
('ECW-PP-2OZ','2oz Hinged Lid PP Container','Smaller portion cup with lid.','Containers',1000,'case',82.00,0.0820,'in_stock'),
('WBS-147SB24','24oz Clear Salad Bowl w/ Lid','Crystal-clear PET bowl with dome lid.','Bowls',150,'case',199.75,1.3317,'in_stock'),
('ECW-BGSHB','Bagasse 6"x6" Hamburger Clamshell','Compostable sugarcane fibre clamshell.','Clamshells',500,'case',100.00,0.2000,'out_of_stock'),
('ECW-BGSHD','Bagasse 9"x6" Hot Dog Clamshell','Compostable hot dog box.','Clamshells',250,'case',70.00,0.2800,'out_of_stock'),
('ECW-OVLBGS','Bagasse Burrito Bowl 32oz','Oval bagasse bowl, microwave safe.','Bowls',500,'case',317.25,0.6345,'low_stock'),
('ECW-OVLLID','Bagasse Bowl + Dome Lid Combo','Pre-paired bowls and lids.','Bowls',500,'case',240.88,0.4818,'in_stock'),
('CUT-FRK-HVY','Heavy-Duty Plastic Forks (White)','Sturdy forks for takeout.','Cutlery',1000,'case',95.50,0.0955,'in_stock'),
('CUP-PCD-12','12oz Double-Wall Paper Cup','Hot cup, no sleeve needed.','Cups & Lids',500,'case',186.00,0.3720,'in_stock'),
('CUP-LID-12','Sip Lid for 12/16oz Hot Cups','Universal black sip lid.','Cups & Lids',1000,'case',128.00,0.1280,'low_stock'),
('BAG-KFT-MD','Kraft Paper Takeout Bag (Medium)','Twisted handle kraft bag.','Bags',250,'case',142.00,0.5680,'in_stock'),
('NAP-DIN-2P','Dinner Napkin 2-Ply White','15"x17" 2-ply dinner napkin.','Napkins',2400,'case',168.00,0.0700,'in_stock'),
('CLN-DSH-5L','Lemon Dishwashing Liquid 5L','Concentrated kitchen detergent.','Cleaning',4,'case',98.00,24.5000,'in_stock')
on conflict (sku) do nothing;
