import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Repeat, WifiOff, LogOut, BarChart3, User as UserIcon, Truck, ClipboardCheck } from "lucide-react";
import { useDriver } from "@/hooks/use-driver";
import { useRole } from "@/hooks/use-role";

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);
  return online;
}

export function DeliveryShell({
  title, subtitle, back, children, right,
}: {
  title?: string;
  subtitle?: string;
  back?: { to: string };
  children: ReactNode;
  right?: ReactNode;
}) {
  const online = useOnline();
  return (
    <div className="min-h-screen bg-[#F6F7F9]">
      <TopBar title={title} subtitle={subtitle} back={back} right={right} />
      {!online && (
        <div className="sticky top-[56px] z-30 bg-[#FFEDD5] px-4 py-2 text-center text-[12px] font-semibold text-[#9A3412]">
          <WifiOff className="mr-1.5 inline h-3.5 w-3.5" /> Offline — actions will sync when reconnected
        </div>
      )}
      <main className="mx-auto max-w-[640px] px-4 pt-4 pb-24">{children}</main>
    </div>
  );
}

function TopBar({ title, subtitle, back, right }: { title?: string; subtitle?: string; back?: { to: string }; right?: ReactNode }) {
  const { driverName, initials, setDriverName, vehicleId } = useDriver();
  const { signOut } = useRole();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const switchRole = async () => { setOpen(false); await signOut(); navigate({ to: "/" }); };
  const editName = () => {
    const next = window.prompt("Your name (for this shift)", driverName);
    if (next && next.trim()) setDriverName(next.trim());
  };

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-[#E5E9EF] bg-white">
      <div className="mx-auto flex h-full max-w-[640px] items-center gap-2 px-3">
        {back ? (
          <Link to={back.to} className="grid h-10 w-10 place-items-center rounded-xl text-ink hover:bg-[#F1F4F8]" aria-label="Back">
            <ChevronLeft className="h-6 w-6" strokeWidth={2.25} />
          </Link>
        ) : (
          <Link to="/delivery" className="flex shrink-0 items-baseline gap-1.5 pl-1">
            <span className="text-[20px] font-extrabold leading-none text-[#0B1A2E]">ABL</span>
            <span className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-[#10B981]">Delivery</span>
          </Link>
        )}
        <div className="min-w-0 flex-1 px-1 text-center">
          {title && <div className="truncate text-[14px] font-bold text-ink">{title}</div>}
          {subtitle && <div className="truncate text-[11px] text-muted-foreground">{subtitle}</div>}
        </div>
        {right}
        <div className="relative shrink-0" ref={ref}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-full bg-[#10B981] text-[13px] font-bold text-white shadow-sm"
            aria-label="Driver menu"
          >
            {initials}
          </button>
          {open && (
            <div className="absolute right-0 top-[48px] w-[280px] overflow-hidden rounded-2xl border border-[#E5E9EF] bg-white shadow-2xl">
              <div className="border-b border-[#F1F4F8] px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-[#10B981] text-[13px] font-bold text-white">{initials}</div>
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-bold text-ink">{driverName}</div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{vehicleId} · Driver</div>
                  </div>
                </div>
              </div>
              <MenuItem icon={<UserIcon className="h-4 w-4" />} onClick={() => { setOpen(false); editName(); }}>Edit my name</MenuItem>
              <MenuItem icon={<Truck className="h-4 w-4" />} onClick={() => { setOpen(false); navigate({ to: "/delivery/load" }); }}>Load van</MenuItem>
              <MenuItem icon={<BarChart3 className="h-4 w-4" />} onClick={() => { setOpen(false); navigate({ to: "/delivery/me" }); }}>View my stats</MenuItem>
              <MenuItem icon={<ClipboardCheck className="h-4 w-4" />} onClick={() => { setOpen(false); navigate({ to: "/delivery/end-shift" }); }}>Done for the day</MenuItem>
              <div className="border-t border-[#F1F4F8]" />
              <MenuItem icon={<LogOut className="h-4 w-4" />} onClick={switchRole}>Switch role</MenuItem>
              <MenuItem icon={<Repeat className="h-4 w-4" />} onClick={switchRole}>Sign out</MenuItem>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuItem({ icon, children, onClick }: { icon: ReactNode; children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left text-[13.5px] font-semibold text-ink hover:bg-[#FAFBFC]">
      <span className="text-muted-foreground">{icon}</span>{children}
    </button>
  );
}
