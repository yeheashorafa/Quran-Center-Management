"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { ManagerStageOption } from "@/lib/manager/types";
import type { StudentHalaqaOption } from "@/lib/students/types";
import type {
  FollowUpReason,
  FollowUpSeverity,
  StudentFollowUpData,
} from "@/lib/student-follow-up/types";

import { ParentReportModal } from "@/components/reports/parent-report-modal";
import type { ParentReportData } from "@/lib/reports/parent-report-types";

const SEVERITY_STYLES: Record<FollowUpSeverity, string> = {
  HIGH: "border-red-200 bg-red-50 text-red-800",
  MEDIUM: "border-amber-200 bg-amber-50 text-amber-900",
  LOW: "border-blue-200 bg-blue-50 text-blue-800",
};

function subtractDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function formatPages(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function highestSeverity(reasons: FollowUpReason[]): FollowUpSeverity {
  if (reasons.some((item) => item.severity === "HIGH")) return "HIGH";
  if (reasons.some((item) => item.severity === "MEDIUM")) return "MEDIUM";
  return "LOW";
}

export function StudentFollowUpPanel({
  initialDate,
  stages,
  halaqat,
}: {
  initialDate: string;
  stages: ManagerStageOption[];
  halaqat: StudentHalaqaOption[];
}) {
  const [from, setFrom] = useState(subtractDays(initialDate, 30));
  const [to, setTo] = useState(initialDate);
  const [stageId, setStageId] = useState("");
  const [halaqaId, setHalaqaId] = useState("");
  const [attendanceThreshold, setAttendanceThreshold] = useState(70);
  const [data, setData] = useState<StudentFollowUpData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeParentReport, setActiveParentReport] = useState<ParentReportData | null>(null);
  const [fetchingReportId, setFetchingReportId] = useState<string | null>(null);

  async function openParentReport(studentId: string) {
    setFetchingReportId(studentId);
    try {
      const month = to.slice(0, 7);
      const response = await fetch(`/api/reports/parent?studentId=${studentId}&month=${month}`);
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.message || "تعذر فتح تقرير ولي الأمر.");
      setActiveParentReport(json.data as ParentReportData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء فتح التقرير.");
    } finally {
      setFetchingReportId(null);
    }
  }

  const visibleHalaqatList = useMemo(() => {
    if (!stageId) return halaqat;
    const stageName = stages.find((stage) => stage.id === stageId)?.nameAr;
    return halaqat.filter((halaqa) => halaqa.stageName === stageName);
  }, [halaqat, stageId, stages]);

  async function load(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        from,
        to,
        attendanceThreshold: String(attendanceThreshold),
      });
      if (stageId) params.set("stageId", stageId);
      if (halaqaId) params.set("halaqaId", halaqaId);
      const response = await fetch(`/api/manager/follow-up?${params.toString()}`);
      const payload = (await response.json().catch(() => ({}))) as {
        data?: StudentFollowUpData;
        message?: string;
      };
      if (!response.ok || !payload.data) throw new Error(payload.message || "تعذر تحميل قائمة المتابعة.");
      setData(payload.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر تحميل قائمة المتابعة.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
    // Initial load only; filters are applied explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeStage(value: string) {
    setStageId(value);
    setHalaqaId("");
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-xs font-bold text-emerald-700">تحليل الحضور والإنجاز</p>
        <h2 className="mt-1 text-xl font-black text-slate-950">طلاب يحتاجون متابعة</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          يعتمد التحليل على الغياب المتكرر، الغياب المتتالي، «لم يسمع»، انخفاض الحضور، والحضور دون إنجاز مسجل.
        </p>

        <form className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={load}>
          <div>
            <label className="form-label" htmlFor="follow-from">من تاريخ</label>
            <input id="follow-from" className="form-control" type="date" value={from} onChange={(event) => setFrom(event.target.value)} required />
          </div>
          <div>
            <label className="form-label" htmlFor="follow-to">إلى تاريخ</label>
            <input id="follow-to" className="form-control" type="date" value={to} onChange={(event) => setTo(event.target.value)} required />
          </div>
          <div>
            <label className="form-label" htmlFor="follow-threshold">حد نسبة الحضور</label>
            <select id="follow-threshold" className="form-control" value={attendanceThreshold} onChange={(event) => setAttendanceThreshold(Number(event.target.value))}>
              <option value={60}>أقل من 60%</option>
              <option value={70}>أقل من 70%</option>
              <option value={80}>أقل من 80%</option>
              <option value={90}>أقل من 90%</option>
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="follow-stage">المرحلة</label>
            <select id="follow-stage" className="form-control" value={stageId} onChange={(event) => changeStage(event.target.value)}>
              <option value="">كل المراحل</option>
              {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.nameAr}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="follow-halaqa">الحلقة</label>
            <select id="follow-halaqa" className="form-control" value={halaqaId} onChange={(event) => setHalaqaId(event.target.value)}>
              <option value="">كل الحلقات</option>
              {visibleHalaqatList.map((halaqa) => <option key={halaqa.id} value={halaqa.id}>{halaqa.nameAr}</option>)}
            </select>
          </div>
          <button className="min-h-12 self-end rounded-2xl bg-emerald-800 px-5 text-sm font-black text-white hover:bg-emerald-900 disabled:opacity-60" disabled={loading}>{loading ? "جاري التحليل..." : "تحليل الفترة"}</button>
        </form>
        {error ? <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">{error}</div> : null}
      </section>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric value={data?.summary.studentsNeedingFollowUp ?? 0} label="بحاجة متابعة" />
        <Metric value={data?.summary.highPriority ?? 0} label="أولوية عالية" danger />
        <Metric value={data?.summary.mediumPriority ?? 0} label="أولوية متوسطة" warning />
        <Metric value={data?.summary.lowPriority ?? 0} label="أولوية منخفضة" />
      </div>

      <section className="space-y-3">
        {loading && !data ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500">جاري تحليل بيانات الطلاب...</div>
        ) : data?.students.length ? data.students.map((student) => {
          const severity = highestSeverity(student.reasons);
          return (
            <article key={student.studentId} className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-black text-slate-950">{student.displayName}</h3>
                    <span className={`rounded-full border px-3 py-1 text-[10px] font-black ${SEVERITY_STYLES[severity]}`}>{severity === "HIGH" ? "أولوية عالية" : severity === "MEDIUM" ? "أولوية متوسطة" : "أولوية منخفضة"}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{student.currentHalaqa ? `${student.currentHalaqa.stageName} — ${student.currentHalaqa.nameAr}` : "لا يوجد تسجيل مرتبط ضمن الفترة"}</p>
                  {student.parentPhone ? <p className="mt-1 text-xs font-bold text-slate-500" dir="ltr">{student.parentPhone}</p> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={fetchingReportId === student.studentId}
                    onClick={() => openParentReport(student.studentId)}
                    className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-950 transition hover:bg-emerald-100 disabled:opacity-50"
                  >
                    {fetchingReportId === student.studentId ? "جاري..." : "📜 تقرير ولي الأمر"}
                  </button>
                  <a href={`/manager/students/${student.studentId}`} className="rounded-xl bg-emerald-900 px-4 py-2 text-xs font-black text-white hover:bg-emerald-950">فتح ملف الطالب</a>
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                <Info label="الجلسات" value={student.metrics.recordedSessions} />
                <Info label="الحضور" value={student.metrics.present} />
                <Info label="الغياب" value={student.metrics.absent} danger />
                <Info label="لم يسمع" value={student.metrics.notHeard} />
                <Info label="نسبة الحضور" value={`${student.metrics.attendanceRate}%`} danger={student.metrics.attendanceRate < attendanceThreshold} />
                <Info label="إجمالي الصفحات" value={formatPages(student.metrics.totalPages)} />
              </dl>

              <div className="mt-4 flex flex-wrap gap-2">
                {student.reasons.map((item) => (
                  <span key={item.code} title={item.detail} className={`rounded-full border px-3 py-1.5 text-xs font-black ${SEVERITY_STYLES[item.severity]}`}>{item.label}</span>
                ))}
              </div>

              <div className="mt-4 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                <p className="rounded-xl bg-slate-50 p-3">غياب متتالٍ: <strong>{student.metrics.consecutiveAbsences}</strong></p>
                <p className="rounded-xl bg-slate-50 p-3">حضور دون صفحات: <strong>{student.metrics.zeroPagePresentSessions}</strong></p>
                <p className="rounded-xl bg-slate-50 p-3">آخر سجل: <strong>{student.metrics.lastRecordDate ?? "—"}</strong></p>
              </div>
            </article>
          );
        }) : (
          <div className="rounded-3xl border border-dashed border-emerald-300 bg-emerald-50 p-8 text-center text-sm font-black text-emerald-900">لا يوجد طلاب تنطبق عليهم قواعد المتابعة في الفترة المحددة.</div>
        )}
      </section>

      {activeParentReport ? (
        <ParentReportModal data={activeParentReport} onClose={() => setActiveParentReport(null)} />
      ) : null}
    </div>
  );
}

function Metric({ value, label, danger, warning }: { value: number; label: string; danger?: boolean; warning?: boolean }) {
  return <article className={`rounded-2xl border p-4 text-center shadow-sm ${danger ? "border-red-200 bg-red-50" : warning ? "border-amber-200 bg-amber-50" : "border-emerald-100 bg-white"}`}><div className={`text-2xl font-black ${danger ? "text-red-800" : warning ? "text-amber-900" : "text-emerald-900"}`}>{value}</div><div className="mt-1 text-xs font-bold text-slate-500">{label}</div></article>;
}

function Info({ label, value, danger }: { label: string; value: number | string; danger?: boolean }) {
  return <div className={`rounded-xl p-3 text-center ${danger ? "bg-red-50" : "bg-slate-50"}`}><dt className="text-[10px] font-bold text-slate-500">{label}</dt><dd className={`mt-1 font-black ${danger ? "text-red-800" : "text-slate-800"}`}>{value}</dd></div>;
}
