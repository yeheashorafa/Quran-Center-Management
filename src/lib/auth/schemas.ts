import { z } from "zod";

export const appRoleSchema = z.enum(["TEACHER", "CENTER_MANAGER", "EXAMINER"]);

export const loginSchema = z
  .object({
    role: appRoleSchema,
    stageId: z.string().uuid().optional().or(z.literal("")),
    userId: z.string().uuid("المستخدم المحدد غير صالح."),
    password: z
      .string()
      .min(4, "كلمة الدخول يجب أن تحتوي 4 أحرف أو أرقام على الأقل.")
      .max(128, "كلمة الدخول طويلة جداً."),
    rememberDevice: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.role === "TEACHER" && !value.stageId) {
      context.addIssue({
        code: "custom",
        path: ["stageId"],
        message: "اختر المرحلة أولاً.",
      });
    }
  });

export type LoginInput = z.infer<typeof loginSchema>;
