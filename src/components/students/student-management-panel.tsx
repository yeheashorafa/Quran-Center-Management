"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { ManagerStudentItem, StudentHalaqaOption } from "@/lib/students/types";

type ApiMessage = { message?: string };

type Notice = { type: "success" | "error"; text: string } | null;

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

export function StudentManagementPanel({
  students,
  halaqat,
}: {
  students: ManagerStudentItem[];
  halaqat: StudentHalaqaOption[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [query, setQuery] = useState("");
  const [halaqaFilter, setHalaqaFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  const filteredStudents = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ar");
    return students.filter((student) => {
      const matchesQuery =
        !normalizedQuery ||
        student.fullName.toLocaleLowerCase("ar").includes(normalizedQuery) ||
        student.displayName.toLocaleLowerCase("ar").includes(normalizedQuery) ||
        (student.parentPhone || "").includes(normalizedQuery);
      const matchesHalaqa =
        !halaqaFilter || student.activeEnrollment?.halaqa.id === halaqaFilter;
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" ? student.isActive : !student.isActive);
      return matchesQuery && matchesHalaqa && matchesStatus;
    });
  }, [halaqaFilter, query, statusFilter, students]);

  async function createStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setBusy(true);
    setNotice(null);

    try {
      const response = await fetch("/api/manager/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formData.get("fullName"),
          displayName: formData.get("displayName"),
          parentPhone: formData.get("parentPhone"),
          gradeLevel: formData.get("gradeLevel"),
          memorizationStartedOn: formData.get("memorizationStartedOn"),
          notes: formData.get("notes"),
          halaqaId: formData.get("halaqaId"),
          startedOn: formData.get("startedOn"),
        }),
      });

      const message = await readApiMessage(response);
      if (!response.ok) throw new Error(message);

      form.reset();
      setNotice({ type: "success", text: message });
      router.refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "تعذر إنشاء ملف الطالب.",
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setBusy(false);
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

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.45fr)]">
        <section className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-xs font-bold text-emerald-700">ملفات الطلاب</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">إضافة طالب وتسجيله</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            ينشأ ملف واحد ثابت للطالب، ثم يرتبط بالحَلَقة من خلال تسجيل مستقل.
          </p>

          {!halaqat.length ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
              يجب إنشاء حلقة نشطة أولاً قبل تسجيل الطلاب.
            </div>
          ) : null}

          <form className="mt-5 space-y-4" onSubmit={createStudent}>
            <div>
              <label className="form-label" htmlFor="student-full-name">الاسم الكامل</label>
              <input
                className="form-control"
                id="student-full-name"
                name="fullName"
                placeholder="الاسم الرباعي أو الكامل"
                required
              />
            </div>

            <div>
              <label className="form-label" htmlFor="student-display-name">اسم العرض</label>
              <input
                className="form-control"
                id="student-display-name"
                name="displayName"
                placeholder="اختياري، يستخدم الاسم الكامل تلقائياً"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="form-label" htmlFor="student-parent-phone">هاتف ولي الأمر</label>
                <input
                  className="form-control"
                  id="student-parent-phone"
                  name="parentPhone"
                  inputMode="tel"
                  placeholder="اختياري"
                />
              </div>
              <div>
                <label className="form-label" htmlFor="student-grade-level">الصف الدراسي</label>
                <input
                  className="form-control"
                  id="student-grade-level"
                  name="gradeLevel"
                  placeholder="مثال: الصف السادس"
                />
              </div>
            </div>

            <div>
              <label className="form-label" htmlFor="student-started-memorization">تاريخ بداية الحفظ</label>
              <input
                className="form-control"
                id="student-started-memorization"
                name="memorizationStartedOn"
                type="date"
              />
            </div>

            <div>
              <label className="form-label" htmlFor="student-halaqa">الحلقة</label>
              <select
                className="form-control"
                id="student-halaqa"
                name="halaqaId"
                required
                disabled={!halaqat.length}
                defaultValue=""
              >
                <option value="">-- اختر الحلقة --</option>
                {halaqat.map((halaqa) => (
                  <option key={halaqa.id} value={halaqa.id}>
                    {halaqa.stageName} — {halaqa.nameAr}
                    {halaqa.teacherName ? ` — ${halaqa.teacherName}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label" htmlFor="student-enrollment-start">تاريخ التسجيل في الحلقة</label>
              <input
                className="form-control"
                id="student-enrollment-start"
                name="startedOn"
                type="date"
                defaultValue={todayInputValue()}
                required
              />
            </div>

            <div>
              <label className="form-label" htmlFor="student-notes">ملاحظات</label>
              <textarea
                className="form-control min-h-24 resize-y"
                id="student-notes"
                name="notes"
                placeholder="اختياري"
              />
            </div>

            <button
              className="min-h-12 w-full rounded-2xl bg-emerald-800 px-4 font-black text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy || !halaqat.length}
            >
              {busy ? "جاري الحفظ..." : "إنشاء ملف الطالب وتسجيله"}
            </button>
          </form>
        </section>

        <section className="space-y-4">
          <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-emerald-700">الطلاب المسجلون</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">قائمة الطلاب</h2>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-900">
                {filteredStudents.length} من {students.length}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <input
                className="form-control sm:col-span-1"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="بحث بالاسم أو الهاتف"
                aria-label="بحث عن طالب"
              />
              <select
                className="form-control"
                value={halaqaFilter}
                onChange={(event) => setHalaqaFilter(event.target.value)}
                aria-label="تصفية حسب الحلقة"
              >
                <option value="">كل الحلقات</option>
                {halaqat.map((halaqa) => (
                  <option key={halaqa.id} value={halaqa.id}>{halaqa.nameAr}</option>
                ))}
              </select>
              <select
                className="form-control"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                aria-label="تصفية حسب الحالة"
              >
                <option value="ALL">كل الحالات</option>
                <option value="ACTIVE">نشط</option>
                <option value="INACTIVE">غير نشط</option>
              </select>
            </div>
          </div>

          {filteredStudents.length ? (
            filteredStudents.map((student) => (
              <article
                key={student.id}
                className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black text-slate-950">{student.displayName}</h3>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                          student.isActive
                            ? "bg-emerald-100 text-emerald-900"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {student.isActive ? "نشط" : "غير نشط"}
                      </span>
                    </div>
                    {student.fullName !== student.displayName ? (
                      <p className="mt-1 text-sm text-slate-500">{student.fullName}</p>
                    ) : null}
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-2 text-center">
                    <div className="text-lg font-black text-slate-900">{student.enrollmentsCount}</div>
                    <div className="text-[10px] font-bold text-slate-500">تسجيل تاريخي</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <InfoItem label="الحلقة الحالية" value={student.activeEnrollment?.halaqa.nameAr || "غير مسجل"} />
                  <InfoItem label="المرحلة" value={student.activeEnrollment?.halaqa.stageName || "—"} />
                  <InfoItem label="الشيخ" value={student.activeEnrollment?.halaqa.teacherName || "—"} />
                  <InfoItem label="هاتف ولي الأمر" value={student.parentPhone || "غير مسجل"} />
                </div>

                <Link
                  className="mt-4 flex min-h-11 w-full items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-black text-emerald-900 transition hover:bg-emerald-100"
                  href={`/manager/students/${student.id}`}
                >
                  فتح ملف الطالب
                </Link>
              </article>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-500">
              لا توجد نتائج مطابقة.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <div className="text-[11px] font-extrabold text-slate-500">{label}</div>
      <div className="mt-1 font-black text-slate-800">{value}</div>
    </div>
  );
}
