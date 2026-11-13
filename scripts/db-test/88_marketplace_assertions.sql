-- Phase 10 assertions: listings verified by admins only, private requests, contact release, reviews, fees.
\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'cpa.ana@example.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'client.ben@example.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'stranger@example.test');
update public.marketplace_settings set fee_rate = 0.10;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false) \gset ignored_
do $$ begin
  begin
    insert into public.cpa_listings (user_id, display_name, contact_email, status, verified_at) values (auth.uid(), 'Ana', 'ana@example.test', 'verified', now());
    raise exception 'FAIL: listing self-verified on insert';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.cpa_listings (user_id, display_name, contact_email) values (auth.uid(), 'Ana', 'ana@example.test');
    raise exception 'FAIL: CPA listing without license accepted';
  exception when check_violation then null; end;
  insert into public.cpa_listings (user_id, display_name, prc_license_no, contact_email, services, cities) values (auth.uid(), 'Ana Santos, CPA', '0123456', 'ana@example.test', '{tax_filing}', '{Quezon City}');
  update public.cpa_listings set status = 'verified', verified_at = now() where user_id = auth.uid();
  assert (select status from public.cpa_listings where user_id = auth.uid()) = 'pending', 'owner verified themselves';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false) \gset ignored_

set role anon;
do $$ begin assert (select count(*) from public.cpa_directory) = 0, 'pending listing is public'; end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false) \gset ignored_
update public.cpa_listings set status = 'verified', verified_at = now() where user_id = '00000000-0000-0000-0000-0000000000a1';
set role anon;
do $$ begin
  assert (select count(*) from public.cpa_directory) = 1, 'verified listing not public';
  assert (select count(*) from public.cpa_listings) = 0, 'anon reads raw listings (emails)';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false) \gset ignored_

-- Owner edits license number: back to pending.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false) \gset ignored_
update public.cpa_listings set prc_license_no = '0654321' where user_id = auth.uid();
reset role;
select set_config('request.jwt.claim.sub', '', false) \gset ignored_
do $$ begin assert (select status from public.cpa_listings where user_id = '00000000-0000-0000-0000-0000000000a1') = 'pending', 'license change kept verification'; end $$;
update public.cpa_listings set status = 'verified', verified_at = now() where user_id = '00000000-0000-0000-0000-0000000000a1';

-- Client requests a quote; stranger can't see it; client can't accept it.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false) \gset ignored_
do $$ begin
  insert into public.quote_requests (id, requester_id, cpa_user_id, service, message) values
    ('96000000-0000-4000-8000-000000000001', auth.uid(), '00000000-0000-0000-0000-0000000000a1', 'tax_filing', 'I need help filing my quarterly 1701Q returns this year.');
  begin
    update public.quote_requests set status = 'accepted' where id = '96000000-0000-4000-8000-000000000001';
    raise exception 'FAIL: requester accepted their own request';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.cpa_reviews (request_id, reviewer_id, cpa_user_id, rating) values ('96000000-0000-4000-8000-000000000001', auth.uid(), '00000000-0000-0000-0000-0000000000a1', 5);
    raise exception 'FAIL: review before completion';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a3', false) \gset ignored_
do $$ begin assert (select count(*) from public.quote_requests) = 0, 'stranger sees request'; end $$;

-- Professional accepts; contacts released by the server; completes with a fee.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false) \gset ignored_
do $$ begin
  update public.quote_requests set status = 'accepted', cpa_reply = 'Happy to help.', quoted_fee_php = 3000 where id = '96000000-0000-4000-8000-000000000001';
  assert (select count(*) from public.quote_contacts) = 0, 'contacts visible before release';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false) \gset ignored_
set role service_role;
select public.release_quote_contacts('96000000-0000-4000-8000-000000000001', 'client.ben@example.test');
reset role;
select set_config('request.jwt.claim.sub', '', false) \gset ignored_
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false) \gset ignored_
do $$ begin assert (select cpa_email from public.quote_contacts) = 'ana@example.test', 'client cannot see CPA email after acceptance'; end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a3', false) \gset ignored_
do $$ begin assert (select count(*) from public.quote_contacts) = 0, 'stranger sees contacts'; end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false) \gset ignored_
do $$ begin
  begin
    update public.quote_requests set status = 'completed' where id = '96000000-0000-4000-8000-000000000001';
    raise exception 'FAIL: completed without a final fee';
  exception when check_violation then null; end;
  update public.quote_requests set status = 'completed', final_fee_php = 3500 where id = '96000000-0000-4000-8000-000000000001';
  assert (select fee_php from public.platform_fees where request_id = '96000000-0000-4000-8000-000000000001') = 350, 'platform fee wrong';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false) \gset ignored_
do $$ begin
  insert into public.cpa_reviews (request_id, reviewer_id, cpa_user_id, rating, comment) values ('96000000-0000-4000-8000-000000000001', auth.uid(), '00000000-0000-0000-0000-0000000000a1', 5, 'Clear and fast.');
  assert (select count(*) from public.platform_fees) = 0, 'client sees platform fees';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false) \gset ignored_
set role anon;
do $$ begin assert (select rating_avg from public.cpa_directory) = 5.0 and (select rating_count from public.cpa_directory) = 1, 'rating summary wrong'; end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false) \gset ignored_
do $$ begin assert (select role from public.profiles where id = '00000000-0000-0000-0000-0000000000a1') = 'user', 'listing verification granted the cpa role'; end $$;

\echo 'ALL MARKETPLACE ASSERTIONS PASSED'
