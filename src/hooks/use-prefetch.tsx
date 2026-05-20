import { useCallback } from "react";
import { useQueryClient, type QueryKey, type QueryFunction } from "@tanstack/react-query";

/**
 * Returns an `onMouseEnter` handler that warms React Query's cache for
 * the given key. Attach to sidebar / nav links so the next page renders
 * from cache when the user actually clicks.
 *
 * Safe to use without arguments — when `enabled` is false it returns a
 * no-op so callers can keep their JSX clean.
 */
export function usePrefetchOnHover<TData>(
  queryKey: QueryKey,
  queryFn: QueryFunction<TData>,
  options?: { enabled?: boolean; staleTime?: number },
) {
  const queryClient = useQueryClient();
  const enabled = options?.enabled ?? true;
  const staleTime = options?.staleTime ?? 30_000;

  return useCallback(() => {
    if (!enabled) return;
    queryClient.prefetchQuery({ queryKey, queryFn, staleTime });
  }, [queryClient, queryKey, queryFn, enabled, staleTime]);
}
