import { z } from "zod";

const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "صيغة الشهر يجب أن تكون YYYY-MM.")
  .refine((value) => {
    const date = new Date(`${value}-01T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 7) === value;
  }, "الشهر غير صالح.");

const optionalUuid = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.string().uuid("المعرّف غير صالح.").optional(),
);

const booleanFromQuery = z.preprocess(
  (value) => value === "true" || value === "1" || value === true,
  z.boolean(),
);

export const monthlyReportQuerySchema = z.object({
  month: monthSchema,
  kind: z.enum(["COMPREHENSIVE", "EXAMS"]),
  format: z.enum(["excel", "pdf", "csv"]),
  stageId: optionalUuid,
  halaqaId: optionalUuid,
  includeVoided: booleanFromQuery.default(false),
});

export type MonthlyReportQuery = z.infer<typeof monthlyReportQuerySchema>;
