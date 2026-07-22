import { ExaminerExamsPanel } from "@/components/exams/examiner-exams-panel";
import { MonthlyReportsPanel } from "@/components/reports/monthly-reports-panel";
import { requireRole } from "@/lib/auth/session";
import { todayInPalestine } from "@/lib/memorization-sessions/date";
import { getOfficialExamList, getOfficialExamOptions } from "@/lib/official-exams/queries";
import { getMonthlyReportOptions } from "@/lib/reports/queries";

export const dynamic = "force-dynamic";

export default async function ExaminerDashboardPage() {
  const session = await requireRole("EXAMINER");
  const [options, initialExams, reportOptions] = await Promise.all([
    getOfficialExamOptions(),
    getOfficialExamList({ status: "ALL", limit: 100 }),
    getMonthlyReportOptions(session),
  ]);

  return (
    <section className="space-y-5">
      <div className="rounded-3xl bg-gradient-to-l from-sky-950 to-sky-700 p-5 text-white shadow-lg shadow-sky-950/10 sm:p-6">
        <p className="text-sm font-bold text-sky-100">لوحة المختبر</p>
        <h1 className="mt-1 text-2xl font-black sm:text-3xl">مرحباً، {session.user.displayName}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-sky-50">
          سجّل الاختبارات الرسمية وعدّلها عند الحاجة، مع الاحتفاظ بتاريخ الحلقة والنطاق وسجل كامل لكل عملية.
        </p>
      </div>

      <ExaminerExamsPanel
        options={options}
        initialExams={initialExams}
        initialDate={todayInPalestine()}
      />
      <MonthlyReportsPanel
        options={reportOptions}
        initialMonth={todayInPalestine().slice(0, 7)}
      />
    </section>
  );
}
