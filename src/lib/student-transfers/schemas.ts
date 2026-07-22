import { z } from "zod";
import { isIsoDateOnly } from "@/lib/memorization-sessions/date";

export const transferStudentSchema = z.object({
  toHalaqaId: z.string().uuid("اختر الحلقة الجديدة."),
  transferDate: z.string().refine(isIsoDateOnly, {
    message: "تاريخ النقل غير صالح.",
  }),
  note: z.string().max(500, "الملاحظة طويلة جداً.").optional().nullable(),
  idempotencyKey: z.string().min(1, "معرف العملية مطلوب."),
});

export type TransferStudentInput = z.infer<typeof transferStudentSchema>;
