/**
 * Zod schemas for admin form payloads (after ./form.ts has converted raw form
 * fields into typed values). Mirror the database CHECK constraints so admins
 * get clear field errors instead of database errors.
 */
import { z } from "zod";
import { hoursSchema } from "@/lib/content/hours";
import { dueRuleSchema, ruleParameterSchemas } from "@/lib/engines/tax";
import { lguDeadlinesSchema, lguFeesSchema, lguRequirementsSchema, lguStepsSchema } from "@/lib/engines/lgu";
import type { ResourceKey } from "./resources";

const optionalText = (max: number) => z.string().trim().max(max).nullable();
const requiredText = (min: number, max: number) => z.string().trim().min(min, "Required").max(max);
const url = z
  .string()
  .regex(/^https?:\/\/\S+$/, "Must be a full URL starting with https://")
  .nullable();
// z.guid(), not z.uuid(): Postgres accepts any well-formed UUID (seed ids use version 0),
// while z.uuid() enforces RFC version bits and would reject them.
const uuid = z.guid("Pick an option");
const optionalUuid = z.guid().nullable();
const count = z.number().int("Whole number").min(0, "Can't be negative").nullable();
const money = z.number().min(0, "Can't be negative").max(10_000_000).multipleOf(0.01).nullable();
const key = z.string().trim().regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers, and underscores only");

const verification = {
  source_url: url,
  to_verify_note: optionalText(2000),
};

const isoDate = z.iso.date("Use YYYY-MM-DD");

export const schemas: Record<ResourceKey, z.ZodType<Record<string, unknown>>> = {
  lgu_process: z.object({
    city: requiredText(2, 80),
    province: optionalText(80),
    process_type: z.enum(["new_business_permit", "business_permit_renewal", "barangay_clearance", "other"]),
    title: requiredText(2, 200),
    steps: z.preprocess((v) => v ?? [], lguStepsSchema),
    requirements: z.preprocess((v) => v ?? [], lguRequirementsSchema),
    fees: z.preprocess((v) => v ?? [], lguFeesSchema),
    deadlines: z.preprocess((v) => v ?? [], lguDeadlinesSchema),
    ...verification,
  }),

  tax_rule: z
    .object({
      rule_key: z.string().trim().regex(/^[a-z0-9_.]+$/, "Lowercase letters, numbers, dots, underscores"),
      description: requiredText(2, 1000),
      parameters: z.record(z.string(), z.unknown()),
      effective_from: isoDate,
      effective_to: isoDate.nullable(),
      ...verification,
    })
    .superRefine((v, ctx) => {
      const known = ruleParameterSchemas[v.rule_key];
      if (known && !known.safeParse(v.parameters).success) {
        ctx.addIssue({ code: "custom", path: ["parameters"], message: `Doesn't match the expected shape for ${v.rule_key}` });
      }
      if (v.effective_to && v.effective_to <= v.effective_from) ctx.addIssue({ code: "custom", path: ["effective_to"], message: "Must be after the start date" });
    }),

  tax_deadline: z
    .object({
      form_code: requiredText(1, 30),
      frequency: z.enum(["monthly", "quarterly", "annual", "one_time"]),
      due_rule: z.record(z.string(), z.unknown()),
      applies_to: z.array(z.enum(["eight_percent", "graduated", "all", "employer"])).min(1, "Add at least one"),
      description: optionalText(1000),
      effective_from: isoDate,
      effective_to: isoDate.nullable(),
      ...verification,
    })
    .superRefine((v, ctx) => {
      if (!dueRuleSchema.safeParse(v.due_rule).success) ctx.addIssue({ code: "custom", path: ["due_rule"], message: "Not a recognized due date rule" });
      if (v.effective_to && v.effective_to <= v.effective_from) ctx.addIssue({ code: "custom", path: ["effective_to"], message: "Must be after the start date" });
    }),

  agency: z.object({
    name: requiredText(2, 200),
    acronym: optionalText(20),
    official_url: url,
    ...verification,
  }),

  document: z
    .object({
      name: requiredText(2, 200),
      slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase words joined by hyphens"),
      type: z.enum(["id", "certificate", "clearance", "registration", "permit", "filing", "other"]),
      agency_id: optionalUuid,
      description: optionalText(4000),
      purpose_tags: z.array(key).max(20),
      validity_text: optionalText(200),
      validity_months: z.number().int().min(1, "At least 1").nullable(),
      processing_days_min: count,
      processing_days_max: count,
      processing_note: optionalText(1000),
      fee_min: money,
      fee_max: money,
      fee_note: optionalText(1000),
      ...verification,
    })
    .superRefine((v, ctx) => {
      if (v.fee_min != null && v.fee_max != null && v.fee_min > v.fee_max) {
        ctx.addIssue({ code: "custom", path: ["fee_max"], message: "Must be at least the minimum fee" });
      }
      if (v.processing_days_min != null && v.processing_days_max != null && v.processing_days_min > v.processing_days_max) {
        ctx.addIssue({ code: "custom", path: ["processing_days_max"], message: "Must be at least the minimum" });
      }
    }),

  document_requirement: z
    .object({
      document_id: uuid,
      group_key: key,
      option_key: key,
      requires_document_id: optionalUuid,
      requirement_text: optionalText(500),
      quantity: z.number().int().min(1, "At least 1").nullable().transform((q) => q ?? 1),
      sort_order: z.number().int().nullable().transform((n) => n ?? 0),
      notes: optionalText(1000),
      ...verification,
    })
    .superRefine((v, ctx) => {
      const hasDoc = Boolean(v.requires_document_id);
      const hasText = Boolean(v.requirement_text);
      if (hasDoc === hasText) {
        ctx.addIssue({
          code: "custom",
          path: ["requirement_text"],
          message: "Pick a required document OR write a free-text requirement (exactly one).",
        });
      }
      if (v.requires_document_id && v.requires_document_id === v.document_id) {
        ctx.addIssue({ code: "custom", path: ["requires_document_id"], message: "A document can't require itself" });
      }
    }),

  accepted_for: z.object({
    document_id: uuid,
    purpose: key,
    notes: optionalText(1000),
    ...verification,
  }),

  guide_step: z.object({
    document_id: uuid,
    step_order: z.number().int().min(1, "Start at 1").nullable().refine((n) => n !== null, "Required"),
    title: requiredText(2, 200),
    body_md: z.string().max(10_000).nullable().transform((b) => b ?? ""),
    is_online: z.boolean(),
    estimated_minutes: z.number().int().min(1, "At least 1").nullable(),
    ...verification,
  }),

  office: z.object({
    agency_id: uuid,
    name: requiredText(2, 200),
    // null lets the database generate the slug from the name.
    slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase words joined by hyphens").nullable(),
    address: optionalText(500),
    region: optionalText(80),
    province: optionalText(80),
    city: optionalText(80),
    barangay: optionalText(80),
    lat: z.number().min(4, "Outside the Philippines").max(22, "Outside the Philippines").nullable(),
    lng: z.number().min(116, "Outside the Philippines").max(127, "Outside the Philippines").nullable(),
    hours: hoursSchema,
    hours_note: optionalText(300),
    accepts_walk_in: z.boolean().nullable(),
    appointment_url: url,
    ...verification,
  }),

  office_service: z.object({
    office_id: uuid,
    document_id: uuid,
    notes: optionalText(1000),
    ...verification,
  }),

  legal_reference: z.object({
    target_type: z.enum(["agency", "document", "document_requirement", "accepted_for", "guide_step", "office", "office_service"]),
    target_id: uuid,
    source_rank: z.number().int().min(1).max(4),
    issuance_type: z.enum([
      "constitution", "republic_act", "irr", "executive_order", "regulation",
      "memorandum_circular", "order", "advisory", "other",
    ]),
    issuance_number: optionalText(80),
    citation_title: requiredText(2, 300),
    issuing_body: requiredText(2, 200),
    date_issued: z.iso.date("Use YYYY-MM-DD").nullable(),
    section: optionalText(200),
    note: optionalText(2000),
    ...verification,
  }),
};
