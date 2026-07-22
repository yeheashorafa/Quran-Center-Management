import { requireRole } from "@/lib/auth/session";

export default async function ExaminerDashboardPage() {
  const session = await requireRole("EXAMINER");

  return (
    <section className="space-y-4">
      <div className="rounded-3xl bg-gradient-to-l from-sky-900 to-sky-700 p-5 text-white shadow-lg shadow-sky-950/10">
        <p className="text-sm text-sky-100">لوحة المختبر</p>
        <h1 className="mt-1 text-2xl font-black">{session.user.displayName}</h1>
        <p className="mt-2 text-sm leading-6 text-sky-50">تم التحقق من دور المختبر من قاعدة البيانات قبل فتح الصفحة.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ["اختبار رسمي جديد", "اختيار الطالب ونطاق الاختبار والنتيجة."],
          ["سجل الاختبارات", "عرض الاختبارات السابقة وتصديرها."],
        ].map(([title, description]) => (
          <article key={title} className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
            <h2 className="font-extrabold text-slate-900">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
