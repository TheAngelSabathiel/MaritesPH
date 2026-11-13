-- Seed sanity: runs on its own database after supabase/seed.sql is applied.
\set ON_ERROR_STOP on
do $$ begin
  assert (select count(*) from public.content_index) > 40, 'seed looks incomplete';
  assert (select count(*) from public.content_index where status <> 'draft') = 0,
    'seed contains non-draft rows';
  assert (select count(*) from public.content_index where to_verify_note is null) = 0,
    'seed row without a TO VERIFY note';
  assert (select count(*) from public.documents) = 13, 'expected 13 documents (5 IDs/certificates + 4 BIR + 4 business guides)';
  assert (select count(*) from public.lgu_processes where status <> 'draft' or to_verify_note is null) = 0, 'seeded LGU processes must be TO VERIFY drafts';
  assert (select count(*) from public.tax_rules where status <> 'draft' or cpa_reviewed) = 0, 'seeded tax rules must be unverified drafts';
  assert (select count(*) from public.tax_rules where to_verify_note not like 'TO VERIFY WITH CPA%') = 0, 'every seeded tax rule needs a CPA note';
  assert (select count(distinct region) from public.offices) = 1, 'seed must cover exactly one region';
  assert (select count(*) from public.offices where slug is null or slug = '') = 0, 'office without slug';
end $$;
\echo 'SEED CHECK PASSED'
