import { NextRequest, NextResponse } from "next/server";
import { authorizeApiPermission } from "@/lib/auth/api-authorization";
import { getManagerDailyMonitoringData } from "@/lib/manager-monitoring/queries";
import { managerMonitoringQuerySchema } from "@/lib/manager-monitoring/schemas";

export async function GET(request: NextRequest) {
  const authorization = await authorizeApiPermission("sessions.read.all");
  if (authorization.response) return authorization.response;

  const parsed = managerMonitoringQuerySchema.safeParse({
    date: request.nextUrl.searchParams.get("date") ?? "",
  });

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "التاريخ غير صالح." },
      { status: 400 },
    );
  }

  const data = await getManagerDailyMonitoringData(parsed.data.date);
  return NextResponse.json({ data });
}
