import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const KEY_NAME = "abl_driver_name";
const KEY_VEHICLE = "abl_driver_vehicle";
const DEFAULT_NAME = "Neal Springer";
const DEFAULT_VEHICLE = "VAN-04";

interface Ctx {
  driverName: string;
  setDriverName: (n: string) => void;
  initials: string;
  vehicleId: string;
  setVehicleId: (v: string) => void;
}

const DriverCtx = createContext<Ctx | undefined>(undefined);

export function DriverProvider({ children }: { children: ReactNode }) {
  const [driverName, setNameState] = useState<string>(DEFAULT_NAME);
  const [vehicleId, setVehicleState] = useState<string>(DEFAULT_VEHICLE);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const n = window.localStorage.getItem(KEY_NAME);
    if (n) setNameState(n);
    const v = window.localStorage.getItem(KEY_VEHICLE);
    if (v) setVehicleState(v);
  }, []);

  const setDriverName = (n: string) => {
    setNameState(n);
    if (typeof window !== "undefined") window.localStorage.setItem(KEY_NAME, n);
  };
  const setVehicleId = (v: string) => {
    setVehicleState(v);
    if (typeof window !== "undefined") window.localStorage.setItem(KEY_VEHICLE, v);
  };

  const initials =
    driverName.split(/\s+/).map((p) => p[0] ?? "").slice(0, 2).join("").toUpperCase() || "?";

  return (
    <DriverCtx.Provider value={{ driverName, setDriverName, initials, vehicleId, setVehicleId }}>
      {children}
    </DriverCtx.Provider>
  );
}

export function useDriver() {
  const ctx = useContext(DriverCtx);
  if (!ctx) throw new Error("useDriver must be used within DriverProvider");
  return ctx;
}
