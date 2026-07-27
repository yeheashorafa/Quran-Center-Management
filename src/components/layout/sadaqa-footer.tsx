import React from "react";

export function SadaqaFooter() {
  return (
    <footer className="mt-auto w-full max-w-full overflow-hidden border-t border-[var(--border-color)] px-4 py-3.5 text-center text-[11px] text-[var(--text-muted)] transition-colors duration-200">
      <div className="mx-auto max-w-4xl max-w-full space-y-1 break-words text-wrap">
        <p className="leading-relaxed">
          🤍 صدقة جارية عن روح الشهداء بإذن الله
        </p>
        <p className="font-semibold text-[var(--primary)] leading-normal">
          أبو فايز الشرفا · أبو أنس الشرفا · أبو المعتصم الزرد
        </p>
      </div>
    </footer>
  );
}
