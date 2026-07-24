import type { ReactNode } from "react";
import type { AuthenticatedSession } from "@/lib/auth/types";
import { LogoutButton } from "@/components/auth/logout-button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { appConfig } from "@/config/app";
import { DynamicDashboardLogo } from "../shared/dynamic-dashboard-logo";

export function DashboardShell({
  children,
}: {
  session: AuthenticatedSession;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[var(--bg-app)] text-[var(--text-main)] transition-colors duration-200">
      <header className="sticky top-0 z-20 border-b border-[var(--border-color)] bg-[var(--card-bg)]/95 px-4 shadow-xs backdrop-blur-md transition-colors duration-200">
        <div className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative size-14 shrink-0 sm:size-16">
              <DynamicDashboardLogo
                alt={`شعار ${appConfig.centerName}`}
                sizes="64px"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-3 py-5 sm:px-6 sm:py-6">
        {children}
      </main>
    </div>
  );
}
