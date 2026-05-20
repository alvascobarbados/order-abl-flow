/**
 * Central query-key registry. Realtime invalidation, prefetch hover
 * helpers, and components all import from here so a typo can't silently
 * desync the live-update wiring.
 *
 * Keys are arrays whose **first element** is the namespace string. We rely
 * on `queryClient.invalidateQueries({ queryKey: [namespace] })` which
 * prefix-matches, so any filter-scoped variants under the same namespace
 * (e.g. `['orders', { tab: 'packed' }]`) are invalidated together.
 */
export const qk = {
  // Office / shared
  orders: (filters?: unknown) => filters === undefined ? ["orders"] as const : ["orders", filters] as const,
  orderById: (id: string) => ["order", id] as const,
  customers: (filters?: unknown) => filters === undefined ? ["customers"] as const : ["customers", filters] as const,
  customerById: (id: string) => ["customer", id] as const,
  products: () => ["products"] as const,
  shopProducts: (filters?: unknown) => filters === undefined ? ["shop-products"] as const : ["shop-products", filters] as const,
  categories: () => ["categories"] as const,
  payments: (filters?: unknown) => filters === undefined ? ["payments"] as const : ["payments", filters] as const,
  stockMovements: (productId?: string) => productId ? ["stock-movements", productId] as const : ["stock-movements"] as const,

  // Dashboard
  dashboard: () => ["dashboard"] as const,
  dashboardKpis: () => ["dashboard-kpis"] as const,
  pipelineCounts: () => ["pipeline-counts"] as const,
  pendingOrders: () => ["pending-orders"] as const,
  activityFeed: () => ["activity-feed"] as const,

  // Warehouse
  warehouseQueue: () => ["warehouse-queue"] as const,
  warehouseDispatch: () => ["warehouse-dispatch"] as const,

  // Delivery
  route: (driverName: string) => ["route", driverName] as const,
  availableLoads: () => ["available-loads"] as const,

  // Settings / misc
  systemSettings: () => ["system-settings"] as const,
} as const;

/**
 * Maps a Supabase table name → list of query-key namespace prefixes to
 * invalidate when a row in that table changes. Used by
 * `useRealtimeInvalidation`.
 */
export const tableToQueryKeys: Record<string, readonly string[]> = {
  orders: [
    "orders", "order", "dashboard", "dashboard-kpis", "pipeline-counts", "pending-orders",
    "warehouse-queue", "warehouse-dispatch", "route", "available-loads",
  ],
  payments: ["payments", "dashboard", "dashboard-kpis", "customers", "customer", "activity-feed"],
  payment_allocations: ["orders", "order", "payments", "dashboard", "dashboard-kpis"],
  delivery_events: ["route", "activity-feed", "dashboard", "dashboard-kpis"],
  picking_events: ["warehouse-queue", "activity-feed", "dashboard"],
  activity_log: ["activity-feed", "dashboard"],
  stock_movements: ["products", "shop-products", "stock-movements"],
  customers: ["customers", "customer"],
  products: ["products", "shop-products"],
};
