-- =============================================================================
-- Marites PH — Migration 11 (Phase 9): Marites Negosyo
--   businesses   up to 10 per user; registration numbers encrypted by the app
--   employees    names encrypted; salary kept as a number for computation
--   remittances  one row per business, agency, and month (what was paid, when)
-- Contribution RATES live in tax_rules (keys contribution.sss / .philhealth /
-- .pagibig) and remittance DEADLINES in tax_deadlines (applies_to 'employer'),
-- so they share effective dating, verification, and CPA review.
-- Permit renewal steps/fees/deadlines live in lgu_processes (Phase 1 table).
-- =============================================================================

create table public.businesses (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles (id) on delete cascade,
  name                 text not null check (char_length(name) between 2 and 120),
  business_type        text not null default 'sole_prop' check (business_type in ('sole_prop', 'partnership', 'corporation', 'cooperative')),
  city                 text check (char_length(city) <= 80),
  -- Encrypted by the app ("v1:..."): DTI/SEC number, SSS employer no., PhilHealth PEN, Pag-IBIG employer ID.
  registration_no_enc  text check (registration_no_enc like 'v1:%'),
  sss_no_enc           text check (sss_no_enc like 'v1:%'),
  philhealth_no_enc    text check (philhealth_no_enc like 'v1:%'),
  pagibig_no_enc       text check (pagibig_no_enc like 'v1:%'),
  -- Some agencies set due dates by a digit of the employer number; only that digit is stored in plain form.
  sss_due_digit        smallint check (sss_due_digit between 0 and 9),
  philhealth_due_digit smallint check (philhealth_due_digit between 0 and 9),
  permit_renewed_for   integer check (permit_renewed_for between 2000 and 2100),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index businesses_user_idx on public.businesses (user_id);
create trigger businesses_set_updated_at before update on public.businesses for each row execute function public.set_updated_at();

create or replace function public.limit_businesses()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.businesses where user_id = new.user_id) >= 10 then
    raise exception 'business limit reached' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger businesses_limit before insert on public.businesses for each row execute function public.limit_businesses();

create table public.employees (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  name_enc        text not null check (name_enc like 'v1:%'),
  monthly_salary  numeric(12, 2) not null check (monthly_salary > 0 and monthly_salary < 10000000),
  start_date      date,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);
create index employees_business_idx on public.employees (business_id);

create table public.remittances (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  agency          text not null check (agency in ('sss', 'philhealth', 'pagibig')),
  period          text not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  employee_share  numeric(12, 2) not null check (employee_share >= 0),
  employer_share  numeric(12, 2) not null check (employer_share >= 0),
  paid_on         date not null,
  created_at      timestamptz not null default now(),
  unique (business_id, agency, period)
);

-- Children must belong to a business the same user owns.
create or replace function public.check_business_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.businesses b where b.id = new.business_id and b.user_id = new.user_id) then
    raise exception 'business belongs to another user' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger employees_owner before insert or update on public.employees for each row execute function public.check_business_owner();
create trigger remittances_owner before insert or update on public.remittances for each row execute function public.check_business_owner();

do $$
declare t text;
begin
  foreach t in array array['businesses', 'employees', 'remittances'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%1$s: owner reads" on public.%1$I for select to authenticated using (user_id = auth.uid())', t);
    execute format('create policy "%1$s: owner inserts" on public.%1$I for insert to authenticated with check (user_id = auth.uid())', t);
    execute format('create policy "%1$s: owner updates" on public.%1$I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy "%1$s: owner deletes" on public.%1$I for delete to authenticated using (user_id = auth.uid())', t);
  end loop;
end $$;
