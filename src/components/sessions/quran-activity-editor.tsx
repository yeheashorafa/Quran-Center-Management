"use client";

import { useMemo, useState } from "react";
import { QURAN_SURAHS, calculateAyahPageCount } from "@/lib/quran/metadata";
import { QURAN_JUZS, getJuzLabel } from "@/lib/quran/juz-metadata";
import type { SessionActivityCode } from "@/lib/memorization-sessions/types";

export type SurahEntry = {
  id: string;
  surahNumber: number;
  fromAyah: number;
  toAyah: number;
  pageCount: number;
};

export type JuzEntry = {
  id: string;
  juzNumber: number;
};

const ACTIVITY_LABELS: Record<
  SessionActivityCode,
  {
    label: string;
    icon: string;
    colorClass: string;
    bgClass: string;
    borderClass: string;
  }
> = {
  MEMORIZATION: {
    label: "حفظ جديد",
    icon: "🟢",
    colorClass: "text-emerald-700 dark:text-emerald-300",
    bgClass: "bg-emerald-50/50 dark:bg-emerald-950/20",
    borderClass: "border-emerald-200 dark:border-emerald-800/40",
  },
  REVIEW: {
    label: "مراجعة",
    icon: "🔵",
    colorClass: "text-blue-700 dark:text-blue-300",
    bgClass: "bg-blue-50/50 dark:bg-blue-950/20",
    borderClass: "border-blue-200 dark:border-blue-800/40",
  },
  RECITATION: {
    label: "سرد",
    icon: "🟣",
    colorClass: "text-purple-700 dark:text-purple-300",
    bgClass: "bg-purple-50/50 dark:bg-purple-950/20",
    borderClass: "border-purple-200 dark:border-purple-800/40",
  },
};

export function parseSurahEntriesFromText(text: string): SurahEntry[] {
  if (!text || !text.trim()) return [];
  const parts = text.split("|").map((p) => p.trim());
  const entries: SurahEntry[] = [];

  parts.forEach((part) => {
    const surahMatch = QURAN_SURAHS.find((s) => part.includes(s.nameAr));
    if (!surahMatch) return;

    let fromAyah = 1;
    let toAyah = surahMatch.totalAyahs;

    const rangeMatch =
      part.match(/\((\d+)\s*-\s*(\d+)\)/) ||
      part.match(/من\s*(\d+)\s*إلى\s*(\d+)/);
    if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
      fromAyah = Number(rangeMatch[1]);
      toAyah = Number(rangeMatch[2]);
    }

    const validFrom = Math.max(1, Math.min(fromAyah, surahMatch.totalAyahs));
    const validTo = Math.max(validFrom, Math.min(toAyah, surahMatch.totalAyahs));
    const pageCount = calculateAyahPageCount(
      surahMatch.number,
      validFrom,
      validTo,
    );

    entries.push({
      id: `surah-entry-${surahMatch.number}-${Math.random().toString(36).substring(2, 7)}`,
      surahNumber: surahMatch.number,
      fromAyah,
      toAyah,
      pageCount,
    });
  });

  return entries;
}

export function formatSurahEntriesToText(entries: SurahEntry[]): {
  text: string;
  pageCount: number;
} {
  if (!entries.length) return { text: "", pageCount: 0 };

  let totalPages = 0;
  const formattedParts: string[] = [];

  for (const entry of entries) {
    const surah =
      QURAN_SURAHS.find((s) => s.number === entry.surahNumber) ??
      QURAN_SURAHS[0]!;

    const numFrom = Number(entry.fromAyah);
    const numTo = Number(entry.toAyah);

    const isValid =
      !isNaN(numFrom) &&
      !isNaN(numTo) &&
      numFrom >= 1 &&
      numFrom <= surah.totalAyahs &&
      numTo >= 1 &&
      numTo <= surah.totalAyahs &&
      numFrom <= numTo;

    if (isValid) {
      const pages = calculateAyahPageCount(entry.surahNumber, numFrom, numTo);
      totalPages += pages;

      if (numFrom === 1 && numTo === surah.totalAyahs) {
        formattedParts.push(`سورة ${surah.nameAr} (كاملة)`);
      } else {
        formattedParts.push(`سورة ${surah.nameAr} (${numFrom} - ${numTo})`);
      }
    } else {
      formattedParts.push(`سورة ${surah.nameAr} (${entry.fromAyah} - ${entry.toAyah})`);
    }
  }

  return {
    text: formattedParts.join(" | "),
    pageCount: Number(totalPages.toFixed(1)),
  };
}

export function parseJuzEntriesFromText(text: string): JuzEntry[] {
  if (!text || !text.trim()) return [];
  const parts = text.split("،").map((p) => p.trim());
  const entries: JuzEntry[] = [];
  const seen = new Set<number>();

  parts.forEach((part) => {
    const match = part.match(/الجزء\s*(\d+)/);
    if (match && match[1]) {
      const num = Number(match[1]);
      if (num >= 1 && num <= 30 && !seen.has(num)) {
        seen.add(num);
        entries.push({
          id: `juz-entry-${num}-${Math.random().toString(36).substring(2, 7)}`,
          juzNumber: num,
        });
      }
    }
  });

  return entries;
}

export function formatJuzEntriesToText(entries: JuzEntry[]): {
  text: string;
  pageCount: number;
} {
  if (!entries.length) return { text: "", pageCount: 0 };

  const formattedParts = entries.map((entry) => getJuzLabel(entry.juzNumber));
  const totalPages = entries.length * 20;

  return {
    text: formattedParts.join("، "),
    pageCount: totalPages,
  };
}

/**
 * Editor for Memorization (حفظ جديد) and Review (مراجعة) supporting multiple surahs per activity
 */
export function SurahActivityEditor({
  activity,
  onChange,
}: {
  activity: { type: SessionActivityCode; text: string; pageCount: number };
  onChange: (text: string, pageCount: number) => void;
}) {
  const meta = ACTIVITY_LABELS[activity.type];

  const [entries, setEntries] = useState<SurahEntry[]>(() => {
    const parsed = parseSurahEntriesFromText(activity.text);
    if (parsed.length > 0) return parsed;
    const defaultSurahNum = activity.type === "MEMORIZATION" ? 78 : 2;
    const surah =
      QURAN_SURAHS.find((s) => s.number === defaultSurahNum) ?? QURAN_SURAHS[0]!;
    return [
      {
        id: `surah-init-${surah.number}-${Date.now()}`,
        surahNumber: surah.number,
        fromAyah: 1,
        toAyah: surah.totalAyahs,
        pageCount: calculateAyahPageCount(surah.number, 1, surah.totalAyahs),
      },
    ];
  });

  function notifyChange(newEntries: SurahEntry[]) {
    setEntries(newEntries);
    const { text, pageCount } = formatSurahEntriesToText(newEntries);
    onChange(text, pageCount);
  }

  function handleAddSurah() {
    const defaultSurahNum = activity.type === "MEMORIZATION" ? 78 : 2;
    const surah =
      QURAN_SURAHS.find((s) => s.number === defaultSurahNum) ?? QURAN_SURAHS[0]!;
    const newEntry: SurahEntry = {
      id: `surah-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      surahNumber: surah.number,
      fromAyah: 1,
      toAyah: surah.totalAyahs,
      pageCount: calculateAyahPageCount(surah.number, 1, surah.totalAyahs),
    };
    notifyChange([...entries, newEntry]);
  }

  function handleRemoveSurah(id: string) {
    const updated = entries.filter((e) => e.id !== id);
    notifyChange(updated);
  }

  function handleSurahChange(id: string, surahNum: number) {
    const surah =
      QURAN_SURAHS.find((s) => s.number === surahNum) ?? QURAN_SURAHS[0]!;
    const updated = entries.map((entry) => {
      if (entry.id !== id) return entry;
      const pages = calculateAyahPageCount(surahNum, 1, surah.totalAyahs);
      return {
        ...entry,
        surahNumber: surahNum,
        fromAyah: 1,
        toAyah: surah.totalAyahs,
        pageCount: pages,
      };
    });
    notifyChange(updated);
  }

  function handleFullSurah(id: string) {
    const updated = entries.map((entry) => {
      if (entry.id !== id) return entry;
      const surah =
        QURAN_SURAHS.find((s) => s.number === entry.surahNumber) ??
        QURAN_SURAHS[0]!;
      const pages = calculateAyahPageCount(
        surah.number,
        1,
        surah.totalAyahs,
      );
      return {
        ...entry,
        fromAyah: 1,
        toAyah: surah.totalAyahs,
        pageCount: pages,
      };
    });
    notifyChange(updated);
  }

  function handleAyahInputChange(id: string, field: "fromAyah" | "toAyah", value: number) {
    const updated = entries.map((entry) => {
      if (entry.id !== id) return entry;
      const surah =
        QURAN_SURAHS.find((s) => s.number === entry.surahNumber) ??
        QURAN_SURAHS[0]!;

      const newFrom = field === "fromAyah" ? value : entry.fromAyah;
      const newTo = field === "toAyah" ? value : entry.toAyah;

      const numFrom = Number(newFrom);
      const numTo = Number(newTo);

      let pages = 0;
      if (
        !isNaN(numFrom) &&
        !isNaN(numTo) &&
        numFrom >= 1 &&
        numFrom <= surah.totalAyahs &&
        numTo >= 1 &&
        numTo <= surah.totalAyahs &&
        numFrom <= numTo
      ) {
        pages = calculateAyahPageCount(surah.number, numFrom, numTo);
      }

      return {
        ...entry,
        fromAyah: newFrom,
        toAyah: newTo,
        pageCount: pages,
      };
    });
    notifyChange(updated);
  }

  const totalPagesSum = entries.reduce(
    (sum, e) => sum + Number(e.pageCount || 0),
    0,
  );

  return (
    <div
      className={`rounded-2xl border p-3.5 space-y-3.5 transition-colors duration-200 ${meta.bgClass} ${meta.borderClass}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-xs font-black flex items-center gap-1.5 ${meta.colorClass}`}
        >
          <span>{meta.icon}</span>
          <span>{meta.label} ({entries.length} سورة)</span>
        </span>

        <button
          type="button"
          onClick={handleAddSurah}
          className="rounded-xl bg-[var(--primary)] px-3 py-1.5 text-xs font-black text-white shadow-xs hover:bg-[var(--primary-dark)] transition"
        >
          ➕ إضافة سورة أخرى
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="text-xs font-bold text-[var(--text-muted)] text-center py-2">
          لم تضف أي سورة بعد. اضغط &quot;إضافة سورة أخرى&quot; لتسجيل الإنجاز.
        </p>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, index) => {
            const surah =
              QURAN_SURAHS.find((s) => s.number === entry.surahNumber) ??
              QURAN_SURAHS[0]!;

            const numFrom = Number(entry.fromAyah);
            const numTo = Number(entry.toAyah);

            let validationError: string | null = null;
            if (isNaN(numFrom) || numFrom < 1 || numFrom > surah.totalAyahs) {
              validationError = `آية البداية (${entry.fromAyah}) خارج حدود سورة ${surah.nameAr} (1 - ${surah.totalAyahs}).`;
            } else if (isNaN(numTo) || numTo < 1 || numTo > surah.totalAyahs) {
              validationError = `آية النهاية (${entry.toAyah}) خارج حدود سورة ${surah.nameAr} (1 - ${surah.totalAyahs}).`;
            } else if (numFrom > numTo) {
              validationError = "آية البداية يجب أن تكون قبل آية النهاية.";
            }

            return (
              <div
                key={entry.id}
                className="rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-3 space-y-2 shadow-xs transition-colors duration-200"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-color)] pb-2">
                  <span className="text-[11px] font-black text-[var(--text-muted)]">
                    سورة رقم #{index + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleFullSurah(entry.id)}
                      className="rounded-lg bg-[var(--card-soft)] border border-[var(--border-color)] px-2 py-0.5 text-[11px] font-black text-[var(--text-main)] hover:bg-emerald-500/10 transition"
                    >
                      🎯 السورة كاملة
                    </button>
                    {entries.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveSurah(entry.id)}
                        className="rounded-lg bg-red-500/10 border border-red-500/30 px-2 py-0.5 text-[11px] font-black text-red-600 dark:text-red-400 hover:bg-red-500/20 transition"
                      >
                        🗑️ حذف هذه السورة
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {/* Surah Dropdown */}
                  <div>
                    <label className="text-[11px] font-bold text-[var(--text-muted)] block mb-1">
                      السورة:
                    </label>
                    <select
                      value={entry.surahNumber}
                      onChange={(e) =>
                        handleSurahChange(entry.id, Number(e.target.value))
                      }
                      className="form-control text-xs font-black"
                    >
                      {QURAN_SURAHS.map((s) => (
                        <option key={s.number} value={s.number}>
                          {s.number}. {s.nameAr} ({s.totalAyahs} آية)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* From Ayah */}
                  <div>
                    <label className="text-[11px] font-bold text-[var(--text-muted)] block mb-1">
                      من آية:
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={surah.totalAyahs}
                      value={entry.fromAyah}
                      onChange={(e) =>
                        handleAyahInputChange(
                          entry.id,
                          "fromAyah",
                          Number(e.target.value),
                        )
                      }
                      className="form-control text-xs font-black"
                    />
                  </div>

                  {/* To Ayah */}
                  <div>
                    <label className="text-[11px] font-bold text-[var(--text-muted)] block mb-1">
                      إلى آية:
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={surah.totalAyahs}
                      value={entry.toAyah}
                      onChange={(e) =>
                        handleAyahInputChange(
                          entry.id,
                          "toAyah",
                          Number(e.target.value),
                        )
                      }
                      className="form-control text-xs font-black"
                    />
                  </div>
                </div>

                {validationError ? (
                  <div className="rounded-lg border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-2 text-[11px] font-bold text-[var(--status-danger-text)]">
                    ⚠️ {validationError}
                  </div>
                ) : (
                  <div className="text-[11px] font-bold text-[var(--text-muted)] text-left">
                    صفحات هذه السورة:{" "}
                    <strong className="font-black text-[var(--text-main)]">
                      {entry.pageCount} ص
                    </strong>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between text-xs font-bold pt-1 text-[var(--text-main)] border-t border-[var(--border-color)]">
        <span>النص الإجمالي: {activity.text || "لم يحدد"}</span>
        <span className="rounded-md bg-[var(--card-bg)] px-2.5 py-1 font-black border border-[var(--border-color)] text-[var(--text-main)]">
          مجموع الصفحات: {totalPagesSum.toFixed(1)} ص
        </span>
      </div>
    </div>
  );
}

/**
 * Editor for Recitation (السرد) supporting Juz selection ONLY (الأجزاء فقط) with multi-juz support
 */
export function JuzActivityEditor({
  activity,
  onChange,
}: {
  activity: { type: SessionActivityCode; text: string; pageCount: number };
  onChange: (text: string, pageCount: number) => void;
}) {
  const meta = ACTIVITY_LABELS.RECITATION;
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);

  const juzOptionsDescending = useMemo(
    () => [...QURAN_JUZS].sort((a, b) => b.number - a.number),
    [],
  );

  const [entries, setEntries] = useState<JuzEntry[]>(() => {
    const parsed = parseJuzEntriesFromText(activity.text);
    if (parsed.length > 0) return parsed;
    return [
      {
        id: `juz-init-${Date.now()}`,
        juzNumber: 30,
      },
    ];
  });

  function notifyChange(newEntries: JuzEntry[]) {
    setEntries(newEntries);
    const { text, pageCount } = formatJuzEntriesToText(newEntries);
    onChange(text, pageCount);
  }

  function handleAddJuz() {
    setDuplicateNotice(null);
    const usedJuzs = new Set(entries.map((e) => e.juzNumber));
    const available = juzOptionsDescending.find((j) => !usedJuzs.has(j.number));

    if (!available) {
      setDuplicateNotice("تم إضافة جميع الأجزاء الـ 30 لهذا الطالب!");
      return;
    }

    const newEntry: JuzEntry = {
      id: `juz-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      juzNumber: available.number,
    };
    notifyChange([...entries, newEntry]);
  }

  function handleRemoveJuz(id: string) {
    setDuplicateNotice(null);
    const updated = entries.filter((e) => e.id !== id);
    notifyChange(updated);
  }

  function handleJuzChange(id: string, newJuzNumber: number) {
    setDuplicateNotice(null);
    const isDuplicate = entries.some(
      (e) => e.id !== id && e.juzNumber === newJuzNumber,
    );

    if (isDuplicate) {
      setDuplicateNotice(
        `تنبيه: ${getJuzLabel(newJuzNumber)} مضاف مسبقاً لهذا الطالب.`,
      );
      return;
    }

    const updated = entries.map((entry) =>
      entry.id === id ? { ...entry, juzNumber: newJuzNumber } : entry,
    );
    notifyChange(updated);
  }

  const totalPagesSum = entries.length * 20;

  return (
    <div
      className={`rounded-2xl border p-3.5 space-y-3.5 transition-colors duration-200 ${meta.bgClass} ${meta.borderClass}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-xs font-black flex items-center gap-1.5 ${meta.colorClass}`}
        >
          <span>{meta.icon}</span>
          <span>{meta.label} - الأجزاء ({entries.length} جزء)</span>
        </span>

        <button
          type="button"
          onClick={handleAddJuz}
          className="rounded-xl bg-purple-700 dark:bg-purple-600 px-3 py-1.5 text-xs font-black text-white shadow-xs hover:bg-purple-800 transition"
        >
          ➕ إضافة جزء آخر
        </button>
      </div>

      {duplicateNotice ? (
        <div className="rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-2 text-xs font-bold text-[var(--status-warning-text)]">
          ⚠️ {duplicateNotice}
        </div>
      ) : null}

      {entries.length === 0 ? (
        <p className="text-xs font-bold text-[var(--text-muted)] text-center py-2">
          لم تضف أي جزء بعد. اضغط &quot;إضافة جزء آخر&quot; لتسجيل السرد.
        </p>
      ) : (
        <div className="space-y-2.5">
          {entries.map((entry, index) => (
            <div
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--card-bg)] p-2.5 shadow-xs transition-colors duration-200"
            >
              <div className="flex items-center gap-2 flex-1 min-w-48">
                <span className="text-[11px] font-black text-[var(--text-muted)] shrink-0">
                  الجزء #{index + 1}:
                </span>
                <select
                  value={entry.juzNumber}
                  onChange={(e) =>
                    handleJuzChange(entry.id, Number(e.target.value))
                  }
                  className="form-control text-xs font-black flex-1"
                >
                  {juzOptionsDescending.map((j) => (
                    <option key={j.number} value={j.number}>
                      {getJuzLabel(j.number)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-[var(--text-muted)]">
                  20 ص
                </span>
                {entries.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => handleRemoveJuz(entry.id)}
                    className="rounded-lg bg-red-500/10 border border-red-500/30 px-2 py-1 text-[11px] font-black text-red-600 dark:text-red-400 hover:bg-red-500/20 transition"
                  >
                    🗑️ حذف هذا الجزء
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-xs font-bold pt-1 text-[var(--text-main)] border-t border-[var(--border-color)]">
        <span>النص الإجمالي: {activity.text || "لم يحدد"}</span>
        <span className="rounded-md bg-[var(--card-bg)] px-2.5 py-1 font-black border border-[var(--border-color)] text-[var(--text-main)]">
          مجموع السرد: {entries.length} جزء ({totalPagesSum} ص)
        </span>
      </div>
    </div>
  );
}
