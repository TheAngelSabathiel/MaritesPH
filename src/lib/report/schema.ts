/** Validation for "report outdated info" submissions. Shared by the action and tests. */
import { z } from "zod";

export const REPORT_LIMIT = { perWindow: 5, windowSeconds: 3600 } as const;

export const reportSchema = z.object({
  target_type: z.enum(["document", "office"]),
  target_id: z.guid(),
  reason: z.enum(["outdated", "incorrect", "fixer", "other"]),
  details: z.string().trim().min(5).max(1000),
  evidence_url: z
    .string()
    .trim()
    .max(500)
    .regex(/^https?:\/\/\S+$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type ReportInput = z.infer<typeof reportSchema>;
export type ReportState = { status: "idle" | "ok" | "invalid" | "limited" | "signin" | "error" };
