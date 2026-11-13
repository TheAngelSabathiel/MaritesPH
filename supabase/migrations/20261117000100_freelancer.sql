-- =============================================================================
-- Marites PH — Migration 9 (Phase 7): freelancer compliance
--   taxpayer_profiles   one per user; TIN, registered name and address encrypted
--                       by the app (AES-256-GCM, FIELD_ENCRYPTION_KEY) before storage
--   income_entries      owner-only; foreign currency kept with the rate used
--   expense_entries     owner-only
--   reminders           filing reminders (created and sent by the server)
--   CPA review          only a user with role 'cpa' can mark tax rules/deadlines
--                       as CPA-reviewed (cpa_review_tax_item); editing a rule's
--                       content clears the review automatically.
-- =============================================================================

create table public.taxpayer_profiles (
  user_id                uuid primary key references public.profiles (id) on delete cascade,
  taxpayer_type          text not null default 'freelancer' check (taxpayer_type in ('freelancer', 'sole_prop', 'mixed')),
  registration_status    text not null default 'not_registered' check (registration_status in ('not_registered', 'registered')),
  rdo_code               text check (rdo_code ~ '^[0-9]{2,3}[A-Z]?$'),
  tax_option             text not null default 'undecided' check (tax_option in ('eight_percent', 'graduated', 'undecided')),
  deduction_method       text not null default 'osd' check (deduction_method in ('osd', 'itemized')),
  vat_status             text not null default 'non_vat' check (vat_status in ('non_vat', 'vat')),
  registered_on          date,
  -- Encrypted by the application ("v1:<iv>:<tag>:<ciphertext>", base64). Never plaintext.
  tin_enc                text check (tin_enc like 'v1:%'),
  registered_name_enc    text check (registered_name_enc like 'v1:%'),
  registered_address_enc text check (registered_address_enc like 'v1:%'),
  email_reminders        boolean not null default false,
  reminder_days_before   integer not null default 7 check (reminder_days_before between 1 and 30),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create trigger taxpayer_profiles_set_updated_at before update on public.taxpayer_profiles
  for each row execute function public.set_updated_at();

create table public.income_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  received_on date not null,
  amount      numeric(14, 2) not null check (amount > 0),
  currency    char(3) not null default 'PHP' check (currency ~ '^[A-Z]{3}$'),
  fx_rate     numeric(14, 6) not null default 1 check (fx_rate > 0),
  php_amount  numeric(14, 2) not null check (php_amount > 0),
  category    text not null default 'services' check (category in ('services', 'sales', 'other')),
  notes_enc   text check (notes_enc like 'v1:%'),
  created_at  timestamptz not null default now(),
  constraint income_php_matches check (abs(php_amount - round(amount * fx_rate, 2)) <= 0.01)
);
create index income_entries_user_date_idx on public.income_entries (user_id, received_on);

create table public.expense_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  spent_on    date not null,
  amount      numeric(14, 2) not null check (amount > 0),
  currency    char(3) not null default 'PHP' check (currency ~ '^[A-Z]{3}$'),
  fx_rate     numeric(14, 6) not null default 1 check (fx_rate > 0),
  php_amount  numeric(14, 2) not null check (php_amount > 0),
  category    text not null default 'other' check (category in ('equipment', 'internet', 'rent', 'utilities', 'supplies', 'professional_fees', 'travel', 'other')),
  notes_enc   text check (notes_enc like 'v1:%'),
  created_at  timestamptz not null default now(),
  constraint expense_php_matches check (abs(php_amount - round(amount * fx_rate, 2)) <= 0.01)
);
create index expense_entries_user_date_idx on public.expense_entries (user_id, spent_on);

create table public.reminders (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  kind          text not null default 'tax_deadline' check (kind in ('tax_deadline')),
  deadline_key  text not null check (char_length(deadline_key) <= 100),
  title         text not null check (char_length(title) <= 200),
  due_on        date not null,
  remind_on     date not null,
  channels      text[] not null default '{email}',
  sent_at       timestamptz,
  created_at    timestamptz not null default now(),
  unique (user_id, deadline_key)
);
create index reminders_due_idx on public.reminders (remind_on) where sent_at is null;

-- Owner-only access for all personal financial data. Admins can't read it either.
do $$
declare t text;
begin
  foreach t in array array['taxpayer_profiles', 'income_entries', 'expense_entries'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%1$s: owner reads" on public.%1$I for select to authenticated using (user_id = auth.uid())', t);
    execute format('create policy "%1$s: owner inserts" on public.%1$I for insert to authenticated with check (user_id = auth.uid())', t);
    execute format('create policy "%1$s: owner updates" on public.%1$I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy "%1$s: owner deletes" on public.%1$I for delete to authenticated using (user_id = auth.uid())', t);
  end loop;
end $$;
alter table public.reminders enable row level security;
create policy "reminders: owner reads" on public.reminders for select to authenticated using (user_id = auth.uid());
create policy "reminders: owner deletes" on public.reminders for delete to authenticated using (user_id = auth.uid());
revoke insert, update on public.reminders from anon, authenticated;

-- ---------------------------------------------------------------------------
-- CPA review. Editing a tax rule's content clears its CPA review, unless the
-- same update is the review itself. Combined with the Phase 1 constraint
-- (published requires cpa_reviewed), a published rule can't be changed in
-- place without a fresh CPA review.
-- ---------------------------------------------------------------------------
create or replace function public.reset_cpa_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (to_jsonb(new) - array['cpa_reviewed', 'reviewed_at', 'reviewed_by', 'status', 'last_verified_at', 'verified_by', 'updated_at', 'to_verify_note'])
     is distinct from
     (to_jsonb(old) - array['cpa_reviewed', 'reviewed_at', 'reviewed_by', 'status', 'last_verified_at', 'verified_by', 'updated_at', 'to_verify_note'])
     and not (new.cpa_reviewed and not old.cpa_reviewed) then
    new.cpa_reviewed := false;
    new.reviewed_at := null;
    new.reviewed_by := null;
  end if;
  return new;
end;
$$;
create trigger tax_rules_reset_cpa before update on public.tax_rules for each row execute function public.reset_cpa_review();
create trigger tax_deadlines_reset_cpa before update on public.tax_deadlines for each row execute function public.reset_cpa_review();

-- Only a CPA (role 'cpa') can mark a verified tax rule or deadline as reviewed.
create or replace function public.cpa_review_tax_item(p_table text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_user_role() is distinct from 'cpa' then
    raise exception 'only a CPA can review tax rules' using errcode = '42501';
  end if;
  if p_table = 'tax_rules' then
    update public.tax_rules set cpa_reviewed = true, reviewed_at = now(), reviewed_by = auth.uid()
     where id = p_id and status in ('verified', 'published');
  elsif p_table = 'tax_deadlines' then
    update public.tax_deadlines set cpa_reviewed = true, reviewed_at = now(), reviewed_by = auth.uid()
     where id = p_id and status in ('verified', 'published');
  else
    raise exception 'unknown table' using errcode = '22023';
  end if;
  if not found then
    raise exception 'item must exist and be verified before CPA review' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.cpa_review_tax_item(text, uuid) from public, anon;
grant execute on function public.cpa_review_tax_item(text, uuid) to authenticated;

-- CPAs can read tax rules, deadlines, and tax-related proposals (any status) for review.
create policy "tax_rules: cpa reads all" on public.tax_rules for select to authenticated using (public.current_user_role() = 'cpa');
create policy "tax_deadlines: cpa reads all" on public.tax_deadlines for select to authenticated using (public.current_user_role() = 'cpa');
create policy "change_proposals: cpa reads tax" on public.change_proposals for select to authenticated
  using (public.current_user_role() = 'cpa' and target_type in ('tax_rule', 'tax_deadline'));

-- Walkthroughs for official filing systems (e.g. "Filing 1701Q with eBIRForms").
alter type public.document_type add value if not exists 'filing';
