import { useEffect, useRef, useState } from "react";
import { X, AlertTriangle } from "lucide-react";

// Lazy-load the scanner only when opened (avoids SSR + saves bundle)
export function Scanner({ open, onClose, onDetected }: { open: boolean; onClose: () => void; onDetected: (text: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    let cancelled = false;
    setError(null);

    (async () => {
      try {
        const mod = await import("html5-qrcode");
        if (cancelled || !ref.current) return;
        const Html5Qrcode = mod.Html5Qrcode;
        const id = "wh-qr-region";
        ref.current.id = id;
        const scanner = new Html5Qrcode(id, { verbose: false });
        instanceRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 12, qrbox: { width: 240, height: 240 } },
          (text) => { onDetected(text); },
          () => {/* per-frame failure: silent */},
        );
      } catch (e: any) {
        setError(e?.message ?? "Could not access the camera. Use the manual pick buttons.");
      }
    })();

    return () => {
      cancelled = true;
      (async () => {
        const inst = instanceRef.current;
        if (inst) {
          try { await inst.stop(); } catch {/* */}
          try { inst.clear(); } catch {/* */}
        }
        instanceRef.current = null;
      })();
    };
  }, [open, onDetected]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/95">
      <div className="flex h-16 items-center justify-between px-4 text-white">
        <div className="font-bold">Scan a carton</div>
        <button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full bg-white/10" aria-label="Close scanner">
          <X className="h-6 w-6" />
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center p-4">
        {error ? (
          <div className="max-w-md rounded-2xl bg-white p-6 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-[#F59E0B]" />
            <div className="mt-3 text-[16px] font-bold text-ink">Camera unavailable</div>
            <p className="mt-2 text-[13px] text-muted-foreground">{error}</p>
            <button type="button" onClick={onClose} className="mt-5 h-12 w-full rounded-xl bg-[#0F2540] px-4 text-[14px] font-bold text-white">Use manual pick</button>
          </div>
        ) : (
          <div ref={ref} className="w-full max-w-[480px] overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: "1 / 1" }} />
        )}
      </div>
      <div className="p-4 text-center text-[13px] text-white/70">Aim at the QR or barcode on the carton</div>
    </div>
  );
}
