## Products & Inventory — implementation plan

A large but well-scoped build. Splitting into a database migration, a storage bucket, and a layered frontend so each piece can be reviewed independently.

### 1. Database migration (one call, then approval)

**Extend `products`** with: `description`, `on_hand`, `reorder_point`, `reorder_quantity`, `lead_time_days`, `track_inventory`, `stock_status_override` (enum auto/in_stock/low_stock/out_of_stock), `bin_location`, `cost_price`, `vat_inclusive`, `barcode`, `supplier_sku`, `supplier_name`, `primary_image_url`, `secondary_image_urls` (text[]), `archived_at`, `archived_by_profile_id`, `sort_order`.

**New `stock_movements`** table: `id`, `product_id`, `movement_type` (enum: received, sold, damaged, count_correction, customer_return, internal_use, other), `quantity` (int, signed), `reason`, `reference`, `recorded_by_profile_id`, `balance_after`, `created_at`. RLS: office/admin/warehouse read & insert.

**New `categories`** table: `id`, `name` (unique), `icon`, `sort_order`. Seeded from current product categories.

**Triggers / functions:**
- `resolve_stock_status(on_hand, reorder_point, override)` — returns the effective status
- After insert on `stock_movements` → update `products.on_hand` and recompute `stock_status`
- After `orders.status` → `delivered`: insert sold movements per line item (negative qty)
- After `orders.status` `delivered/picking → cancelled`: reverse those movements
- Activity log entry for each movement

**View `products_with_stock_info`**: products + computed `avg_weekly_velocity` (sold qty last 4 weeks ÷ 4) and `days_of_stock`.

**Storage bucket** `product-images` (public read, authenticated write).

### 2. Frontend structure

```
src/routes/office.products.tsx          (tabbed shell)
src/routes/office.products.new.tsx      (create form)
src/routes/office.products.$id.edit.tsx (edit form)

src/components/abl/office/products/
  ProductsCatalogTab.tsx     (filter bar + table/grid toggle)
  ProductsStockTab.tsx       (stock-focused table)
  ProductsCategoriesTab.tsx  (manage categories)
  ProductsLowStockTab.tsx    (two-column alerts)
  ProductsArchivedTab.tsx    (archived list)
  ProductDetailDrawer.tsx    (5 inner tabs)
  ProductForm.tsx            (shared create/edit)
  AdjustStockModal.tsx
  CategoryModal.tsx
  ProductImageManager.tsx
```

Helpers: `src/lib/products.ts` (queries, mutations, image upload), `src/lib/stock.ts` (movement helpers, status resolver).

### 3. Build order

1. Migration → wait for approval
2. Storage bucket + RLS
3. Catalog tab + filter bar + table view (the centerpiece)
4. Product detail drawer (5 tabs)
5. Create/edit form with live preview
6. Adjust stock modal + stock movements wiring
7. Stock levels tab
8. Categories tab (with drag reorder)
9. Low stock alerts tab
10. Archived tab
11. Grid view toggle (reuses storefront ProductCard)
12. Wire storefront catalog/category chips to new `categories` table + `primary_image_url`

### 4. Out of scope (per prompt)

CSV import, real supplier integration, image processing/cropping, tier pricing, demand forecasting, barcode scanning, multi-location, lot/expiry.

### 5. Risks / notes

- Existing `products.stock_status` column stays as the resolved status (updated by trigger); `stock_status_override` is the input.
- `cost_price` visibility handled via app-layer role check + RLS (admin only); office sees the field hidden in form/drawer.
- Storefront `ProductCard` already supports the shape we need; we'll pass through `primary_image_url` once available.
- Dev anon RLS policies extended to allow inserts/updates so the dev role-picker flow keeps working.

Confirm and I'll start with the migration.
