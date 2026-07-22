import { NextResponse } from "next/server";
import { authorizeApiPermission } from "@/lib/auth/api-authorization";
import { todayInPalestine } from "@/lib/memorization-sessions/date";
import { generateParentReportHtml } from "@/lib/reports/parent-report-html";
import { getParentStudentReportData } from "@/lib/reports/parent-report-queries";
import { renderHtmlToPdf, ReportBrowserUnavailableError } from "@/lib/reports/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorization = await authorizeApiPermission("reports.export.own");
  if (authorization.response) return authorization.response;

  const url = new URL(request.url);
  const studentId = url.searchParams.get("studentId");
  const month = url.searchParams.get("month") || todayInPalestine().slice(0, 7);
  const format = url.searchParams.get("format");

  if (!studentId) {
    return NextResponse.json({ message: "معرف الطالب مطلوب." }, { status: 400 });
  }

  const report = await getParentStudentReportData(authorization.session, studentId, month);
  if (!report) {
    return NextResponse.json({ message: "التقرير غير متاح أو لا تملك صلاحية الوصول لهذا الطالب." }, { status: 404 });
  }

  if (format === "pdf") {
    const html = generateParentReportHtml(report);
    const cleanStudentName = report.student.displayName.replace(/[\s\/\\]+/g, "_");
    const filename = `تقرير_ولي_الأمر_${cleanStudentName}_${month}.pdf`;

    try {
      const pdfBuffer = await renderHtmlToPdf(html);
      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      if (error instanceof ReportBrowserUnavailableError) {
        // Fallback: return printable HTML document
        return new NextResponse(html, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      }
      return NextResponse.json({ message: "تعذر توليد ملف PDF." }, { status: 500 });
    }
  }

  return NextResponse.json({ data: report });
}
