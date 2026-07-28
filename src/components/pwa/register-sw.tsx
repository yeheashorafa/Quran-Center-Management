"use client";

import { useEffect } from "react";

export function RegisterSW() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const isPWAEnabled = process.env.NEXT_PUBLIC_ENABLE_PWA !== "false";

    if (!isPWAEnabled) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
      return;
    }

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("PWA Service Worker registered:", registration.scope);
          void registration.update();
        })
        .catch((error) => {
          console.warn("PWA Service Worker registration failed:", error);
        });
    };

    if (document.readyState === "complete" || document.readyState === "interactive") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
