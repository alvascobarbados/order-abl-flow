/**
 * Shared skeleton primitives used across pages while initial queries
 * resolve. Loading state must look *visually distinct* from the empty
 * state — these are pulsing muted blocks; empty states stay as their
 * styled "All caught up" messages.
 */

const SHIMMER = "animate-pulse rounded-md bg-muted";

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`${SHIMMER} ${className ?? ""}`} />;
}

/** Tiny pill, used in place of a numeric badge while count is loading. */
export function SkeletonPill({ className }: { className?: string }) {
  return <span className={`inline-block h-3 w-5 rounded-full bg-muted animate-pulse align-middle ${className ?? ""}`} />;
}

/** A single text-line skeleton at given width (Tailwind classes). */
export function SkeletonLine({ w = "w-full", className }: { w?: string; className?: string }) {
  return <div className={`${SHIMMER} h-3 ${w} ${className ?? ""}`} />;
}

/** KPI card on the office dashboard / warehouse landing. */
export function SkeletonKpiCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className={`${SHIMMER} h-3 w-24`} />
      <div className={`${SHIMMER} mt-3 h-7 w-20`} />
      <div className={`${SHIMMER} mt-2 h-3 w-28`} />
    </div>
  );
}

/** Pipeline column on the office dashboard. */
export function SkeletonPipelineCol() {
  return (
    <div className="flex flex-col items-center justify-center py-3">
      <div className={`${SHIMMER} h-7 w-10`} />
      <div className={`${SHIMMER} mt-2 h-3 w-16`} />
    </div>
  );
}

/** Generic table row skeleton, used for orders / customers / products tables. */
export function SkeletonTableRow({ cols }: { cols: number }) {
  return (
    <tr className="border-t border-border">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-3.5">
          <div className={`${SHIMMER} h-3 ${i === 0 ? "w-32" : i === 1 ? "w-24" : "w-16"}`} />
        </td>
      ))}
    </tr>
  );
}

/** Pending-approval-style row on the office dashboard. */
export function SkeletonPendingRow() {
  return (
    <li className="rounded-[10px] border border-border p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <div className={`${SHIMMER} h-4 w-16`} />
            <div className={`${SHIMMER} h-3 w-12`} />
          </div>
          <div className={`${SHIMMER} h-4 w-40`} />
          <div className={`${SHIMMER} h-3 w-56`} />
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <div className={`${SHIMMER} h-7 w-16`} />
          <div className={`${SHIMMER} h-7 w-20`} />
        </div>
      </div>
    </li>
  );
}

/** Activity feed row. */
export function SkeletonActivityRow() {
  return (
    <li className="flex gap-3 border-b border-border py-2.5 last:border-b-0">
      <div className={`${SHIMMER} h-3 w-12`} />
      <div className={`${SHIMMER} h-3 flex-1`} />
    </li>
  );
}

/** Warehouse queue / dispatch order card. */
export function SkeletonOrderCard() {
  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className={`${SHIMMER} h-4 w-20`} />
        <div className={`${SHIMMER} h-3 w-16`} />
      </div>
      <div className={`${SHIMMER} mt-3 h-6 w-48`} />
      <div className={`${SHIMMER} mt-2 h-3 w-40`} />
      <div className={`${SHIMMER} mt-4 h-12 w-full`} />
    </article>
  );
}

/** Delivery route stop card. */
export function SkeletonStopCard() {
  return (
    <li className="flex items-stretch gap-3 rounded-2xl border border-border bg-card p-3">
      <div className={`${SHIMMER} h-10 w-10 rounded-full`} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className={`${SHIMMER} h-4 w-40`} />
        <div className={`${SHIMMER} h-3 w-56`} />
        <div className={`${SHIMMER} h-3 w-24`} />
      </div>
    </li>
  );
}

/** Customer storefront product card. */
export function SkeletonProductCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className={`aspect-square ${SHIMMER} rounded-none`} />
      <div className="space-y-2 p-3">
        <div className={`${SHIMMER} h-3 w-16`} />
        <div className={`${SHIMMER} h-4 w-3/4`} />
        <div className={`${SHIMMER} h-4 w-1/2`} />
      </div>
    </div>
  );
}
