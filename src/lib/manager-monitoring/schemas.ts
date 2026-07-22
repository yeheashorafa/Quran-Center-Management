import { z } from "zod";
import { isIsoDateOnly } from "@/lib/memorization-sessions/date";

export const managerMonitoringQuerySchema = z.object({
  date: z.string().refine(isIsoDateOnly, "التاريخ غير صالح."),
});
