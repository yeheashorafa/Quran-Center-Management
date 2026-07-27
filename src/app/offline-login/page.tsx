"use client";

import { useEffect } from "react";

export default function OfflineLoginPage() {
  useEffect(() => {
    window.location.replace("/offline-shell.html");
  }, []);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--bg-app)] text-[var(--text-main)] p-4" dir="rtl">
      <div className="text-center space-y-3">
        <div className="size-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent mx-auto" />
        <p className="text-sm font-bold text-[var(--text-muted)]">جاري التوجيه إلى شاشة الأوفلاين...</p>
      </div>
    </div>
  );
}
