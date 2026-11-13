-- Phase 9 assertions: owner-only business data, encryption format, cross-owner protection, business limit.
\set ON_ERROR_STOP on

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f1', 'owner1@example.test'), ('00000000-0000-0000-0000-0000000000f2', 'owner2@example.test');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false) \gset ignored_
do $$
declare b uuid;
begin
  insert into public.businesses (id, user_id, name, city) values ('95000000-0000-4000-8000-000000000001', auth.uid(), 'Sari-sari ni Aling Nena', 'Quezon City') returning id into b;
  insert into public.employees (business_id, user_id, name_enc, monthly_salary) values (b, auth.uid(), 'v1:aXY=:dGFn:Y3Q=', 18000);
  begin
    insert into public.employees (business_id, user_id, name_enc, monthly_salary) values (b, auth.uid(), 'Juan Dela Cruz', 18000);
    raise exception 'FAIL: plaintext employee name accepted';
  exception when check_violation then null; end;
  insert into public.remittances (business_id, user_id, agency, period, employee_share, employer_share, paid_on) values (b, auth.uid(), 'sss', '2026-10', 900, 1830, '2026-11-10');
  begin
    insert into public.remittances (business_id, user_id, agency, period, employee_share, employer_share, paid_on) values (b, auth.uid(), 'sss', '2026-13', 1, 1, '2026-11-10');
    raise exception 'FAIL: invalid period accepted';
  exception when check_violation then null; end;
  for i in 2..10 loop
    insert into public.businesses (user_id, name) values (auth.uid(), 'Business ' || i);
  end loop;
  begin
    insert into public.businesses (user_id, name) values (auth.uid(), 'Business 11');
    raise exception 'FAIL: more than 10 businesses';
  exception when check_violation then null; end;
end $$;

-- Another user can't read it or attach employees to it.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f2', false) \gset ignored_
do $$ begin
  assert (select count(*) from public.businesses) = 0, 'other user sees businesses';
  assert (select count(*) from public.employees) = 0, 'other user sees employees';
  begin
    insert into public.employees (business_id, user_id, name_enc, monthly_salary) values ('95000000-0000-4000-8000-000000000001', auth.uid(), 'v1:a:b:c', 1);
    raise exception 'FAIL: attached an employee to someone else''s business';
  exception when insufficient_privilege then null; end;
end $$;
-- Admins can't read business finances either.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false) \gset ignored_
do $$ begin
  assert (select count(*) from public.employees) = 0, 'admin sees employees';
end $$;
reset role;

do $$ begin
  delete from auth.users where id = '00000000-0000-0000-0000-0000000000f1';
  assert (select count(*) from public.businesses) = 0, 'businesses not deleted with the account';
  assert (select count(*) from public.remittances) = 0, 'remittances not deleted with the account';
end $$;

\echo 'ALL NEGOSYO ASSERTIONS PASSED'
