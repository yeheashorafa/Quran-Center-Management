import { NextRequest, NextResponse } from "next/server";
import { authorizeApiPermission } from "@/lib/auth/api-authorization";
import { getManagerDailyMonitoringData } from "@/lib/manager-monitoring/queries";
import { managerMonitoringQuerySchema } from "@/lib/manager-monitoring/schemas";
import { renderDailyMonitoringExcel, renderDailyMonitoringCsv } from "@/lib/manager-monitoring/export";

export async function GET(request: NextRequest) {
  const authorization = await authorizeApiPermission("sessions.read.all");
  if (authorization.response) return authorization.response;

  const dateParam = request.nextUrl.searchParams.get("date") ?? "";
  const format = request.nextUrl.searchParams.get("format") ?? "json";

  const parsed = managerMonitoringQuerySchema.safeParse({
    date: dateParam,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "التاريخ غير صالح." },
      { status: 400 },
    );
  }

  const data = await getManagerDailyMonitoringData(parsed.data.date);

  if (format === "excel") {
    const buffer = await renderDailyMonitoringExcel(data);
    const filename = encodeURIComponent(`تقرير_متابعة_الحلقات_${data.date}.xlsx`);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${filename}`,
      },
    });
  }

  if (format === "csv") {
    const csvContent = renderDailyMonitoringCsv(data);
    const filename = encodeURIComponent(`تقرير_متابعة_الحلقات_${data.date}.csv`);
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${filename}`,
      },
    });
  }

  return NextResponse.json({ data });
}
