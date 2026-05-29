import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Package, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDriver } from "@/hooks/use-driver";
import { DeliveryShell } from "./DeliveryShell";
import { DeliveryErrorCard } from "./DeliveryErrorCard";
import { formatBBD } from "@/lib/format";
import { fetchCustomerInfoMap } from "./customer-info";
import { toast } from "sonner";

type ShiftSummary = {
  delivered: Array<{ id: string; order_number: string | null; total: number; company_name: string | null }>;
  undelivered: Array<{ id: string; order_number: string | null; company_name: string | null; reason: string | null }>;
  goodsDelivered: number;
};

async function loadShiftSummary(driverProfileId: string): Promise<ShiftSummary> {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const startISO = start.toISOString();

  const { data: orders, error } = await supabase.from("orders")
    .select("id, order_number, customer_id, total, status, delivered_at, delivery_status_detail, delivery_notes")
    .eq("driver_profile_id", driverProfileId)
    .or(`and(status.in.(delivered,paid),delivered_at.gte.${startISO}),and(status.eq.out_for_delivery,dispatched_at.gte.${startISO})`);
  if (error) throw new Error(error.message);

  const rows = orders ?? [];
  const customerIds = Array.from(new Set(rows.map((r) => r.customer_id)));
  const custMap = await fetchCustomerInfoMap(customerIds);

  const delivered: ShiftSummary["delivered"] = [];
  const undelivered: ShiftSummary["undelivered"] = [];
  let goodsDelivered = 0;

  for (const o of rows) {
    const company_name = custMap.get(o.customer_id)?.company_name ?? null;
    if (o.status === "delivered" || o.status === "paid") {
      delivered.push({ id: o.id, order_number: o.order_number, total: Number(o.total), company_name });
      goodsDelivered += Number(o.total);
    } else {
      // out_for_delivery and not delivered = undelivered/refused
      undelivered.push({
        id: o.id,
        order_number: o.order_number,
        company_name,
        reason: o.delivery_status_detail ? String(o.delivery_status_detail).replace(/_/g, " ") : (o.delivery_notes ?? null),
      });
    }
  }

  return { delivered, undelivered, goodsDelivered };
}

export function EndShiftPage() {
  const { driverName, driverProfileId, vehicleId } = useDriver();
  const navigate = useNavigate();
  const [notes, setNotes] = useState("");

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["delivery", "end-shift", driverProfileId ?? "_anon"],
    queryFn: () => loadShiftSummary(driverProfileId!),
    enabled: !!driverProfileId,
    staleTime: 10_000,
  });

  const submitMut = useMutation({
    mutationFn: async () => {
      if (!driverProfileId) throw new Error("Not signed in as a driver.");
      const today = new Date().toISOString().slice(0, 10);
      const { data: inserted, error: insErr } = await supabase.from("driver_shifts").insert({
        driver_profile_id: driverProfileId,
        driver_name: driverName,
        shift_date: today,
        ended_at: new Date().toISOString(),
        vehicle_id: vehicleId,
        deliveries_count: data?.delivered.length ?? 0,
        notes: notes.trim() || null,
      }).select("id");
      if (insErr) throw new Error(insErr.message);
      if (!inserted || inserted.length === 0) {
        throw new Error("Shift insert affected 0 rows — likely blocked by RLS.");
      }
      return inserted[0].id as string;
    },
    onSuccess: () => {
      toast.success("Shift submitted");
      setTimeout(() => navigate({ to: "/" }), 1000);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DeliveryShell title="End of shift" back={{ to: "/delivery" }} subtitle={`${driverName} · ${new Date().toLocaleDateString()}`}>
      {isError ? (
        <DeliveryErrorCard
          title="Couldn't load shift summary"
          message={(error as Error)?.message}
          onRetry={() => refetch()}
        />
      ) : isPending || !driverProfileId ? (
        <div className="space-y-3">
          <div className="h-32 animate-pulse rounded-2xl bg-[#F1F4F8]" />
          <div className="h-24 animate-pulse rounded-2xl bg-[#F1F4F8]" />
        </div>
      ) : (
        <>
          <section className="mb-4 rounded-2xl bg-white p-5 shadow-[0_1px_0_#E5E9EF]">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Deliveries completed</div>
            <div className="flex items-baseline gap-2">
              <span className="text-[44px] font-extrabold leading-none text-ink tabular-nums">{data.delivered.length}</span>
              {(data.delivered.length + data.undelivered.length) > 0 && (
                <span className="text-[18px] font-bold text-muted-foreground tabular-nums">
                  / {data.delivered.length + data.undelivered.length}
                </span>
              )}
            </div>
            {data.goodsDelivered > 0 && (
              <div className="mt-3 text-[11.5px] text-muted-foreground tabular-nums">
                {formatBBD(data.goodsDelivered)} in goods delivered
              </div>
            )}
          </section>

          {data.delivered.length > 0 && (
            <section className="mb-4 rounded-2xl bg-white p-4 shadow-[0_1px_0_#E5E9EF]">
              <div className="mb-2 flex items-center gap-2 text-[13px] font-extrabold text-ink">
                <CheckCircle2 className="h-4 w-4 text-[#10B981]" /> Delivered
              </div>
              <ul className="space-y-1.5">
                {data.delivered.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#E5E9EF] px-3 py-2 text-[12.5px]">
                    <span className="font-mono font-bold text-ink shrink-0">{d.order_number ?? "—"}</span>
                    <span className="truncate text-muted-foreground flex-1">{d.company_name ?? "—"}</span>
                    <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{formatBBD(d.total)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.undelivered.length > 0 && (
            <section className="mb-4 rounded-2xl bg-white p-4 shadow-[0_1px_0_#E5E9EF]">
              <div className="mb-2 flex items-center gap-2 text-[13px] font-extrabold text-ink">
                <XCircle className="h-4 w-4 text-[#B91C1C]" /> Not delivered
              </div>
              <ul className="space-y-1.5">
                {data.undelivered.map((u) => (
                  <li key={u.id} className="rounded-lg border border-[#FEE2E2] bg-[#FEF2F2] px-3 py-2 text-[12.5px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-ink">{u.order_number ?? "—"}</span>
                      <span className="truncate text-muted-foreground">{u.company_name ?? "—"}</span>
                    </div>
                    {u.reason && <div className="mt-1 text-[11.5px] text-[#9A3412]">Reason: {u.reason}</div>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.delivered.length === 0 && data.undelivered.length === 0 && (
            <section className="mb-4 rounded-2xl border border-dashed border-[#E5E9EF] bg-white px-5 py-8 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#F1F4F8]">
                <Package className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="mt-3 text-[14px] font-extrabold text-ink">No stops on today's shift</div>
              <p className="mt-1 text-[12.5px] text-muted-foreground">You can still submit to close out your shift.</p>
            </section>
          )}

          <section className="mb-4 rounded-2xl bg-white p-4 shadow-[0_1px_0_#E5E9EF]">
            <label className="text-[13px] font-extrabold text-ink">Anything to flag?</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Vehicle issues, customer complaints, missing items…"
              className="mt-2 w-full rounded-xl border border-[#E5E9EF] bg-white p-3 text-[13.5px] text-ink outline-none focus:border-[#10B981]"
            />
          </section>

          <button
            type="button"
            onClick={() => submitMut.mutate()}
            disabled={submitMut.isPending}
            className="flex h-14 w-full items-center justify-center rounded-xl bg-[#FF6A1A] text-[16px] font-extrabold text-white shadow-lg disabled:opacity-50"
          >
            {submitMut.isPending ? "Submitting…" : "Submit end of shift"}
          </button>
        </>
      )}
    </DeliveryShell>
  );
}
