import { useEffect, useState } from "react";

/**
 * Time-of-day greeting that's safe under SSR. Returns `fallback` on the
 * first render (so server HTML matches the initial client HTML), then
 * swaps to the real greeting after mount.
 */
export function useClientGreeting(fallback = "Hello"): string {
  const [g, setG] = useState(fallback);
  useEffect(() => {
    const h = new Date().getHours();
    setG(h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");
  }, []);
  return g;
}

/** Time-of-day greeting computed once on the client. Use only in client-only callbacks. */
export function greetingNow(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
