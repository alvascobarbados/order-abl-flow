import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Repeat, Zap, Wifi, WifiOff, LogOut, BarChart3, HelpCircle, User as UserIcon } from "lucide-react";
import { usePicker } from "@/hooks/use-picker";
import { useRole } from "@/hooks/use-role";
import { supabase } from "@/integrations/supabase/client";

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

export function WarehouseShell({
  title, subtitle, back, children,
}: {
  title: string;
  subtitle?: string;
  back?: { to: string; label?: string };
  children: ReactNode;
}) {
  const online = useOnline();
  return (
    <div className="min-h-screen bg-[#F6F7F9]">
      <TopBar title={title} subtitle={subtitle} back={back} />
      {!online && (
        <div className="sticky top-[64px] z-30 bg-[#FEF3C7] px-4 py-2 text-center text-[13px] font-semibold text-[#92400E]">
          <WifiOff className="mr-1.5 inline h-3.5 w-3.5" /> Offline — your picks will sync when reconnected
        </div>
      )}
      <main className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6">{children}</main>
    </div>
  );
}

function TopBar({ title, subtitle, back }: { title: string; subtitle?: string; back?: { to: string; label?: string } }) {
  const { pickerName, initials, setPickerName, demoScan, setDemoScan } = usePicker();
  const { signOut } = useRole();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchStats = async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const { count } = await supabase.from("orders").select("id", { count: "exact", head: true })
        .eq("status", "packed").gte("packed_at", start.toISOString());
      setTodayCount(count ?? 0);
    };
    if (open) fetchStats();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const endShift = async () => { setOpen(false); await signOut(); navigate({ to: "/" }); };
  const switchRole = async () => { setOpen(false); await signOut(); navigate({ to: "/" }); };
  const editName = () => {
    const next = window.prompt("Your name (for this shift)", pickerName);
    if (next && next.trim()) setPickerName(next.trim());
  };

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-[#E5E9EF] bg-white">
      <div className="mx-auto flex h-full max-w-[1280px] items-center gap-3 px-4 sm:px-6">
        {back ? (
          <Link to={back.to} className="grid h-11 w-11 place-items-center rounded-xl text-ink hover:bg-[#F1F4F8]" aria-label="Back">
            <ChevronLeft className="h-6 w-6" strokeWidth={2.25} />
          </Link>
        ) : (
          <Link to="/warehouse" className="flex shrink-0 items-baseline gap-2">
            <span className="text-[22px] font-extrabold leading-none text-[#0B1A2E]">ABL</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6A1A]">Warehouse</span>
          </Link>
        )}
        <div className="min-w-0 flex-1 px-2 text-center">
          <div className="truncate text-[15px] font-bold text-ink sm:text-[16px]">{title}</div>
          {subtitle && <div className="truncate text-[12px] text-muted-foreground">{subtitle}</div>}
        </div>
        <div className="relative shrink-0" ref={ref}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="grid h-12 w-12 place-items-center rounded-full bg-[#0F2540] text-[15px] font-bold text-white shadow-sm"
            aria-label="Picker menu"
          >
            {initials}
          </button>
          {open && (
            <div className="absolute right-0 top-[56px] w-[280px] overflow-hidden rounded-2xl border border-[#E5E9EF] bg-white shadow-2xl">
              <div className="border-b border-[#F1F4F8] px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-[#0F2540] text-[13px] font-bold text-white">{initials}</div>
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-bold text-ink">{pickerName}</div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Warehouse picker</div>
                  </div>
                </div>
                <div className="mt-2 text-[12px] text-muted-foreground">Today: {todayCount} orders packed</div>
              </div>
              <MenuItem icon={<UserIcon className="h-4 w-4" />} onClick={() => { setOpen(false); editName(); }}>Edit my name</MenuItem>
              <MenuItem icon={<BarChart3 className="h-4 w-4" />} onClick={() => { setOpen(false); navigate({ to: "/warehouse/me" }); }}>View my stats</MenuItem>
              <MenuItem icon={<HelpCircle className="h-4 w-4" />} onClick={() => { setOpen(false); window.dispatchEvent(new CustomEvent("warehouse:help")); }}>Report a problem</MenuItem>
              <div className="flex items-center justify-between border-t border-[#F1F4F8] px-4 py-3">
                <span className="text-[12px] font-semibold text-ink">Demo scan mode</span>
                <button
                  type="button"
                  onClick={() => setDemoScan(!demoScan)}
                  className={`relative h-6 w-11 rounded-full transition ${demoScan ? "bg-[#FF6A1A]" : "bg-[#CBD5E1]"}`}
                  aria-pressed={demoScan}
                >
                  <span className={`absolute top-0.5 grid h-5 w-5 place-items-center rounded-full bg-white shadow transition ${demoScan ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </div>
              <div className="border-t border-[#F1F4F8]" />
              <MenuItem icon={<LogOut className="h-4 w-4" />} onClick={endShift}>End shift</MenuItem>
              <MenuItem icon={<Repeat className="h-4 w-4" />} onClick={switchRole}>Switch role</MenuItem>
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

export function UrgencyChip({ kind }: { kind: "URGENT" | "QUEUED" | "RESUME" }) {
  if (kind === "URGENT") return <span className="rounded-full bg-[#FEE2E2] px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wider text-[#B91C1C]">Urgent</span>;
  if (kind === "RESUME") return <span className="rounded-full bg-[#F59E0B] px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wider text-white">Resume</span>;
  return <span className="rounded-full border border-[#CBD5E1] px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wider text-[#64748B]">Queued</span>;
}

export { Zap, Wifi };
