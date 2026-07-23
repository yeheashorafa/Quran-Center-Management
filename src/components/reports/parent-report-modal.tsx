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
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-xs print:p-0 print:bg-white print:static print:inset-auto" dir="rtl">
      {/* Container Dialog */}
      <div className="relative w-full max-w-3xl rounded-3xl border border-[var(--border-color)] bg-[var(--card-bg)] p-6 shadow-2xl text-[var(--text-main)] transition-colors duration-200 print:max-w-none print:rounded-none print:shadow-none print:p-0 sm:p-8">
        {/* Top Control Bar (Hidden on Print) */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-color)] pb-4 print:hidden">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-[var(--card-soft)] text-[var(--primary)] font-bold border border-[var(--border-color)]">
              📜
            </span>
            <h2 className="text-lg font-black text-[var(--text-main)]">معاينة تقرير ولي الأمر</h2>
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
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--primary-dark)] px-4 text-xs font-black text-white shadow-sm transition hover:opacity-90"
            >
              <span>📥</span>
              <span>تنزيل PDF</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-xs font-black text-white shadow-sm transition hover:bg-[var(--primary-dark)]"
            >
              <span>🖨️</span>
              <span>طباعة</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-xl border border-[var(--border-color)] bg-[var(--card-soft)] px-4 text-sm font-bold text-[var(--text-main)] transition hover:border-[var(--primary)]"
            >
              إغلاق
            </button>
          </div>
        </div>

        {/* Printable Document Sheet (A4 Area) */}
        <div className="print-document font-sans text-[var(--text-main)]" dir="rtl">
          {/* Header Branding */}
          <header className="rounded-2xl bg-[var(--primary-dark)] p-6 text-white shadow-md print:bg-none print:bg-[var(--primary-dark)] print:p-5 print:shadow-none">
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
          <section className="mt-5 rounded-2xl border border-[var(--border-color)] bg-[var(--card-soft)] p-4 print:bg-slate-50 print:border-slate-300">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <span className="block text-xs font-bold text-[var(--text-muted)]">اسم الطالب:</span>
                <span className="mt-0.5 block font-black text-[var(--text-main)] text-base">
                  {data.student.displayName}
                </span>
              </div>
              <div>
                <span className="block text-xs font-bold text-[var(--text-muted)]">المرحلة / الحلقة:</span>
                <span className="mt-0.5 block font-extrabold text-[var(--text-main)]">
                  {data.halaqa.stageName} — {data.halaqa.nameAr}
                </span>
              </div>
              <div>
                <span className="block text-xs font-bold text-[var(--text-muted)]">المحفظ المسؤول:</span>
                <span className="mt-0.5 block font-extrabold text-[var(--text-main)]">
                  {data.halaqa.teacherName || "غير محدد"}
                </span>
              </div>
              <div>
                <span className="block text-xs font-bold text-[var(--text-muted)]">هاتف ولي الأمر:</span>
                <span className="mt-0.5 block font-extrabold text-[var(--text-main)]" dir="ltr">
                  {data.student.parentPhone || "غير مسجل"}
                </span>
              </div>
            </div>
          </section>

          {/* Overall Evaluation Banner */}
          <section className="mt-5 rounded-2xl border border-[var(--border-color)] bg-[var(--card-soft)] p-4 text-center shadow-2xs">
            <span className="text-xs font-bold text-[var(--text-muted)]">التقييم العام للمستوى خلال الشهر:</span>
            <div className="mt-2 flex items-center justify-center gap-3">
              <span
                className={`inline-block rounded-xl border-2 px-6 py-2 text-xl font-black shadow-2xs ${data.evaluation.colorClass}`}
              >
                {data.evaluation.label}
              </span>
            </div>
            <p className="mt-2 text-xs font-bold text-[var(--text-muted)] max-w-xl mx-auto">
              {data.evaluation.description}
            </p>
          </section>

          {/* Attendance & Session Stats */}
          <section className="mt-5">
            <h3 className="mb-3 text-sm font-black text-[var(--text-main)] border-r-4 border-[var(--primary)] pr-2">
              سجل الحضور والالتزام:
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-3 text-center">
                <span className="block text-2xl font-black text-[var(--status-success-text)]">
                  {data.attendance.present}
                </span>
                <span className="mt-1 block text-xs font-extrabold text-[var(--status-success-text)]">
                  أيام الحضور
                </span>
              </div>
              <div className="rounded-2xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-3 text-center">
                <span className="block text-2xl font-black text-[var(--status-danger-text)]">
                  {data.attendance.absent}
                </span>
                <span className="mt-1 block text-xs font-extrabold text-[var(--status-danger-text)]">
                  أيام الغياب
                </span>
              </div>
              <div className="rounded-2xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)] p-3 text-center">
                <span className="block text-2xl font-black text-[var(--status-info-text)]">
                  {data.attendance.excused}
                </span>
                <span className="mt-1 block text-xs font-extrabold text-[var(--status-info-text)]">
                  الأعذار المقبولة
                </span>
              </div>
              <div className="rounded-2xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-3 text-center">
                <span className="block text-2xl font-black text-[var(--status-warning-text)]">
                  {data.attendance.notHeard}
                </span>
                <span className="mt-1 block text-xs font-extrabold text-[var(--status-warning-text)]">
                  حضر ولم يسمّع
                </span>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between rounded-xl bg-[var(--card-soft)] border border-[var(--border-color)] px-4 py-2 text-xs font-bold text-[var(--text-main)]">
              <span>نسبة الحضور والالتزام: {data.attendance.attendanceRate}%</span>
              <span>إجمالي الجلسات المسجلة: {data.attendance.recordedSessions} جلسات</span>
            </div>
          </section>

          {/* Memorization & Output Progress */}
          <section className="mt-5">
            <h3 className="mb-3 text-sm font-black text-[var(--text-main)] border-r-4 border-[var(--primary)] pr-2">
              ملخص إنجاز الحفظ والمراجعة (بالصفحات):
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-soft)] p-3 text-center">
                <span className="block text-xl font-black text-[var(--primary)]">
                  📖 {data.achievement.memorizationPages}
                </span>
                <span className="mt-1 block text-xs font-bold text-[var(--text-muted)]">
                  صفحات الحفظ الجديد
                </span>
              </div>
              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-soft)] p-3 text-center">
                <span className="block text-xl font-black text-[var(--status-info-text)]">
                  🔄 {data.achievement.reviewPages}
                </span>
                <span className="mt-1 block text-xs font-bold text-[var(--text-muted)]">
                  صفحات المراجعة
                </span>
              </div>
              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-soft)] p-3 text-center">
                <span className="block text-xl font-black text-purple-600 dark:text-purple-400">
                  🎙️ {data.achievement.recitationPages}
                </span>
                <span className="mt-1 block text-xs font-bold text-[var(--text-muted)]">
                  صفحات السرد
                </span>
              </div>
              <div className="rounded-2xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-3 text-center">
                <span className="block text-2xl font-black text-[var(--status-success-text)]">
                  ✨ {data.achievement.totalPages}
                </span>
                <span className="mt-1 block text-xs font-extrabold text-[var(--status-success-text)]">
                  مجموع الصفحات
                </span>
              </div>
            </div>

            {data.achievement.latestAchievementText ? (
              <div className="mt-3 rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-3 text-xs">
                <span className="font-black text-[var(--status-success-text)]">آخر مقدار تم تسميعه: </span>
                <span className="font-bold text-[var(--text-main)]">
                  {data.achievement.latestAchievementText}
                </span>
              </div>
            ) : null}
          </section>

          {/* Notes & Exams Sections */}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {/* Teacher Notes */}
            <div className="rounded-2xl border border-[var(--border-color)] p-4 bg-[var(--card-soft)]">
              <h4 className="text-xs font-black text-[var(--text-main)] mb-2">ملاحظة المحفظ لولي الأمر:</h4>
              <p className="text-xs leading-6 font-bold text-[var(--text-muted)]">
                {data.achievement.latestTeacherNote || "لا توجد ملاحظات خاصة مسجلة لهذا الشهر."}
              </p>
            </div>

            {/* Official Exams */}
            <div className="rounded-2xl border border-[var(--border-color)] p-4 bg-[var(--card-soft)]">
              <h4 className="text-xs font-black text-[var(--text-main)] mb-2">أحدث اختبار رسمي:</h4>
              {data.latestExam ? (
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="font-bold text-[var(--text-muted)]">نوع ونطاق الاختبار:</span>
                    <span className="font-black text-[var(--text-main)]">
                      {data.latestExam.examType} — {data.latestExam.scopeLabel}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold text-[var(--text-muted)]">تاريخ الاختبار:</span>
                    <span className="font-extrabold text-[var(--text-main)]">
                      {formatArabicDate(data.latestExam.examDate)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold text-[var(--text-muted)]">النتيجة والعلامة:</span>
                    <span className="font-black text-[var(--primary)]">
                      {data.latestExam.resultLabel || "مكتمل"}
                      {data.latestExam.score !== null ? ` (${data.latestExam.score}%)` : ""}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs font-bold text-[var(--text-muted)]">
                  لم يتقدم الطالب لااختبار رسمي خلال هذه الفترة.
                </p>
              )}
            </div>
          </div>

          {/* Footer Note */}
          <footer className="mt-6 border-t border-[var(--border-color)] pt-4 text-center text-[11px] font-bold text-[var(--text-muted)]">
            <p>هذا التقرير لمتابعة ولي الأمر لمستوى الطالب داخل مركز التحفيظ.</p>
            <p className="mt-1 text-[10px] text-[var(--text-muted)]">
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
