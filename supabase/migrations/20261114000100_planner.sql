-- =============================================================================
-- Marites PH — Migration 6 (Phase 4): planner and personal tracking
--   * user_documents  "my documents" tracker
--   * plans           saved "Ano'ng Lakad Mo?" plans (snapshot of the result)
--   * ai_usage_log    token usage and cost of AI calls (budget cap)
-- Users read and write only their own rows. Deleting an account (auth.users)
-- cascades through profiles to these tables. Reports (content_flags) keep the
-- report but lose the user link (on delete set null, from migration 4).
-- =============================================================================

create table public.user_documents (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  document_id  uuid not null references public.documents (id) on delete cascade,
  status       text not null check (status in ('have', 'in_progress', 'need')),
  expires_on   date,
  notes        text check (char_length(notes) <= 500),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (user_id, document_id)
);
create index user_documents_expiry_idx on public.user_documents (expires_on) where expires_on is not null;
create trigger user_documents_set_updated_at before update on public.user_documents
  for each row execute function public.set_updated_at();

alter table public.user_documents enable row level security;
create policy "user_documents: owner reads" on public.user_documents
  for select to authenticated using (user_id = auth.uid());
create policy "user_documents: owner inserts" on public.user_documents
  for insert to authenticated with check (user_id = auth.uid());
create policy "user_documents: owner updates" on public.user_documents
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "user_documents: owner deletes" on public.user_documents
  for delete to authenticated using (user_id = auth.uid());

create table public.plans (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  title           text not null check (char_length(title) between 1 and 200),
  goal            jsonb not null,
  inputs          jsonb not null,
  generated_plan  jsonb not null,
  chosen_option   text check (chosen_option in ('fastest', 'no_leave', 'cheapest', 'fewest_visits')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Keep rows small: a plan snapshot is a few KB; reject anything absurd.
  constraint plans_size check (pg_column_size(generated_plan) < 200000 and pg_column_size(inputs) < 20000)
);
create index plans_user_idx on public.plans (user_id, created_at desc);
create trigger plans_set_updated_at before update on public.plans
  for each row execute function public.set_updated_at();

alter table public.plans enable row level security;
create policy "plans: owner reads" on public.plans for select to authenticated using (user_id = auth.uid());
create policy "plans: owner inserts" on public.plans for insert to authenticated with check (user_id = auth.uid());
create policy "plans: owner updates" on public.plans
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "plans: owner deletes" on public.plans for delete to authenticated using (user_id = auth.uid());

create table public.ai_usage_log (
  id             bigint generated always as identity primary key,
  purpose        text not null check (purpose in ('plan_summary', 'troubleshoot', 'live_context', 'monitoring')),
  model          text not null,
  input_tokens   integer not null default 0 check (input_tokens >= 0),
  output_tokens  integer not null default 0 check (output_tokens >= 0),
  cost_estimate  numeric(10, 6) not null default 0,
  outcome        text not null default 'ok' check (outcome in ('ok', 'rejected', 'error')),
  user_id        uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index ai_usage_log_month_idx on public.ai_usage_log (created_at);

alter table public.ai_usage_log enable row level security;
-- Written only with the secret key (server). Admins can read it.
create policy "ai_usage_log: admins read" on public.ai_usage_log for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.ai_usage_log from anon, authenticated;

-- Month-to-date AI spend, for the budget cap. Service role only.
create or replace function public.ai_spend_this_month()
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(cost_estimate), 0)
    from public.ai_usage_log
   where created_at >= date_trunc('month', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila';
$$;
revoke all on function public.ai_spend_this_month() from public, anon, authenticated;
grant execute on function public.ai_spend_this_month() to service_role;
