import type { ReactNode } from "react";
import type { AuthenticatedSession } from "@/lib/auth/types";
import { LogoutButton } from "@/components/auth/logout-button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import Image from "next/image";
import { appConfig } from "@/config/app";

export function DashboardShell({
  children,
}: {
  session: AuthenticatedSession;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[var(--bg-app)] text-[var(--text-main)] transition-colors duration-200">
      <header className="sticky top-0 z-20 border-b border-[var(--border-color)] bg-[var(--card-bg)]/90 px-4 shadow-xs backdrop-blur-md transition-colors duration-200">
        <div className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative size-14 shrink-0 sm:size-16">
              <Image
                src="/brand/logo.png"
                alt={`شعار ${appConfig.centerName}`}
                fill
                sizes="64px"
                className="object-contain"
              />
            </div>
            <div className="truncate">
              <h1 className="truncate text-sm font-black text-[var(--text-main)] sm:text-base">
                {appConfig.centerName}
              </h1>
              <p className="truncate text-[11px] font-bold text-[var(--gold)]">
                نظام متابعة التلاوة والتحفيظ
              </p>
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
