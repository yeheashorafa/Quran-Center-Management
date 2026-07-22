import { NextRequest, NextResponse } from "next/server";
import { authorizeApiPermission } from "@/lib/auth/api-authorization";
import { getStudentFollowUpData } from "@/lib/student-follow-up/queries";
import { studentFollowUpQuerySchema } from "@/lib/student-follow-up/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authorization = await authorizeApiPermission("students.read.all");
  if (authorization.response) return authorization.response;

  const parsed = studentFollowUpQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "خيارات المتابعة غير صالحة." },
      { status: 400 },
    );
  }

  try {
    const data = await getStudentFollowUpData(parsed.data);
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Load follow-up students failed:", error);
    return NextResponse.json(
      { message: "تعذر تحميل قائمة الطلاب الذين يحتاجون متابعة حالياً." },
      { status: 500 },
    );
  }
}
