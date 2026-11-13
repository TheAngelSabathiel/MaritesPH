-- =============================================================================
-- Marites PH — Migration 2: profiles, role helpers, signup + consent
-- =============================================================================

create table public.profiles (
  id                       uuid primary key references auth.users (id) on delete cascade,
  display_name             text check (char_length(display_name) <= 80),
  language_pref            public.app_locale not null default 'en',
  region                   text check (char_length(region) <= 80),
  city                     text check (char_length(city) <= 80),
  role                     public.user_role not null default 'user',
  -- RA 10173 (Data Privacy Act): record WHEN the user consented and to WHICH
  -- version of the privacy policy. Null means consent has not been recorded
  -- and the app must ask before doing anything with personal data.
  privacy_consent_at       timestamptz,
  privacy_consent_version  text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth user. Minimal personal data only (RA 10173).';
comment on column public.profiles.role is
  'Not user-editable. Changed only by the service role (admin tooling).';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER so they can read profiles without
-- recursing through profiles' own RLS policies).
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

revoke all on function public.current_user_role() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.current_user_role() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS: users see and edit only their own profile; admins can read all.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles: owner can read"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "profiles: admins can read all"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

create policy "profiles: owner can update"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- No INSERT policy: rows are created only by the signup trigger below.
-- No DELETE policy: account deletion goes through a server-side flow
-- (deleting auth.users cascades here).

-- Column-level privileges: users may edit only harmless profile fields.
-- role and consent columns are NOT in this list, so a user cannot make
-- themselves an admin or forge a consent timestamp.
revoke update on public.profiles from anon, authenticated;
grant update (display_name, language_pref, region, city)
  on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Signup trigger: create the profile row for every new auth user.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locale public.app_locale;
begin
  -- Only accept known locales from user metadata; fall back to English.
  v_locale := case new.raw_user_meta_data ->> 'language_pref'
                when 'fil' then 'fil'::public.app_locale
                else 'en'::public.app_locale
              end;

  insert into public.profiles (id, display_name, language_pref)
  values (
    new.id,
    left(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 80),
    v_locale
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Consent RPC: the only way a user can set their own consent fields.
-- Called by the auth callback after the user ticked the consent box.
-- ---------------------------------------------------------------------------
create or replace function public.record_privacy_consent(p_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_version is null or char_length(p_version) not between 1 and 20 then
    raise exception 'invalid consent version' using errcode = '22023';
  end if;

  update public.profiles
     set privacy_consent_at = now(),
         privacy_consent_version = p_version
   where id = auth.uid();
end;
$$;

-- Supabase's default privileges grant EXECUTE to anon explicitly, so revoking
-- from PUBLIC alone is not enough.
revoke all on function public.record_privacy_consent(text) from public, anon;
grant execute on function public.record_privacy_consent(text) to authenticated;
