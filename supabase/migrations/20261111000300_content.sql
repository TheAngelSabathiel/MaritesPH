-- =============================================================================
-- Marites PH — Migration 3: verified content (admin-managed, public when published)
-- =============================================================================
-- Every table here carries the "verification block":
--   status            content_status   draft -> verified -> published (-> archived)
--   source_url        text             official source this fact came from
--   last_verified_at  timestamptz      when an admin last checked it against source_url
--   verified_by       uuid             which admin checked it
--   to_verify_note    text             NOT NULL = still has an open TO VERIFY item
--
-- Guardrails enforced by the database itself (not just the UI):
--   * 'verified' or 'published' requires source_url AND last_verified_at.
--   * 'published' requires to_verify_note IS NULL (no guessed facts go live).
--   * Tax rules/deadlines can be 'published' only when cpa_reviewed = true.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- agencies
-- ---------------------------------------------------------------------------
create table public.agencies (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (char_length(name) between 2 and 200),
  acronym           text check (char_length(acronym) <= 20),
  official_url      text check (official_url ~ '^https?://'),
  status            public.content_status not null default 'draft',
  source_url        text check (source_url ~ '^https?://'),
  last_verified_at  timestamptz,
  verified_by       uuid references public.profiles (id) on delete set null,
  to_verify_note    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint agencies_verifiable check (
    status in ('draft', 'archived') or (source_url is not null and last_verified_at is not null)
  ),
  constraint agencies_publishable check (status <> 'published' or to_verify_note is null)
);

-- ---------------------------------------------------------------------------
-- documents: IDs, certificates, clearances, registrations, permits
-- ---------------------------------------------------------------------------
create table public.documents (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name                 text not null check (char_length(name) between 2 and 200),
  type                 public.document_type not null,
  agency_id            uuid references public.agencies (id) on delete restrict,
  purpose_tags         text[] not null default '{}',
  description          text,
  -- Validity: free text for display + optional months for computing expiry.
  validity_text        text,
  validity_months      integer check (validity_months > 0),
  -- Processing time in calendar days (range), plus a note for nuance.
  processing_days_min  integer check (processing_days_min >= 0),
  processing_days_max  integer check (processing_days_max >= 0),
  processing_note      text,
  -- Fees in PHP. Range because many fees vary by option (e.g. rush vs regular).
  fee_min              numeric(12, 2) check (fee_min >= 0),
  fee_max              numeric(12, 2) check (fee_max >= 0),
  fee_currency         char(3) not null default 'PHP',
  fee_note             text,
  status               public.content_status not null default 'draft',
  source_url           text check (source_url ~ '^https?://'),
  last_verified_at     timestamptz,
  verified_by          uuid references public.profiles (id) on delete set null,
  to_verify_note       text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint documents_fee_range check (fee_min is null or fee_max is null or fee_min <= fee_max),
  constraint documents_processing_range check (
    processing_days_min is null or processing_days_max is null
    or processing_days_min <= processing_days_max
  ),
  constraint documents_verifiable check (
    status in ('draft', 'archived') or (source_url is not null and last_verified_at is not null)
  ),
  constraint documents_publishable check (status <> 'published' or to_verify_note is null)
);
create index documents_agency_idx on public.documents (agency_id);
create index documents_status_idx on public.documents (status);
create index documents_purpose_tags_idx on public.documents using gin (purpose_tags);

-- ---------------------------------------------------------------------------
-- document_requirements
-- ---------------------------------------------------------------------------
-- Requirement logic is "AND of groups, OR of options, AND of items":
--   * All distinct group_key values for a document are required (AND).
--   * Within a group, satisfying ANY one option_key is enough (OR).
--   * An option is satisfied when ALL its rows are satisfied (AND).
-- Example: "Valid ID: either a passport, OR a birth certificate + barangay clearance"
--   group 'valid_id', option 'a': [passport]
--   group 'valid_id', option 'b': [birth certificate], [barangay clearance]
-- Each row points either at another document (requires_document_id) or is a
-- free-text requirement (requirement_text), never both.
create table public.document_requirements (
  id                    uuid primary key default gen_random_uuid(),
  document_id           uuid not null references public.documents (id) on delete cascade,
  group_key             text not null check (group_key ~ '^[a-z0-9_]+$'),
  option_key            text not null default 'a' check (option_key ~ '^[a-z0-9_]+$'),
  requires_document_id  uuid references public.documents (id) on delete restrict,
  requirement_text      text check (char_length(requirement_text) <= 500),
  quantity              integer not null default 1 check (quantity > 0),
  notes                 text,
  sort_order            integer not null default 0,
  status                public.content_status not null default 'draft',
  source_url            text check (source_url ~ '^https?://'),
  last_verified_at      timestamptz,
  verified_by           uuid references public.profiles (id) on delete set null,
  to_verify_note        text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint document_requirements_one_target check (
    (requires_document_id is not null) <> (requirement_text is not null)
  ),
  constraint document_requirements_not_self check (requires_document_id <> document_id),
  constraint document_requirements_verifiable check (
    status in ('draft', 'archived') or (source_url is not null and last_verified_at is not null)
  ),
  constraint document_requirements_publishable check (status <> 'published' or to_verify_note is null)
);
create index document_requirements_document_idx on public.document_requirements (document_id);
create index document_requirements_requires_idx on public.document_requirements (requires_document_id);

-- ---------------------------------------------------------------------------
-- accepted_for: which documents satisfy which purposes (bank account, etc.)
-- ---------------------------------------------------------------------------
create table public.accepted_for (
  document_id       uuid not null references public.documents (id) on delete cascade,
  purpose           text not null check (purpose ~ '^[a-z0-9_]+$'),
  notes             text,
  status            public.content_status not null default 'draft',
  source_url        text check (source_url ~ '^https?://'),
  last_verified_at  timestamptz,
  verified_by       uuid references public.profiles (id) on delete set null,
  to_verify_note    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (document_id, purpose),
  constraint accepted_for_verifiable check (
    status in ('draft', 'archived') or (source_url is not null and last_verified_at is not null)
  ),
  constraint accepted_for_publishable check (status <> 'published' or to_verify_note is null)
);
create index accepted_for_purpose_idx on public.accepted_for (purpose);

-- ---------------------------------------------------------------------------
-- guide_steps
-- ---------------------------------------------------------------------------
create table public.guide_steps (
  id                 uuid primary key default gen_random_uuid(),
  document_id        uuid not null references public.documents (id) on delete cascade,
  step_order         integer not null check (step_order > 0),
  title              text not null check (char_length(title) between 2 and 200),
  body_md            text not null default '',
  is_online          boolean not null default false,
  estimated_minutes  integer check (estimated_minutes > 0),
  status             public.content_status not null default 'draft',
  source_url         text check (source_url ~ '^https?://'),
  last_verified_at   timestamptz,
  verified_by        uuid references public.profiles (id) on delete set null,
  to_verify_note     text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- Deferrable so the admin UI can reorder steps inside one transaction.
  constraint guide_steps_order_unique unique (document_id, step_order) deferrable initially deferred,
  constraint guide_steps_verifiable check (
    status in ('draft', 'archived') or (source_url is not null and last_verified_at is not null)
  ),
  constraint guide_steps_publishable check (status <> 'published' or to_verify_note is null)
);

-- ---------------------------------------------------------------------------
-- offices
-- ---------------------------------------------------------------------------
-- hours: one JSON object for the whole week. Keys mon..sun, each an array of
-- [open, close] pairs in 24h "HH:MM" local Philippine time. Missing or empty = closed.
--   {"mon": [["08:00","17:00"]], "sat": [["08:00","12:00"]], "sun": []}
-- (Refinement of the brief's separate hours/weekend_hours: one structure
--  covers both and avoids the two disagreeing. Validated with Zod in the app.)
create table public.offices (
  id                uuid primary key default gen_random_uuid(),
  agency_id         uuid not null references public.agencies (id) on delete restrict,
  name              text not null check (char_length(name) between 2 and 200),
  address           text,
  region            text,
  province          text,
  city              text,
  barangay          text,
  lat               numeric(9, 6) check (lat between 4 and 22),     -- rough PH bounds
  lng               numeric(9, 6) check (lng between 116 and 127),  -- rough PH bounds
  hours             jsonb not null default '{}'::jsonb check (jsonb_typeof(hours) = 'object'),
  hours_note        text,
  accepts_walk_in   boolean,           -- null = unknown
  appointment_url   text check (appointment_url ~ '^https?://'),
  status            public.content_status not null default 'draft',
  source_url        text check (source_url ~ '^https?://'),
  last_verified_at  timestamptz,
  verified_by       uuid references public.profiles (id) on delete set null,
  to_verify_note    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint offices_verifiable check (
    status in ('draft', 'archived') or (source_url is not null and last_verified_at is not null)
  ),
  constraint offices_publishable check (status <> 'published' or to_verify_note is null)
);
create index offices_agency_idx on public.offices (agency_id);
create index offices_location_idx on public.offices (region, province, city);

-- ---------------------------------------------------------------------------
-- office_services: which office handles which document
-- ---------------------------------------------------------------------------
create table public.office_services (
  office_id         uuid not null references public.offices (id) on delete cascade,
  document_id       uuid not null references public.documents (id) on delete cascade,
  notes             text,
  status            public.content_status not null default 'draft',
  source_url        text check (source_url ~ '^https?://'),
  last_verified_at  timestamptz,
  verified_by       uuid references public.profiles (id) on delete set null,
  to_verify_note    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (office_id, document_id),
  constraint office_services_verifiable check (
    status in ('draft', 'archived') or (source_url is not null and last_verified_at is not null)
  ),
  constraint office_services_publishable check (status <> 'published' or to_verify_note is null)
);
create index office_services_document_idx on public.office_services (document_id);

-- ---------------------------------------------------------------------------
-- lgu_processes: city/municipality-level processes (few cities at first)
-- ---------------------------------------------------------------------------
create table public.lgu_processes (
  id                uuid primary key default gen_random_uuid(),
  province          text,
  city              text not null,
  process_type      text not null check (process_type in (
                      'new_business_permit', 'business_permit_renewal',
                      'barangay_clearance', 'other')),
  title             text not null,
  steps             jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  requirements      jsonb not null default '[]'::jsonb check (jsonb_typeof(requirements) = 'array'),
  fees              jsonb not null default '[]'::jsonb check (jsonb_typeof(fees) = 'array'),
  deadlines         jsonb not null default '[]'::jsonb check (jsonb_typeof(deadlines) = 'array'),
  status            public.content_status not null default 'draft',
  source_url        text check (source_url ~ '^https?://'),
  last_verified_at  timestamptz,
  verified_by       uuid references public.profiles (id) on delete set null,
  to_verify_note    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint lgu_processes_unique unique nulls not distinct (province, city, process_type),
  constraint lgu_processes_verifiable check (
    status in ('draft', 'archived') or (source_url is not null and last_verified_at is not null)
  ),
  constraint lgu_processes_publishable check (status <> 'published' or to_verify_note is null)
);

-- ---------------------------------------------------------------------------
-- tax_rules: every rate, threshold and form code is data, effective-dated
-- ---------------------------------------------------------------------------
create table public.tax_rules (
  id                uuid primary key default gen_random_uuid(),
  rule_key          text not null check (rule_key ~ '^[a-z0-9_.]+$'),
  description       text not null,
  parameters        jsonb not null default '{}'::jsonb,
  effective_from    date not null,
  effective_to      date,            -- exclusive; null = still in effect
  cpa_reviewed      boolean not null default false,
  reviewed_at       timestamptz,
  reviewed_by       uuid references public.profiles (id) on delete set null,
  status            public.content_status not null default 'draft',
  source_url        text check (source_url ~ '^https?://'),
  last_verified_at  timestamptz,
  verified_by       uuid references public.profiles (id) on delete set null,
  to_verify_note    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint tax_rules_dates check (effective_to is null or effective_to > effective_from),
  constraint tax_rules_cpa_before_publish check (status <> 'published' or cpa_reviewed),
  constraint tax_rules_verifiable check (
    status in ('draft', 'archived') or (source_url is not null and last_verified_at is not null)
  ),
  constraint tax_rules_publishable check (status <> 'published' or to_verify_note is null),
  -- Two live versions of the same rule may never overlap in time.
  -- Drafts may overlap (they are proposals).
  constraint tax_rules_no_overlap exclude using gist (
    rule_key with =,
    daterange(effective_from, effective_to, '[)') with &&
  ) where (status in ('verified', 'published'))
);

-- ---------------------------------------------------------------------------
-- tax_deadlines
-- ---------------------------------------------------------------------------
-- due_rule examples (validated with Zod in the app, Phase 7):
--   {"kind": "day_after_period_end", "days": 60}
--   {"kind": "fixed_date", "month": 4, "day": 15}
create table public.tax_deadlines (
  id                uuid primary key default gen_random_uuid(),
  form_code         text not null check (char_length(form_code) between 1 and 30),
  frequency         text not null check (frequency in ('monthly', 'quarterly', 'annual', 'one_time')),
  due_rule          jsonb not null check (jsonb_typeof(due_rule) = 'object'),
  applies_to        text[] not null default '{}',
  description       text,
  effective_from    date not null,
  effective_to      date,
  cpa_reviewed      boolean not null default false,
  reviewed_at       timestamptz,
  reviewed_by       uuid references public.profiles (id) on delete set null,
  status            public.content_status not null default 'draft',
  source_url        text check (source_url ~ '^https?://'),
  last_verified_at  timestamptz,
  verified_by       uuid references public.profiles (id) on delete set null,
  to_verify_note    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint tax_deadlines_dates check (effective_to is null or effective_to > effective_from),
  constraint tax_deadlines_cpa_before_publish check (status <> 'published' or cpa_reviewed),
  constraint tax_deadlines_verifiable check (
    status in ('draft', 'archived') or (source_url is not null and last_verified_at is not null)
  ),
  constraint tax_deadlines_publishable check (status <> 'published' or to_verify_note is null),
  constraint tax_deadlines_no_overlap exclude using gist (
    form_code with =,
    frequency with =,
    daterange(effective_from, effective_to, '[)') with &&
  ) where (status in ('verified', 'published'))
);

-- ---------------------------------------------------------------------------
-- updated_at triggers + RLS for every content table
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'agencies', 'documents', 'document_requirements', 'accepted_for', 'guide_steps',
    'offices', 'office_services', 'lgu_processes', 'tax_rules', 'tax_deadlines'
  ]
  loop
    execute format(
      'create trigger %1$s_set_updated_at before update on public.%1$I
         for each row execute function public.set_updated_at()', t);

    execute format('alter table public.%I enable row level security', t);

    -- Admins can read everything (drafts included) and are the only writers.
    execute format(
      'create policy "%1$s: admins read all" on public.%1$I
         for select to authenticated using (public.is_admin())', t);
    execute format(
      'create policy "%1$s: admins insert" on public.%1$I
         for insert to authenticated with check (public.is_admin())', t);
    execute format(
      'create policy "%1$s: admins update" on public.%1$I
         for update to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    execute format(
      'create policy "%1$s: admins delete" on public.%1$I
         for delete to authenticated using (public.is_admin())', t);
  end loop;
end;
$$;

-- Public read policies. Child rows are public only when they AND their parent
-- document (or office) are published.
create policy "agencies: public reads published" on public.agencies
  for select to anon, authenticated using (status = 'published');

create policy "documents: public reads published" on public.documents
  for select to anon, authenticated using (status = 'published');

create policy "document_requirements: public reads published" on public.document_requirements
  for select to anon, authenticated using (
    status = 'published'
    and exists (select 1 from public.documents d where d.id = document_id and d.status = 'published')
  );

create policy "accepted_for: public reads published" on public.accepted_for
  for select to anon, authenticated using (
    status = 'published'
    and exists (select 1 from public.documents d where d.id = document_id and d.status = 'published')
  );

create policy "guide_steps: public reads published" on public.guide_steps
  for select to anon, authenticated using (
    status = 'published'
    and exists (select 1 from public.documents d where d.id = document_id and d.status = 'published')
  );

create policy "offices: public reads published" on public.offices
  for select to anon, authenticated using (status = 'published');

create policy "office_services: public reads published" on public.office_services
  for select to anon, authenticated using (
    status = 'published'
    and exists (select 1 from public.offices o where o.id = office_id and o.status = 'published')
    and exists (select 1 from public.documents d where d.id = document_id and d.status = 'published')
  );

create policy "lgu_processes: public reads published" on public.lgu_processes
  for select to anon, authenticated using (status = 'published');

create policy "tax_rules: public reads published" on public.tax_rules
  for select to anon, authenticated using (status = 'published');

create policy "tax_deadlines: public reads published" on public.tax_deadlines
  for select to anon, authenticated using (status = 'published');
