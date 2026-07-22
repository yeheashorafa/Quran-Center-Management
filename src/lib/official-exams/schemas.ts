import { z } from "zod";
import { isIsoDateOnly } from "@/lib/memorization-sessions/date";

const uuid = z.string().uuid("المعرف غير صالح.");
const isoDate = z.string().refine(isIsoDateOnly, "التاريخ غير صالح.");
const examType = z.enum(["INDIVIDUAL", "COLLECTIVE"]);

const examFields = {
  studentId: uuid,
  examDate: isoDate,
  examType,
  juzFrom: z.coerce.number().int().min(1, "الجزء من 1 إلى 30.").max(30, "الجزء من 1 إلى 30."),
  juzTo: z.coerce.number().int().min(1, "الجزء من 1 إلى 30.").max(30, "الجزء من 1 إلى 30."),
  score: z.coerce.number().min(0, "الدرجة لا تقل عن صفر.").max(100, "الدرجة لا تزيد عن 100."),
  notes: z.string().trim().max(1000, "الملاحظة طويلة جداً.").optional().default(""),
};

function validateScope(
  value: { examType: "INDIVIDUAL" | "COLLECTIVE"; juzFrom: number; juzTo: number },
  context: { addIssue(issue: { code: "custom"; path: (string | number)[]; message: string }): void },
) {
  if (value.examType === "INDIVIDUAL" && value.juzFrom !== value.juzTo) {
    context.addIssue({
      code: "custom",
      path: ["juzTo"],
      message: "الاختبار المنفرد يجب أن يكون لجزء واحد.",
    });
  }

  if (value.examType === "COLLECTIVE" && value.juzFrom > value.juzTo) {
    context.addIssue({
      code: "custom",
      path: ["juzTo"],
      message: "جزء النهاية يجب أن يكون بعد جزء البداية أو مساوياً له.",
    });
  }
}

export const createOfficialExamSchema = z
  .object({
    ...examFields,
    idempotencyKey: z.string().uuid("معرف العملية غير صالح."),
  })
  .superRefine(validateScope);

export const updateOfficialExamSchema = z
  .object({
    ...examFields,
    version: z.coerce.number().int().positive("رقم الإصدار غير صالح."),
  })
  .superRefine(validateScope);

export const voidOfficialExamSchema = z.object({
  version: z.coerce.number().int().positive("رقم الإصدار غير صالح."),
  reason: z.string().trim().min(3, "اكتب سبب الإلغاء.").max(500, "سبب الإلغاء طويل جداً."),
});

export const officialExamQuerySchema = z.object({
  stageId: z.string().uuid().optional(),
  halaqaId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  status: z.enum(["ACTIVE", "VOIDED", "ALL"]).optional().default("ALL"),
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
});
