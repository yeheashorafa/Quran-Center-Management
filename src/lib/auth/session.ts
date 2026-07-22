import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import {
  getDashboardPath,
  isAppRoleCode,
  SESSION_COOKIE_NAME,
  type AppRoleCode,
} from "@/lib/auth/constants";
import { hashSessionToken } from "@/lib/auth/token";
import type { AuthenticatedSession } from "@/lib/auth/types";

type SessionDatabaseRow = {
  sessionId: string;
  userId: string;
  displayName: string;
  roleId: string | null;
  roleCode: string | null;
  roleNameAr: string | null;
  expiresAt: Date;
};

export const getCurrentSession = cache(async (): Promise<AuthenticatedSession | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const tokenHash = hashSessionToken(token);
  const rows = await prisma.$queryRaw<SessionDatabaseRow[]>`
    SELECT
      s."id" AS "sessionId",
      u."id" AS "userId",
      u."display_name" AS "displayName",
      r."id" AS "roleId",
      r."code" AS "roleCode",
      r."name_ar" AS "roleNameAr",
      s."expires_at" AS "expiresAt"
    FROM "auth_sessions" s
    INNER JOIN "users" u ON u."id" = s."user_id"
    LEFT JOIN "roles" r ON r."id" = s."active_role_id"
    WHERE s."token_hash" = ${tokenHash}
      AND s."revoked_at" IS NULL
      AND s."expires_at" > NOW()
      AND u."status" = 'ACTIVE'
      AND u."deleted_at" IS NULL
    LIMIT 1
  `;

  const row = rows[0];
  if (!row?.roleId || !row.roleCode || !row.roleNameAr || !isAppRoleCode(row.roleCode)) {
    return null;
  }

  const role = await prisma.role.findUnique({
    where: { id: row.roleId },
    select: {
      permissions: {
        select: {
          permission: { select: { code: true } },
        },
      },
    },
  });

  if (!role) return null;

  return {
    sessionId: row.sessionId,
    expiresAt: row.expiresAt,
    user: {
      id: row.userId,
      displayName: row.displayName,
    },
    role: {
      id: row.roleId,
      code: row.roleCode,
      nameAr: row.roleNameAr,
    },
    permissions: role.permissions.map((item) => item.permission.code),
  };
});

export async function requireSession(): Promise<AuthenticatedSession> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireRole(roleCode: AppRoleCode): Promise<AuthenticatedSession> {
  const session = await requireSession();
  if (session.role.code !== roleCode) redirect("/unauthorized");
  return session;
}

export async function redirectAuthenticatedUser(): Promise<void> {
  const session = await getCurrentSession();
  if (session) redirect(getDashboardPath(session.role.code));
}
