import { ManagementPanel } from "@/components/manager/management-panel";
import { requireRole } from "@/lib/auth/session";
import { getManagerDashboardData } from "@/lib/manager/queries";
import { getManagerDailyMonitoringData } from "@/lib/manager-monitoring/queries";
import { isIsoDateOnly, todayInPalestine } from "@/lib/memorization-sessions/date";

export default async function ManagerDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; date?: string }>;
}) {
  const session = await requireRole("CENTER_MANAGER");
  const { tab, date } = await searchParams;
  const monitoringDate = date && isIsoDateOnly(date) ? date : todayInPalestine();
  const [data, monitoringData] = await Promise.all([
    getManagerDashboardData(session.user.id),
    getManagerDailyMonitoringData(monitoringDate),
  ]);
  const initialTab =
    tab === "halaqat" || tab === "students" || tab === "users" || tab === "monitoring"
      ? tab
      : "monitoring";

  return (
    <section className="space-y-5">
      <div className="rounded-3xl bg-gradient-to-l from-emerald-950 to-emerald-700 p-5 text-white shadow-lg shadow-emerald-950/10 sm:p-6">
        <p className="text-sm font-bold text-emerald-100">لوحة مدير المركز</p>
        <h1 className="mt-1 text-2xl font-black sm:text-3xl">مرحباً، {session.user.displayName}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-emerald-50">
          تابع تسجيل الحلقات حسب التاريخ، ثم أدر المستخدمين والحلقات وملفات الطلاب دون فقد السجلات التاريخية.
        </p>
      </div>

      <ManagementPanel data={data} monitoringData={monitoringData} initialTab={initialTab} />
    </section>
  );
}
