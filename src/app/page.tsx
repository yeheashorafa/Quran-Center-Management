import { redirect } from "next/navigation";
import { getDashboardPath } from "@/lib/auth/constants";
import { getCurrentSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getCurrentSession();
  redirect(session ? getDashboardPath(session.role.code) : "/login");
}
