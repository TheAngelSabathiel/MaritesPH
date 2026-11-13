-- =============================================================================
-- Marites PH — Migration 8 (Phase 6): Bantay Batas monitoring
--   official_sources   registry of official pages/feeds to watch (admin only)
--   issuances          laws/issuances found; public only when an admin publishes them
--   issuance_links     which content records an issuance may affect
--   change_proposals   AI-drafted before/after diffs; a human approves every change
--   community_signals  aggregated community patterns (from tips), no raw text
--   change_alerts      per-user notices about approved changes (sent from Phase 8)
-- AI NEVER publishes: proposals change nothing until an admin approves them.
-- =============================================================================

create type public.issuance_type as enum (
  'republic_act', 'irr', 'executive_order', 'regulation', 'memorandum_circular', 'order', 'advisory', 'news', 'other'
);

create table public.official_sources (
  id                    uuid primary key default gen_random_uuid(),
  agency_id             uuid references public.agencies (id) on delete set null,
  name                  text not null check (char_length(name) between 2 and 200),
  url                   text not null unique check (url ~ '^https://'),
  source_type           text not null check (source_type in ('rss', 'html_list', 'pdf_list', 'api', 'manual')),
  parser_key            text not null default 'auto' check (parser_key in ('auto', 'rss', 'html_links', 'pdf_links', 'manual')),
  parser_config         jsonb not null default '{}'::jsonb check (jsonb_typeof(parser_config) = 'object'),
  topic                 text not null default 'general' check (topic in ('ids', 'tax', 'business', 'general')),
  crawl_frequency_hours integer not null default 24 check (crawl_frequency_hours between 1 and 720),
  robots_ok             boolean,
  active                boolean not null default false,
  listing_hash          text,
  last_crawled_at       timestamptz,
  last_success_at       timestamptz,
  last_error            text check (char_length(last_error) <= 500),
  failure_count         integer not null default 0 check (failure_count >= 0),
  to_verify_note        text,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  -- A source can't be crawled until someone has checked it (URL, terms, robots).
  constraint official_sources_verified_before_active check (not active or to_verify_note is null)
);
create trigger official_sources_set_updated_at before update on public.official_sources
  for each row execute function public.set_updated_at();

create table public.issuances (
  id                     uuid primary key default gen_random_uuid(),
  source_id              uuid references public.official_sources (id) on delete set null,
  url                    text not null unique check (url ~ '^https?://'),
  title                  text not null check (char_length(title) between 1 and 500),
  issuing_body           text check (char_length(issuing_body) <= 200),
  issuance_type          public.issuance_type,
  issuance_number        text check (char_length(issuance_number) <= 80),
  date_issued            date,
  effective_date         date,
  topic                  text not null default 'general' check (topic in ('ids', 'tax', 'business', 'general')),
  content_hash           text,
  extracted_text         text check (char_length(extracted_text) <= 200000),
  summary                text check (char_length(summary) <= 1000),
  extraction_status      text not null default 'pending' check (extraction_status in ('pending', 'ok', 'needs_ocr', 'failed')),
  classification_status  text not null default 'pending' check (classification_status in ('pending', 'done', 'failed', 'skipped')),
  attempts               integer not null default 0,
  published              boolean not null default false,
  created_at             timestamptz not null default now()
);
create index issuances_pending_idx on public.issuances (classification_status, created_at) where classification_status = 'pending';
create index issuances_published_idx on public.issuances (published, date_issued desc) where published;

create table public.issuance_links (
  id               uuid primary key default gen_random_uuid(),
  issuance_id      uuid not null references public.issuances (id) on delete cascade,
  target_type      public.content_target_type not null,
  target_id        uuid not null,
  relevance_score  numeric(3, 2) not null check (relevance_score between 0 and 1),
  link_status      text not null default 'proposed' check (link_status in ('proposed', 'confirmed', 'rejected')),
  reason           text check (char_length(reason) <= 500),
  created_at       timestamptz not null default now(),
  unique (issuance_id, target_type, target_id)
);
create trigger issuance_links_validate_target before insert or update of target_type, target_id on public.issuance_links
  for each row execute function public.validate_content_target();

create table public.change_proposals (
  id               uuid primary key default gen_random_uuid(),
  issuance_id      uuid references public.issuances (id) on delete set null,
  target_type      public.content_target_type not null,
  target_id        uuid not null,
  -- {"fields": {"fee_min": {"before": 950, "after": 1000}, ...}}
  proposed_change  jsonb not null check (jsonb_typeof(proposed_change -> 'fields') = 'object'),
  ai_rationale     text check (char_length(ai_rationale) <= 2000),
  public_summary   text check (char_length(public_summary) <= 300),
  source_urls      text[] not null default '{}',
  status           text not null default 'open' check (status in ('open', 'approved', 'rejected', 'needs_cpa')),
  review_note      text check (char_length(review_note) <= 1000),
  reviewed_by      uuid references public.profiles (id) on delete set null,
  reviewed_at      timestamptz,
  cpa_reviewed_by  uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint change_proposals_reviewed check (status in ('open', 'needs_cpa') or reviewed_at is not null)
);
create index change_proposals_open_idx on public.change_proposals (status, created_at) where status in ('open', 'needs_cpa');
create trigger change_proposals_validate_target before insert or update of target_type, target_id on public.change_proposals
  for each row execute function public.validate_content_target();

-- legal_references.issuance_id becomes a real link now that issuances exist.
alter table public.legal_references
  add constraint legal_references_issuance_fk foreign key (issuance_id) references public.issuances (id) on delete set null;

create table public.community_signals (
  id             uuid primary key default gen_random_uuid(),
  document_id    uuid references public.documents (id) on delete cascade,
  office_id      uuid references public.offices (id) on delete cascade,
  signal_type    text not null check (signal_type in ('outage', 'new_requirement', 'long_queue', 'policy_confusion')),
  summary        text not null check (char_length(summary) <= 500),
  source_urls    text[] not null default '{}',
  mention_count  integer not null default 1 check (mention_count >= 1),
  first_seen     timestamptz not null default now(),
  last_seen      timestamptz not null default now(),
  status         text not null default 'open' check (status in ('open', 'dismissed')),
  constraint community_signals_target check (document_id is not null or office_id is not null),
  constraint community_signals_unique unique nulls not distinct (document_id, office_id, signal_type)
);

create table public.change_alerts (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles (id) on delete cascade,
  change_proposal_id  uuid references public.change_proposals (id) on delete cascade,
  issuance_id         uuid references public.issuances (id) on delete set null,
  reason              text not null check (char_length(reason) <= 300),
  channel             text check (channel in ('email', 'sms', 'in_app')),
  sent_at             timestamptz,
  created_at          timestamptz not null default now(),
  unique (user_id, change_proposal_id)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.official_sources enable row level security;
alter table public.issuances enable row level security;
alter table public.issuance_links enable row level security;
alter table public.change_proposals enable row level security;
alter table public.community_signals enable row level security;
alter table public.change_alerts enable row level security;

do $$
declare t text;
begin
  foreach t in array array['official_sources', 'issuances', 'issuance_links', 'change_proposals', 'community_signals'] loop
    execute format('create policy "%1$s: admins read" on public.%1$I for select to authenticated using (public.is_admin())', t);
    execute format('create policy "%1$s: admins update" on public.%1$I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;
-- Admins may add and remove sources by hand; everything else is written by the pipeline (secret key).
create policy "official_sources: admins insert" on public.official_sources for insert to authenticated with check (public.is_admin());
create policy "official_sources: admins delete" on public.official_sources for delete to authenticated using (public.is_admin());

-- Public "Ano'ng Bago?" feed: published issuances and approved changes only.
create policy "issuances: public reads published" on public.issuances for select to anon, authenticated using (published);
create policy "change_proposals: public reads approved" on public.change_proposals for select to anon, authenticated using (status = 'approved');

-- Alerts: each user reads their own; written by the server only.
create policy "change_alerts: owner reads" on public.change_alerts for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.change_alerts from anon, authenticated;
