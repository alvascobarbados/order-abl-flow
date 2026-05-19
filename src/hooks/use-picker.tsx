import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const KEY_NAME = "abl_picker_name";
const DEFAULT_NAME = "Andre Williams";

interface Ctx {
  pickerName: string;
  setPickerName: (n: string) => void;
  initials: string;
  demoScan: boolean;
  setDemoScan: (v: boolean) => void;
}

const PickerCtx = createContext<Ctx | undefined>(undefined);
const KEY_DEMO = "abl_picker_demo_scan";

export function PickerProvider({ children }: { children: ReactNode }) {
  const [pickerName, setPickerNameState] = useState<string>(DEFAULT_NAME);
  const [demoScan, setDemoScanState] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = window.localStorage.getItem(KEY_NAME);
    if (v) setPickerNameState(v);
    const d = window.localStorage.getItem(KEY_DEMO);
    if (d != null) setDemoScanState(d === "1");
  }, []);

  const setPickerName = (n: string) => {
    setPickerNameState(n);
    if (typeof window !== "undefined") window.localStorage.setItem(KEY_NAME, n);
  };
  const setDemoScan = (v: boolean) => {
    setDemoScanState(v);
    if (typeof window !== "undefined") window.localStorage.setItem(KEY_DEMO, v ? "1" : "0");
  };

  const initials = pickerName.split(/\s+/).map((p) => p[0] ?? "").slice(0, 2).join("").toUpperCase() || "?";

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
