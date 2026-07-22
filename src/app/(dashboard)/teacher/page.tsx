import { TeacherSessionPanel } from "@/components/sessions/teacher-session-panel";
import { requireRole } from "@/lib/auth/session";
import { todayInPalestine } from "@/lib/memorization-sessions/date";
import { getTeacherSessionDashboard } from "@/lib/memorization-sessions/queries";

export const dynamic = "force-dynamic";

export default async function TeacherDashboardPage() {
  const session = await requireRole("TEACHER");
  const dashboard = await getTeacherSessionDashboard(session.user.id);

  return <TeacherSessionPanel dashboard={dashboard} initialDate={todayInPalestine()} />;
}
