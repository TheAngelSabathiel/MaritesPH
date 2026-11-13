-- =============================================================================
-- Marites PH — Migration 10 (Phase 8): plans, payments, entitlements
--   Prepaid periods (1/3/6/12 months) through PayMongo Checkout; no auto-debit.
--   subscription_plans  prices set by admins (nothing hardcoded); public sees active plans
--   payments       ledger; created pending at checkout, marked paid ONLY by
--                  apply_payment() after a verified webhook (or a manual comp)
--   entitlements   one row per user: plan + period end. Feature access checks
--                  only this table (src/lib/billing/access.ts).
--   webhook_events idempotency: each PayMongo event is applied at most once
-- =============================================================================

create table public.subscription_plans (
  key                text primary key check (key in ('freelancer', 'negosyo')),
  name               text not null check (char_length(name) between 2 and 80),
  monthly_price_php  numeric(10, 2) check (monthly_price_php > 0),
  rank               integer not null check (rank > 0), -- higher includes lower (negosyo includes freelancer)
  active             boolean not null default false,
  updated_at         timestamptz not null default now(),
  constraint subscription_plans_price_before_active check (not active or monthly_price_php is not null)
);
create trigger subscription_plans_set_updated_at before update on public.subscription_plans for each row execute function public.set_updated_at();
insert into public.subscription_plans (key, name, rank) values ('freelancer', 'Marites Freelancer', 1), ('negosyo', 'Marites Negosyo', 2);

create table public.payments (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references public.profiles (id) on delete set null,
  plan_key             text not null references public.subscription_plans (key),
  months               integer not null check (months in (1, 3, 6, 12)),
  amount_php           numeric(10, 2) not null check (amount_php >= 0),
  provider             text not null check (provider in ('paymongo', 'manual')),
  status               text not null default 'pending' check (status in ('pending', 'paid', 'review', 'expired', 'refunded', 'comp')),
  checkout_session_id  text unique,
  livemode             boolean,
  paid_at              timestamptz,
  note                 text check (char_length(note) <= 500),
  created_at           timestamptz not null default now()
);
create index payments_user_idx on public.payments (user_id, created_at desc);

create table public.entitlements (
  user_id             uuid primary key references public.profiles (id) on delete cascade,
  plan_key            text not null references public.subscription_plans (key),
  current_period_end  timestamptz not null,
  status              text not null default 'active' check (status in ('active', 'canceled')),
  source              text not null check (source in ('paid', 'comp')),
  renewal_reminded_at timestamptz,
  updated_at          timestamptz not null default now()
);
create trigger entitlements_set_updated_at before update on public.entitlements for each row execute function public.set_updated_at();

create table public.webhook_events (
  event_key    text primary key,
  type         text not null,
  outcome      text not null,
  received_at  timestamptz not null default now()
);

alter table public.subscription_plans enable row level security;
alter table public.payments enable row level security;
alter table public.entitlements enable row level security;
alter table public.webhook_events enable row level security; -- no policies: server only

create policy "subscription_plans: public reads active" on public.subscription_plans for select to anon, authenticated using (active);
create policy "subscription_plans: admins read all" on public.subscription_plans for select to authenticated using (public.is_admin());
create policy "subscription_plans: admins update" on public.subscription_plans for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "payments: owner reads" on public.payments for select to authenticated using (user_id = auth.uid());
create policy "payments: admins read" on public.payments for select to authenticated using (public.is_admin());
create policy "entitlements: owner reads" on public.entitlements for select to authenticated using (user_id = auth.uid());
create policy "entitlements: admins read" on public.entitlements for select to authenticated using (public.is_admin());
-- A user may stop renewal reminders (status canceled); nothing else.
create policy "entitlements: owner cancels" on public.entitlements for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and status = 'canceled');
revoke insert, delete on public.payments, public.entitlements from anon, authenticated;
revoke update on public.payments from anon, authenticated;
revoke update on public.entitlements from anon, authenticated;
grant update (status) on public.entitlements to authenticated;

-- ---------------------------------------------------------------------------
-- apply_payment: the ONLY way a payment becomes paid and access is extended.
-- Same plan: adds months after the current end. Upgrade (higher rank): starts
-- now, and remaining days of the lower plan carry over. Buying a lower plan
-- while a higher one is active is refused (checkout also blocks it).
-- Idempotent: a payment already paid returns without changes.
-- ---------------------------------------------------------------------------
create or replace function public.apply_payment(p_payment_id uuid, p_status text default 'paid')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  pay public.payments%rowtype;
  ent public.entitlements%rowtype;
  new_rank integer;
  old_rank integer;
  base timestamptz;
  carry interval := interval '0';
begin
  if p_status not in ('paid', 'comp') then raise exception 'bad status' using errcode = '22023'; end if;
  select * into pay from public.payments where id = p_payment_id for update;
  if not found then return 'not_found'; end if;
  if pay.status in ('paid', 'comp') then return 'already_applied'; end if;
  if pay.status <> 'pending' then return 'not_pending'; end if;
  if pay.user_id is null then return 'no_user'; end if;

  select rank into new_rank from public.subscription_plans where key = pay.plan_key;
  select * into ent from public.entitlements where user_id = pay.user_id for update;

  if found and ent.current_period_end > now() then
    select rank into old_rank from public.subscription_plans where key = ent.plan_key;
    if old_rank = new_rank then
      base := ent.current_period_end;
    elsif new_rank > old_rank then
      base := now();
      carry := ent.current_period_end - now();
    else
      update public.payments set status = 'review', note = 'Lower plan bought while a higher plan is active' where id = pay.id;
      return 'needs_review';
    end if;
  else
    base := now();
  end if;

  insert into public.entitlements (user_id, plan_key, current_period_end, status, source, renewal_reminded_at)
  values (pay.user_id, pay.plan_key, base + make_interval(months => pay.months) + carry, 'active', case when p_status = 'comp' then 'comp' else 'paid' end, null)
  on conflict (user_id) do update set
    plan_key = excluded.plan_key, current_period_end = excluded.current_period_end,
    status = 'active', source = excluded.source, renewal_reminded_at = null;

  update public.payments set status = p_status, paid_at = now() where id = pay.id;
  return 'applied';
end;
$$;
revoke all on function public.apply_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.apply_payment(uuid, text) to service_role;

-- Reminders: allow plan renewal reminders alongside tax deadlines.
alter table public.reminders drop constraint reminders_kind_check;
alter table public.reminders add constraint reminders_kind_check check (kind in ('tax_deadline', 'plan_renewal'));
