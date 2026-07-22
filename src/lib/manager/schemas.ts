import { z } from "zod";
import { WEEKDAY_CODES } from "@/lib/halaqat/weekdays";

export const createManagedUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "اسم المستخدم يجب أن يتكون من 3 أحرف على الأقل.")
    .max(80, "اسم المستخدم طويل جداً."),
  displayName: z
    .string()
    .trim()
    .min(2, "أدخل اسم المستخدم الظاهر.")
    .max(160, "الاسم الظاهر طويل جداً."),
  password: z
    .string()
    .min(6, "كلمة الدخول يجب أن تتكون من 6 خانات على الأقل.")
    .max(128, "كلمة الدخول طويلة جداً."),
  role: z.enum(["TEACHER", "CENTER_MANAGER", "EXAMINER"]),
});

export const updateManagedUserStatusSchema = z.object({
  status: z.enum(["ACTIVE", "DISABLED"]),
});

export const createHalaqaSchema = z.object({
  nameAr: z
    .string()
    .trim()
    .min(2, "أدخل اسم الحلقة.")
    .max(160, "اسم الحلقة طويل جداً."),
  stageId: z.string().uuid("المرحلة غير صالحة."),
  teacherUserId: z.string().uuid("اختر الشيخ المسؤول."),
  weekdays: z.array(z.enum(WEEKDAY_CODES)).min(1, "اختر يوماً واحداً على الأقل."),
  effectiveFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ بداية الجدول غير صالح."),
  notes: z.string().trim().max(2000, "الملاحظات طويلة جداً.").optional().or(z.literal("")),
});

export const updateHalaqaStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
});
