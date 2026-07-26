import { TeacherSessionPanel } from "@/components/sessions/teacher-session-panel";
import { requireRole } from "@/lib/auth/session";
import { todayInPalestine } from "@/lib/memorization-sessions/date";
import { getTeacherSessionDashboard } from "@/lib/memorization-sessions/queries";
import { getRecentOfficialExamsForTeacher } from "@/lib/official-exams/queries";

export const dynamic = "force-dynamic";

export default async function TeacherDashboardPage() {
  const session = await requireRole("TEACHER");
  const [dashboard, officialExams] = await Promise.all([
    getTeacherSessionDashboard(session.user.id),
    getRecentOfficialExamsForTeacher(session.user.id),
  ]);

  return (
    <TeacherSessionPanel
      dashboard={dashboard}
      officialExams={officialExams}
      initialHalaqaId={dashboard.halaqat[0]?.id || ""}
      initialDate={todayInPalestine()}
    />
  );
}
