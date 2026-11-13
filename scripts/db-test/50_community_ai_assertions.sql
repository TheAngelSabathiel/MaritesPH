-- Phase 5 assertions: tips moderation, wait stats, troubleshooter cache, live context.
\set ON_ERROR_STOP on

-- A fresh user (user b was deleted in the planner suite).
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000c', 'maria@example.test');
insert into public.offices (id, agency_id, name, status, source_url, last_verified_at)
values ('60000000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000001', 'Tip Office', 'published', 'https://example.gov.ph', now());

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false) \gset ignored_
do $$ begin
  insert into public.tips (user_id, office_id, body, wait_minutes) values (auth.uid(), '60000000-0000-4000-8000-000000000001', 'Line was long in the morning', 120);
  begin
    insert into public.tips (user_id, office_id, body, status) values (auth.uid(), '60000000-0000-4000-8000-000000000001', 'Self approved tip text', 'approved');
    raise exception 'FAIL: user approved their own tip';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.tips (user_id, body) values (auth.uid(), 'Tip about nothing at all');
    raise exception 'FAIL: tip without a target accepted';
  exception when check_violation then null; end;
  assert (select count(*) from public.tips) = 1, 'author cannot see own pending tip';
end $$;
reset role;

-- Pending tips are invisible to the public and don't count toward wait stats.
set role anon;
select set_config('request.jwt.claim.sub', '', false) \gset ignored_
do $$ begin
  assert (select count(*) from public.tips) = 0, 'anon sees pending tips';
  assert (select count(*) from public.office_wait_stats) = 0, 'pending tips counted in wait stats';
end $$;
reset role;

-- Admin approves; plus two more approved tips -> median.
update public.tips set status = 'approved', reviewed_at = now() where body = 'Line was long in the morning';
insert into public.tips (user_id, office_id, body, wait_minutes, status) values
  ('00000000-0000-0000-0000-00000000000c', '60000000-0000-4000-8000-000000000001', 'Quick visit this time', 30, 'approved'),
  ('00000000-0000-0000-0000-00000000000c', '60000000-0000-4000-8000-000000000001', 'About an hour of waiting', 60, 'approved');
set role anon;
do $$ begin
  assert (select count(*) from public.tips) = 3, 'anon should see approved tips';
  assert (select median_wait_minutes from public.office_wait_stats where office_id = '60000000-0000-4000-8000-000000000001') = 60, 'median wait wrong';
end $$;
reset role;

-- Troubleshooter cache: similar question found; private to the asker; service role only for lookup.
insert into public.troubleshoot_queries (user_id, document_id, problem_text, result) values
  ('00000000-0000-0000-0000-00000000000c', '20000000-0000-0000-0000-000000000001', 'My name on the PSA birth certificate is misspelled', '{"summary":"x"}');
set role service_role;
do $$ begin
  assert (select count(*) from public.find_similar_troubleshoot('20000000-0000-0000-0000-000000000001', 'my name is misspelled on my PSA birth certificate', 'en')) = 1, 'similar question not found';
  assert (select count(*) from public.find_similar_troubleshoot('20000000-0000-0000-0000-000000000001', 'office closed on Saturday morning', 'en')) = 0, 'unrelated question matched';
  assert (select count(*) from public.find_similar_troubleshoot('20000000-0000-0000-0000-000000000002', 'My name on the PSA birth certificate is misspelled', 'en')) = 0, 'other document matched';
end $$;
reset role;
set role anon;
do $$ begin
  begin
    perform public.find_similar_troubleshoot('20000000-0000-0000-0000-000000000001', 'x', 'en');
    raise exception 'FAIL: anon could search cached questions';
  exception when insufficient_privilege then null; end;
  assert (select count(*) from public.troubleshoot_queries) = 0, 'anon reads troubleshoot questions';
end $$;
reset role;

-- Live context: public can read, cannot write.
insert into public.live_context_cache (target_type, target_id, kind, results, expires_at)
values ('document', '20000000-0000-0000-0000-000000000001', 'official', '{"items":[]}', now() + interval '1 day');
set role anon;
do $$ begin
  assert (select count(*) from public.live_context_cache) = 1, 'anon cannot read live context';
  begin
    insert into public.live_context_cache (target_type, target_id, kind, results, expires_at)
    values ('document', '20000000-0000-0000-0000-000000000001', 'community', '{}', now());
    raise exception 'FAIL: anon wrote live context';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

\echo 'ALL COMMUNITY AND AI ASSERTIONS PASSED'
