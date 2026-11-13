-- =============================================================================
-- Marites PH — Migration 5 (Phase 3): public guides support
--   * slugify() + office slugs for clean URLs (/offices/[city]/[agency]/[office])
--   * table-based rate limiter (used by "report outdated info"; later by AI routes)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- slugify: "Parañaque City Hall" -> "paranaque-city-hall".
-- Mirrors src/lib/slug.ts (keep both in sync; unit tests cover the TS side).
-- ---------------------------------------------------------------------------
create or replace function public.slugify(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(
           translate(lower(coalesce(p_text, '')),
                     'ñáàâäãéèêëíìîïóòôöõúùûüç',
                     'naaaaaeeeeiiiiooooouuuuc'),
           '[^a-z0-9]+', '-', 'g'));
$$;

alter table public.offices add column slug text;

-- Backfill: slug from name; on duplicates append a short id suffix.
update public.offices o
   set slug = case
     when (select count(*) from public.offices o2 where public.slugify(o2.name) = public.slugify(o.name)) > 1
       then public.slugify(o.name) || '-' || left(o.id::text, 6)
     else public.slugify(o.name)
   end;

alter table public.offices alter column slug set not null;
alter table public.offices add constraint offices_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
alter table public.offices add constraint offices_slug_key unique (slug);

-- New offices get a slug automatically when none is given.
create or replace function public.offices_default_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_base text;
begin
  if new.slug is null or new.slug = '' then
    v_base := public.slugify(new.name);
    if exists (select 1 from public.offices where slug = v_base and id <> new.id) then
      new.slug := v_base || '-' || left(new.id::text, 6);
    else
      new.slug := v_base;
    end if;
  end if;
  return new;
end;
$$;

create trigger offices_default_slug
  before insert or update of slug, name on public.offices
  for each row execute function public.offices_default_slug();

-- ---------------------------------------------------------------------------
-- Rate limiter (fixed window). Called only by the server with the secret key.
-- Keys are opaque strings such as "flag:ip:<sha256>" or "flag:user:<uuid>";
-- raw IP addresses are never stored.
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  key           text not null check (char_length(key) <= 200),
  window_start  timestamptz not null,
  hits          integer not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security;
-- No policies: only the service role (which bypasses RLS) uses this table.
revoke all on public.rate_limits from anon, authenticated;

-- Returns true if the call is allowed (and counts it), false if over the limit.
create or replace function public.hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz;
  v_hits integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid rate limit' using errcode = '22023';
  end if;
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;

  -- Housekeeping: drop this key's old windows (cheap, indexed by primary key).
  delete from public.rate_limits where key = p_key and window_start < v_window;

  return v_hits <= p_limit;
end;
$$;

revoke all on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;
