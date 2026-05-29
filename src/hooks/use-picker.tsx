import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";

interface Ctx {
  pickerName: string;
  initials: string;
  /** Setter kept for compat; updates the local override only. Real name comes from profile. */
  setPickerName: (n: string) => void;
  demoScan: boolean;
  setDemoScan: (v: boolean) => void;
}

const PickerCtx = createContext<Ctx | undefined>(undefined);
const KEY_DEMO = "abl_picker_demo_scan";

export function PickerProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [override, setOverride] = useState<string | null>(null);
  const [demoScan, setDemoScanState] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const d = window.localStorage.getItem(KEY_DEMO);
    if (d != null) setDemoScanState(d === "1");
  }, []);

  const pickerName = override ?? profile?.full_name ?? "Picker";
  const initials =
    pickerName.split(/\s+/).map((p) => p[0] ?? "").slice(0, 2).join("").toUpperCase() || "?";

  const setPickerName = (n: string) => setOverride(n);
  const setDemoScan = (v: boolean) => {
    setDemoScanState(v);
    if (typeof window !== "undefined") window.localStorage.setItem(KEY_DEMO, v ? "1" : "0");
  };

  return (
    <PickerCtx.Provider value={{ pickerName, setPickerName, initials, demoScan, setDemoScan }}>
      {children}
    </PickerCtx.Provider>
  );
}

export function usePicker() {
  const ctx = useContext(PickerCtx);
  if (!ctx) throw new Error("usePicker must be used within PickerProvider");
  return ctx;
}
