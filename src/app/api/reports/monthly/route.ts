import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getRequestIp, getRequestUserAgent } from "@/lib/http/request-metadata";
import { renderMonthlyReportCsv } from "@/lib/reports/csv";
import { renderMonthlyReportExcel } from "@/lib/reports/excel";
import { renderMonthlyReportHtml } from "@/lib/reports/html";
import { ReportBrowserUnavailableError, renderHtmlToPdf } from "@/lib/reports/pdf";
import { getMonthlyReportData } from "@/lib/reports/queries";
import { monthlyReportQuerySchema } from "@/lib/reports/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

function contentDisposition(filename: string): string {
  const encoded = encodeURIComponent(filename).replaceAll("'", "%27");
  return `attachment; filename="monthly-report"; filename*=UTF-8''${encoded}`;
}

function safeName(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "_").slice(0, 90);
}

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return errorResponse("يجب تسجيل الدخول أولاً.", 401);

  const canExportAll = session.permissions.includes("reports.export.all");
  const canExportOwn = session.permissions.includes("reports.export.own");
  if (!canExportAll && !canExportOwn) {
    return errorResponse("ليس لديك صلاحية لتصدير التقارير.", 403);
  }

  const parsed = monthlyReportQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "خيارات التقرير غير صالحة.", 400);
  }

  if (session.role.code === "TEACHER" && parsed.data.kind !== "COMPREHENSIVE") {
    return errorResponse("الشيخ يستطيع تصدير تقرير حلقاته الشهري فقط.", 403);
  }
  if (session.role.code === "EXAMINER" && parsed.data.kind !== "EXAMS") {
    return errorResponse("المختبر يستطيع تصدير تقرير الاختبارات الرسمية فقط.", 403);
  }

  try {
    const report = await getMonthlyReportData(session, {
      month: parsed.data.month,
      kind: parsed.data.kind,
      stageId: parsed.data.stageId,
      halaqaId: parsed.data.halaqaId,
      includeVoided: parsed.data.includeVoided,
    });

    if (!report.halaqat.length) {
      return errorResponse("لا توجد حلقات متاحة ضمن الشهر والنطاق المحددين.", 404);
    }

    const baseName = safeName(`${report.title}_${parsed.data.month}_${report.scopeLabel}`);
    let body: Buffer;
    let contentType: string;
    let filename: string;

    if (parsed.data.format === "pdf") {
      body = await renderHtmlToPdf(renderMonthlyReportHtml(report));
      contentType = "application/pdf";
      filename = `${baseName}.pdf`;
    } else if (parsed.data.format === "csv") {
      body = renderMonthlyReportCsv(report);
      contentType = "text/csv; charset=utf-8";
      filename = `${baseName}.csv`;
    } else {
      body = renderMonthlyReportExcel(report);
      contentType = "application/vnd.ms-excel; charset=utf-8";
      filename = `${baseName}.xml`;
    }

    await prisma.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: "MONTHLY_REPORT_EXPORTED",
        entityType: "monthly_report",
        requestId: randomUUID(),
        ipAddress: getRequestIp(request),
        userAgent: getRequestUserAgent(request),
        newValues: {
          month: parsed.data.month,
          kind: parsed.data.kind,
          format: parsed.data.format,
          stageId: parsed.data.stageId ?? null,
          halaqaId: parsed.data.halaqaId ?? null,
          includeVoided: parsed.data.includeVoided,
          scopeLabel: report.scopeLabel,
          halaqatCount: report.summary.halaqatCount,
          studentsCount: report.summary.studentsCount,
          examCount: report.summary.examCount,
        },
      },
    });

    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition(filename),
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof ReportBrowserUnavailableError) {
      // Fallback: return printable HTML document directly
      const report = await getMonthlyReportData(session, {
        month: parsed.data.month,
        kind: parsed.data.kind,
        stageId: parsed.data.stageId,
        halaqaId: parsed.data.halaqaId,
        includeVoided: parsed.data.includeVoided,
      });
      const html = renderMonthlyReportHtml(report);
      return new NextResponse(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }
    console.error("Monthly report export failed:", error);
    return errorResponse("تعذر إنشاء التقرير حالياً.", 500);
  }
}
