import { z } from "zod";
import { isIsoDateOnly } from "@/lib/memorization-sessions/date";

export const managerAlertsQuerySchema = z.object({
  date: z.string().refine(isIsoDateOnly, "التاريخ غير صالح."),
  lookbackDays: z.coerce.number().int().min(1).max(30).default(7),
});
