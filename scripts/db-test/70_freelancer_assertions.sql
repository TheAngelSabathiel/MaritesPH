-- Phase 7 assertions: private financial data, encryption format, CPA-only review, review reset on edit.
\set ON_ERROR_STOP on

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000d', 'cpa@example.test');
update public.profiles set role = 'cpa' where id = '00000000-0000-0000-0000-00000000000d';

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false) \gset ignored_
do $$ begin
  insert into public.taxpayer_profiles (user_id, tax_option, tin_enc) values (auth.uid(), 'eight_percent', 'v1:aXY=:dGFn:Y3Q=');
  begin
    update public.taxpayer_profiles set tin_enc = '123-456-789' where user_id = auth.uid();
    raise exception 'FAIL: plaintext TIN accepted';
  exception when check_violation then null; end;
  insert into public.income_entries (user_id, received_on, amount, currency, fx_rate, php_amount) values (auth.uid(), '2026-02-01', 1000, 'USD', 56.5, 56500);
  begin
    insert into public.income_entries (user_id, received_on, amount, currency, fx_rate, php_amount) values (auth.uid(), '2026-02-01', 1000, 'USD', 56.5, 1);
    raise exception 'FAIL: inconsistent PHP amount accepted';
  exception when check_violation then null; end;
  begin
    insert into public.reminders (user_id, deadline_key, title, due_on, remind_on) values (auth.uid(), 'x', 'x', current_date, current_date);
    raise exception 'FAIL: user created a reminder directly';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Admin can't read anyone's finances.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false) \gset ignored_
do $$ begin
  assert (select count(*) from public.taxpayer_profiles) = 0, 'admin reads taxpayer profiles';
  assert (select count(*) from public.income_entries) = 0, 'admin reads income';
end $$;
reset role;

-- CPA review: verified rule -> only the CPA can review; admin cannot.
insert into public.tax_rules (id, rule_key, description, parameters, effective_from, status, source_url, last_verified_at)
values ('80000000-0000-4000-8000-000000000001', 'test.rate', 'Test rate', '{"rate":0.08}', '2026-01-01', 'verified', 'https://example.gov.ph', now());
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false) \gset ignored_
do $$ begin
  begin
    perform public.cpa_review_tax_item('tax_rules', '80000000-0000-4000-8000-000000000001');
    raise exception 'FAIL: admin performed a CPA review';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false) \gset ignored_
do $$ begin
  assert (select count(*) from public.tax_rules where id = '80000000-0000-4000-8000-000000000001') = 1, 'CPA cannot read unpublished rule';
  perform public.cpa_review_tax_item('tax_rules', '80000000-0000-4000-8000-000000000001');
end $$;
reset role;
do $$ begin
  assert (select cpa_reviewed from public.tax_rules where id = '80000000-0000-4000-8000-000000000001'), 'CPA review not recorded';
  update public.tax_rules set status = 'published' where id = '80000000-0000-4000-8000-000000000001';
  -- Editing the rule's content clears the review, which a published rule can't have: refused.
  begin
    update public.tax_rules set parameters = '{"rate":0.09}' where id = '80000000-0000-4000-8000-000000000001';
    raise exception 'FAIL: published tax rule changed without a new CPA review';
  exception when check_violation then null; end;
  update public.tax_rules set status = 'verified' where id = '80000000-0000-4000-8000-000000000001';
  update public.tax_rules set parameters = '{"rate":0.09}' where id = '80000000-0000-4000-8000-000000000001';
  assert not (select cpa_reviewed from public.tax_rules where id = '80000000-0000-4000-8000-000000000001'), 'edit did not clear CPA review';
end $$;

-- Account deletion removes financial data.
do $$ begin
  delete from auth.users where id = '00000000-0000-0000-0000-00000000000c';
  assert (select count(*) from public.income_entries) = 0, 'income not deleted with account';
  assert (select count(*) from public.taxpayer_profiles) = 0, 'taxpayer profile not deleted with account';
end $$;

\echo 'ALL FREELANCER ASSERTIONS PASSED'
