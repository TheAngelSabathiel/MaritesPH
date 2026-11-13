-- Phase 8 assertions: prices before activation, server-only payments, apply_payment period math, idempotency.
\set ON_ERROR_STOP on

do $$ begin
  begin
    update public.subscription_plans set active = true where key = 'freelancer';
    raise exception 'FAIL: plan activated without a price';
  exception when check_violation then null; end;
end $$;
update public.subscription_plans set monthly_price_php = 199, active = true where key = 'freelancer';
update public.subscription_plans set monthly_price_php = 499, active = true where key = 'negosyo';

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e1', 'payer@example.test');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false) \gset ignored_
do $$ begin
  begin
    insert into public.payments (user_id, plan_key, months, amount_php, provider, status) values (auth.uid(), 'freelancer', 12, 0, 'manual', 'paid');
    raise exception 'FAIL: user created a paid payment';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.entitlements (user_id, plan_key, current_period_end, source) values (auth.uid(), 'negosyo', now() + interval '10 years', 'comp');
    raise exception 'FAIL: user granted themselves a plan';
  exception when insufficient_privilege then null; end;
  begin
    perform public.apply_payment('00000000-0000-0000-0000-000000000000');
    raise exception 'FAIL: user called apply_payment';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Period math (as the server would do it).
insert into public.payments (id, user_id, plan_key, months, amount_php, provider) values
  ('90000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-0000000000e1', 'freelancer', 1, 199, 'paymongo'),
  ('90000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-0000000000e1', 'freelancer', 3, 597, 'paymongo'),
  ('90000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-0000000000e1', 'negosyo', 1, 499, 'paymongo'),
  ('90000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-0000000000e1', 'freelancer', 1, 199, 'paymongo');
set role service_role;
do $$
declare first_end timestamptz;
begin
  assert public.apply_payment('90000000-0000-4000-8000-000000000001') = 'applied', 'first payment not applied';
  assert public.apply_payment('90000000-0000-4000-8000-000000000001') = 'already_applied', 'payment applied twice';
  select current_period_end into first_end from public.entitlements where user_id = '00000000-0000-0000-0000-0000000000e1';
  assert first_end between now() + interval '27 days' and now() + interval '32 days', 'one month wrong';
  -- Renewal of the same plan stacks after the current end.
  assert public.apply_payment('90000000-0000-4000-8000-000000000002') = 'applied', 'renewal not applied';
  assert (select current_period_end from public.entitlements where user_id = '00000000-0000-0000-0000-0000000000e1') = first_end + interval '3 months', 'renewal did not stack';
  -- Upgrade: starts now, carries remaining days (~4 months) onto the higher plan.
  assert public.apply_payment('90000000-0000-4000-8000-000000000003') = 'applied', 'upgrade not applied';
  assert (select plan_key from public.entitlements where user_id = '00000000-0000-0000-0000-0000000000e1') = 'negosyo', 'upgrade plan wrong';
  assert (select current_period_end from public.entitlements where user_id = '00000000-0000-0000-0000-0000000000e1') > now() + interval '4 months', 'upgrade lost remaining time';
  -- Downgrade while higher is active: held for review, no change.
  assert public.apply_payment('90000000-0000-4000-8000-000000000004') = 'needs_review', 'downgrade not held';
  assert (select plan_key from public.entitlements where user_id = '00000000-0000-0000-0000-0000000000e1') = 'negosyo', 'downgrade changed plan';
end $$;
reset role;

-- Owner can see and cancel (stop reminders) but not extend.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false) \gset ignored_
do $$ begin
  assert (select count(*) from public.payments) = 4, 'owner cannot see payments';
  update public.entitlements set status = 'canceled' where user_id = auth.uid();
  assert (select status from public.entitlements where user_id = auth.uid()) = 'canceled', 'owner cannot cancel';
  begin
    update public.entitlements set current_period_end = now() + interval '10 years' where user_id = auth.uid();
    raise exception 'FAIL: owner extended their plan';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set role anon;
do $$ begin
  assert (select count(*) from public.subscription_plans) = 2, 'anon cannot see active plans';
  assert (select count(*) from public.payments) = 0, 'anon sees payments';
  assert (select count(*) from public.webhook_events) = 0, 'anon sees webhook events';
end $$;
reset role;

\echo 'ALL BILLING ASSERTIONS PASSED'
