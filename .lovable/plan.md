# ABL Distribution — Customer Storefront (Phase 1)

Build the customer-facing storefront on Lovable Cloud + Supabase Auth. Schema supports the full order lifecycle but only the customer-facing slice ships now.

## Decisions locked in
- Cart **persists** per user (DB-backed `carts` + `cart_items` table).
- "Notify" on sold-out items = log row in `stock_notification_requests` (no email).
- Pricing: uniform `case_price` for everyone; `pricing_tier` column stored for later.
- Min 1 case per line, integer quantities, no order minimum.
- Customer can **cancel** (not edit) while `status = 'pending_approval'`. Locked after approval.
- No emails on order placement (yet).
- Product image fallback = styled empty state (SKU + category icon, navy/grey surface).

## Step 1 — Enable Lovable Cloud + design system
- Enable Lovable Cloud.
- Install Plus Jakarta Sans + JetBrains Mono via `@fontsource`.
- Replace `src/styles.css` tokens with ABL palette (navy `#0F2540`, accent `#FF6A1A`, ink, muted, success/warning/error pairs, etc.) in `oklch`.
- Set body font Plus Jakarta Sans; add `font-mono` for SKUs / order numbers.

## Step 2 — Database schema (migration)
Tables (all RLS enabled): `profiles`, `customers`, `products`, `orders`, `order_items`, `carts`, `cart_items`, `stock_notification_requests`.

Enums: `app_role` (`customer|office|warehouse|delivery|admin`), `pricing_tier`, `stock_status`, `order_status`.

Sequences for `SO-2001+` and `INV-4001+`. Triggers:
- `handle_new_user` → insert profile (role default `customer`).
- `set_order_number` BEFORE INSERT on `orders`.
- `set_invoice_number` BEFORE UPDATE when `status` becomes `invoiced`.
- `updated_at` triggers.

Security-definer helper `public.has_role(uuid, app_role)` + `public.current_customer_id()` to avoid recursive RLS.

RLS policies (each commented):
- `profiles`: self read/update; office/admin read all.
- `customers`: customer reads own row via `current_customer_id()`; office/admin all.
- `products`: any authenticated user reads `is_active`; only admin writes.
- `orders` + `order_items`: customer reads/inserts where `customer_id = current_customer_id()`; cancel allowed only when `status='pending_approval'`; office+ reads all.
- `carts` / `cart_items`: owner-only.
- `stock_notification_requests`: owner insert/read; office reads all.

## Step 3 — Seed data
- 12 products across categories (7 specified + 5 invented).
- 3 customers (Cosy Cafe, Champers Restaurant, Buzo Osteria) each with a `customer` auth user.
- 1 `office` user to verify role routing.
- Credentials printed in final summary.

## Step 4 — Auth + role routing
- Sign-in page (email + password, forgot password via Supabase, no public signup — show ABL contact message).
- `useAuth` hook: session + profile (with role).
- Root route gate: unauthenticated → `/login`; `customer` → storefront; any other role → `/coming-soon` placeholder.

## Step 5 — Storefront pages
Routes under `src/routes/`:
- `/login`, `/reset-password`
- `/` catalog (sticky delivery banner, header w/ ABL mark, search, cart, account menu; category chips; toolbar w/ count, in-stock toggle, sort; responsive product grid 2/3/4 cols).
- Cart drawer (right slide-over) — items, stepper, subtotal/VAT/total, "Place order".
- Place-order confirmation modal — read-only delivery address + delivery notes textarea.
- `/orders` list with status badges.
- `/orders/$orderNumber` detail with lifecycle progress tracker, items, totals, invoice section (placeholder PDF button when invoiced).
- `/account` — editable contact name, phone, password; read-only company/addresses/terms/credit.
- `/coming-soon` for non-customer roles.

Product card per spec: SKU tag, stock chip, pack-size chip, BBD$ price formatting `formatBBD()`, stepper + Add button, sold-out → "Notify" + dimmed image.

## Step 6 — Cart + order placement logic
- Cart hook reads/writes `carts`/`cart_items` via Supabase (RLS-scoped to user).
- Place order = RPC `place_order(delivery_notes)` (SECURITY DEFINER) that snapshots prices, computes VAT (17.5% inclusive split), inserts order + items, clears cart, returns `order_number`.
- Cancel order = update status to `cancelled` (RLS allows only when currently `pending_approval`).

## Step 7 — QA
- Sign in as Cosy Cafe customer → browse, add to cart, place order, view in `/orders`.
- Sign in as office user → see `/coming-soon`.
- Verify RLS: customer cannot read another customer's orders.

## Technical notes
- Currency helper: `BBD$ ${n.toFixed(2)}`.
- VAT-inclusive: `vat = total - total/1.175`, `subtotal = total - vat`.
- All Supabase calls from browser client respecting RLS; no admin client needed for this phase.
- Order number / invoice number generated server-side via triggers (never client-set).
- Sticky banner + header use navy `--primary`; CTAs use orange `--accent`.

## Out of scope (explicitly NOT built)
Office/warehouse/delivery views, payments, shipping calc, public catalog, PDF generation, emails, tier discount math.
