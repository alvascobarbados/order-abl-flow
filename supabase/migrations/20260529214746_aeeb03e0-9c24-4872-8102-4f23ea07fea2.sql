-- Seed test auth accounts for staff + one customer.
-- Idempotent via ON CONFLICT. Passwords are bcrypt-hashed via pgcrypto.
-- handle_new_user trigger auto-populates public.profiles from user_metadata.

DO $$
DECLARE
  v_users jsonb := jsonb_build_array(
    jsonb_build_object('email','sarah@abl.test','pw','DevPass2026!Sarah','name','Sarah Clarke','role','office'),
    jsonb_build_object('email','andre@abl.test','pw','DevPass2026!Andre','name','Andre Williams','role','warehouse'),
    jsonb_build_object('email','neal@abl.test','pw','DevPass2026!Neal','name','Neal Phillips','role','delivery'),
    jsonb_build_object('email','damon@abl.test','pw','DevPass2026!Damon','name','Damon Greaves','role','delivery'),
    jsonb_build_object('email','marlon@abl.test','pw','DevPass2026!Marlon','name','Marlon Best','role','office'),
    jsonb_build_object('email','admin@abl.test','pw','DevPass2026!Admin','name','ABL Admin','role','admin'),
    jsonb_build_object('email','buzo@test.customer','pw','DevPass2026!Buzo','name','Buzo Osteria Owner','role','customer')
  );
  v_rec jsonb;
  v_uid uuid;
BEGIN
  FOR v_rec IN SELECT * FROM jsonb_array_elements(v_users) LOOP
    -- Skip if user already exists
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = (v_rec->>'email')) THEN
      CONTINUE;
    END IF;

    v_uid := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_uid,
      'authenticated',
      'authenticated',
      v_rec->>'email',
      crypt(v_rec->>'pw', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v_rec->>'name', 'role', v_rec->>'role'),
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', v_rec->>'email', 'email_verified', true),
      'email',
      v_rec->>'email',
      now(), now(), now()
    );
  END LOOP;
END $$;

-- Link Buzo customer profile to the seeded buzo auth user
UPDATE public.customers
SET contact_profile_id = (SELECT id FROM auth.users WHERE email = 'buzo@test.customer')
WHERE id = '7347fdb0-17dd-4493-be90-065dd7065340'
  AND contact_profile_id IS DISTINCT FROM (SELECT id FROM auth.users WHERE email = 'buzo@test.customer');

-- Safety net: ensure profiles got created with the right role
-- (handle_new_user trigger normally does this, but guarantee idempotently)
INSERT INTO public.profiles (id, email, full_name, role)
SELECT
  u.id,
  u.email,
  u.raw_user_meta_data->>'full_name',
  (u.raw_user_meta_data->>'role')::public.app_role
FROM auth.users u
WHERE u.email IN (
  'sarah@abl.test','andre@abl.test','neal@abl.test','damon@abl.test',
  'marlon@abl.test','admin@abl.test','buzo@test.customer'
)
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
  email = EXCLUDED.email;