"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { StudentProfileData } from "@/lib/students/types";

type ApiMessage = { message?: string };
type Notice = { type: "success" | "error"; text: string } | null;

const ENROLLMENT_STATUS_LABELS = {
  ACTIVE: "نشط",
  COMPLETED: "مكتمل",
  TRANSFERRED: "تم النقل",
  WITHDRAWN: "منسحب",
  INACTIVE: "متوقف",
} as const;

function todayInputValue(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function readApiMessage(response: Response): Promise<string> {
  const data = (await response.json().catch(() => ({}))) as ApiMessage;
  return data.message || (response.ok ? "تمت العملية بنجاح." : "تعذر تنفيذ العملية.");
}

export function StudentProfilePanel({ data }: { data: StudentProfileData }) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  function showNotice(type: "success" | "error", text: string) {
    setNotice({ type, text });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setBusyKey("profile");
    setNotice(null);

    try {
      const response = await fetch(`/api/manager/students/${data.student.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formData.get("fullName"),
          displayName: formData.get("displayName"),
          parentPhone: formData.get("parentPhone"),
          gradeLevel: formData.get("gradeLevel"),
          memorizationStartedOn: formData.get("memorizationStartedOn"),
          notes: formData.get("notes"),
        }),
      });
      const message = await readApiMessage(response);
      if (!response.ok) throw new Error(message);
      showNotice("success", message);
      router.refresh();
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "تعذر تحديث ملف الطالب.");
    } finally {
      setBusyKey(null);
    }
  }

  async function updateStatus(isActive: boolean) {
    const action = isActive ? "تفعيل" : "إيقاف";
    if (!window.confirm(`هل تريد ${action} ملف الطالب؟`)) return;

    setBusyKey("status");
    setNotice(null);
    try {
      const response = await fetch(`/api/manager/students/${data.student.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive, effectiveOn: todayInputValue() }),
      });
      const message = await readApiMessage(response);
      if (!response.ok) throw new Error(message);
      showNotice("success", message);
      router.refresh();
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "تعذر تحديث حالة الطالب.");
    } finally {
      setBusyKey(null);
    }
  }

  async function createEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setBusyKey("enrollment");
    setNotice(null);

    try {
      const response = await fetch(`/api/manager/students/${data.student.id}/enrollments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          halaqaId: formData.get("halaqaId"),
          startedOn: formData.get("startedOn"),
        }),
      });
      const message = await readApiMessage(response);
      if (!response.ok) throw new Error(message);
      form.reset();
      showNotice("success", message);
      router.refresh();
    } catch (error) {
      showNotice("error", error instanceof Error ? error.message : "تعذر تسجيل الطالب في الحلقة.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-5">
      {notice ? (
        <div
          role="status"
          className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
            notice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <SummaryCard value={data.summary.attendanceRecords} label="سجل تسميع" />
        <SummaryCard value={data.summary.officialExams} label="اختبار رسمي" />
        <SummaryCard value={data.summary.transfers} label="عملية نقل" />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <section className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-xs font-bold text-emerald-700">بيانات الطالب</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">تعديل الملف</h2>

          <form className="mt-5 space-y-4" onSubmit={updateProfile}>
            <div>
              <label className="form-label" htmlFor="profile-full-name">الاسم الكامل</label>
              <input
                className="form-control"
                id="profile-full-name"
                name="fullName"
                defaultValue={data.student.fullName}
                required
              />
            </div>
            <div>
              <label className="form-label" htmlFor="profile-display-name">اسم العرض</label>
              <input
                className="form-control"
                id="profile-display-name"
                name="displayName"
                defaultValue={data.student.displayName}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="form-label" htmlFor="profile-parent-phone">هاتف ولي الأمر</label>
                <input
                  className="form-control"
                  id="profile-parent-phone"
                  name="parentPhone"
                  inputMode="tel"
                  defaultValue={data.student.parentPhone || ""}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="profile-grade-level">الصف الدراسي</label>
                <input
                  className="form-control"
                  id="profile-grade-level"
                  name="gradeLevel"
                  defaultValue={data.student.gradeLevel || ""}
                />
              </div>
            </div>
            <div>
              <label className="form-label" htmlFor="profile-started-on">تاريخ بداية الحفظ</label>
              <input
                className="form-control"
                id="profile-started-on"
                name="memorizationStartedOn"
                type="date"
                defaultValue={data.student.memorizationStartedOn || ""}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="profile-notes">ملاحظات</label>
              <textarea
                className="form-control min-h-28 resize-y"
                id="profile-notes"
                name="notes"
                defaultValue={data.student.notes || ""}
              />
            </div>
            <button
              className="min-h-12 w-full rounded-2xl bg-emerald-800 px-4 font-black text-white transition hover:bg-emerald-900 disabled:opacity-60"
              disabled={busyKey !== null}
            >
              {busyKey === "profile" ? "جاري الحفظ..." : "حفظ تعديلات الملف"}
            </button>
          </form>
        </section>

        <div className="space-y-5">
          <section className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-emerald-700">الحالة الحالية</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">التسجيل النشط</h2>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-black ${
                  data.student.isActive
                    ? "bg-emerald-100 text-emerald-900"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {data.student.isActive ? "ملف نشط" : "ملف متوقف"}
              </span>
            </div>

            {data.activeEnrollment ? (
              <div className="mt-4 rounded-2xl bg-emerald-50 p-4">
                <h3 className="font-black text-emerald-950">{data.activeEnrollment.halaqa.nameAr}</h3>
                <p className="mt-1 text-sm font-bold text-emerald-800">
                  {data.activeEnrollment.halaqa.stageName}
                  {data.activeEnrollment.halaqa.teacherName
                    ? ` — ${data.activeEnrollment.halaqa.teacherName}`
                    : ""}
                </p>
                <p className="mt-2 text-xs text-emerald-700">
                  مسجل منذ {data.activeEnrollment.startedOn}
                </p>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-4 text-sm font-bold text-slate-500">
                لا يوجد تسجيل نشط للطالب.
              </div>
            )}

            <button
              className={`mt-4 min-h-11 w-full rounded-xl border px-4 text-sm font-black transition disabled:opacity-60 ${
                data.student.isActive
                  ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                  : "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
              }`}
              disabled={busyKey !== null}
              onClick={() => updateStatus(!data.student.isActive)}
              type="button"
            >
              {busyKey === "status"
                ? "جاري التحديث..."
                : data.student.isActive
                  ? "إيقاف الملف وإنهاء التسجيل النشط"
                  : "إعادة تفعيل ملف الطالب"}
            </button>
          </section>

          {!data.activeEnrollment && data.student.isActive ? (
            <section className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
              <p className="text-xs font-bold text-emerald-700">تسجيل جديد</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">تسجيل الطالب في حلقة</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                هذه العملية مخصصة للطالب غير المسجل حالياً. تغيير الحلقة سيتم لاحقاً من شاشة النقل.
              </p>

              <form className="mt-4 space-y-4" onSubmit={createEnrollment}>
                <div>
                  <label className="form-label" htmlFor="profile-halaqa">الحلقة</label>
                  <select
                    className="form-control"
                    id="profile-halaqa"
                    name="halaqaId"
                    defaultValue=""
                    required
                  >
                    <option value="">-- اختر الحلقة --</option>
                    {data.availableHalaqat.map((halaqa) => (
                      <option key={halaqa.id} value={halaqa.id}>
                        {halaqa.stageName} — {halaqa.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label" htmlFor="profile-enrollment-start">تاريخ التسجيل</label>
                  <input
                    className="form-control"
                    id="profile-enrollment-start"
                    name="startedOn"
                    type="date"
                    defaultValue={todayInputValue()}
                    required
                  />
                </div>
                <button
                  className="min-h-11 w-full rounded-xl bg-emerald-800 px-4 text-sm font-black text-white transition hover:bg-emerald-900 disabled:opacity-60"
                  disabled={busyKey !== null || !data.availableHalaqat.length}
                >
                  {busyKey === "enrollment" ? "جاري التسجيل..." : "تسجيل الطالب"}
                </button>
              </form>
            </section>
          ) : null}
        </div>
      </div>

      <section className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-emerald-700">السجل التاريخي</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">تسجيلات الطالب</h2>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-900">
            {data.enrollmentHistory.length}
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {data.enrollmentHistory.length ? (
            data.enrollmentHistory.map((enrollment) => (
              <article key={enrollment.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-slate-950">{enrollment.halaqa.nameAr}</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {enrollment.halaqa.stageName}
                      {enrollment.halaqa.teacherName ? ` — ${enrollment.halaqa.teacherName}` : ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                    {ENROLLMENT_STATUS_LABELS[enrollment.status]}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-3">من: <strong>{enrollment.startedOn}</strong></div>
                  <div className="rounded-xl bg-slate-50 p-3">إلى: <strong>{enrollment.endedOn || "مستمر"}</strong></div>
                </div>
                {enrollment.endReason ? (
                  <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">
                    {enrollment.endReason}
                  </p>
                ) : null}
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm font-bold text-slate-500">
              لا يوجد سجل تسجيلات بعد.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ value, label }: { value: number; label: string }) {
  return (
    <article className="rounded-2xl border border-emerald-100 bg-white p-3 text-center shadow-sm sm:p-4">
      <div className="text-2xl font-black text-emerald-900 sm:text-3xl">{value}</div>
      <div className="mt-1 text-[11px] font-bold text-slate-500 sm:text-xs">{label}</div>
    </article>
  );
}
