"use client";

import { useEffect } from "react";

export function RegisterSW() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("PWA Service Worker registered:", registration.scope);
            // Check for service worker updates
            void registration.update();
          })
          .catch((error) => {
            console.warn("PWA Service Worker registration failed:", error);
          });
      });

      // Update SW when tab gains focus
      const handleVisibility = () => {
        if (document.visibilityState === "visible") {
          navigator.serviceWorker.getRegistration().then((reg) => {
            void reg?.update();
          });
        }
      };

      window.addEventListener("visibilitychange", handleVisibility);
      return () => window.removeEventListener("visibilitychange", handleVisibility);
    }
  }, []);

  return null;
}
