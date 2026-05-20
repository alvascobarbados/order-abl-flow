import { QueryClient } from "@tanstack/react-query";

/**
 * Shared QueryClient. A single instance per browser tab so navigation
 * preserves cached data ("cached first, refresh in background"). The
 * TanStack Start SSR entry creates its own per-request client via
 * `getRouter()`, but the same instance is reused on the client after
 * hydration because it's a module-level singleton.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,          // 30s — fresh window
      gcTime: 5 * 60_000,         // 5min — keep in cache when idle
      refetchOnWindowFocus: true, // refetch when tab regains focus
      refetchOnMount: "always",   // show cached, refresh on mount
      retry: 1,
    },
  },
});
