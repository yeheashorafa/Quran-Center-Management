import Link from "next/link";
import { notFound } from "next/navigation";
import { StudentProfilePanel } from "@/components/students/student-profile-panel";
import { requireRole } from "@/lib/auth/session";
import { getStudentProfileData } from "@/lib/students/queries";

export default async function ManagerStudentProfilePage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  await requireRole("CENTER_MANAGER");
  const { studentId } = await params;
  const data = await getStudentProfileData(studentId);

  if (!data) notFound();

  return (
    <section className="space-y-5">
      <div className="rounded-3xl bg-gradient-to-l from-emerald-950 to-emerald-700 p-5 text-white shadow-lg shadow-emerald-950/10 sm:p-6">
        <Link
          className="inline-flex min-h-10 items-center rounded-xl border border-white/25 bg-white/10 px-4 text-sm font-black text-white transition hover:bg-white/20"
          href="/manager?tab=students"
        >
          العودة إلى إدارة الطلاب
        </Link>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-emerald-100">ملف الطالب</p>
            <h1 className="mt-1 text-2xl font-black sm:text-3xl">{data.student.displayName}</h1>
            <p className="mt-2 text-sm leading-7 text-emerald-50">{data.student.fullName}</p>
          </div>
          <span
            className={`rounded-full px-4 py-2 text-xs font-black ${
              data.student.isActive
                ? "bg-white text-emerald-900"
                : "bg-slate-200 text-slate-800"
            }`}
          >
            {data.student.isActive ? "طالب نشط" : "ملف متوقف"}
          </span>
        </div>
      </div>

      <StudentProfilePanel data={data} />
    </section>
  );
}
