-- =============================================================================
-- Marites PH — Migration 4 (Phase 2): admin workflow
--   * stable uuid ids on composite-key content tables (for polymorphic links)
--   * content_target_type + validator for polymorphic references
--   * legal_references ("Bakit ganito?" legal basis)
--   * content_flags (user reports + system flags; admin review queue)
--   * verification_events (audit trail of every status change)
--   * content_index view (one list of all content for admin queues)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Composite-key tables get a stable uuid so they can be referenced like others.
-- ---------------------------------------------------------------------------
alter table public.accepted_for add column id uuid not null default gen_random_uuid();
alter table public.accepted_for add constraint accepted_for_id_key unique (id);
alter table public.office_services add column id uuid not null default gen_random_uuid();
alter table public.office_services add constraint office_services_id_key unique (id);

-- ---------------------------------------------------------------------------
-- Polymorphic target types
-- ---------------------------------------------------------------------------
create type public.content_target_type as enum (
  'agency', 'document', 'document_requirement', 'accepted_for', 'guide_step',
  'office', 'office_service', 'lgu_process', 'tax_rule', 'tax_deadline', 'legal_reference'
);

-- Maps a target type to its table. Single source of truth for SQL helpers.
create or replace function public.content_table_for(p_type public.content_target_type)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_type
    when 'agency' then 'agencies'
    when 'document' then 'documents'
    when 'document_requirement' then 'document_requirements'
    when 'accepted_for' then 'accepted_for'
    when 'guide_step' then 'guide_steps'
    when 'office' then 'offices'
    when 'office_service' then 'office_services'
    when 'lgu_process' then 'lgu_processes'
    when 'tax_rule' then 'tax_rules'
    when 'tax_deadline' then 'tax_deadlines'
    when 'legal_reference' then 'legal_references'
  end;
$$;

-- Trigger: reject rows whose (target_type, target_id) points at nothing.
-- SECURITY DEFINER so a user reporting a published row isn't blocked by RLS
-- on drafts they can't see; it only answers "does this id exist".
create or replace function public.validate_content_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exists boolean;
begin
  execute format('select exists (select 1 from public.%I where id = $1)',
                 public.content_table_for(new.target_type))
    into v_exists using new.target_id;
  if not v_exists then
    raise exception 'target % % does not exist', new.target_type, new.target_id
      using errcode = '23503';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_content_target() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- legal_references: the legal basis behind a requirement, fee, step, or rule.
-- issuance_id will reference public.issuances once Bantay Batas lands (Phase 6);
-- until then citations are entered by hand.
-- source_rank follows the source hierarchy (README): 1 law/Constitution,
-- 2 IRR/executive order, 3 agency issuance, 4 official advisory.
-- News (5) and community posts (6) can never be a legal basis.
-- ---------------------------------------------------------------------------
create table public.legal_references (
  id                uuid primary key default gen_random_uuid(),
  target_type       public.content_target_type not null check (target_type <> 'legal_reference'),
  target_id         uuid not null,
  issuance_id       uuid,
  source_rank       smallint not null check (source_rank between 1 and 4),
  issuing_body      text not null check (char_length(issuing_body) between 2 and 200),
  issuance_type     text not null check (issuance_type in (
                      'constitution', 'republic_act', 'irr', 'executive_order', 'regulation',
                      'memorandum_circular', 'order', 'advisory', 'other')),
  issuance_number   text check (char_length(issuance_number) <= 80),
  citation_title    text not null check (char_length(citation_title) between 2 and 300),
  date_issued       date,
  section           text check (char_length(section) <= 200),
  note              text,
  status            public.content_status not null default 'draft',
  source_url        text check (source_url ~ '^https?://'),
  last_verified_at  timestamptz,
  verified_by       uuid references public.profiles (id) on delete set null,
  to_verify_note    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint legal_references_verifiable check (
    status in ('draft', 'archived') or (source_url is not null and last_verified_at is not null)
  ),
  constraint legal_references_publishable check (status <> 'published' or to_verify_note is null)
);
create index legal_references_target_idx on public.legal_references (target_type, target_id);

create trigger legal_references_validate_target
  before insert or update of target_type, target_id on public.legal_references
  for each row execute function public.validate_content_target();
create trigger legal_references_set_updated_at
  before update on public.legal_references
  for each row execute function public.set_updated_at();

alter table public.legal_references enable row level security;
create policy "legal_references: public reads published" on public.legal_references
  for select to anon, authenticated using (status = 'published');
create policy "legal_references: admins read all" on public.legal_references
  for select to authenticated using (public.is_admin());
create policy "legal_references: admins insert" on public.legal_references
  for insert to authenticated with check (public.is_admin());
create policy "legal_references: admins update" on public.legal_references
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "legal_references: admins delete" on public.legal_references
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- content_flags: "report outdated info" from users, and system flags
-- (e.g. live context conflict detection in Phase 5) inserted with the secret key.
-- ---------------------------------------------------------------------------
create table public.content_flags (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references public.profiles (id) on delete set null,
  source           text not null default 'user' check (source in ('user', 'system')),
  target_type      public.content_target_type not null,
  target_id        uuid not null,
  reason           text not null check (reason in ('outdated', 'incorrect', 'fixer', 'other')),
  details          text check (char_length(details) <= 1000),
  evidence_url     text check (evidence_url ~ '^https?://'),
  status           text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolution_note  text check (char_length(resolution_note) <= 1000),
  resolved_by      uuid references public.profiles (id) on delete set null,
  resolved_at      timestamptz,
  created_at       timestamptz not null default now(),
  constraint content_flags_resolution check (
    (status = 'open') = (resolved_at is null)
  )
);
create index content_flags_open_idx on public.content_flags (status, created_at desc);
create index content_flags_target_idx on public.content_flags (target_type, target_id);

create trigger content_flags_validate_target
  before insert or update of target_type, target_id on public.content_flags
  for each row execute function public.validate_content_target();

alter table public.content_flags enable row level security;
-- Users file flags as themselves only, and only as open user flags.
create policy "content_flags: users insert own" on public.content_flags
  for insert to authenticated
  with check (user_id = auth.uid() and source = 'user' and status = 'open'
              and resolved_at is null and resolved_by is null and resolution_note is null);
create policy "content_flags: users read own" on public.content_flags
  for select to authenticated using (user_id = auth.uid());
create policy "content_flags: admins read all" on public.content_flags
  for select to authenticated using (public.is_admin());
create policy "content_flags: admins update" on public.content_flags
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- verification_events: append-only audit trail of status changes.
-- Written only by trigger; admins can read; nobody can edit or delete.
-- ---------------------------------------------------------------------------
create table public.verification_events (
  id           bigint generated always as identity primary key,
  target_type  public.content_target_type not null,
  target_id    uuid not null,
  from_status  public.content_status,
  to_status    public.content_status not null,
  actor        uuid,
  created_at   timestamptz not null default now()
);
create index verification_events_target_idx on public.verification_events (target_type, target_id, created_at desc);

alter table public.verification_events enable row level security;
create policy "verification_events: admins read" on public.verification_events
  for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.verification_events from anon, authenticated;

create or replace function public.log_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.verification_events (target_type, target_id, from_status, to_status, actor)
    values (tg_argv[0]::public.content_target_type, new.id,
            case when tg_op = 'UPDATE' then old.status end, new.status, auth.uid());
  end if;
  return new;
end;
$$;
revoke all on function public.log_status_change() from public, anon, authenticated;

do $$
declare
  pair text[];
begin
  foreach pair slice 1 in array array[
    ['agencies', 'agency'], ['documents', 'document'],
    ['document_requirements', 'document_requirement'], ['accepted_for', 'accepted_for'],
    ['guide_steps', 'guide_step'], ['offices', 'office'], ['office_services', 'office_service'],
    ['lgu_processes', 'lgu_process'], ['tax_rules', 'tax_rule'], ['tax_deadlines', 'tax_deadline'],
    ['legal_references', 'legal_reference']
  ]
  loop
    execute format(
      'create trigger %1$s_log_status after insert or update of status on public.%1$I
         for each row execute function public.log_status_change(%2$L)', pair[1], pair[2]);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- content_index: every content row in one shape, for the admin dashboard,
-- stale queue, TO VERIFY queue, and sources page. security_invoker = true,
-- so RLS of the underlying tables applies (public sees only published rows).
-- parent_* tells the admin UI which page edits the row.
-- ---------------------------------------------------------------------------
create view public.content_index with (security_invoker = true) as
  select 'agency'::public.content_target_type as target_type, a.id, a.name as label,
         'agency'::public.content_target_type as parent_type, a.id as parent_id,
         a.status, a.source_url, a.last_verified_at, a.to_verify_note, a.updated_at
    from public.agencies a
  union all
  select 'document', d.id, d.name, 'document', d.id,
         d.status, d.source_url, d.last_verified_at, d.to_verify_note, d.updated_at
    from public.documents d
  union all
  select 'document_requirement', r.id,
         d.name || ': ' || coalesce(r.requirement_text, rd.name),
         'document', r.document_id,
         r.status, r.source_url, r.last_verified_at, r.to_verify_note, r.updated_at
    from public.document_requirements r
    join public.documents d on d.id = r.document_id
    left join public.documents rd on rd.id = r.requires_document_id
  union all
  select 'accepted_for', af.id, d.name || ': accepted for ' || af.purpose,
         'document', af.document_id,
         af.status, af.source_url, af.last_verified_at, af.to_verify_note, af.updated_at
    from public.accepted_for af
    join public.documents d on d.id = af.document_id
  union all
  select 'guide_step', s.id, d.name || ': step ' || s.step_order || ', ' || s.title,
         'document', s.document_id,
         s.status, s.source_url, s.last_verified_at, s.to_verify_note, s.updated_at
    from public.guide_steps s
    join public.documents d on d.id = s.document_id
  union all
  select 'office', o.id, o.name, 'office', o.id,
         o.status, o.source_url, o.last_verified_at, o.to_verify_note, o.updated_at
    from public.offices o
  union all
  select 'office_service', os.id, o.name || ': ' || d.name, 'office', os.office_id,
         os.status, os.source_url, os.last_verified_at, os.to_verify_note, os.updated_at
    from public.office_services os
    join public.offices o on o.id = os.office_id
    join public.documents d on d.id = os.document_id
  union all
  select 'lgu_process', l.id, l.city || ': ' || l.title, 'lgu_process', l.id,
         l.status, l.source_url, l.last_verified_at, l.to_verify_note, l.updated_at
    from public.lgu_processes l
  union all
  select 'tax_rule', t.id, t.rule_key, 'tax_rule', t.id,
         t.status, t.source_url, t.last_verified_at, t.to_verify_note, t.updated_at
    from public.tax_rules t
  union all
  select 'tax_deadline', td.id, td.form_code || ' (' || td.frequency || ')', 'tax_deadline', td.id,
         td.status, td.source_url, td.last_verified_at, td.to_verify_note, td.updated_at
    from public.tax_deadlines td
  union all
  -- A legal reference is edited on the page of whatever it explains; child rows
  -- (requirements, steps, ...) resolve to their parent document/office page.
  select 'legal_reference', lr.id, lr.citation_title,
         case lr.target_type
           when 'document_requirement' then 'document'
           when 'accepted_for' then 'document'
           when 'guide_step' then 'document'
           when 'office_service' then 'office'
           else lr.target_type
         end::public.content_target_type,
         coalesce(r.document_id, af.document_id, s.document_id, os.office_id, lr.target_id),
         lr.status, lr.source_url, lr.last_verified_at, lr.to_verify_note, lr.updated_at
    from public.legal_references lr
    left join public.document_requirements r on lr.target_type = 'document_requirement' and r.id = lr.target_id
    left join public.accepted_for af on lr.target_type = 'accepted_for' and af.id = lr.target_id
    left join public.guide_steps s on lr.target_type = 'guide_step' and s.id = lr.target_id
    left join public.office_services os on lr.target_type = 'office_service' and os.id = lr.target_id;

comment on view public.content_index is
  'All content rows in one shape. RLS of underlying tables applies (security_invoker).';
