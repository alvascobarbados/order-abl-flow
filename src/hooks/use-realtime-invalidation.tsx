import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { tableToQueryKeys } from "@/lib/query-keys";

/**
 * Subscribes once to every realtime channel we care about and translates
 * incoming row events into React Query cache invalidations. Mount this
 * exactly once near the app root.
 *
 * RLS in dev is permissive (`dev_anon_*` policies), so anonymous clients
 * receive realtime payloads as the operational accounts will once auth is
 * re-enabled.
 */
export function RealtimeInvalidationBridge() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const channel = supabase.channel("global-invalidation");

    Object.entries(tableToQueryKeys).forEach(([table, prefixes]) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          for (const prefix of prefixes) {
            queryClient.invalidateQueries({ queryKey: [prefix] });
          }
        },
      );
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return null;
}
