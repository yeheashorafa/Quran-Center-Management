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
          <div className="flex items-center gap-3 min-w-0">
            <BrandMark compact />
            <div className="min-w-0 hidden sm:block">
              <p className="truncate text-sm font-black text-emerald-950">
                {session.user.displayName}
              </p>
              <p className="truncate text-xs font-bold text-slate-500">{session.role.nameAr}</p>
            </div>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
