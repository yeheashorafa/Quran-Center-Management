"use client";

import type { ParentReportData } from "@/lib/reports/parent-report-types";

function formatArabicDate(isoDate: string): string {
  try {
    return new Intl.DateTimeFormat("ar-PS", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(isoDate));
  } catch {
    return isoDate;
  }
}

export function ParentReportModal({
  data,
  onClose,
}: {
  data: ParentReportData;
  onClose: () => void;
}) {
  function handlePrint() {
    window.print();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-xs print:p-0 print:bg-white print:static print:inset-auto">
      {/* Container Dialog */}
      <div className="relative w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl print:max-w-none print:rounded-none print:shadow-none print:p-0 sm:p-8">
        {/* Top Control Bar (Hidden on Print) */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 print:hidden">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-900 font-bold">
              📜
            </span>
            <h2 className="text-lg font-black text-slate-900">معاينة تقرير ولي الأمر</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                window.open(
                  `/api/reports/parent?studentId=${data.student.id}&month=${data.monthLabel}&format=pdf`,
                  "_blank",
                );
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-900 px-4 text-xs font-black text-white shadow-sm transition hover:bg-blue-950"
            >
              <span>📥</span>
              <span>تنزيل PDF</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-900 px-4 text-xs font-black text-white shadow-sm transition hover:bg-emerald-950"
            >
              <span>🖨️</span>
              <span>طباعة</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
            >
              إغلاق
            </button>
          </div>
        </div>

        {/* Printable Document Sheet (A4 Area) */}
        <div className="print-document font-sans text-slate-900" dir="rtl">
          {/* Header Branding */}
          <header className="rounded-2xl bg-gradient-to-l from-emerald-950 via-emerald-900 to-emerald-800 p-6 text-white shadow-md print:bg-none print:bg-emerald-950 print:p-5 print:shadow-none">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-emerald-800/80 pb-4">
              <div>
                <p className="text-xs font-bold text-emerald-200">{data.centerName}</p>
                <h1 className="mt-1 text-2xl font-black text-white">{data.reportTitle}</h1>
              </div>
              <div className="rounded-xl bg-white/10 px-4 py-2 text-left backdrop-blur-xs">
                <span className="block text-xs text-emerald-200">شهر التقرير:</span>
                <span className="block font-black text-white text-base">{data.monthLabel}</span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between text-xs text-emerald-100">
              <span>تاريخ الإصدار: {formatArabicDate(data.generatedAt)}</span>
              <span>مركز سيد الشهداء حمزة لتلاوة القرآن وتحفيظه</span>
            </div>
          </header>

          {/* Student Info Box */}
          <section className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 print:bg-slate-50 print:border-slate-300">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <span className="block text-xs font-bold text-slate-500">اسم الطالب:</span>
                <span className="mt-0.5 block font-black text-slate-900 text-base">
                  {data.student.displayName}
                </span>
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-500">المرحلة / الحلقة:</span>
                <span className="mt-0.5 block font-extrabold text-slate-800">
                  {data.halaqa.stageName} — {data.halaqa.nameAr}
                </span>
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-500">المحفظ المسؤول:</span>
                <span className="mt-0.5 block font-extrabold text-slate-800">
                  {data.halaqa.teacherName || "غير محدد"}
                </span>
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-500">هاتف ولي الأمر:</span>
                <span className="mt-0.5 block font-extrabold text-slate-800" dir="ltr">
                  {data.student.parentPhone || "غير مسجل"}
                </span>
              </div>
            </div>
          </section>

          {/* Overall Evaluation Banner */}
          <section className="mt-5 rounded-2xl border p-4 text-center shadow-2xs">
            <span className="text-xs font-bold text-slate-500">التقييم العام للمستوى خلال الشهر:</span>
            <div className="mt-2 flex items-center justify-center gap-3">
              <span
                className={`inline-block rounded-xl border-2 px-6 py-2 text-xl font-black shadow-2xs ${data.evaluation.colorClass}`}
              >
                {data.evaluation.label}
              </span>
            </div>
            <p className="mt-2 text-xs font-bold text-slate-600 max-w-xl mx-auto">
              {data.evaluation.description}
            </p>
          </section>

          {/* Attendance & Session Stats */}
          <section className="mt-5">
            <h3 className="mb-3 text-sm font-black text-slate-900 border-r-4 border-emerald-800 pr-2">
              سجل الحضور والالتزام:
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 text-center">
                <span className="block text-2xl font-black text-emerald-900">
                  {data.attendance.present}
                </span>
                <span className="mt-1 block text-xs font-extrabold text-emerald-800">
                  أيام الحضور
                </span>
              </div>
              <div className="rounded-2xl border border-red-200 bg-red-50/60 p-3 text-center">
                <span className="block text-2xl font-black text-red-900">
                  {data.attendance.absent}
                </span>
                <span className="mt-1 block text-xs font-extrabold text-red-800">
                  أيام الغياب
                </span>
              </div>
              <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-3 text-center">
                <span className="block text-2xl font-black text-blue-900">
                  {data.attendance.excused}
                </span>
                <span className="mt-1 block text-xs font-extrabold text-blue-800">
                  الأعذار المقبولة
                </span>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3 text-center">
                <span className="block text-2xl font-black text-amber-900">
                  {data.attendance.notHeard}
                </span>
                <span className="mt-1 block text-xs font-extrabold text-amber-800">
                  حضر ولم يسمّع
                </span>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700">
              <span>نسبة الحضور والالتزام: {data.attendance.attendanceRate}%</span>
              <span>إجمالي الجلسات المسجلة: {data.attendance.recordedSessions} جلسات</span>
            </div>
          </section>

          {/* Memorization & Output Progress */}
          <section className="mt-5">
            <h3 className="mb-3 text-sm font-black text-slate-900 border-r-4 border-emerald-800 pr-2">
              ملخص إنجاز الحفظ والمراجعة (بالصفحات):
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center">
                <span className="block text-xl font-black text-emerald-900">
                  📖 {data.achievement.memorizationPages}
                </span>
                <span className="mt-1 block text-xs font-bold text-slate-600">
                  صفحات الحفظ الجديد
                </span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center">
                <span className="block text-xl font-black text-blue-900">
                  🔄 {data.achievement.reviewPages}
                </span>
                <span className="mt-1 block text-xs font-bold text-slate-600">
                  صفحات المراجعة
                </span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center">
                <span className="block text-xl font-black text-purple-900">
                  🎙️ {data.achievement.recitationPages}
                </span>
                <span className="mt-1 block text-xs font-bold text-slate-600">
                  صفحات السرد
                </span>
              </div>
              <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-3 text-center">
                <span className="block text-2xl font-black text-emerald-950">
                  ✨ {data.achievement.totalPages}
                </span>
                <span className="mt-1 block text-xs font-extrabold text-emerald-900">
                  مجموع الصفحات
                </span>
              </div>
            </div>

            {data.achievement.latestAchievementText ? (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-xs">
                <span className="font-black text-emerald-950">آخر مقدار تم تسميعه: </span>
                <span className="font-bold text-slate-800">
                  {data.achievement.latestAchievementText}
                </span>
              </div>
            ) : null}
          </section>

          {/* Notes & Exams Sections */}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {/* Teacher Notes */}
            <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/40">
              <h4 className="text-xs font-black text-slate-900 mb-2">ملاحظة المحفظ لولي الأمر:</h4>
              <p className="text-xs leading-6 font-bold text-slate-700">
                {data.achievement.latestTeacherNote || "لا توجد ملاحظات خاصة مسجلة لهذا الشهر."}
              </p>
            </div>

            {/* Official Exams */}
            <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/40">
              <h4 className="text-xs font-black text-slate-900 mb-2">أحدث اختبار رسمي:</h4>
              {data.latestExam ? (
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-500">نوع ونطاق الاختبار:</span>
                    <span className="font-black text-slate-900">
                      {data.latestExam.examType} — {data.latestExam.scopeLabel}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-500">تاريخ الاختبار:</span>
                    <span className="font-extrabold text-slate-800">
                      {formatArabicDate(data.latestExam.examDate)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-500">النتيجة والعلامة:</span>
                    <span className="font-black text-emerald-800">
                      {data.latestExam.resultLabel || "مكتمل"}
                      {data.latestExam.score !== null ? ` (${data.latestExam.score}%)` : ""}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs font-bold text-slate-500">
                  لم يتقدم الطالب لاختبار رسمي خلال هذه الفترة.
                </p>
              )}
            </div>
          </div>

          {/* Footer Note */}
          <footer className="mt-6 border-t border-slate-200 pt-4 text-center text-[11px] font-bold text-slate-500">
            <p>هذا التقرير لمتابعة ولي الأمر لمستوى الطالب داخل مركز التحفيظ.</p>
            <p className="mt-1 text-[10px] text-slate-400">
              مركز سيد الشهداء حمزة — نظام إدارة الحلقات والتحفيظ
            </p>
          </footer>
        </div>
      </div>

      {/* Print Specific CSS Override */}
      <style jsx global>{`
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }
          header, footer, nav, button {
            box-shadow: none !important;
          }
          .print-document {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
