import { z } from "zod";

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "التاريخ غير صالح.");

const activitySchema = z.object({
  type: z.enum(["MEMORIZATION", "REVIEW", "RECITATION"]),
  text: z.string().trim().max(1000, "تفاصيل الإنجاز طويلة جداً.").default(""),
  pageCount: z.coerce
    .number()
    .min(0, "عدد الصفحات لا يمكن أن يكون سالباً.")
    .max(604, "عدد الصفحات غير منطقي."),
});

export const saveSessionItemsSchema = z.object({
  date: dateOnlySchema,
  complete: z.boolean().default(false),
  items: z
    .array(
      z.object({
        studentId: z.string().uuid("معرف الطالب غير صالح."),
        enrollmentId: z.string().uuid("معرف تسجيل الطالب غير صالح."),
        attendance: z.enum(["PENDING", "PRESENT", "ABSENT", "EXCUSED", "NOT_HEARD"]),
        notes: z.string().trim().max(2000, "ملاحظة الطالب طويلة جداً.").default(""),
        baseVersion: z.number().int().positive().nullable().optional(),
        activities: z.array(activitySchema).max(3, "عدد أنواع الإنجاز غير صالح."),
      }),
    )
    .min(1, "لا توجد بيانات طلاب للحفظ.")
    .max(300, "عدد الطلاب كبير جداً."),
});
