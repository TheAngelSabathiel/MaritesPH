-- Phase 3 assertions: slugs and rate limiter.
\set ON_ERROR_STOP on

do $$ begin
  assert public.slugify('Parañaque City Hall') = 'paranaque-city-hall', 'slugify ñ';
  assert public.slugify('  DFA (ASEANA) — Office #1 ') = 'dfa-aseana-office-1', 'slugify punctuation';
end $$;

-- Office slugs: auto-generated, unique, collision-safe.
insert into public.offices (id, agency_id, name) values
  ('50000000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000001', 'Sample Office'),
  ('50000000-0000-4000-8000-000000000002', '10000000-0000-0000-0000-000000000001', 'Sample Office');
do $$ begin
  assert (select slug from public.offices where id = '50000000-0000-4000-8000-000000000001') = 'sample-office', 'slug not generated';
  assert (select slug from public.offices where id = '50000000-0000-4000-8000-000000000002') = 'sample-office-500000',
    'duplicate name should get id suffix';
  begin
    update public.offices set slug = 'Bad Slug' where id = '50000000-0000-4000-8000-000000000001';
    raise exception 'FAIL: invalid slug accepted';
  exception when check_violation then null; end;
end $$;

-- Rate limiter: only the service role can call it; counts per window.
set role anon;
do $$ begin
  begin
    perform public.hit_rate_limit('k', 1, 60);
    raise exception 'FAIL: anon could call the rate limiter';
  exception when insufficient_privilege then null; end;
  begin
    perform count(*) from public.rate_limits;
    raise exception 'FAIL: anon could read rate_limits';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set role service_role;
do $$ begin
  assert public.hit_rate_limit('test:key', 2, 3600) = true, 'first hit';
  assert public.hit_rate_limit('test:key', 2, 3600) = true, 'second hit';
  assert public.hit_rate_limit('test:key', 2, 3600) = false, 'third hit should be limited';
  assert public.hit_rate_limit('test:other', 2, 3600) = true, 'keys are independent';
end $$;
reset role;

\echo 'ALL PUBLIC GUIDE ASSERTIONS PASSED'
