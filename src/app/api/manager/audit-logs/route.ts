import { NextRequest, NextResponse } from "next/server";
import { authorizeApiPermission } from "@/lib/auth/api-authorization";
import { getAuditLogPage } from "@/lib/audit-logs/queries";
import { auditLogQuerySchema } from "@/lib/audit-logs/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authorization = await authorizeApiPermission("audit.read");
  if (authorization.response) return authorization.response;

  const parsed = auditLogQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "خيارات سجل التدقيق غير صالحة." },
      { status: 400 },
    );
  }

  try {
    const data = await getAuditLogPage(parsed.data);
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Load audit logs failed:", error);
    return NextResponse.json({ message: "تعذر تحميل سجل التدقيق حالياً." }, { status: 500 });
  }
}
