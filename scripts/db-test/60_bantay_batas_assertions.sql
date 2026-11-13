-- Phase 6 assertions: monitoring tables are admin-only; feed shows only published/approved; alerts are private.
\set ON_ERROR_STOP on

do $$ begin
  begin
    insert into public.official_sources (name, url, source_type, active, to_verify_note)
    values ('Unchecked source', 'https://example.gov.ph/feed', 'rss', true, 'TO VERIFY: terms');
    raise exception 'FAIL: unverified source activated';
  exception when check_violation then null; end;
end $$;

insert into public.official_sources (id, name, url, source_type) values ('70000000-0000-4000-8000-000000000001', 'Test feed', 'https://example.gov.ph/rss', 'rss');
insert into public.issuances (id, source_id, url, title, published) values
  ('71000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'https://example.gov.ph/mc-1', 'Published circular', true),
  ('71000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000001', 'https://example.gov.ph/mc-2', 'Unpublished circular', false);
insert into public.change_proposals (id, issuance_id, target_type, target_id, proposed_change, status, reviewed_at) values
  ('72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', 'document', '20000000-0000-0000-0000-000000000001', '{"fields":{"fee_min":{"before":1,"after":2}}}', 'approved', now()),
  ('72000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000002', 'document', '20000000-0000-0000-0000-000000000001', '{"fields":{}}', 'open', null);
insert into public.change_alerts (user_id, change_proposal_id, reason) values
  ('00000000-0000-0000-0000-00000000000c', '72000000-0000-4000-8000-000000000001', 'A document you track changed');

do $$ begin
  begin
    insert into public.change_proposals (target_type, target_id, proposed_change) values ('document', '99999999-9999-4999-8999-999999999999', '{"fields":{}}');
    raise exception 'FAIL: proposal for a missing record accepted';
  exception when foreign_key_violation then null; end;
  begin
    update public.change_proposals set status = 'approved' where id = '72000000-0000-4000-8000-000000000002';
    raise exception 'FAIL: approved without reviewed_at';
  exception when check_violation then null; end;
end $$;

set role anon;
select set_config('request.jwt.claim.sub', '', false) \gset ignored_
do $$ begin
  assert (select count(*) from public.official_sources) = 0, 'anon sees sources';
  assert (select count(*) from public.issuances) = 1, 'anon should see only the published issuance';
  assert (select count(*) from public.change_proposals) = 1, 'anon should see only approved proposals';
  assert (select count(*) from public.issuance_links) = 0, 'anon sees links';
  assert (select count(*) from public.change_alerts) = 0, 'anon sees alerts';
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false) \gset ignored_
do $$ begin
  assert (select count(*) from public.change_alerts) = 1, 'user cannot see own alert';
  assert (select count(*) from public.official_sources) = 0, 'non-admin sees sources';
  begin
    insert into public.official_sources (name, url, source_type) values ('Mine', 'https://example.gov.ph/x', 'rss');
    raise exception 'FAIL: non-admin added a source';
  exception when insufficient_privilege then null; end;
  begin
    update public.change_proposals set status = 'approved', reviewed_at = now() where id = '72000000-0000-4000-8000-000000000002';
    assert (select status from public.change_proposals where id = '72000000-0000-4000-8000-000000000002') is null, 'unreachable';
  exception when others then null; end;
end $$;
reset role;
do $$ begin
  assert (select status from public.change_proposals where id = '72000000-0000-4000-8000-000000000002') = 'open', 'non-admin approved a proposal';
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false) \gset ignored_
do $$ begin
  assert (select count(*) from public.official_sources) >= 1, 'admin cannot see sources';
  assert (select count(*) from public.change_proposals) = 2, 'admin cannot see all proposals';
  assert (select count(*) from public.change_alerts) = 0, 'admin should not read other users alerts';
end $$;
reset role;

\echo 'ALL BANTAY BATAS ASSERTIONS PASSED'
