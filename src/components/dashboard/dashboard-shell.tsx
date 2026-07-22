import type { ReactNode } from "react";
import type { AuthenticatedSession } from "@/lib/auth/types";
import { BrandMark } from "@/components/shared/brand-mark";
import { LogoutButton } from "@/components/auth/logout-button";

export function DashboardShell({
  session,
  children,
}: {
  session: AuthenticatedSession;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[var(--page-background)]">
      <header className="sticky top-0 z-20 border-b border-emerald-950/10 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-[var(--brand-green)]">مركز سيد الشهداء حمزة</p>
            <p className="truncate text-xs text-slate-500">
              {session.user.displayName} — {session.role.nameAr}
            </p>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-6 rounded-3xl border border-white bg-white p-4 shadow-sm sm:p-5">
          <BrandMark compact />
        </div>
        {children}
      </main>
    </div>
  );
}
