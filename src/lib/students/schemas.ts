import { z } from "zod";

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "التاريخ غير صالح.");

const optionalShortText = (max: number, message: string) =>
  z.string().trim().max(max, message).optional().or(z.literal(""));

export const createStudentSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, "أدخل الاسم الكامل للطالب.")
    .max(200, "اسم الطالب طويل جداً."),
  displayName: optionalShortText(160, "اسم العرض طويل جداً."),
  parentPhone: optionalShortText(40, "رقم هاتف ولي الأمر طويل جداً."),
  gradeLevel: optionalShortText(80, "الصف الدراسي طويل جداً."),
  memorizationStartedOn: dateOnlySchema.optional().or(z.literal("")),
  notes: optionalShortText(3000, "الملاحظات طويلة جداً."),
  halaqaId: z.string().uuid("اختر الحلقة."),
  startedOn: dateOnlySchema,
});

export const updateStudentSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, "أدخل الاسم الكامل للطالب.")
    .max(200, "اسم الطالب طويل جداً."),
  displayName: z
    .string()
    .trim()
    .min(2, "أدخل اسم العرض.")
    .max(160, "اسم العرض طويل جداً."),
  parentPhone: optionalShortText(40, "رقم هاتف ولي الأمر طويل جداً."),
  gradeLevel: optionalShortText(80, "الصف الدراسي طويل جداً."),
  memorizationStartedOn: dateOnlySchema.optional().or(z.literal("")),
  notes: optionalShortText(3000, "الملاحظات طويلة جداً."),
});

export const updateStudentStatusSchema = z.object({
  isActive: z.boolean(),
  effectiveOn: dateOnlySchema,
});

export const createStudentEnrollmentSchema = z.object({
  halaqaId: z.string().uuid("اختر الحلقة."),
  startedOn: dateOnlySchema,
});
