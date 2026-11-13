-- =============================================================================
-- Marites PH — Migration 7 (Phase 5): Chika sa Pila, tips, live context, AI
--   * tips                 community experiences (wait time, extra requirements)
--   * office_wait_stats    median reported wait per office (approved tips only)
--   * troubleshoot_queries cached troubleshooter answers (short summaries + links)
--   * live_context_cache   official and community updates per guide, with expiry
-- Community content is never mixed with verified content and never changes it.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- tips: public only when approved by an admin (or auto-approved rules, none yet)
-- ---------------------------------------------------------------------------
create table public.tips (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid references public.profiles (id) on delete set null,
  document_id              uuid references public.documents (id) on delete cascade,
  office_id                uuid references public.offices (id) on delete cascade,
  body                     text not null check (char_length(body) between 10 and 500),
  visited_on               date check (visited_on <= current_date + 1),
  wait_minutes             integer check (wait_minutes between 0 and 720),
  extra_requirements_asked text check (char_length(extra_requirements_asked) <= 300),
  status                   text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  auto_flags               text[] not null default '{}',
  moderation_reason        text check (char_length(moderation_reason) <= 300),
  reviewed_by              uuid references public.profiles (id) on delete set null,
  reviewed_at              timestamptz,
  created_at               timestamptz not null default now(),
  constraint tips_target check (document_id is not null or office_id is not null)
);
create index tips_office_idx on public.tips (office_id, status, created_at desc);
create index tips_document_idx on public.tips (document_id, status, created_at desc);
create index tips_pending_idx on public.tips (status, created_at) where status = 'pending';

alter table public.tips enable row level security;
create policy "tips: public reads approved" on public.tips for select to anon, authenticated using (status = 'approved');
create policy "tips: authors read own" on public.tips for select to authenticated using (user_id = auth.uid());
create policy "tips: admins read all" on public.tips for select to authenticated using (public.is_admin());
create policy "tips: users submit own, pending only" on public.tips for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and reviewed_by is null and reviewed_at is null);
create policy "tips: admins moderate" on public.tips for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "tips: admins delete" on public.tips for delete to authenticated using (public.is_admin());

-- Median reported wait per office over the last 90 days (approved tips only).
create view public.office_wait_stats with (security_invoker = true) as
  select office_id,
         percentile_cont(0.5) within group (order by wait_minutes)::integer as median_wait_minutes,
         count(*)::integer as reports
    from public.tips
   where status = 'approved' and office_id is not null and wait_minutes is not null
     and coalesce(visited_on, created_at::date) >= current_date - 90
   group by office_id;

-- ---------------------------------------------------------------------------
-- troubleshoot_queries: cached answers. Private to the asker; the server reuses
-- answers for similar questions through find_similar_troubleshoot (service role).
-- Only short summaries and links are stored, never thread text.
-- ---------------------------------------------------------------------------
create table public.troubleshoot_queries (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references public.profiles (id) on delete cascade,
  document_id     uuid not null references public.documents (id) on delete cascade,
  problem_text    text not null check (char_length(problem_text) between 10 and 500),
  locale          public.app_locale not null default 'en',
  result          jsonb not null,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default now() + interval '14 days',
  constraint troubleshoot_result_size check (pg_column_size(result) < 50000)
);
create index troubleshoot_doc_idx on public.troubleshoot_queries (document_id, created_at desc);
create index troubleshoot_trgm_idx on public.troubleshoot_queries using gin (problem_text extensions.gin_trgm_ops);

alter table public.troubleshoot_queries enable row level security;
create policy "troubleshoot: owner reads" on public.troubleshoot_queries for select to authenticated using (user_id = auth.uid());
create policy "troubleshoot: admins read" on public.troubleshoot_queries for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.troubleshoot_queries from anon, authenticated;

create or replace function public.find_similar_troubleshoot(p_document_id uuid, p_problem text, p_locale public.app_locale, p_min_similarity real default 0.45)
returns table (id uuid, result jsonb, similarity real, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select q.id, q.result, extensions.similarity(q.problem_text, p_problem) as similarity, q.created_at
    from public.troubleshoot_queries q
   where q.document_id = p_document_id
     and q.locale = p_locale
     and q.expires_at > now()
     and extensions.similarity(q.problem_text, p_problem) >= p_min_similarity
   order by similarity desc, q.created_at desc
   limit 1;
$$;
revoke all on function public.find_similar_troubleshoot(uuid, text, public.app_locale, real) from public, anon, authenticated;
grant execute on function public.find_similar_troubleshoot(uuid, text, public.app_locale, real) to service_role;

-- ---------------------------------------------------------------------------
-- live_context_cache: official and community results per guide, kept apart.
-- Public data (no personal information); written only by the server.
-- ---------------------------------------------------------------------------
create table public.live_context_cache (
  target_type  public.content_target_type not null check (target_type in ('document', 'office')),
  target_id    uuid not null,
  kind         text not null check (kind in ('official', 'community')),
  locale       public.app_locale not null default 'en',
  results      jsonb not null,
  fetched_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  primary key (target_type, target_id, kind, locale),
  constraint live_context_size check (pg_column_size(results) < 50000)
);
alter table public.live_context_cache enable row level security;
create policy "live context: public reads" on public.live_context_cache for select to anon, authenticated using (true);
revoke insert, update, delete on public.live_context_cache from anon, authenticated;
