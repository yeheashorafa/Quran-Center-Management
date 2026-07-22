import "server-only";

import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import type { AuthenticatedSession } from "@/lib/auth/types";

export type ApiAuthorizationResult =
  | { session: AuthenticatedSession; response?: never }
  | { session?: never; response: NextResponse };

export async function authorizeApiPermission(permission: string): Promise<ApiAuthorizationResult> {
  const session = await getCurrentSession();

  if (!session) {
    return {
      response: NextResponse.json({ message: "يجب تسجيل الدخول أولاً." }, { status: 401 }),
    };
  }

  if (!session.permissions.includes(permission)) {
    return {
      response: NextResponse.json({ message: "ليس لديك صلاحية لتنفيذ هذه العملية." }, { status: 403 }),
    };
  }

  return { session };
}
