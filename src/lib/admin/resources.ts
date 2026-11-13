/**
 * Admin resource definitions: one description per content type drives the
 * list pages, forms, and save logic. Plain data only (no functions), so Client
 * Components can import it. Validation schemas live in ./schemas.ts (server).
 *
 * The admin panel is an internal tool and is English-only by design; public UI
 * strings stay in src/i18n/messages.
 */

export type FieldKind =
  | "text"
  | "textarea"
  | "url"
  | "number"
  | "money"
  | "date"
  | "select"
  | "checkbox"
  | "tristate"
  | "tags"
  | "hours"
  | "reference"
  | "target"
  | "json";

export type FieldDef = {
  name: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  help?: string;
  placeholder?: string;
  /** For "select". */
  options?: { value: string; label: string }[];
  /** For "reference": which resource's records to offer. */
  references?: ResourceKey;
  /** Half width on wide screens (forms are always one column on phones). */
  half?: boolean;
};

export type ResourceKey =
  | "lgu_process"
  | "tax_rule"
  | "tax_deadline"
  | "agency"
  | "document"
  | "document_requirement"
  | "accepted_for"
  | "guide_step"
  | "office"
  | "office_service"
  | "legal_reference";

export type ResourceDef = {
  key: ResourceKey;
  /** URL segment under /admin. */
  slug: string;
  table: string;
  singular: string;
  plural: string;
  labelColumn: string;
  /** Top-level resources get their own list page and nav entry. */
  topLevel: boolean;
  /** Child resources are edited on their parent's page. */
  parent?: { resource: ResourceKey; column: string };
  /** Polymorphic parent (legal references): set from the target field. */
  polymorphicParent?: boolean;
  orderBy: { column: string; ascending: boolean }[];
  /** Columns shown in list views (besides label and status). */
  listColumns: { name: string; label: string }[];
  fields: FieldDef[];
  /**
   * Fields that are NOT facts. Changing any other field on a verified or
   * published record requires re-verification (see workflow.applyEdit).
   */
  nonFactual: string[];
};

/** Appended to every resource: where the fact comes from and what's unconfirmed. */
export const verificationFields: FieldDef[] = [
  {
    name: "source_url",
    label: "Official source URL",
    kind: "url",
    help: "The official page or issuance this information comes from.",
    placeholder: "https://",
  },
  {
    name: "to_verify_note",
    label: "TO VERIFY note",
    kind: "textarea",
    help: "Describe anything not yet confirmed. Must be empty before this can be verified or published.",
    placeholder: "TO VERIFY: ...",
  },
];

const documentTypeOptions = [
  { value: "id", label: "ID" },
  { value: "certificate", label: "Certificate" },
  { value: "clearance", label: "Clearance" },
  { value: "registration", label: "Registration" },
  { value: "permit", label: "Permit" },
  { value: "filing", label: "Filing walkthrough" },
  { value: "other", label: "Other" },
];

export const sourceRankOptions = [
  { value: "1", label: "Rank 1: Law (Republic Act) or Constitution" },
  { value: "2", label: "Rank 2: IRR or executive order" },
  { value: "3", label: "Rank 3: Agency issuance (circular, order, regulation)" },
  { value: "4", label: "Rank 4: Official advisory or announcement" },
];

const issuanceTypeOptions = [
  { value: "constitution", label: "Constitution" },
  { value: "republic_act", label: "Republic Act" },
  { value: "irr", label: "Implementing rules (IRR)" },
  { value: "executive_order", label: "Executive order" },
  { value: "regulation", label: "Regulation" },
  { value: "memorandum_circular", label: "Memorandum circular" },
  { value: "order", label: "Order" },
  { value: "advisory", label: "Advisory" },
  { value: "other", label: "Other" },
];

const taxOptionHelp = "Comma-separated: eight_percent, graduated, all, or employer (monthly remittances)";

export const resources: Record<ResourceKey, ResourceDef> = {
  lgu_process: {
    key: "lgu_process",
    slug: "lgu-processes",
    table: "lgu_processes",
    singular: "LGU process",
    plural: "LGU processes",
    labelColumn: "title",
    topLevel: true,
    orderBy: [
      { column: "city", ascending: true },
      { column: "process_type", ascending: true },
    ],
    listColumns: [
      { name: "city", label: "City" },
      { name: "process_type", label: "Process" },
    ],
    fields: [
      { name: "city", label: "City or municipality", kind: "text", required: true, half: true, placeholder: "Quezon City" },
      { name: "province", label: "Province (blank for NCR)", kind: "text", half: true },
      {
        name: "process_type",
        label: "Process",
        kind: "select",
        required: true,
        options: [
          { value: "business_permit_renewal", label: "Business permit renewal" },
          { value: "new_business_permit", label: "New business permit" },
          { value: "barangay_clearance", label: "Barangay clearance" },
          { value: "other", label: "Other" },
        ],
      },
      { name: "title", label: "Title", kind: "text", required: true },
      { name: "steps", label: "Steps (JSON)", kind: "json", help: '[{"title": "...", "body": "..."}]' },
      { name: "requirements", label: "Requirements (JSON)", kind: "json", help: '[{"text": "...", "note": "..."}]' },
      { name: "fees", label: "Fees (JSON)", kind: "json", help: '[{"label": "...", "amount": 500, "note": "..."}] (amount null when it depends on gross sales)' },
      { name: "deadlines", label: "Deadlines (JSON)", kind: "json", help: '[{"label": "Renew without surcharge", "month": 1, "day": 20}]' },
    ],
    nonFactual: [],
  },

  tax_rule: {
    key: "tax_rule",
    slug: "tax-rules",
    table: "tax_rules",
    singular: "Tax rule",
    plural: "Tax rules",
    labelColumn: "rule_key",
    topLevel: true,
    orderBy: [
      { column: "rule_key", ascending: true },
      { column: "effective_from", ascending: false },
    ],
    listColumns: [
      { name: "effective_from", label: "From" },
      { name: "effective_to", label: "Until" },
      { name: "cpa_reviewed", label: "CPA reviewed" },
    ],
    fields: [
      {
        name: "rule_key",
        label: "Rule key",
        kind: "text",
        required: true,
        help: "income_tax.graduated, income_tax.eight_percent, income_tax.osd, or percentage_tax.rate (the engine validates parameters per key).",
      },
      { name: "description", label: "Description", kind: "textarea", required: true },
      {
        name: "parameters",
        label: "Parameters (JSON)",
        kind: "json",
        required: true,
        help: 'Example for percentage_tax.rate: {"rate": 0.03}. Rates are decimals (3% = 0.03).',
      },
      { name: "effective_from", label: "Effective from", kind: "date", required: true, half: true },
      { name: "effective_to", label: "Effective until (exclusive, optional)", kind: "date", half: true },
    ],
    nonFactual: [],
  },

  tax_deadline: {
    key: "tax_deadline",
    slug: "tax-deadlines",
    table: "tax_deadlines",
    singular: "Tax deadline",
    plural: "Tax deadlines",
    labelColumn: "form_code",
    topLevel: true,
    orderBy: [
      { column: "form_code", ascending: true },
      { column: "effective_from", ascending: false },
    ],
    listColumns: [
      { name: "frequency", label: "Frequency" },
      { name: "effective_from", label: "From" },
      { name: "cpa_reviewed", label: "CPA reviewed" },
    ],
    fields: [
      { name: "form_code", label: "BIR form", kind: "text", required: true, half: true, placeholder: "1701Q" },
      {
        name: "frequency",
        label: "Frequency",
        kind: "select",
        required: true,
        half: true,
        options: [
          { value: "monthly", label: "Monthly" },
          { value: "quarterly", label: "Quarterly" },
          { value: "annual", label: "Annual" },
          { value: "one_time", label: "One time" },
        ],
      },
      {
        name: "due_rule",
        label: "Due date rule (JSON)",
        kind: "json",
        required: true,
        help: 'quarterly_fixed {"kind":"quarterly_fixed","dates":[{"quarter":1,"month":5,"day":15}]}, after_quarter_end {"kind":"after_quarter_end","days":25}, or annual_fixed {"kind":"annual_fixed","month":4,"day":15,"yearOffset":1}.',
      },
      { name: "applies_to", label: "Applies to", kind: "tags", help: taxOptionHelp },
      { name: "description", label: "Description", kind: "textarea" },
      { name: "effective_from", label: "Effective from", kind: "date", required: true, half: true },
      { name: "effective_to", label: "Effective until (exclusive, optional)", kind: "date", half: true },
    ],
    nonFactual: [],
  },

  agency: {
    key: "agency",
    slug: "agencies",
    table: "agencies",
    singular: "Agency",
    plural: "Agencies",
    labelColumn: "name",
    topLevel: true,
    orderBy: [{ column: "name", ascending: true }],
    listColumns: [{ name: "acronym", label: "Acronym" }],
    fields: [
      { name: "name", label: "Name", kind: "text", required: true },
      { name: "acronym", label: "Acronym", kind: "text", half: true },
      { name: "official_url", label: "Official website", kind: "url", half: true, placeholder: "https://" },
    ],
    nonFactual: [],
  },

  document: {
    key: "document",
    slug: "documents",
    table: "documents",
    singular: "Document",
    plural: "Documents",
    labelColumn: "name",
    topLevel: true,
    orderBy: [{ column: "name", ascending: true }],
    listColumns: [
      { name: "type", label: "Type" },
      { name: "slug", label: "URL slug" },
    ],
    fields: [
      { name: "name", label: "Name", kind: "text", required: true },
      {
        name: "slug",
        label: "URL slug",
        kind: "text",
        required: true,
        half: true,
        help: "Lowercase words joined by hyphens, e.g. nbi-clearance. Changing it changes the public URL.",
      },
      { name: "type", label: "Type", kind: "select", required: true, options: documentTypeOptions, half: true },
      { name: "agency_id", label: "Issuing agency", kind: "reference", references: "agency" },
      { name: "description", label: "Description", kind: "textarea" },
      {
        name: "purpose_tags",
        label: "Purpose tags",
        kind: "tags",
        help: "Comma-separated, e.g. valid_id, bank_account",
      },
      { name: "validity_text", label: "Validity (as shown to users)", kind: "text", half: true },
      { name: "validity_months", label: "Validity in months", kind: "number", half: true },
      { name: "processing_days_min", label: "Processing days (min)", kind: "number", half: true },
      { name: "processing_days_max", label: "Processing days (max)", kind: "number", half: true },
      { name: "processing_note", label: "Processing note", kind: "textarea" },
      { name: "fee_min", label: "Fee from (₱)", kind: "money", half: true },
      { name: "fee_max", label: "Fee up to (₱)", kind: "money", half: true },
      { name: "fee_note", label: "Fee note", kind: "textarea" },
    ],
    nonFactual: ["slug"],
  },

  document_requirement: {
    key: "document_requirement",
    slug: "requirements",
    table: "document_requirements",
    singular: "Requirement",
    plural: "Requirements",
    labelColumn: "requirement_text",
    topLevel: false,
    parent: { resource: "document", column: "document_id" },
    orderBy: [
      { column: "sort_order", ascending: true },
      { column: "group_key", ascending: true },
    ],
    listColumns: [],
    fields: [
      {
        name: "group_key",
        label: "Group",
        kind: "text",
        required: true,
        half: true,
        help: "Every group is required. Example: valid_id",
      },
      {
        name: "option_key",
        label: "Option",
        kind: "text",
        required: true,
        half: true,
        help: "Inside a group, any ONE option is enough. Rows with the same option are all needed together.",
      },
      {
        name: "requires_document_id",
        label: "Required document",
        kind: "reference",
        references: "document",
        help: "Pick a document, OR write a free-text requirement below. Not both.",
      },
      { name: "requirement_text", label: "Free-text requirement", kind: "textarea" },
      { name: "quantity", label: "Quantity", kind: "number", half: true },
      { name: "sort_order", label: "Sort order", kind: "number", half: true },
      { name: "notes", label: "Notes", kind: "textarea" },
    ],
    nonFactual: ["sort_order"],
  },

  accepted_for: {
    key: "accepted_for",
    slug: "accepted-for",
    table: "accepted_for",
    singular: "Accepted purpose",
    plural: "Accepted for",
    labelColumn: "purpose",
    topLevel: false,
    parent: { resource: "document", column: "document_id" },
    orderBy: [{ column: "purpose", ascending: true }],
    listColumns: [],
    fields: [
      {
        name: "purpose",
        label: "Purpose",
        kind: "text",
        required: true,
        help: "Lowercase with underscores, e.g. bank_account, remittance, employment",
      },
      { name: "notes", label: "Notes", kind: "textarea" },
    ],
    nonFactual: [],
  },

  guide_step: {
    key: "guide_step",
    slug: "steps",
    table: "guide_steps",
    singular: "Guide step",
    plural: "Guide steps",
    labelColumn: "title",
    topLevel: false,
    parent: { resource: "document", column: "document_id" },
    orderBy: [{ column: "step_order", ascending: true }],
    listColumns: [],
    fields: [
      { name: "step_order", label: "Step number", kind: "number", required: true, half: true },
      { name: "estimated_minutes", label: "Estimated minutes", kind: "number", half: true },
      { name: "title", label: "Title", kind: "text", required: true },
      {
        name: "body_md",
        label: "Instructions",
        kind: "textarea",
        help: "Plain, calm language. No jokes in steps.",
      },
      { name: "is_online", label: "This step is done online", kind: "checkbox" },
    ],
    nonFactual: ["step_order"],
  },

  office: {
    key: "office",
    slug: "offices",
    table: "offices",
    singular: "Office",
    plural: "Offices",
    labelColumn: "name",
    topLevel: true,
    orderBy: [
      { column: "region", ascending: true },
      { column: "city", ascending: true },
      { column: "name", ascending: true },
    ],
    listColumns: [
      { name: "city", label: "City" },
      { name: "region", label: "Region" },
    ],
    fields: [
      { name: "agency_id", label: "Agency", kind: "reference", references: "agency", required: true },
      { name: "name", label: "Office name", kind: "text", required: true },
      {
        name: "slug",
        label: "URL slug",
        kind: "text",
        help: "Leave empty to generate from the name. Changing it changes the public URL.",
      },
      { name: "address", label: "Address", kind: "textarea" },
      { name: "region", label: "Region", kind: "text", half: true, placeholder: "NCR" },
      { name: "province", label: "Province", kind: "text", half: true },
      { name: "city", label: "City / municipality", kind: "text", half: true },
      { name: "barangay", label: "Barangay", kind: "text", half: true },
      { name: "lat", label: "Latitude", kind: "number", half: true, help: "e.g. 14.5995" },
      { name: "lng", label: "Longitude", kind: "number", half: true, help: "e.g. 120.9842" },
      { name: "hours", label: "Opening hours (Philippine time)", kind: "hours" },
      { name: "hours_note", label: "Hours note", kind: "text" },
      { name: "accepts_walk_in", label: "Accepts walk-ins", kind: "tristate", half: true },
      { name: "appointment_url", label: "Appointment URL", kind: "url", half: true, placeholder: "https://" },
    ],
    nonFactual: ["slug"],
  },

  office_service: {
    key: "office_service",
    slug: "office-services",
    table: "office_services",
    singular: "Service at this office",
    plural: "Services",
    labelColumn: "document_id",
    topLevel: false,
    parent: { resource: "office", column: "office_id" },
    orderBy: [{ column: "created_at", ascending: true }],
    listColumns: [],
    fields: [
      { name: "document_id", label: "Document handled here", kind: "reference", references: "document", required: true },
      { name: "notes", label: "Notes", kind: "textarea" },
    ],
    nonFactual: [],
  },

  legal_reference: {
    key: "legal_reference",
    slug: "legal-references",
    table: "legal_references",
    singular: "Legal reference",
    plural: "Legal basis",
    labelColumn: "citation_title",
    topLevel: false,
    polymorphicParent: true,
    orderBy: [
      { column: "source_rank", ascending: true },
      { column: "date_issued", ascending: false },
    ],
    listColumns: [],
    fields: [
      {
        name: "target",
        label: "This explains",
        kind: "target",
        required: true,
        help: "The record this law or issuance is the basis for.",
      },
      { name: "source_rank", label: "Source type", kind: "select", required: true, options: sourceRankOptions },
      { name: "issuance_type", label: "Issuance type", kind: "select", required: true, options: issuanceTypeOptions, half: true },
      { name: "issuance_number", label: "Number", kind: "text", half: true, placeholder: "RA 11055" },
      { name: "citation_title", label: "Title", kind: "text", required: true },
      { name: "issuing_body", label: "Issuing body", kind: "text", required: true, half: true },
      { name: "date_issued", label: "Date issued", kind: "date", half: true },
      { name: "section", label: "Section(s)", kind: "text", placeholder: "Sec. 5" },
      { name: "note", label: "What it requires, in plain words", kind: "textarea" },
    ],
    nonFactual: [],
  },
};

export function resourceBySlug(slug: string): ResourceDef | undefined {
  return Object.values(resources).find((r) => r.slug === slug);
}

/** All form fields for a resource, including the verification block. */
export function allFields(resource: ResourceDef): FieldDef[] {
  return [...resource.fields, ...verificationFields];
}

/** Fields whose change requires re-verification. */
export function factualFields(resource: ResourceDef): string[] {
  return allFields(resource)
    .filter((f) => f.name !== "to_verify_note" && f.kind !== "target" && !resource.nonFactual.includes(f.name))
    .map((f) => f.name)
    .concat(resource.polymorphicParent ? ["target_type", "target_id"] : []);
}

/** Map a content_index target type to its admin resource, where one exists. */
export function resourceForTargetType(type: string): ResourceDef | undefined {
  return Object.values(resources).find((r) => r.key === type);
}
