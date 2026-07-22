import { z } from "zod";
import { isIsoDateOnly } from "@/lib/memorization-sessions/date";

const optionalDate = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || isIsoDateOnly(value), "التاريخ غير صالح.");

export const auditLogQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(10).max(100).default(20),
    query: z.string().trim().max(120).optional(),
    actorUserId: z.string().uuid().optional(),
    action: z.string().trim().max(120).optional(),
    entityType: z.string().trim().max(100).optional(),
    from: optionalDate,
    to: optionalDate,
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "تاريخ البداية يجب ألا يتجاوز تاريخ النهاية.",
    path: ["to"],
  });
