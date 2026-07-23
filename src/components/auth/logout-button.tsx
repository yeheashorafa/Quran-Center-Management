"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clearOfflineProfiles } from "@/lib/offline/offline-profile";
import { clearTeacherDataCache } from "@/lib/offline/teacher-cache";
import { clearExaminerDataCache } from "@/lib/offline/examiner-cache";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function logout() {
    setIsPending(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      }).catch(() => {});
      await clearOfflineProfiles();
      await clearTeacherDataCache();
      await clearExaminerDataCache();
    } finally {
      router.replace("/login");
      router.refresh();
      setIsPending(false);
    }
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
