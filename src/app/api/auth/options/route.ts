import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { isAppRoleCode } from "@/lib/auth/constants";
import type { LoginOptionsResponse } from "@/lib/auth/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [stages, users] = await Promise.all([
    prisma.stage.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { nameAr: "asc" }],
      select: { id: true, code: true, nameAr: true },
    }),
    prisma.user.findMany({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        roles: {
          some: {
            role: {
              code: { in: ["TEACHER", "CENTER_MANAGER", "EXAMINER"] },
            },
          },
        },
      },
      orderBy: { displayName: "asc" },
      select: {
        id: true,
        username: true,
        displayName: true,
        roles: {
          select: { role: { select: { code: true } } },
        },
        staffAssignments: {
          where: {
            deletedAt: null,
            startsOn: { lte: today },
            OR: [{ endsOn: null }, { endsOn: { gte: today } }],
            halaqa: {
              status: "ACTIVE",
              deletedAt: null,
              stage: { isActive: true },
            },
          },
          select: {
            halaqa: { select: { stageId: true } },
          },
        },
      },
    }),
  ]);

  const response: LoginOptionsResponse = {
    stages: stages.map((stage) => ({
      id: stage.id,
      code: stage.code,
      label: stage.nameAr,
    })),
    users: users.map((user) => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      roles: user.roles
        .map((item) => item.role.code)
        .filter(isAppRoleCode),
      stageIds: Array.from(
        new Set(
          user.staffAssignments
            .map((assignment) => assignment.halaqa.stageId)
            .filter((stageId): stageId is string => Boolean(stageId)),
        ),
      ),
    })),
  };

  return NextResponse.json(response, {
    headers: { "Cache-Control": "no-store" },
  });
}
