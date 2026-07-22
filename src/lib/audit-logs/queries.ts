import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { dateOnlyToUtc } from "@/lib/memorization-sessions/date";
import { auditActionLabel, auditEntityLabel } from "@/lib/audit-logs/labels";
import type { AuditLogPage } from "@/lib/audit-logs/types";
import type { z } from "zod";
import type { auditLogQuerySchema } from "@/lib/audit-logs/schemas";

type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;

function nextUtcDay(value: string): Date {
  const date = dateOnlyToUtc(value);
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

export async function getAuditLogPage(input: AuditLogQuery): Promise<AuditLogPage> {
  const where: Prisma.AuditLogWhereInput = {};

  if (input.actorUserId) where.actorUserId = input.actorUserId;
  if (input.action) where.action = input.action;
  if (input.entityType) where.entityType = input.entityType;
  if (input.from || input.to) {
    where.createdAt = {
      ...(input.from ? { gte: dateOnlyToUtc(input.from) } : {}),
      ...(input.to ? { lt: nextUtcDay(input.to) } : {}),
    };
  }
  if (input.query) {
    where.OR = [
      { action: { contains: input.query, mode: "insensitive" } },
      { entityType: { contains: input.query, mode: "insensitive" } },
      { actorUser: { displayName: { contains: input.query, mode: "insensitive" } } },
      { actorUser: { username: { contains: input.query, mode: "insensitive" } } },
    ];
  }

  const skip = (input.page - 1) * input.pageSize;
  const [totalItems, logs, users, actionRows, entityRows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: input.pageSize,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        oldValues: true,
        newValues: true,
        metadata: true,
        requestId: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        actorUser: {
          select: { id: true, displayName: true, username: true },
        },
      },
    }),
    prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true, username: true },
    }),
    prisma.auditLog.findMany({
      distinct: ["action"],
      orderBy: { action: "asc" },
      select: { action: true },
    }),
    prisma.auditLog.findMany({
      distinct: ["entityType"],
      orderBy: { entityType: "asc" },
      select: { entityType: true },
    }),
  ]);

  return {
    items: logs.map((log) => ({
      id: log.id,
      action: log.action,
      actionLabel: auditActionLabel(log.action),
      entityType: log.entityType,
      entityLabel: auditEntityLabel(log.entityType),
      entityId: log.entityId,
      actor: log.actorUser,
      oldValues: log.oldValues,
      newValues: log.newValues,
      metadata: log.metadata,
      requestId: log.requestId,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt.toISOString(),
    })),
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      totalItems,
      totalPages: Math.max(Math.ceil(totalItems / input.pageSize), 1),
    },
    filters: {
      users,
      actions: actionRows.map((row: { action: string }) => ({
        value: row.action,
        label: auditActionLabel(row.action),
      })),
      entityTypes: entityRows.map((row: { entityType: string }) => ({
        value: row.entityType,
        label: auditEntityLabel(row.entityType),
      })),
    },
  };
}
