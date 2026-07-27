"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function logout() {
    setIsPending(true);
    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

    if (!isOffline) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "same-origin",
        });
      } catch {
        // Ignore network errors on logout fetch
      }
    }

    // Perform local logout without wiping saved offline profiles/caches
    const targetUrl = isOffline ? "/login?offlineLogout=1" : "/login";
    router.replace(targetUrl);
    router.refresh();
    setIsPending(false);
  }

  return (
    <button
      type="button"
      onClick={() => void logout()}
      disabled={isPending}
      className="rounded-2xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3.5 py-2 text-xs font-black text-[var(--status-danger-text)] transition hover:opacity-90 disabled:opacity-60"
    >
      {isPending ? "جاري الخروج..." : "تسجيل الخروج"}
    </button>
  );
}
