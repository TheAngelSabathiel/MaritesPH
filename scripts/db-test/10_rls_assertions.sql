-- RLS + guardrail assertions. Each block raises on failure.
\set ON_ERROR_STOP on

-- Fixtures (as superuser): one admin, one regular user.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@example.test', '{"full_name":"Admin"}'),
  ('00000000-0000-0000-0000-00000000000b', 'juan@example.test',  '{"full_name":"Juan","language_pref":"fil"}');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';

-- 1. Signup trigger created profiles with safe defaults.
do $$ begin
  assert (select count(*) from public.profiles) = 2, 'profiles not created by trigger';
  assert (select language_pref from public.profiles
           where id = '00000000-0000-0000-0000-00000000000b') = 'fil', 'language_pref not taken from metadata';
  assert (select role from public.profiles
           where id = '00000000-0000-0000-0000-00000000000b') = 'user', 'default role is not user';
end $$;

-- 2. Publish guardrails (as superuser, constraints still apply).
do $$ begin
  begin
    insert into public.agencies (name, status) values ('No Source Agency', 'published');
    raise exception 'FAIL: published row without source was accepted';
  exception when check_violation then null; end;

  begin
    insert into public.agencies (name, status, source_url, last_verified_at, to_verify_note)
    values ('Unverified Agency', 'published', 'https://example.gov.ph', now(), 'TO VERIFY: name');
    raise exception 'FAIL: published row with open TO VERIFY note was accepted';
  exception when check_violation then null; end;

  begin
    insert into public.tax_rules (rule_key, description, effective_from, status, source_url, last_verified_at)
    values ('test.rate', 'x', '2026-01-01', 'published', 'https://example.gov.ph', now());
    raise exception 'FAIL: tax rule published without CPA review';
  exception when check_violation then null; end;
end $$;

-- 3. Overlapping live tax rule versions are rejected; drafts may overlap.
do $$ begin
  insert into public.tax_rules (rule_key, description, effective_from, effective_to, status, source_url, last_verified_at, cpa_reviewed)
  values ('test.overlap', 'v1', '2026-01-01', '2027-01-01', 'verified', 'https://example.gov.ph', now(), true);
  insert into public.tax_rules (rule_key, description, effective_from, status)
  values ('test.overlap', 'draft proposal', '2026-06-01', 'draft');
  begin
    insert into public.tax_rules (rule_key, description, effective_from, status, source_url, last_verified_at, cpa_reviewed)
    values ('test.overlap', 'v2', '2026-06-01', 'verified', 'https://example.gov.ph', now(), true);
    raise exception 'FAIL: overlapping verified tax rules accepted';
  exception when exclusion_violation then null; end;
end $$;

-- Content fixtures: one published agency + document, one draft document.
insert into public.agencies (id, name, acronym, status, source_url, last_verified_at)
values ('10000000-0000-0000-0000-000000000001', 'Test Agency', 'TA', 'published', 'https://example.gov.ph', now());
insert into public.documents (id, slug, name, type, agency_id, status, source_url, last_verified_at) values
  ('20000000-0000-0000-0000-000000000001', 'published-doc', 'Published Doc', 'id',
   '10000000-0000-0000-0000-000000000001', 'published', 'https://example.gov.ph', now()),
  ('20000000-0000-0000-0000-000000000002', 'draft-doc', 'Draft Doc', 'id',
   '10000000-0000-0000-0000-000000000001', 'draft', null, null);
insert into public.guide_steps (document_id, step_order, title, status, source_url, last_verified_at) values
  ('20000000-0000-0000-0000-000000000001', 1, 'Published step', 'published', 'https://example.gov.ph', now()),
  ('20000000-0000-0000-0000-000000000002', 1, 'Step under draft doc', 'published', 'https://example.gov.ph', now());

-- 4. Requirement rows must target exactly one thing.
do $$ begin
  begin
    insert into public.document_requirements (document_id, group_key, requirement_text, requires_document_id)
    values ('20000000-0000-0000-0000-000000000001', 'g', 'text', '20000000-0000-0000-0000-000000000002');
    raise exception 'FAIL: requirement with two targets accepted';
  exception when check_violation then null; end;
end $$;

-- 5. Anonymous visitors see only published content.
set role anon;
select set_config('request.jwt.claim.sub', '', false) \gset ignored_
do $$ begin
  assert (select count(*) from public.documents) = 1, 'anon sees draft documents';
  assert (select count(*) from public.guide_steps) = 1, 'anon sees steps of a draft document';
  assert (select count(*) from public.profiles) = 0, 'anon sees profiles';
  begin
    insert into public.agencies (name) values ('Anon Agency');
    raise exception 'FAIL: anon inserted content';
  exception when insufficient_privilege then null; end;
  begin
    perform public.record_privacy_consent('v1');
    raise exception 'FAIL: anon could call consent RPC';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- 6. Regular user: own profile only, cannot escalate role, cannot write content.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false) \gset ignored_
do $$ begin
  assert (select count(*) from public.profiles) = 1, 'user sees other profiles';
  assert (select count(*) from public.documents) = 1, 'user sees draft documents';

  update public.profiles set city = 'Calamba' where id = auth.uid();
  assert (select city from public.profiles where id = auth.uid()) = 'Calamba', 'user cannot edit own city';

  begin
    update public.profiles set role = 'admin' where id = auth.uid();
    raise exception 'FAIL: user changed own role';
  exception when insufficient_privilege then null; end;

  begin
    update public.profiles set privacy_consent_at = now() where id = auth.uid();
    raise exception 'FAIL: user forged consent timestamp';
  exception when insufficient_privilege then null; end;

  perform public.record_privacy_consent('2026-11-v1');
  assert (select privacy_consent_version from public.profiles where id = auth.uid()) = '2026-11-v1',
    'consent RPC did not record version';

  begin
    insert into public.documents (slug, name, type) values ('x', 'X doc', 'id');
    raise exception 'FAIL: regular user inserted content';
  exception when insufficient_privilege then null; end;

  -- Updates against content silently match zero rows under RLS.
  update public.documents set name = 'Hacked' where slug = 'published-doc';
end $$;
reset role;

do $$ begin
  assert (select name from public.documents where slug = 'published-doc') = 'Published Doc',
    'regular user modified content';
end $$;

-- 7. Admin: sees drafts, can write content.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false) \gset ignored_
do $$ begin
  assert (select count(*) from public.documents) = 2, 'admin cannot see drafts';
  assert (select count(*) from public.profiles) = 2, 'admin cannot read profiles';
  insert into public.documents (slug, name, type) values ('admin-draft', 'Admin draft', 'certificate');
  update public.documents set to_verify_note = 'TO VERIFY: fee' where slug = 'admin-draft';
end $$;
reset role;

\echo 'ALL RLS ASSERTIONS PASSED'
