import { NextResponse } from "next/server";
import { authorizeApiPermission } from "@/lib/auth/api-authorization";
import { getOfficialExamOptions } from "@/lib/official-exams/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const authorization = await authorizeApiPermission("exams.manage");
  if (authorization.response) return authorization.response;

  const data = await getOfficialExamOptions();
  return NextResponse.json({ data });
}
