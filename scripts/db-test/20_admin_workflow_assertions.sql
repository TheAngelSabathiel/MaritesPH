-- Phase 2 assertions: legal references, content flags, audit trail, content index.
-- Runs after 10_rls_assertions.sql and reuses its fixtures.
\set ON_ERROR_STOP on

-- Fixture: published guide step + requirement on the published doc.
insert into public.document_requirements (id, document_id, group_key, requirement_text, status, source_url, last_verified_at)
values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'proof',
        'Proof of address', 'published', 'https://example.gov.ph', now());

-- 1. Legal references: target must exist; news/community can't be legal basis.
do $$ begin
  begin
    insert into public.legal_references (target_type, target_id, source_rank, issuing_body, issuance_type, citation_title)
    values ('document', '99999999-9999-9999-9999-999999999999', 1, 'Congress', 'republic_act', 'RA 0000');
    raise exception 'FAIL: legal reference to missing target accepted';
  exception when foreign_key_violation then null; end;

  begin
    insert into public.legal_references (target_type, target_id, source_rank, issuing_body, issuance_type, citation_title)
    values ('document', '20000000-0000-0000-0000-000000000001', 5, 'Some newspaper', 'other', 'News article');
    raise exception 'FAIL: news accepted as legal basis';
  exception when check_violation then null; end;

  insert into public.legal_references (id, target_type, target_id, source_rank, issuing_body, issuance_type, citation_title)
  values ('40000000-0000-0000-0000-000000000001', 'document_requirement',
          '30000000-0000-0000-0000-000000000001', 1, 'Congress', 'republic_act', 'RA 0000 (test)');
end $$;

-- 2. content_index resolves child legal references to the parent document page.
do $$ begin
  assert (select parent_type::text || ':' || parent_id::text from public.content_index
           where target_type = 'legal_reference' and id = '40000000-0000-0000-0000-000000000001')
         = 'document:20000000-0000-0000-0000-000000000001', 'legal reference parent not resolved';
end $$;

-- 3. Audit trail records inserts and status changes, with the actor.
do $$ begin
  assert (select count(*) from public.verification_events
           where target_id = '20000000-0000-0000-0000-000000000002' and from_status is null) = 1,
    'insert not logged';
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false) \gset ignored_
update public.documents set status = 'archived' where id = '20000000-0000-0000-0000-000000000002';
reset role;
do $$ begin
  assert (select actor from public.verification_events
           where target_id = '20000000-0000-0000-0000-000000000002' and to_status = 'archived')
         = '00000000-0000-0000-0000-00000000000a', 'status change actor not logged';
end $$;

-- 4. Anonymous visitors: content_index shows published only; cannot flag.
set role anon;
select set_config('request.jwt.claim.sub', '', false) \gset ignored_
do $$ begin
  assert (select count(*) from public.content_index where status <> 'published') = 0,
    'anon sees unpublished rows in content_index';
  begin
    insert into public.content_flags (target_type, target_id, reason)
    values ('document', '20000000-0000-0000-0000-000000000001', 'outdated');
    raise exception 'FAIL: anon filed a flag';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- 5. Regular user: can flag as self only, can't resolve, can't touch audit log.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false) \gset ignored_
do $$ begin
  insert into public.content_flags (user_id, target_type, target_id, reason, details)
  values (auth.uid(), 'document', '20000000-0000-0000-0000-000000000001', 'outdated', 'Fee changed');

  begin
    insert into public.content_flags (user_id, target_type, target_id, reason)
    values ('00000000-0000-0000-0000-00000000000a', 'document', '20000000-0000-0000-0000-000000000001', 'other');
    raise exception 'FAIL: user filed a flag as someone else';
  exception when insufficient_privilege then null; end;

  begin
    insert into public.content_flags (user_id, source, target_type, target_id, reason)
    values (auth.uid(), 'system', 'document', '20000000-0000-0000-0000-000000000001', 'other');
    raise exception 'FAIL: user filed a system flag';
  exception when insufficient_privilege then null; end;

  update public.content_flags set status = 'dismissed', resolved_at = now() where user_id = auth.uid();
  assert (select status from public.content_flags where user_id = auth.uid()) = 'open',
    'user changed their own flag status';

  begin
    insert into public.verification_events (target_type, target_id, to_status) values ('document', gen_random_uuid(), 'published');
    raise exception 'FAIL: user wrote to the audit log';
  exception when insufficient_privilege then null; end;

  assert (select count(*) from public.verification_events) = 0, 'user can read audit log';
end $$;
reset role;

-- 6. Admin resolves the flag; resolution requires resolved_at.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false) \gset ignored_
do $$ begin
  begin
    update public.content_flags set status = 'resolved' where status = 'open';
    raise exception 'FAIL: resolved flag without resolved_at';
  exception when check_violation then null; end;
  update public.content_flags set status = 'resolved', resolved_at = now(), resolved_by = auth.uid(),
         resolution_note = 'Fee updated' where status = 'open';
  assert (select count(*) from public.content_flags where status = 'resolved') = 1, 'admin could not resolve';
  assert (select count(*) from public.content_index where status = 'draft') >= 1, 'admin cannot see drafts in index';
end $$;
reset role;

\echo 'ALL ADMIN WORKFLOW ASSERTIONS PASSED'
