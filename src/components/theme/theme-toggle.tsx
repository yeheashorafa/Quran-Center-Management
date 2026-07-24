"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme/theme-provider";

const emptySubscribe = () => () => {};

export function ThemeToggle({
  showLabel = false,
  className = "",
}: {
  showLabel?: boolean;
  className?: string;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  if (!mounted) {
    // Return placeholder during SSR to prevent hydration mismatch
    return (
      <div
        className={`flex items-center justify-center size-10 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] ${className}`}
        aria-hidden="true"
      />
    );
  }

  const cycleTheme = () => {
    if (resolvedTheme === "dark") {
      setTheme("light");
    } else {
      setTheme("dark");
    }
  };

  const getLabel = () => {
    if (resolvedTheme === "dark") return "المظهر الداكن";
    return "المظهر الفاتح";
  };

  return (
    <button
      type="button"
      onClick={cycleTheme}
      title={`النمط الحالي: ${getLabel()} (اضغط للتغيير)`}
      aria-label={`تبديل الثيم: ${getLabel()}`}
      className={`group relative flex items-center justify-center gap-2 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-2 text-[var(--text-main)] shadow-xs transition hover:border-[var(--primary)] hover:bg-[var(--card-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${className}`}
    >
      <div className="relative flex size-5 items-center justify-center text-[var(--gold)] transition group-hover:scale-110">
        {resolvedTheme === "dark" ? (
          <Moon className="size-5 transition-transform duration-300" />
        ) : (
          <Sun className="size-5 transition-transform duration-300" />
        )}
      </div>

      {showLabel ? (
        <span className="text-xs font-bold text-[var(--text-main)]">{getLabel()}</span>
      ) : null}
    </button>
  );
}
