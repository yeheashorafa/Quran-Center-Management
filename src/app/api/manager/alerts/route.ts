import { NextRequest, NextResponse } from "next/server";
import { authorizeApiPermission } from "@/lib/auth/api-authorization";
import { getManagerAlertsData } from "@/lib/manager-alerts/queries";
import { managerAlertsQuerySchema } from "@/lib/manager-alerts/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authorization = await authorizeApiPermission("sessions.read.all");
  if (authorization.response) return authorization.response;

  const parsed = managerAlertsQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "خيارات التنبيهات غير صالحة." },
      { status: 400 },
    );
  }

  try {
    const data = await getManagerAlertsData(parsed.data.date, parsed.data.lookbackDays);
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Load manager alerts failed:", error);
    return NextResponse.json({ message: "تعذر تحميل التنبيهات حالياً." }, { status: 500 });
  }
}
