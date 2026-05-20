# Get rid of the "waking up" feel

This is a systemic refactor that touches ~40 data-fetching components. I want to land it in deliberate stages instead of one mega-commit so each stage is reviewable and ships value on its own.

## Stage 1 — Infrastructure (one commit, no visible UI change yet)

Wire the foundation everything else builds on.

1. **QueryClient + Provider**
   - `bun add @tanstack/react-query` is already in the template (used by the router context). Confirm version, then export a shared client from `src/lib/query-client.ts` with the config in the brief (`staleTime: 30_000`, `gcTime: 5min`, `refetchOnWindowFocus: true`, `refetchOnMount: 'always'`, `retry: 1`).
   - `src/routes/__root.tsx` already wraps `<Outlet />` in `QueryClientProvider`, but the client comes from the router context (created per-request). Swap it to import the shared instance so the cache survives navigations in dev/preview. Keep router context wiring intact.

2. **Realtime invalidation hook**
   - New `src/hooks/use-realtime-invalidation.tsx`. Subscribes once at the root to the six tables called out: `orders`, `payments`, `delivery_events`, `picking_events`, `activity_log`, `stock_movements`.
   - Maps each table → list of query-key prefixes to invalidate (e.g. `orders` → `['orders']`, `['dashboard-kpis']`, `['pipeline-counts']`, `['activity-feed']`, `['warehouse-queue']`, `['route']`).
   - Mounted in `__root.tsx` next to the existing providers. Tables already exist; no migration needed. Realtime publication needs `ALTER PUBLICATION supabase_realtime ADD TABLE …` for each — handled in one migration.

3. **Skeleton primitives**
   - `src/components/ui/skeleton.tsx` already exists. Add a thin wrapper file `src/components/abl/skeletons.tsx` exporting reusable shapes used across pages: `<SkeletonKpiCard />`, `<SkeletonTableRow cols={…} />`, `<SkeletonOrderCard />`, `<SkeletonProductCard />`, `<SkeletonStopCard />`, `<SkeletonPill />`.
   - All use `bg-muted animate-pulse` per the brief — no new tokens, no font changes.

4. **Prefetch helper**
   - `src/hooks/use-prefetch.tsx` exposes a `usePrefetchOnHover(queryKey, queryFn)` returning an `onMouseEnter` handler. Used by sidebar links in `OfficeShell`.

5. **Optimistic mutation helper**
   - `src/lib/mutations.ts` with a tiny `createOptimisticOrderMutation()` factory that cancels in-flight `['orders']` queries, snapshots, applies the patch, rolls back on error, and invalidates `onSettled`. Reused by approve / reject / mark-packed / assign-driver / record-payment.

## Stage 2 — Highest-traffic pages refactored (this is where users feel it)

Refactor these from `useEffect`+`useState` → `useQuery`. Each gets proper skeletons and removes the "0/empty for a beat" flash. Tab badge counts switch from `0` to a tiny `<SkeletonPill />` until the query resolves.

- **Office Dashboard** (`OfficeDashboard.tsx`) — KPI strip (6 cards), pipeline row (6 circles), pending approval rows, activity feed. Query keys: `['dashboard-kpis']`, `['pipeline-counts']`, `['pending-orders']`, `['activity-feed']`. `staleTime: 10_000` for activity, default for the rest.
- **Office Orders** (`OrdersPage.tsx`) — table rows + tab counts. Query key `['orders', { tab, filters }]`. 8 skeleton rows during load.
- **Office Customers** (`CustomersTable.tsx`) — `['customers', filters]`, 8 skeleton rows.
- **Office Products** (`ProductsPage.tsx`) — `['products']` + `['categories']`, 6 skeleton cards. `staleTime: 5min`.
- **Warehouse Queue** (`QueuePage.tsx`) — `['warehouse-queue']` + `['warehouse-dispatch']`. KPI strip skeleton, 3 queue card skeletons, 2 dispatch skeletons.
- **Delivery Route** (`RoutePage.tsx`) — `['route', driverName]`. Hero card shows `—` until resolved (never `BBD$ 0.00`). 3 skeleton stop cards.
- **Driver Load** (`LoadVanPage.tsx`) — `['available-loads']`.
- **Customer Storefront** (`shop/index.tsx`) — `['products', { category }]`, 12 skeleton product cards.

## Stage 3 — Realtime + prefetch + optimistic (polish)

- Mount the realtime hook (Stage 1) at the root. Verify two-tab test (Andre marks packed → Sarah sees pipeline update in ≤2s).
- Add `onMouseEnter` prefetch to every sidebar link in `OfficeShell`, `WarehouseShell`, `DeliveryShell`.
- Convert these mutations to optimistic: approve, reject, mark packed, record payment, mark delivered, assign driver/vehicle. UI flips on tap; rollback + toast on error.

## Stage 4 — Sweep the long tail

Apply the same pattern to remaining pages without UI change: `InvoicesPage`, `PurchasingPage`, `SettingsPage`, customer detail drawer tabs, payment drawer, order drawer tabs, warehouse `PackPage`/`PickPage`/`DonePage`, delivery `StopPage`/`DonePage`/`EndShiftPage`/`MeStatsPage`. Each is mechanical: extract query, swap defaults for skeleton, use shared keys.

## Out of scope (not doing in this pass)

- Loom recording (I can't record video — I'll instead verify by reproducing the three tests in the preview and reporting back with screenshots).
- Suspense / `useSuspenseQuery` migration — sticking to `useQuery` so the skeleton story stays simple.
- Loader-based prefetching via TanStack Router. Keeping data fetching component-local keeps the diff smaller and the realtime invalidation simpler. Can revisit later.

## Technical details

- **Query key conventions** centralized in `src/lib/query-keys.ts` so realtime invalidation and prefetch use the exact same strings (cheap to typo otherwise).
- **`refetchOnMount: 'always'`** is what gives the "cached first, then silently refresh" behavior the brief calls for — paired with `staleTime: 30_000` it shows cached data instantly on re-navigation and refetches in the background.
- **Skeleton vs empty state**: skeletons render only while `isPending` (first load, no cache). Once resolved with `data.length === 0`, render the existing styled empty state. Background refetches (`isFetching && !isPending`) keep showing real data — no flicker.
- **Realtime publication**: one migration `ALTER PUBLICATION supabase_realtime ADD TABLE …` for the six tables. RLS already permissive in dev (`dev_anon_*` policies).
- **Mono/sans font rule**: untouched. Skeletons are pure shapes.
- **Cart**: already context-managed with optimistic updates — leaving as-is.

## Stage sizing

Stage 1 + Stage 2 in this turn is realistic if you're OK with Stage 3 (realtime + prefetch + optimistic) and Stage 4 (long tail) landing in follow-up turns. Doing all four stages in one turn would mean ~40 file edits and would be hard to review. Tell me if you'd rather I attempt the whole thing in one go anyway, or land Stages 1+2 now and queue 3+4 next.
