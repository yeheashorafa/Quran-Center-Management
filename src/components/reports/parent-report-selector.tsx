"use client";

import { useMemo, useState } from "react";
import { todayInPalestine } from "@/lib/memorization-sessions/date";

export type StudentOption = {
  id: string;
  displayName: string;
  halaqaId?: string;
  halaqaName?: string;
  stageId?: string;
  stageName?: string;
};

export type StageOption = {
  id: string;
  nameAr: string;
};

export type HalaqaOption = {
  id: string;
  nameAr: string;
  stageId?: string | null;
  stageName?: string | null;
  teacherName?: string | null;
};

export function ParentReportSelector({
  students = [],
  stages = [],
  halaqat = [],
  title = "تنزيل تقرير ولي الأمر (PDF)",
  description = "اختر الطالب ثم حدد الشهر للتنزيل المباشر كملف PDF مخصص لولي الأمر.",
  defaultStudentId,
  hideStageFilter = false,
  hideTeacherFilter = false,
}: {
  students: StudentOption[];
  stages?: StageOption[];
  halaqat?: HalaqaOption[];
  title?: string;
  description?: string;
  defaultStudentId?: string;
  hideStageFilter?: boolean;
  hideTeacherFilter?: boolean;
}) {
  const [selectedStageId, setSelectedStageId] = useState("");
  const [selectedHalaqaId, setSelectedHalaqaId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState(defaultStudentId || "");
  const [selectedMonth, setSelectedMonth] = useState(todayInPalestine().slice(0, 7));
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const availableStages = useMemo(() => {
    if (stages.length > 0) return stages;
    const map = new Map<string, string>();
    for (const s of students) {
      const stageKey = s.stageId || s.stageName;
      if (stageKey && s.stageName) {
        map.set(stageKey, s.stageName);
      }
    }
    return Array.from(map.entries()).map(([id, nameAr]) => ({ id, nameAr }));
  }, [stages, students]);

  const availableHalaqat = useMemo(() => {
    if (halaqat.length > 0) {
      const selectedStageObj = stages.find((s) => s.id === selectedStageId);
      const selectedStageName = selectedStageObj?.nameAr || selectedStageId;
      return selectedStageId
        ? halaqat.filter((h) => h.stageId === selectedStageId || h.stageName === selectedStageName)
        : halaqat;
    }
    const map = new Map<string, { id: string; nameAr: string; stageId?: string; teacherName?: string | null }>();
    for (const s of students) {
      if (s.halaqaId && s.halaqaName) {
        const matchesStage =
          !selectedStageId || s.stageId === selectedStageId || s.stageName === selectedStageId;
        if (matchesStage) {
          map.set(s.halaqaId, { id: s.halaqaId, nameAr: s.halaqaName, stageId: s.stageId });
        }
      }
    }
    return Array.from(map.values());
  }, [halaqat, students, stages, selectedStageId]);

  const filteredStudents = useMemo(() => {
    const selectedStageObj = stages.find((s) => s.id === selectedStageId);
    const selectedStageName = selectedStageObj?.nameAr || selectedStageId;
    return students.filter((s) => {
      if (!hideStageFilter && selectedStageId) {
        const matchesStage = s.stageId === selectedStageId || s.stageName === selectedStageName;
        if (!matchesStage) return false;
      }
      if (!hideTeacherFilter && selectedHalaqaId && s.halaqaId && s.halaqaId !== selectedHalaqaId) return false;
      return true;
    });
  }, [students, stages, selectedStageId, selectedHalaqaId, hideStageFilter, hideTeacherFilter]);

  function handleStageChange(stageId: string) {
    setSelectedStageId(stageId);
    setSelectedHalaqaId("");
    setSelectedStudentId("");
  }

  function handleHalaqaChange(halaqaId: string) {
    setSelectedHalaqaId(halaqaId);
    setSelectedStudentId("");
  }

  function downloadPdf() {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("التقارير والتصدير تحتاج اتصالاً بالإنترنت.");
      return;
    }

    if (!selectedStudentId) {
      setError("اختر الطالب أولاً لتنزيل التقرير.");
      return;
    }

    setError(null);
    setSuccessNotice(null);

    const downloadUrl = `/api/reports/parent?studentId=${selectedStudentId}&month=${selectedMonth}&format=pdf`;
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = `تقرير_ولي_الأمر_${selectedMonth}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    setSuccessNotice("جاري تنزيل تقرير ولي الأمر PDF...");
  }

  const showHalaqaDropdown = !hideTeacherFilter && availableHalaqat.length > 1;

  return (
    <section
      className="rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-5 shadow-sm text-[var(--text-main)] transition-colors duration-200"
      dir="rtl"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold text-[var(--gold)]">تقارير أولياء الأمور (Online Only)</span>
          <h2 className="text-xl font-black text-[var(--text-main)]">{title}</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-3 text-xs font-bold text-[var(--status-danger-text)]">
          ⚠️ {error}
        </div>
      ) : null}

      {successNotice ? (
        <div className="mt-4 rounded-2xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-3 text-xs font-bold text-[var(--status-success-text)]">
          ✅ {successNotice}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {!hideStageFilter ? (
          <div>
            <label className="form-label" htmlFor="parent-report-stage">
              المرحلة
            </label>
            <select
              id="parent-report-stage"
              className="form-control font-bold"
              value={selectedStageId}
              onChange={(e) => handleStageChange(e.target.value)}
            >
              <option value="">كل المراحل</option>
              {availableStages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.nameAr}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {showHalaqaDropdown ? (
          <div>
            <label className="form-label" htmlFor="parent-report-halaqa">
              الشيخ / الحلقة
            </label>
            <select
              id="parent-report-halaqa"
              className="form-control font-bold"
              value={selectedHalaqaId}
              onChange={(e) => handleHalaqaChange(e.target.value)}
            >
              <option value="">كل الحلقات</option>
              {availableHalaqat.map((halaqa) => (
                <option key={halaqa.id} value={halaqa.id}>
                  {halaqa.nameAr}{halaqa.teacherName ? ` — ${halaqa.teacherName}` : ""}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <label className="form-label" htmlFor="parent-report-student">
            الطالب
          </label>
          <select
            id="parent-report-student"
            className="form-control font-bold"
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
          >
            <option value="">-- اختر الطالب --</option>
            {filteredStudents.map((student) => (
              <option key={student.id} value={student.id}>
                {student.displayName}
                {student.halaqaName ? ` (${student.halaqaName})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="form-label" htmlFor="parent-report-month">
            الشهر
          </label>
          <input
            id="parent-report-month"
            type="month"
            className="form-control font-bold"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-5">
        <button
          type="button"
          disabled={!selectedStudentId}
          onClick={downloadPdf}
          className="min-h-12 w-full rounded-2xl bg-[var(--primary)] px-5 text-sm font-black text-white shadow-sm transition hover:bg-[var(--primary-dark)] disabled:opacity-40"
        >
          📄 تنزيل تقرير ولي الأمر PDF
        </button>
      </div>
    </section>
  );
}
