-- =============================================================================
-- SAMPLE DATA FOR LOCAL DEVELOPMENT AND E2E TESTS ONLY. NEVER RUN IN PRODUCTION.
-- =============================================================================
-- Clearly fake records ("Sample ...", example.gov.ph sources) marked as
-- published, so public guide and office pages have something to render
-- before real content is verified. Slugs all start with "sample-".
--
-- Covers: OR-groups, a stale record (shows "may be outdated"), drafts that
-- must stay hidden, legal references, weekend and walk-in offices.
--
-- Load after migrations (and optionally seed.sql):
--   psql "$DATABASE_URL" -f tests/fixtures/sample-published.sql
-- Remove:
--   delete from public.documents where slug like 'sample-%';
--   delete from public.offices where slug like 'sample-%';
--   delete from public.agencies where name like 'Sample %';
--   delete from auth.users where email = 'sample.user@example.test';
-- =============================================================================

do $$ begin
  if exists (select 1 from public.documents where slug like 'sample-%') then
    raise exception 'Sample data already loaded';
  end if;
end $$;

insert into public.agencies (id, name, acronym, official_url, status, source_url, last_verified_at) values
  ('f0000000-0000-4000-8000-0000000000a1', 'Sample Agency', 'SA', 'https://example.gov.ph', 'published',
   'https://example.gov.ph', now() - interval '10 days');

insert into public.documents (id, slug, name, type, agency_id, purpose_tags, description,
  validity_text, validity_months, processing_days_min, processing_days_max, processing_note,
  fee_min, fee_max, fee_note, status, source_url, last_verified_at) values
  ('f0000000-0000-4000-8000-0000000000d1', 'sample-id', 'Sample ID', 'id', 'f0000000-0000-4000-8000-0000000000a1',
   '{valid_id}', 'A made-up ID used to test the guide page layout.',
   '5 years', 60, 1, 5, 'Sample processing note.', 100, 250, 'Sample fee note: regular vs rush.',
   'published', 'https://example.gov.ph/sample-id', now() - interval '10 days'),
  ('f0000000-0000-4000-8000-0000000000d2', 'sample-certificate', 'Sample Certificate', 'certificate',
   'f0000000-0000-4000-8000-0000000000a1', '{proof_of_identity}', 'A made-up certificate. Its verification is old on purpose.',
   null, null, null, null, null, 50, 50, null,
   'published', 'https://example.gov.ph/sample-certificate', now() - interval '200 days'),
  ('f0000000-0000-4000-8000-0000000000d3', 'sample-draft', 'Sample Draft (must stay hidden)', 'id',
   'f0000000-0000-4000-8000-0000000000a1', '{}', null, null, null, null, null, null, null, null, null,
   'draft', null, null);

insert into public.document_requirements (id, document_id, group_key, option_key, requires_document_id, requirement_text,
  sort_order, notes, status, source_url, last_verified_at, to_verify_note) values
  ('f0000000-0000-4000-8000-0000000000b1', 'f0000000-0000-4000-8000-0000000000d1', 'proof_of_identity', 'a',
   'f0000000-0000-4000-8000-0000000000d2', null, 10, null, 'published', 'https://example.gov.ph/sample-id', now() - interval '10 days', null),
  ('f0000000-0000-4000-8000-0000000000b2', 'f0000000-0000-4000-8000-0000000000d1', 'proof_of_identity', 'b',
   null, 'Sample supporting document A', 20, 'Original and one photocopy.', 'published', 'https://example.gov.ph/sample-id', now() - interval '10 days', null),
  ('f0000000-0000-4000-8000-0000000000b3', 'f0000000-0000-4000-8000-0000000000d1', 'proof_of_identity', 'b',
   null, 'Sample supporting document B', 21, null, 'published', 'https://example.gov.ph/sample-id', now() - interval '10 days', null),
  ('f0000000-0000-4000-8000-0000000000b4', 'f0000000-0000-4000-8000-0000000000d1', 'application', 'a',
   null, 'Completed sample application form', 30, null, 'published', 'https://example.gov.ph/sample-id', now() - interval '10 days', null),
  ('f0000000-0000-4000-8000-0000000000b5', 'f0000000-0000-4000-8000-0000000000d1', 'hidden_group', 'a',
   null, 'DRAFT REQUIREMENT, MUST NOT APPEAR', 40, null, 'draft', null, null, 'TO VERIFY: sample');

insert into public.guide_steps (document_id, step_order, title, body_md, is_online, estimated_minutes, status, source_url, last_verified_at) values
  ('f0000000-0000-4000-8000-0000000000d1', 1, 'Book an appointment online', 'Choose a date on the sample agency website.', true, 15,
   'published', 'https://example.gov.ph/sample-id', now() - interval '10 days'),
  ('f0000000-0000-4000-8000-0000000000d1', 2, 'Bring your requirements', 'Bring the originals listed above.', false, 30,
   'published', 'https://example.gov.ph/sample-id', now() - interval '10 days'),
  ('f0000000-0000-4000-8000-0000000000d1', 3, 'Claim your ID', 'Claim it at the same office.', false, 60,
   'published', 'https://example.gov.ph/sample-id', now() - interval '10 days');

insert into public.accepted_for (document_id, purpose, status, source_url, last_verified_at) values
  ('f0000000-0000-4000-8000-0000000000d1', 'bank_account', 'published', 'https://example.gov.ph/sample-id', now() - interval '10 days');

insert into public.legal_references (target_type, target_id, source_rank, issuing_body, issuance_type, issuance_number,
  citation_title, date_issued, section, note, status, source_url, last_verified_at) values
  ('document', 'f0000000-0000-4000-8000-0000000000d1', 1, 'Congress of the Philippines', 'republic_act', 'RA 0000',
   'Sample Identification Act', '2020-01-15', 'Sec. 5', 'Sample: establishes the sample ID.', 'published',
   'https://example.gov.ph/ra-0000', now() - interval '10 days'),
  ('document_requirement', 'f0000000-0000-4000-8000-0000000000b4', 3, 'Sample Agency', 'memorandum_circular', 'MC 2024-01',
   'Sample application form circular', '2024-03-01', null, 'Sample: prescribes the application form.', 'published',
   'https://example.gov.ph/mc-2024-01', now() - interval '10 days');

insert into public.offices (id, agency_id, slug, name, address, region, province, city, barangay, lat, lng, hours, hours_note,
  accepts_walk_in, appointment_url, status, source_url, last_verified_at) values
  ('f0000000-0000-4000-8000-0000000000c1', 'f0000000-0000-4000-8000-0000000000a1', 'sample-office-main', 'Sample Office Main',
   '123 Sample Street, Sample City', 'NCR', 'Metro Manila', 'Sample City', 'Sample Barangay', 14.599500, 120.984200,
   '{"mon":[["08:00","17:00"]],"tue":[["08:00","17:00"]],"wed":[["08:00","17:00"]],"thu":[["08:00","17:00"]],"fri":[["08:00","17:00"]],"sat":[["08:00","12:00"]],"sun":[]}',
   null, true, 'https://example.gov.ph/appointments', 'published', 'https://example.gov.ph/offices', now() - interval '10 days'),
  ('f0000000-0000-4000-8000-0000000000c2', 'f0000000-0000-4000-8000-0000000000a1', 'sample-office-north', 'Sample Office North',
   '45 Example Avenue, Other City', 'NCR', 'Metro Manila', 'Other City', null, 14.676000, 121.043700,
   '{"mon":[["07:00","12:00"],["13:00","19:00"]],"tue":[["07:00","19:00"]],"wed":[["07:00","19:00"]],"thu":[["07:00","19:00"]],"fri":[["07:00","19:00"]],"sat":[],"sun":[]}',
   'Lunch break 12:00 to 1:00 on Mondays.', false, null, 'published', 'https://example.gov.ph/offices', now() - interval '10 days'),
  ('f0000000-0000-4000-8000-0000000000c3', 'f0000000-0000-4000-8000-0000000000a1', 'sample-office-draft', 'Sample Draft Office (hidden)',
   null, 'NCR', 'Metro Manila', 'Sample City', null, null, null, '{}', null, null, null, 'draft', null, null);

insert into public.office_services (office_id, document_id, status, source_url, last_verified_at) values
  ('f0000000-0000-4000-8000-0000000000c1', 'f0000000-0000-4000-8000-0000000000d1', 'published', 'https://example.gov.ph/offices', now() - interval '10 days'),
  ('f0000000-0000-4000-8000-0000000000c1', 'f0000000-0000-4000-8000-0000000000d2', 'published', 'https://example.gov.ph/offices', now() - interval '10 days'),
  ('f0000000-0000-4000-8000-0000000000c2', 'f0000000-0000-4000-8000-0000000000d1', 'published', 'https://example.gov.ph/offices', now() - interval '10 days');

-- ---------------------------------------------------------------------------
-- Phase 5 sample community data (fake). A sample user owns the tips.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values ('f0000000-0000-4000-8000-0000000000e1', 'sample.user@example.test')
  on conflict (id) do nothing;

insert into public.tips (user_id, office_id, body, wait_minutes, visited_on, extra_requirements_asked, status, reviewed_at) values
  ('f0000000-0000-4000-8000-0000000000e1', 'f0000000-0000-4000-8000-0000000000c1', 'Sample tip: the line moved quickly after 10 AM.', 40, current_date - 5, null, 'approved', now()),
  ('f0000000-0000-4000-8000-0000000000e1', 'f0000000-0000-4000-8000-0000000000c1', 'Sample tip: bring a black pen for the form.', 60, current_date - 12, 'A photocopy of the sample certificate', 'approved', now()),
  ('f0000000-0000-4000-8000-0000000000e1', 'f0000000-0000-4000-8000-0000000000c1', 'Sample tip: Saturday mornings are busy.', 90, current_date - 20, null, 'approved', now()),
  ('f0000000-0000-4000-8000-0000000000e1', 'f0000000-0000-4000-8000-0000000000c1', 'PENDING SAMPLE TIP, MUST NOT APPEAR', 10, current_date - 1, null, 'pending', null);

insert into public.live_context_cache (target_type, target_id, kind, locale, results, fetched_at, expires_at) values
  ('document', 'f0000000-0000-4000-8000-0000000000d2', 'official', 'en',
   '{"items":[{"title":"Sample advisory: new certificate fee","issuingBody":"Sample Agency","issuanceNumber":"Advisory 2026-01","date":"2026-11-01","url":"https://example.gov.ph/advisory-2026-01","summary":"Sample: the certificate fee may have changed.","conflicts":true,"conflictNote":"Sample: fee may differ from this guide.","sourceTitle":"Sample advisory"}]}',
   now(), now() + interval '3650 days'),
  ('document', 'f0000000-0000-4000-8000-0000000000d2', 'community', 'en',
   '{"items":[{"url":"https://www.reddit.com/r/example/comments/sample_thread","date":"2026-11-05","summary":"Sample: people reported long lines on Mondays.","sourceTitle":"Sample thread"}]}',
   now(), now() + interval '3650 days');

insert into public.troubleshoot_queries (user_id, document_id, problem_text, locale, result, expires_at) values
  (null, 'f0000000-0000-4000-8000-0000000000d1', 'My name is misspelled on my sample certificate', 'en',
   '{"summary":"Sample: people fixed spelling errors by requesting a correction first.","causes":["Sample: typo during registration"],"resolutions":[{"text":"Sample: request a correction at the issuing office before applying.","officialChannel":"Sample Agency help desk","sources":[{"url":"https://www.reddit.com/r/example/comments/sample_thread","title":"Sample thread","date":"2026-10-20"}]}],"confidence":"medium","recency":"Sample: reports from October 2026","officialGuidance":"Sample: contact the Sample Agency help desk.","generatedAt":"2026-11-10T00:00:00Z"}',
   now() + interval '3650 days');

-- Phase 6 sample monitoring data (fake): one published issuance with an approved change.
insert into public.official_sources (id, name, url, source_type, to_verify_note)
values ('f0000000-0000-4000-8000-0000000000f1', 'Sample Agency advisories', 'https://example.gov.ph/advisories', 'html_list', 'TO VERIFY: sample');
insert into public.issuances (id, source_id, url, title, issuing_body, issuance_type, issuance_number, date_issued, topic, summary, extraction_status, classification_status, published) values
  ('f0000000-0000-4000-8000-0000000000f2', 'f0000000-0000-4000-8000-0000000000f1', 'https://example.gov.ph/advisory-2026-07', 'Sample Advisory No. 7: Sample ID processing', 'Sample Agency', 'advisory', 'Advisory 2026-07', '2026-11-03', 'ids', 'Sample: processing now takes up to 5 days.', 'ok', 'done', true),
  ('f0000000-0000-4000-8000-0000000000f3', 'f0000000-0000-4000-8000-0000000000f1', 'https://example.gov.ph/advisory-2026-08', 'UNPUBLISHED SAMPLE ISSUANCE, MUST NOT APPEAR', 'Sample Agency', 'advisory', null, '2026-11-04', 'ids', null, 'ok', 'done', false);
insert into public.change_proposals (issuance_id, target_type, target_id, proposed_change, public_summary, status, reviewed_at) values
  ('f0000000-0000-4000-8000-0000000000f2', 'document', 'f0000000-0000-4000-8000-0000000000d1', '{"fields":{"processing_days_max":{"before":4,"after":5}}}', 'Sample ID processing time updated to up to 5 days.', 'approved', now()),
  ('f0000000-0000-4000-8000-0000000000f3', 'document', 'f0000000-0000-4000-8000-0000000000d1', '{"fields":{"fee_min":{"before":100,"after":999}}}', 'OPEN SAMPLE PROPOSAL, MUST NOT APPEAR', 'open', null);

-- Phase 7 sample business guide (fake).
insert into public.documents (id, slug, name, type, agency_id, purpose_tags, description, status, source_url, last_verified_at) values
  ('f0000000-0000-4000-8000-0000000000d4', 'sample-business-registration', 'Sample Business Registration', 'registration', 'f0000000-0000-4000-8000-0000000000a1',
   '{tax_compliance}', 'A made-up registration used to test business guides.', 'published', 'https://example.gov.ph/register', now() - interval '5 days');
insert into public.guide_steps (document_id, step_order, title, body_md, is_online, status, source_url, last_verified_at) values
  ('f0000000-0000-4000-8000-0000000000d4', 1, 'Register online (sample)', 'Sample step.', true, 'published', 'https://example.gov.ph/register', now() - interval '5 days');

-- Phase 8: sample plan prices (fake) so the pricing page has something to show.
update public.subscription_plans set monthly_price_php = 199, active = true where key = 'freelancer';
update public.subscription_plans set monthly_price_php = 499, active = true where key = 'negosyo';

-- Phase 9: a sample published LGU renewal process (fake city).
insert into public.lgu_processes (city, process_type, title, steps, requirements, fees, deadlines, status, source_url, last_verified_at) values
  ('Sample City', 'business_permit_renewal', 'Business permit renewal in Sample City',
   '[{"title":"Renew online (sample)"}]', '[{"text":"Sample barangay clearance"}]', '[{"label":"Sample fee","amount":500}]',
   '[{"label":"Renew without surcharge","month":1,"day":20}]', 'published', 'https://example.gov.ph/permits', now() - interval '3 days');

-- Phase 10: a sample verified professional (fake person, fake license).
insert into auth.users (id, email) values ('f0000000-0000-4000-8000-0000000000e2', 'sample.cpa@example.test') on conflict (id) do nothing;
insert into public.cpa_listings (user_id, display_name, profession, prc_license_no, firm_name, bio, services, cities, online_only, starting_fee_php, contact_email, status, verified_at)
values ('f0000000-0000-4000-8000-0000000000e2', 'Sample Santos, CPA', 'cpa', '0000001', 'Sample Accounting', 'A made-up professional for testing.', '{tax_filing,bir_registration}', '{Sample City}', true, 1500, 'sample.cpa@example.test', 'verified', now());
