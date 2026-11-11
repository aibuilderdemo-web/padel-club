"use client";

import { useEffect } from "react";

// Registers /sw.js in production only, so dev reloads are never served stale.
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((e) => console.error("Service worker registration failed:", e));
  }, []);
  return null;
}
