import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDriver } from "@/hooks/use-driver";
import { DeliveryShell } from "./DeliveryShell";
import { formatBBD } from "@/lib/format";

type Bucket = { count: number; total: number };

export function MeStatsPage() {
  const { driverName, vehicleId } = useDriver();
  const [today, setToday] = useState<Bucket>({ count: 0, total: 0 });
  const [week, setWeek] = useState<Bucket>({ count: 0, total: 0 });
  const [all, setAll] = useState<Bucket>({ count: 0, total: 0 });

  useEffect(() => {
    (async () => {
      const t = new Date(); t.setHours(0, 0, 0, 0);
      const w = new Date(); w.setDate(w.getDate() - 7);

      const fetchRange = async (since: Date | null) => {
        const q = supabase.from("orders").select("id, total", { count: "exact" })
          .eq("driver_name", driverName).in("status", ["delivered", "paid"]);
        if (since) q.gte("delivered_at", since.toISOString());
        const { data, count } = await q;
        const total = (data ?? []).reduce((s, r: any) => s + Number(r.total), 0);
        return { count: count ?? 0, total };
      };

      setToday(await fetchRange(t));
      setWeek(await fetchRange(w));
      setAll(await fetchRange(null));
    })();
  }, [driverName]);

  return (
    <DeliveryShell title="My stats" back={{ to: "/delivery" }}>
      <div className="mb-5 rounded-2xl bg-white p-5 shadow-[0_1px_0_#E5E9EF]">
        <div className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Driver</div>
        <div className="text-[22px] font-extrabold leading-tight text-ink">{driverName}</div>
        <div className="text-[12.5px] text-muted-foreground">{vehicleId}</div>
      </div>

      <div className="space-y-3">
        <StatRow label="Today" bucket={today} />
        <StatRow label="This week" bucket={week} />
        <StatRow label="All time" bucket={all} />
      </div>
    </DeliveryShell>
  );
}

function StatRow({ label, bucket }: { label: string; bucket: Bucket }) {
  return (
    <div className="flex items-end justify-between rounded-2xl bg-white p-4 shadow-[0_1px_0_#E5E9EF]">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 font-mono text-[26px] font-extrabold leading-none text-ink">{bucket.count}</div>
        <div className="text-[11.5px] text-muted-foreground">deliveries</div>
      </div>
      <div className="text-right">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Value</div>
        <div className="mt-1 font-mono text-[18px] font-extrabold text-ink">{formatBBD(bucket.total)}</div>
      </div>
    </div>
  );
}
