import { z } from "zod";
import { isIsoDateOnly } from "@/lib/memorization-sessions/date";

const dateOnly = z.string().refine(isIsoDateOnly, "التاريخ غير صالح.");

export const studentFollowUpQuerySchema = z
  .object({
    from: dateOnly,
    to: dateOnly,
    stageId: z.string().uuid().optional(),
    halaqaId: z.string().uuid().optional(),
    attendanceThreshold: z.coerce.number().int().min(30).max(95).default(70),
  })
  .refine((value) => value.from <= value.to, {
    message: "تاريخ البداية يجب ألا يتجاوز تاريخ النهاية.",
    path: ["to"],
  });
