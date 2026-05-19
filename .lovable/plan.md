## Customers page for Office view

Build the full Customers management surface at `/office/customers` with table, detail drawer, and create/edit form. Reuse existing OfficeShell, design tokens, and drawer patterns from the pending approval queue.

### 1. Database migration

Extend `customers` table with the new columns:
- `customer_number` (text, unique) — auto-generated `CUST-XXXX` from a new sequence starting at 1001
- `trading_name`, `business_type`, `billing_city`, `billing_parish`, `billing_postal`
- `delivery_address_same_as_billing` (bool, default true), `delivery_city`, `delivery_parish`, `delivery_postal`, `delivery_notes`
- `opening_balance` (numeric, default 0), `tax_exempt` (bool), `tax_id`
- `sales_rep_name`, `customer_source`, `assigned_at`, `deleted_at`

Create:
- Sequence `customer_number_seq` starting at 1001
- Trigger `assign_customer_number` on INSERT
- Trigger `log_customer_changes` on INSERT/UPDATE → writes to `activity_log`
- Backfill `customer_number` for the 3 existing customers
- Update `dev_anon_customers_*` RLS to allow INSERT/UPDATE/soft-delete for development; keep authenticated office/admin policies for production

### 2. Routes

- `src/routes/office.customers.tsx` — replace ComingSoon with real component
- `src/routes/office.customers.new.tsx` — create form
- `src/routes/office.customers.$id.edit.tsx` — edit form

### 3. Components (under `src/components/abl/office/customers/`)

- `CustomersTable.tsx` — top bar, filter bar, sticky-header table, row actions menu, empty state
- `CustomerDetailDrawer.tsx` — right-side 720px Sheet with header strip + 3 tabs (Overview, Orders, Activity & Notes)
- `CustomerForm.tsx` — shared create/edit form with 5 sections + sticky right summary card + sticky footer
- `TierChip.tsx` — small reusable chip (Standard gray / Volume blue / Key Account orange)
- `GeneratedPasswordModal.tsx` — shows the generated password with copy button

### 4. Customer-view "Viewing as" switcher

- Extend `use-role.tsx` (or add `use-active-customer.tsx`) to store the active customer ID in localStorage
- Add a small dropdown in `AppHeader` (only visible when role === customer) listing all active customers — switches which customer the shop pages query against
- Update `useCart` and shop pages to read from this hook instead of the hardcoded "first customer"

### 5. Business logic

- Validation with zod: company name 2–100, valid email, 10-digit phone, credit_limit ≥ 0
- Phone auto-format to `+1 (246) XXX-XXXX`
- Deactivate guard: query orders with status not in (delivered, cancelled, paid) → block with modal
- Delete = soft delete (set `deleted_at`, `is_active=false`); block if any orders exist → offer deactivate instead
- "Create login" → insert profiles row (id = gen_random_uuid, role='customer') and link via `customers.contact_profile_id`; show generated password in modal (no email)

### 6. What this prompt does NOT do

- Bulk import / CSV
- Real email sending
- Real sales_reps table (free text for now)
- Aging reports / statement PDFs

### Technical notes

- All money via `formatBBD()` helper; dates via existing date formatter
- Reuse `OrderStatusBadge` in Orders tab and recent orders mini-table
- Soft-delete filter: all table queries exclude `deleted_at IS NOT NULL`
- Auto-save notes on textarea blur (single UPDATE)
- Activity log diff: serialize changed fields into description like `"Credit limit BBD$ 1,000 → BBD$ 2,500"`
