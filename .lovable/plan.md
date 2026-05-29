# Security Lockdown Plan

This is a large, destructive change set (dropping 22 open policies). I want to confirm a few decisions before executing, because if any step in Parts 2/3 fails, Part 4 makes the whole app unusable.

## Constraints I need to flag upfront

1. **I cannot run `git` commands.** The sandbox blocks stateful git (`add`, `rm --cached`, `commit`, etc.) — git state is managed by the Lovable harness. So:
   - I can **edit `.gitignore`** to add `.env`, `.env.local`, `.env.production`, `.env.development`.
   - I can **create `.env.example`** with empty values.
   - I **cannot** run `git rm --cached .env` myself. Once `.gitignore` is updated and committed by the harness, you'll need to run `git rm --cached .env` once locally (or I can give you the exact command). The file stays on disk; only the tracked copy is removed.

2. **Seeding `auth.users` from a SQL migration is fragile.** `supabase.auth.admin.createUser` is a JS/Node API — it can't be called from a `.sql` migration. Two real options:
   - **A. Direct SQL insert into `auth.users`** with `crypt(password, gen_salt('bf'))` for `encrypted_password`, plus matching `auth.identities` rows. Idempotent via `ON CONFLICT (email) DO NOTHING`. The existing `handle_new_user` trigger then populates `public.profiles`. This is what I'd do — it's standard for seed migrations and works end-to-end.
   - **B. A one-shot server function** that calls `auth.admin.createUser`. Cleaner API, but not a migration.
   I'll go with **A** unless you prefer B.

3. **Verification I can run vs. can't run:**
   - ✅ I can query `pg_policies` to confirm all `dev_anon_*` are gone.
   - ✅ I can curl the REST endpoint with the anon key (no incognito needed — same effect) and show the empty array.
   - ✅ I can query `profiles` to list seeded accounts.
   - ✅ I can take preview screenshots after signing in as Sarah / Neal / Buzo.
   - ❌ I cannot run `git ls-files`.

## Plan

### Part 1 — .env hygiene
- Edit `.gitignore`: add `.env`, `.env.local`, `.env.production`, `.env.development`.
- Create `.env.example` with the 5 variable names, no values.
- Tell you the one git command to run locally to untrack `.env`.

### Part 2 — Seed test accounts (migration `seed_test_accounts.sql`)
- Insert 7 users into `auth.users` with bcrypt'd passwords + matching `auth.identities` rows, all `email_confirmed_at = now()`, `user_metadata = {full_name, role}`.
- Trigger `handle_new_user` populates `public.profiles` with the right role.
- Link Buzo profile: `UPDATE customers SET contact_profile_id = <buzo_profile_id> WHERE company_name ILIKE 'Buzo%'`.
- Idempotent via `ON CONFLICT (email) DO NOTHING` on the auth insert.

### Part 3 — Rewire role picker to real auth
- `src/routes/index.tsx`: each role card calls `supabase.auth.signInWithPassword({email, password})` with the mapped seeded credentials, then navigates to the role's home.
- `src/hooks/use-role.tsx`: remove localStorage role storage. `role` is derived from `useAuth().profile.role`. Keep a thin `Role` type + `ROLE_META`.
- `SwitchRoleButton`: `signOut()` then navigate to `/`.
- `PickerProvider`, `DriverProvider`: derive `name` from `profile.full_name`; drop localStorage seed (keep `demoScan` toggle since it's a real UI preference, not identity).
- `ActiveCustomerProvider`: for `customer` role, the active customer comes from `customers.contact_profile_id = auth.uid()`. For staff, keep the manual switcher.
- Add `beforeLoad` guards to `/office`, `/warehouse`, `/delivery`, `/shop` route layouts that redirect to `/` if the session role doesn't match. (Currently auth is bypassed app-wide.)

### Part 4 — Drop `dev_anon_*` policies
- Single migration with all 22 `DROP POLICY IF EXISTS` statements (exactly as you specified).

### Part 5 — Real policy audit
Most real policies already exist (I read the schema). Gaps I can see right now:
- `profiles`: no INSERT policy for self (handled by trigger, OK). The self-update WITH CHECK already prevents role change. Need explicit admin policy for role changes. ✅ will add.
- `system_settings`: current `settings_staff_write` is `is_staff()` not admin-only. You asked for admin-only on UPDATE. ✅ will tighten.
- `delivery_events`: has driver-self insert/select but no staff INSERT. ✅ will add `is_staff()` insert.
- `picking_events`, `activity_log`, `stock_movements`, `payments`, `payment_allocations`, `driver_shifts`, `cart`, `carts`, `cart_items`, `categories`, `customers`, `orders`, `order_items`, `products` — already have real policies covering the required matrix. Will spot-check each after Part 4.

Note: there are **two** cart tables (`cart` and `carts`/`cart_items`). I'll leave both intact and only drop the dev_anon ones; consolidation is out of scope.

### Part 6 — Storage buckets
- `product-images`: keep public read (catalog browsing pre-auth is fine; if you want auth-only later, easy switch).
- `invoices`: tighten to authenticated-read only via storage RLS policy. Signed-URL migration flagged as follow-up, not done now.
- `delivery-signatures`: already private — confirm staff+driver-self read policy exists; add if missing.

### Verification I'll run and paste back
1. `.gitignore` diff + `.env.example` contents.
2. `SELECT email, role FROM auth.users JOIN profiles ON ... WHERE email LIKE '%@abl.test' OR email LIKE '%test.customer'` — show all 7.
3. `SELECT policyname FROM pg_policies WHERE policyname LIKE 'dev_anon_%'` — should be empty.
4. `curl https://xufhyckqyersrgtkueuq.supabase.co/rest/v1/customers?select=* -H 'apikey: <anon>'` — show `[]`.
5. Browser screenshots after signing in as Sarah (office dashboard), Neal (delivery), Buzo (shop with only own orders).

## Questions before I execute

1. **OK with SQL-direct `auth.users` seed** (option A above) vs. a server-fn approach (B)?
2. **OK that I can't run `git rm --cached .env` myself** — you'll do it after the .gitignore commit lands?
3. **Role-picker UX after rewire**: currently it's instant. Real sign-in adds ~300ms and shows a spinner per card click. OK?
4. **Customer sign-in mapping**: you specified one customer (Buzo). If a tester wants to test as a different customer, the only path will be the existing `ViewingAsSwitcher` (staff impersonation) — confirm that's fine, or do you want more seeded customer accounts?

Once you confirm (or just say "go"), I'll execute all six parts in order with the migrations queued for your approval.