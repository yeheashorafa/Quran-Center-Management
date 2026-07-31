"use client";

import type { ReactNode } from "react";

interface SectionHintProps {
  title?: string;
  description: string | ReactNode;
  className?: string;
}

export function SectionHint({ title, description, className = "" }: SectionHintProps) {
  return (
    <div
      className={`rounded-2xl border border-[var(--border-color)] bg-[var(--card-soft)] p-3 sm:p-4 text-[var(--text-main)] shadow-xs transition-colors duration-200 ${className}`}
      dir="rtl"
    >
      <div className="flex items-start gap-2.5">
        <span className="text-sm select-none shrink-0 mt-0.5" aria-hidden="true">
          💡
        </span>
        <div className="text-xs sm:text-sm font-semibold leading-relaxed text-[var(--text-muted)]">
          {title ? (
            <strong className="font-extrabold text-[var(--text-main)] ml-1.5">{title}:</strong>
          ) : null}
          {description}
        </div>
      </div>
    </div>
  );
}
