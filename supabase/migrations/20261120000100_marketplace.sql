-- =============================================================================
-- Marites PH — Migration 12 (Phase 10): CPA marketplace
--   cpa_listings     a professional's public listing; public only once an admin
--                    verifies the PRC license (does NOT grant the 'cpa' role used
--                    for tax rule review)
--   quote_requests   user → professional; private to both parties
--   quote_contacts   emails released to both parties only when the professional
--                    accepts (release_quote_contacts, server only)
--   cpa_reviews      one per completed request, by the requester; moderated
--   platform_fees    fee owed by the professional on completed engagements
--   marketplace_settings  admin-set fee rate (a business setting, not a law)
-- Marites PH is not a party to engagements and gives no professional advice.
-- =============================================================================

create table public.marketplace_settings (
  id          boolean primary key default true check (id),
  fee_rate    numeric(5, 4) not null default 0 check (fee_rate >= 0 and fee_rate <= 0.5),
  updated_at  timestamptz not null default now()
);
insert into public.marketplace_settings (id) values (true);

create table public.cpa_listings (
  user_id            uuid primary key references public.profiles (id) on delete cascade,
  display_name       text not null check (char_length(display_name) between 2 and 100),
  profession         text not null default 'cpa' check (profession in ('cpa', 'bookkeeper')),
  prc_license_no     text check (prc_license_no ~ '^[0-9]{4,8}$'),
  license_valid_until date,
  firm_name          text check (char_length(firm_name) <= 120),
  bio                text check (char_length(bio) <= 1500),
  services           text[] not null default '{}' check (services <@ array['bir_registration', 'bookkeeping', 'tax_filing', 'payroll', 'business_registration', 'audit', 'tax_advisory']::text[]),
  cities             text[] not null default '{}',
  online_only        boolean not null default false,
  starting_fee_php   numeric(10, 2) check (starting_fee_php >= 0),
  contact_email      text not null check (contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  status             text not null default 'pending' check (status in ('pending', 'verified', 'rejected', 'suspended')),
  admin_note         text check (char_length(admin_note) <= 500),
  verified_at        timestamptz,
  verified_by        uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint cpa_license_required check (profession <> 'cpa' or prc_license_no is not null),
  constraint cpa_verified_stamp check (status <> 'verified' or verified_at is not null)
);
create trigger cpa_listings_set_updated_at before update on public.cpa_listings for each row execute function public.set_updated_at();

-- Any change by the owner sends a verified listing back to pending review.
create or replace function public.cpa_listing_reverify()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_admin() and auth.uid() is not null then
    if new.status is distinct from old.status and not (old.status = 'verified' and new.status = 'pending') then
      new.status := old.status; -- owners can't verify or unsuspend themselves
    end if;
    if old.status = 'verified' and (new.prc_license_no, new.display_name, new.profession, new.license_valid_until)
        is distinct from (old.prc_license_no, old.display_name, old.profession, old.license_valid_until) then
      new.status := 'pending';
      new.verified_at := null;
    end if;
    new.verified_by := old.verified_by;
    new.admin_note := old.admin_note;
  end if;
  return new;
end;
$$;
create trigger cpa_listings_reverify before update on public.cpa_listings for each row execute function public.cpa_listing_reverify();

create table public.quote_requests (
  id              uuid primary key default gen_random_uuid(),
  requester_id    uuid references public.profiles (id) on delete set null,
  cpa_user_id     uuid not null references public.cpa_listings (user_id) on delete cascade,
  service         text not null,
  message         text not null check (char_length(message) between 20 and 1500),
  city            text check (char_length(city) <= 80),
  status          text not null default 'open' check (status in ('open', 'accepted', 'declined', 'completed', 'canceled')),
  cpa_reply       text check (char_length(cpa_reply) <= 1500),
  quoted_fee_php  numeric(10, 2) check (quoted_fee_php >= 0),
  final_fee_php   numeric(10, 2) check (final_fee_php >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint quote_completed_fee check (status <> 'completed' or final_fee_php is not null)
);
create index quote_requests_cpa_idx on public.quote_requests (cpa_user_id, created_at desc);
create index quote_requests_requester_idx on public.quote_requests (requester_id, created_at desc);
create trigger quote_requests_set_updated_at before update on public.quote_requests for each row execute function public.set_updated_at();

-- Allowed status moves: requester cancels an open request; professional accepts/declines an open one and completes an accepted one.
create or replace function public.quote_request_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare me uuid := auth.uid();
begin
  if me is null or public.is_admin() then return new; end if;
  if new.requester_id is distinct from old.requester_id or new.cpa_user_id is distinct from old.cpa_user_id
     or new.message is distinct from old.message or new.service is distinct from old.service then
    raise exception 'request details are fixed' using errcode = '42501';
  end if;
  if me = old.requester_id and me <> old.cpa_user_id then
    if not (old.status = 'open' and new.status = 'canceled') or new.cpa_reply is distinct from old.cpa_reply
       or new.quoted_fee_php is distinct from old.quoted_fee_php or new.final_fee_php is distinct from old.final_fee_php then
      raise exception 'requesters can only cancel an open request' using errcode = '42501';
    end if;
  elsif me = old.cpa_user_id then
    if not ((old.status = 'open' and new.status in ('open', 'accepted', 'declined')) or (old.status = 'accepted' and new.status in ('accepted', 'completed'))) then
      raise exception 'invalid status change' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger quote_requests_transition before update on public.quote_requests for each row execute function public.quote_request_transition();

create table public.quote_contacts (
  request_id       uuid primary key references public.quote_requests (id) on delete cascade,
  requester_email  text not null,
  cpa_email        text not null,
  released_at      timestamptz not null default now()
);

create table public.cpa_reviews (
  request_id   uuid primary key references public.quote_requests (id) on delete cascade,
  reviewer_id  uuid references public.profiles (id) on delete set null,
  cpa_user_id  uuid not null references public.cpa_listings (user_id) on delete cascade,
  rating       smallint not null check (rating between 1 and 5),
  comment      text check (char_length(comment) <= 600),
  status       text not null default 'published' check (status in ('published', 'hidden')),
  created_at   timestamptz not null default now()
);
create index cpa_reviews_cpa_idx on public.cpa_reviews (cpa_user_id, status);

-- Reviews only for your own completed request, for that request's professional.
create or replace function public.check_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.quote_requests q where q.id = new.request_id and q.requester_id = new.reviewer_id and q.cpa_user_id = new.cpa_user_id and q.status = 'completed') then
    raise exception 'reviews need a completed request of your own' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger cpa_reviews_check before insert on public.cpa_reviews for each row execute function public.check_review();

create table public.platform_fees (
  request_id   uuid primary key references public.quote_requests (id) on delete cascade,
  cpa_user_id  uuid not null references public.cpa_listings (user_id) on delete cascade,
  base_fee_php numeric(10, 2) not null check (base_fee_php >= 0),
  fee_rate     numeric(5, 4) not null,
  fee_php      numeric(10, 2) not null check (fee_php >= 0),
  status       text not null default 'due' check (status in ('due', 'paid', 'waived')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger platform_fees_set_updated_at before update on public.platform_fees for each row execute function public.set_updated_at();

-- Completing a request records the platform fee at the current rate (once).
create or replace function public.record_platform_fee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare r numeric;
begin
  if new.status = 'completed' and old.status <> 'completed' then
    select fee_rate into r from public.marketplace_settings where id;
    insert into public.platform_fees (request_id, cpa_user_id, base_fee_php, fee_rate, fee_php)
    values (new.id, new.cpa_user_id, new.final_fee_php, r, round(new.final_fee_php * r, 2))
    on conflict (request_id) do nothing;
  end if;
  return new;
end;
$$;
create trigger quote_requests_fee after update on public.quote_requests for each row execute function public.record_platform_fee();

-- Release both parties' emails when the professional accepts (server only, secret key).
create or replace function public.release_quote_contacts(p_request_id uuid, p_requester_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.quote_contacts (request_id, requester_email, cpa_email)
  select q.id, p_requester_email, l.contact_email
    from public.quote_requests q join public.cpa_listings l on l.user_id = q.cpa_user_id
   where q.id = p_request_id and q.status = 'accepted'
  on conflict (request_id) do nothing;
end;
$$;
revoke all on function public.release_quote_contacts(uuid, text) from public, anon, authenticated;
grant execute on function public.release_quote_contacts(uuid, text) to service_role;

-- Public directory: verified listings with rating summary (no emails).
create view public.cpa_directory with (security_invoker = false) as
  select l.user_id, l.display_name, l.profession, l.prc_license_no, l.license_valid_until, l.firm_name, l.bio, l.services, l.cities,
         l.online_only, l.starting_fee_php, l.verified_at,
         coalesce(round(avg(r.rating)::numeric, 1), null) as rating_avg,
         count(r.request_id)::integer as rating_count
    from public.cpa_listings l
    left join public.cpa_reviews r on r.cpa_user_id = l.user_id and r.status = 'published'
   where l.status = 'verified' and (l.license_valid_until is null or l.license_valid_until >= current_date)
   group by l.user_id;
grant select on public.cpa_directory to anon, authenticated;

-- Answers only "is this listing verified?" (requesters can't read other people's raw listings).
create or replace function public.is_verified_listing(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.cpa_listings l where l.user_id = p_user_id and l.status = 'verified'
                 and (l.license_valid_until is null or l.license_valid_until >= current_date));
$$;
grant execute on function public.is_verified_listing(uuid) to anon, authenticated;

-- RLS
alter table public.marketplace_settings enable row level security;
alter table public.cpa_listings enable row level security;
alter table public.quote_requests enable row level security;
alter table public.quote_contacts enable row level security;
alter table public.cpa_reviews enable row level security;
alter table public.platform_fees enable row level security;

create policy "settings: admins" on public.marketplace_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- The fee rate isn't secret: professionals see it on their listing page.
create policy "settings: everyone reads" on public.marketplace_settings for select to anon, authenticated using (true);
create policy "listings: owner reads" on public.cpa_listings for select to authenticated using (user_id = auth.uid());
create policy "listings: admins read" on public.cpa_listings for select to authenticated using (public.is_admin());
create policy "listings: owner creates pending" on public.cpa_listings for insert to authenticated with check (user_id = auth.uid() and status = 'pending' and verified_at is null);
create policy "listings: owner updates" on public.cpa_listings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "listings: admins update" on public.cpa_listings for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "listings: owner deletes" on public.cpa_listings for delete to authenticated using (user_id = auth.uid());

create policy "requests: parties read" on public.quote_requests for select to authenticated using (auth.uid() in (requester_id, cpa_user_id));
create policy "requests: admins read" on public.quote_requests for select to authenticated using (public.is_admin());
create policy "requests: users create to verified listings" on public.quote_requests for insert to authenticated
  with check (requester_id = auth.uid() and status = 'open' and cpa_reply is null and quoted_fee_php is null and final_fee_php is null
              and cpa_user_id <> auth.uid() and public.is_verified_listing(cpa_user_id));
create policy "requests: parties update" on public.quote_requests for update to authenticated using (auth.uid() in (requester_id, cpa_user_id)) with check (auth.uid() in (requester_id, cpa_user_id));

create policy "contacts: parties read" on public.quote_contacts for select to authenticated
  using (exists (select 1 from public.quote_requests q where q.id = request_id and auth.uid() in (q.requester_id, q.cpa_user_id)));

create policy "reviews: public reads published" on public.cpa_reviews for select to anon, authenticated using (status = 'published');
create policy "reviews: admins read all" on public.cpa_reviews for select to authenticated using (public.is_admin());
create policy "reviews: requester writes" on public.cpa_reviews for insert to authenticated with check (reviewer_id = auth.uid() and status = 'published');
create policy "reviews: admins moderate" on public.cpa_reviews for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "fees: professional reads own" on public.platform_fees for select to authenticated using (cpa_user_id = auth.uid());
create policy "fees: admins" on public.platform_fees for all to authenticated using (public.is_admin()) with check (public.is_admin());
