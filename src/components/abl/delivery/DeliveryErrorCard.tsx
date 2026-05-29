import { AlertTriangle } from "lucide-react";

/** Shared error card for the delivery surface. Never let a driver see a blank screen. */
export function DeliveryErrorCard({
  title = "Couldn't load this screen",
  message,
  onRetry,
}: { title?: string; message?: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-5 py-6 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white">
        <AlertTriangle className="h-6 w-6 text-[#B91C1C]" />
      </div>
      <div className="mt-3 text-[15px] font-extrabold text-[#7F1D1D]">{title}</div>
      {message && (
        <div className="mx-auto mt-1 max-w-[320px] break-words text-[11.5px] text-[#7F1D1D]/80">
          {message}
        </div>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-[#B91C1C] px-5 text-[13.5px] font-extrabold text-white shadow-sm hover:bg-[#991B1B]"
        >
          Tap to retry
        </button>
      )}
    </div>
  );
}
