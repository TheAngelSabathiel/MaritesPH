-- =============================================================================
-- Marites PH seed data (Phase 2)
-- =============================================================================
-- EVERYTHING HERE IS A DRAFT AND MUST BE VERIFIED. Every row has
-- status = 'draft' and a to_verify_note describing what to check. The database
-- refuses to publish a row until its to_verify_note is cleared, so none of
-- this can reach the public site by accident.
--
-- Values were entered from general knowledge, NOT from the official sources.
-- Fees, validity, processing times, requirements, addresses, coordinates, and
-- hours are all unconfirmed. Where a value was too uncertain, it is left NULL.
--
-- Region seeded: NCR (Metro Manila). Fixed UUIDs keep references readable.
--
-- To make yourself an admin locally after signing in once:
--   update public.profiles set role = 'admin' where id = (
--     select id from auth.users where email = 'you@example.com');
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Agencies
-- ---------------------------------------------------------------------------
insert into public.agencies (id, name, acronym, official_url, source_url, to_verify_note) values
  ('a0000000-0000-0000-0000-000000000001', 'Department of Foreign Affairs', 'DFA',
   'https://dfa.gov.ph', 'https://dfa.gov.ph', 'TO VERIFY: official name and URL'),
  ('a0000000-0000-0000-0000-000000000002', 'Philippine Statistics Authority', 'PSA',
   'https://psa.gov.ph', 'https://psa.gov.ph', 'TO VERIFY: official name and URL'),
  ('a0000000-0000-0000-0000-000000000003', 'National Bureau of Investigation', 'NBI',
   'https://nbi.gov.ph', 'https://nbi.gov.ph', 'TO VERIFY: official name and URL'),
  ('a0000000-0000-0000-0000-000000000004', 'Philippine Postal Corporation', 'PHLPost',
   'https://phlpost.gov.ph', 'https://phlpost.gov.ph', 'TO VERIFY: official name and URL');

-- ---------------------------------------------------------------------------
-- Documents: the 4 IDs + PSA birth certificate (a prerequisite for most IDs)
-- ---------------------------------------------------------------------------
insert into public.documents (
  id, slug, name, type, agency_id, purpose_tags, description,
  validity_text, validity_months, processing_days_min, processing_days_max, processing_note,
  fee_min, fee_max, fee_note, source_url, to_verify_note
) values
  ('d0000000-0000-0000-0000-000000000001', 'passport', 'Philippine Passport', 'id',
   'a0000000-0000-0000-0000-000000000001', '{travel_abroad,valid_id}',
   'Travel document issued by the DFA. Also widely accepted as a primary valid ID.',
   '10 years for adults (TO VERIFY)', 120, null, null,
   'Regular and expedited processing are offered; days vary by site (TO VERIFY).',
   950, 1200, 'Regular vs expedited processing (TO VERIFY).',
   'https://passport.gov.ph',
   'TO VERIFY: fees (regular/expedited), adult validity, processing days for NCR, appointment rules'),
  ('d0000000-0000-0000-0000-000000000002', 'national-id', 'Philippine Identification (PhilID / National ID)', 'id',
   'a0000000-0000-0000-0000-000000000002', '{valid_id,bank_account}',
   'Foundational ID under the Philippine Identification System (PhilSys).',
   null, null, null, null,
   'Physical card delivery times vary; an ePhilID may be available sooner (TO VERIFY).',
   0, 0, 'First issuance believed to be free (TO VERIFY).',
   'https://philsys.gov.ph',
   'TO VERIFY: fee, validity, card vs ePhilID, delivery time, registration steps'),
  ('d0000000-0000-0000-0000-000000000003', 'nbi-clearance', 'NBI Clearance', 'clearance',
   'a0000000-0000-0000-0000-000000000003', '{employment,valid_id}',
   'Certificate that the holder has no derogatory record on file with the NBI.',
   '1 year (TO VERIFY)', 12, null, null,
   'Released same day if there is no "hit"; a name match ("hit") can delay release (TO VERIFY).',
   130, null, 'Clearance fee plus possible online payment service fee (TO VERIFY).',
   'https://clearance.nbi.gov.ph',
   'TO VERIFY: fee and service charges, validity, hit delay, online registration flow'),
  ('d0000000-0000-0000-0000-000000000004', 'postal-id', 'Postal ID', 'id',
   'a0000000-0000-0000-0000-000000000004', '{valid_id}',
   'Identification card issued by PHLPost.',
   null, null, null, null, null,
   null, null, 'Fee not entered: too uncertain (TO VERIFY).',
   'https://phlpost.gov.ph',
   'TO VERIFY: fee, validity, processing time, whether walk-in is accepted'),
  ('d0000000-0000-0000-0000-000000000005', 'psa-birth-certificate', 'PSA Birth Certificate', 'certificate',
   'a0000000-0000-0000-0000-000000000002', '{proof_of_identity}',
   'Certified copy of a birth record on security paper, issued by the PSA. Required for most first-time IDs.',
   null, null, null, null,
   'Walk-in copies may be released same day; online orders are delivered (TO VERIFY).',
   155, 365, 'Walk-in vs online delivery (TO VERIFY).',
   'https://psa.gov.ph',
   'TO VERIFY: walk-in and online fees, release times, whether agencies require a recent copy');

-- ---------------------------------------------------------------------------
-- Requirements. Logic: all groups required; any one option per group; all
-- items in that option. (See README > Database.)
-- ---------------------------------------------------------------------------
insert into public.document_requirements
  (document_id, group_key, option_key, requires_document_id, requirement_text, sort_order, source_url, to_verify_note)
values
  ('d0000000-0000-0000-0000-000000000001', 'appointment', 'a', null,
   'Confirmed online appointment (printed or on phone)', 10, 'https://passport.gov.ph',
   'TO VERIFY: whether printout is required; walk-in exceptions'),
  ('d0000000-0000-0000-0000-000000000001', 'birth_record', 'a', 'd0000000-0000-0000-0000-000000000005',
   null, 20, 'https://passport.gov.ph', 'TO VERIFY: PSA birth certificate requirement for first-time applicants'),
  ('d0000000-0000-0000-0000-000000000001', 'valid_id', 'a', 'd0000000-0000-0000-0000-000000000002',
   null, 30, 'https://passport.gov.ph', 'TO VERIFY: PhilID accepted as valid ID'),
  ('d0000000-0000-0000-0000-000000000001', 'valid_id', 'b', 'd0000000-0000-0000-0000-000000000004',
   null, 31, 'https://passport.gov.ph', 'TO VERIFY: postal ID accepted (and which versions)'),
  ('d0000000-0000-0000-0000-000000000001', 'valid_id', 'c', null,
   'Another government-issued ID on the DFA list of accepted IDs', 32, 'https://passport.gov.ph',
   'TO VERIFY: full list of accepted IDs; link to it'),
  ('d0000000-0000-0000-0000-000000000002', 'proof_of_identity', 'a', 'd0000000-0000-0000-0000-000000000001',
   null, 10, 'https://philsys.gov.ph', 'TO VERIFY: passport alone is sufficient'),
  ('d0000000-0000-0000-0000-000000000002', 'proof_of_identity', 'b', 'd0000000-0000-0000-0000-000000000005',
   null, 20, 'https://philsys.gov.ph', 'TO VERIFY: birth certificate + photo ID combination'),
  ('d0000000-0000-0000-0000-000000000002', 'proof_of_identity', 'b', null,
   'One government-issued ID with photo', 21, 'https://philsys.gov.ph', 'TO VERIFY: accepted photo IDs'),
  ('d0000000-0000-0000-0000-000000000003', 'registration', 'a', null,
   'Online registration and appointment on the NBI Clearance website', 10, 'https://clearance.nbi.gov.ph',
   'TO VERIFY: online-only registration; payment channels'),
  ('d0000000-0000-0000-0000-000000000003', 'valid_ids', 'a', null,
   'Two valid IDs from the NBI list of accepted IDs', 20, 'https://clearance.nbi.gov.ph',
   'TO VERIFY: number of IDs required and accepted list'),
  ('d0000000-0000-0000-0000-000000000004', 'proof_of_identity', 'a', 'd0000000-0000-0000-0000-000000000005',
   null, 10, 'https://phlpost.gov.ph', 'TO VERIFY: accepted proofs of identity'),
  ('d0000000-0000-0000-0000-000000000004', 'proof_of_identity', 'b', 'd0000000-0000-0000-0000-000000000002',
   null, 11, 'https://phlpost.gov.ph', 'TO VERIFY'),
  ('d0000000-0000-0000-0000-000000000004', 'proof_of_identity', 'c', 'd0000000-0000-0000-0000-000000000001',
   null, 12, 'https://phlpost.gov.ph', 'TO VERIFY'),
  ('d0000000-0000-0000-0000-000000000004', 'proof_of_address', 'a', null,
   'Proof of address, such as a barangay certificate or recent utility bill', 20, 'https://phlpost.gov.ph',
   'TO VERIFY: accepted proofs of address and recency'),
  ('d0000000-0000-0000-0000-000000000004', 'application_form', 'a', null,
   'Completed postal ID application form', 30, 'https://phlpost.gov.ph',
   'TO VERIFY: form name, where to get it, number of copies'),
  ('d0000000-0000-0000-0000-000000000005', 'requester_id', 'a', null,
   'Valid ID of the person requesting the copy', 10, 'https://psa.gov.ph',
   'TO VERIFY: who may request; authorization letter rules');

-- ---------------------------------------------------------------------------
-- Accepted for (which purposes each document can satisfy)
-- ---------------------------------------------------------------------------
insert into public.accepted_for (document_id, purpose, source_url, to_verify_note) values
  ('d0000000-0000-0000-0000-000000000001', 'travel_abroad', 'https://passport.gov.ph', 'TO VERIFY'),
  ('d0000000-0000-0000-0000-000000000001', 'bank_account', 'https://www.bsp.gov.ph', 'TO VERIFY: BSP rules and bank policy'),
  ('d0000000-0000-0000-0000-000000000002', 'bank_account', 'https://www.bsp.gov.ph', 'TO VERIFY: BSP rules and bank policy'),
  ('d0000000-0000-0000-0000-000000000004', 'bank_account', 'https://www.bsp.gov.ph', 'TO VERIFY: banks may vary'),
  ('d0000000-0000-0000-0000-000000000003', 'employment', 'https://clearance.nbi.gov.ph', 'TO VERIFY: employer-dependent');

-- ---------------------------------------------------------------------------
-- Guide steps (plain, general; each needs checking against the source)
-- ---------------------------------------------------------------------------
insert into public.guide_steps (document_id, step_order, title, body_md, is_online, estimated_minutes, source_url, to_verify_note) values
  ('d0000000-0000-0000-0000-000000000001', 1, 'Book an appointment online',
   'Book an appointment on the official DFA passport website. Choose the site and date that fit your schedule.', true, 20,
   'https://passport.gov.ph', 'TO VERIFY: booking flow and fees paid at booking'),
  ('d0000000-0000-0000-0000-000000000001', 2, 'Prepare your requirements',
   'Gather the original documents listed in the requirements, plus photocopies if asked.', false, 30,
   'https://passport.gov.ph', 'TO VERIFY: photocopy rules'),
  ('d0000000-0000-0000-0000-000000000001', 3, 'Go to your appointment',
   'Arrive at your chosen site on your appointment date. Your photo, fingerprints, and signature are taken on site.', false, 180,
   'https://passport.gov.ph', 'TO VERIFY: arrival time guidance; dress code'),
  ('d0000000-0000-0000-0000-000000000001', 4, 'Claim or receive your passport',
   'Claim your passport at the site or have it delivered, depending on what you chose.', false, 60,
   'https://passport.gov.ph', 'TO VERIFY: claiming and delivery options'),
  ('d0000000-0000-0000-0000-000000000002', 1, 'Register online (step 1)',
   'Fill in your demographic information on the official PhilSys registration website, if available.', true, 20,
   'https://philsys.gov.ph', 'TO VERIFY: whether online step 1 is currently available'),
  ('d0000000-0000-0000-0000-000000000002', 2, 'Visit a registration center',
   'Bring your proof of identity. Your biometrics are captured at the registration center.', false, 60,
   'https://philsys.gov.ph', 'TO VERIFY: registration center process'),
  ('d0000000-0000-0000-0000-000000000002', 3, 'Get your PhilID',
   'Wait for card delivery, or check whether a digital or printed ePhilID is available to you.', false, null,
   'https://philsys.gov.ph', 'TO VERIFY: delivery and ePhilID options'),
  ('d0000000-0000-0000-0000-000000000003', 1, 'Register and book online',
   'Create an account on the official NBI Clearance website, fill in your details, and pick a branch and schedule.', true, 20,
   'https://clearance.nbi.gov.ph', 'TO VERIFY: online flow'),
  ('d0000000-0000-0000-0000-000000000003', 2, 'Pay the clearance fee',
   'Pay using one of the payment channels shown on the website and keep your reference number.', true, 15,
   'https://clearance.nbi.gov.ph', 'TO VERIFY: payment channels and fees'),
  ('d0000000-0000-0000-0000-000000000003', 3, 'Go to the NBI branch',
   'Bring your valid IDs and reference number. Your photo and fingerprints are taken on site.', false, 120,
   'https://clearance.nbi.gov.ph', 'TO VERIFY: on-site process'),
  ('d0000000-0000-0000-0000-000000000004', 1, 'Prepare your requirements',
   'Gather your proof of identity, proof of address, and the completed application form.', false, 30,
   'https://phlpost.gov.ph', 'TO VERIFY: requirements'),
  ('d0000000-0000-0000-0000-000000000004', 2, 'Apply at a post office that accepts postal ID applications',
   'Submit your requirements, pay the fee, and have your photo and biometrics taken.', false, 90,
   'https://phlpost.gov.ph', 'TO VERIFY: which post offices accept applications'),
  ('d0000000-0000-0000-0000-000000000004', 3, 'Receive your postal ID',
   'Your postal ID is delivered to your address.', false, null,
   'https://phlpost.gov.ph', 'TO VERIFY: delivery method and time'),
  ('d0000000-0000-0000-0000-000000000005', 1, 'Request online or walk in',
   'Order online through the official PSA service for delivery, or request a copy at a PSA outlet.', true, 20,
   'https://psa.gov.ph', 'TO VERIFY: official online ordering channel'),
  ('d0000000-0000-0000-0000-000000000005', 2, 'Pay and receive your copy',
   'Pay the fee for your chosen channel. Walk-in copies are released at the outlet; online orders are delivered.', false, 60,
   'https://psa.gov.ph', 'TO VERIFY: release times');

-- ---------------------------------------------------------------------------
-- Offices (NCR). Hours are a PLACEHOLDER (Mon–Fri 08:00–17:00) until verified.
-- Coordinates are approximate. No PhilSys registration center is seeded yet,
-- because fixed registration sites could not be confirmed.
-- ---------------------------------------------------------------------------
insert into public.offices (
  id, agency_id, name, address, region, province, city, barangay, lat, lng,
  hours, hours_note, accepts_walk_in, appointment_url, source_url, to_verify_note
) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'DFA Office of Consular Affairs (ASEANA)', 'ASEANA Business Park, Parañaque City',
   'NCR', 'Metro Manila', 'Parañaque', null, 14.524000, 120.989000,
   '{"mon":[["08:00","17:00"]],"tue":[["08:00","17:00"]],"wed":[["08:00","17:00"]],"thu":[["08:00","17:00"]],"fri":[["08:00","17:00"]],"sat":[],"sun":[]}',
   'Placeholder hours', false, 'https://passport.gov.ph', 'https://dfa.gov.ph',
   'TO VERIFY: exact address, coordinates, hours, Saturday service, walk-in/courtesy lane policy'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'DFA Consular Office NCR East (SM Megamall)', 'SM Megamall, Mandaluyong City',
   'NCR', 'Metro Manila', 'Mandaluyong', null, 14.585000, 121.056500,
   '{"mon":[["08:00","17:00"]],"tue":[["08:00","17:00"]],"wed":[["08:00","17:00"]],"thu":[["08:00","17:00"]],"fri":[["08:00","17:00"]],"sat":[],"sun":[]}',
   'Placeholder hours', false, 'https://passport.gov.ph', 'https://dfa.gov.ph',
   'TO VERIFY: office still operating at this location, exact floor, hours'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   'DFA Consular Office NCR Northeast (Ali Mall Cubao)', 'Ali Mall, Araneta City, Cubao, Quezon City',
   'NCR', 'Metro Manila', 'Quezon City', null, 14.620500, 121.054500,
   '{"mon":[["08:00","17:00"]],"tue":[["08:00","17:00"]],"wed":[["08:00","17:00"]],"thu":[["08:00","17:00"]],"fri":[["08:00","17:00"]],"sat":[],"sun":[]}',
   'Placeholder hours', false, 'https://passport.gov.ph', 'https://dfa.gov.ph',
   'TO VERIFY: office still operating at this location, hours'),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002',
   'PSA Civil Registration Service Outlet (East Avenue)', 'East Avenue, Diliman, Quezon City',
   'NCR', 'Metro Manila', 'Quezon City', null, 14.648000, 121.049000,
   '{"mon":[["08:00","17:00"]],"tue":[["08:00","17:00"]],"wed":[["08:00","17:00"]],"thu":[["08:00","17:00"]],"fri":[["08:00","17:00"]],"sat":[],"sun":[]}',
   'Placeholder hours', null, null, 'https://psa.gov.ph',
   'TO VERIFY: outlet name and address, hours, walk-in or appointment, PhilSys registration on site'),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000003',
   'NBI Main Office', 'Taft Avenue, Ermita, Manila',
   'NCR', 'Metro Manila', 'Manila', 'Ermita', 14.581000, 120.985000,
   '{"mon":[["08:00","17:00"]],"tue":[["08:00","17:00"]],"wed":[["08:00","17:00"]],"thu":[["08:00","17:00"]],"fri":[["08:00","17:00"]],"sat":[],"sun":[]}',
   'Placeholder hours', false, 'https://clearance.nbi.gov.ph', 'https://nbi.gov.ph',
   'TO VERIFY: address (main office may have relocated), clearance services on site, hours'),
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000004',
   'Manila Central Post Office', 'Liwasang Bonifacio, Ermita, Manila',
   'NCR', 'Metro Manila', 'Manila', 'Ermita', 14.596000, 120.978000,
   '{"mon":[["08:00","17:00"]],"tue":[["08:00","17:00"]],"wed":[["08:00","17:00"]],"thu":[["08:00","17:00"]],"fri":[["08:00","17:00"]],"sat":[],"sun":[]}',
   'Placeholder hours', null, null, 'https://phlpost.gov.ph',
   'TO VERIFY: postal ID services available here, hours, walk-in');

insert into public.office_services (office_id, document_id, source_url, to_verify_note) values
  ('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'https://passport.gov.ph', 'TO VERIFY'),
  ('b0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'https://passport.gov.ph', 'TO VERIFY'),
  ('b0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'https://passport.gov.ph', 'TO VERIFY'),
  ('b0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000005', 'https://psa.gov.ph', 'TO VERIFY'),
  ('b0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000003', 'https://clearance.nbi.gov.ph', 'TO VERIFY'),
  ('b0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000004', 'https://phlpost.gov.ph', 'TO VERIFY');

-- ---------------------------------------------------------------------------
-- Legal basis ("Bakit ganito?"). Rank 1 = Republic Act. Numbers and titles
-- are from general knowledge and must be checked against the Official Gazette.
-- ---------------------------------------------------------------------------
insert into public.legal_references
  (target_type, target_id, source_rank, issuing_body, issuance_type, issuance_number, citation_title, source_url, to_verify_note)
values
  ('document', 'd0000000-0000-0000-0000-000000000001', 1, 'Congress of the Philippines', 'republic_act',
   'RA 11983', 'New Philippine Passport Act', 'https://www.officialgazette.gov.ph',
   'TO VERIFY: number, title, date, and that it supersedes RA 8239'),
  ('document', 'd0000000-0000-0000-0000-000000000002', 1, 'Congress of the Philippines', 'republic_act',
   'RA 11055', 'Philippine Identification System Act', 'https://www.officialgazette.gov.ph',
   'TO VERIFY: number, title, date, relevant sections (free issuance)'),
  ('document', 'd0000000-0000-0000-0000-000000000003', 1, 'Congress of the Philippines', 'republic_act',
   'RA 10867', 'National Bureau of Investigation Reorganization and Modernization Act', 'https://www.officialgazette.gov.ph',
   'TO VERIFY: number, title, sections on clearance issuance'),
  ('document', 'd0000000-0000-0000-0000-000000000004', 1, 'Congress of the Philippines', 'republic_act',
   'RA 7354', 'Postal Service Act of 1992', 'https://www.officialgazette.gov.ph',
   'TO VERIFY: number, title, whether postal ID rests on this law or a PHLPost issuance'),
  ('document', 'd0000000-0000-0000-0000-000000000005', 1, 'Congress of the Philippines', 'republic_act',
   'RA 10625', 'Philippine Statistical Act of 2013', 'https://www.officialgazette.gov.ph',
   'TO VERIFY: number, title, sections on civil registry copies');

-- ---------------------------------------------------------------------------
-- Bantay Batas: CANDIDATE official sources (Phase 6). All inactive and TO VERIFY:
-- check each URL still lists issuances, read the site's terms and robots.txt,
-- adjust the parser, then activate it in Admin -> Source health.
-- ---------------------------------------------------------------------------
insert into public.official_sources (agency_id, name, url, source_type, parser_key, topic, crawl_frequency_hours, to_verify_note) values
  (null, 'Official Gazette (feed)', 'https://www.officialgazette.gov.ph/feed/', 'rss', 'rss', 'general', 24,
   'TO VERIFY: feed URL, terms of use, robots.txt; filter to laws and executive issuances'),
  ('a0000000-0000-0000-0000-000000000001', 'DFA passport advisories', 'https://consular.dfa.gov.ph/', 'html_list', 'html_links', 'ids', 24,
   'TO VERIFY: the page that lists passport advisories; link pattern'),
  ('a0000000-0000-0000-0000-000000000002', 'PSA press releases and advisories', 'https://psa.gov.ph/', 'html_list', 'html_links', 'ids', 24,
   'TO VERIFY: the listing page for civil registration and PhilSys advisories; link pattern'),
  ('a0000000-0000-0000-0000-000000000003', 'NBI clearance announcements', 'https://clearance.nbi.gov.ph/', 'html_list', 'html_links', 'ids', 48,
   'TO VERIFY: where announcements are listed; robots.txt'),
  ('a0000000-0000-0000-0000-000000000004', 'PHLPost announcements', 'https://phlpost.gov.ph/', 'html_list', 'html_links', 'ids', 48,
   'TO VERIFY: listing page for postal ID announcements'),
  (null, 'BIR revenue issuances', 'https://www.bir.gov.ph/', 'pdf_list', 'pdf_links', 'tax', 24,
   'TO VERIFY: the revenue issuances listing (regulations, memorandum circulars); PDF link pattern; for Phase 7 tax rules');

-- =============================================================================
-- Phase 7: BIR and freelancer guides (DRAFT, TO VERIFY), tax rules and
-- deadlines (DRAFT, TO VERIFY WITH CPA). Values are shaped like the TRAIN-law
-- tables and recent issuances as generally known; NONE are verified. A tax rule
-- can be published only after an admin verifies it AND a CPA reviews it.
-- =============================================================================
insert into public.agencies (id, name, acronym, official_url, source_url, to_verify_note) values
  ('a0000000-0000-0000-0000-000000000005', 'Bureau of Internal Revenue', 'BIR', 'https://www.bir.gov.ph', 'https://www.bir.gov.ph', 'TO VERIFY: official name and URL');

insert into public.documents (id, slug, name, type, agency_id, purpose_tags, description, fee_min, fee_max, fee_note, source_url, to_verify_note) values
  ('d0000000-0000-0000-0000-000000000006', 'bir-registration-self-employed', 'BIR registration for freelancers and self-employed professionals', 'registration',
   'a0000000-0000-0000-0000-000000000005', '{tax_compliance}',
   'Registering with BIR as a self-employed individual or professional, and getting your Certificate of Registration.',
   null, null, 'Registration fee rules changed in 2024 (TO VERIFY).', 'https://www.bir.gov.ph',
   'TO VERIFY: online registration system (ORUS) flow, forms (1901), requirements, fees after RA 11976, choosing the 8% option'),
  ('d0000000-0000-0000-0000-000000000007', 'bir-books-of-accounts', 'Books of accounts for freelancers', 'registration',
   'a0000000-0000-0000-0000-000000000005', '{tax_compliance}',
   'Which books to keep (manual, loose-leaf, or computerized) and how to register them.',
   null, null, null, 'https://www.bir.gov.ph', 'TO VERIFY: book types for 8% vs graduated, registration timing and process'),
  ('d0000000-0000-0000-0000-000000000008', 'bir-invoices', 'Invoices for freelancers', 'registration',
   'a0000000-0000-0000-0000-000000000005', '{tax_compliance}',
   'Getting authority to print or using an accredited system for your invoices.',
   null, null, null, 'https://www.bir.gov.ph', 'TO VERIFY: invoice vs receipt rules after RA 11976, authority to print process, required details'),
  ('d0000000-0000-0000-0000-000000000009', 'bir-1701q-ebirforms', 'Filing the quarterly income tax return (1701Q) with eBIRForms', 'filing',
   'a0000000-0000-0000-0000-000000000005', '{tax_compliance}',
   'Step-by-step walkthrough of filing BIR Form 1701Q using the official eBIRForms package and paying online.',
   null, null, null, 'https://www.bir.gov.ph', 'TO VERIFY: current eBIRForms version and steps, payment channels, filing-anywhere rules');

insert into public.document_requirements (document_id, group_key, option_key, requires_document_id, requirement_text, sort_order, source_url, to_verify_note) values
  ('d0000000-0000-0000-0000-000000000006', 'valid_id', 'a', 'd0000000-0000-0000-0000-000000000002', null, 10, 'https://www.bir.gov.ph', 'TO VERIFY'),
  ('d0000000-0000-0000-0000-000000000006', 'valid_id', 'b', 'd0000000-0000-0000-0000-000000000001', null, 11, 'https://www.bir.gov.ph', 'TO VERIFY'),
  ('d0000000-0000-0000-0000-000000000006', 'valid_id', 'c', null, 'Another government-issued ID', 12, 'https://www.bir.gov.ph', 'TO VERIFY: accepted IDs'),
  ('d0000000-0000-0000-0000-000000000006', 'application', 'a', null, 'Registration application (BIR Form 1901), online or printed', 20, 'https://www.bir.gov.ph', 'TO VERIFY: form number and online alternative'),
  ('d0000000-0000-0000-0000-000000000006', 'address', 'a', null, 'Proof of business address, if different from your home', 30, 'https://www.bir.gov.ph', 'TO VERIFY');

insert into public.guide_steps (document_id, step_order, title, body_md, is_online, estimated_minutes, source_url, to_verify_note) values
  ('d0000000-0000-0000-0000-000000000006', 1, 'Register online', 'Create an account on BIR''s online registration system and fill in your registration as a self-employed individual or professional.', true, 45, 'https://www.bir.gov.ph', 'TO VERIFY: system name and flow'),
  ('d0000000-0000-0000-0000-000000000006', 2, 'Choose your income tax option', 'Decide between the 8% option and graduated rates. Use the Marites Freelancer tax computation to compare, and ask a CPA if unsure.', true, 15, 'https://www.bir.gov.ph', 'TO VERIFY: when the option is chosen and how'),
  ('d0000000-0000-0000-0000-000000000006', 3, 'Get your Certificate of Registration', 'Receive your Certificate of Registration and display it at your place of business.', false, null, 'https://www.bir.gov.ph', 'TO VERIFY: issuance and display rules'),
  ('d0000000-0000-0000-0000-000000000006', 4, 'Register your books and invoices', 'Register your books of accounts and set up your invoices before you start issuing them.', false, null, 'https://www.bir.gov.ph', 'TO VERIFY'),
  ('d0000000-0000-0000-0000-000000000007', 1, 'Choose the type of books', 'Pick manual, loose-leaf, or computerized books, depending on your volume and the rules for your tax option.', false, 20, 'https://www.bir.gov.ph', 'TO VERIFY'),
  ('d0000000-0000-0000-0000-000000000007', 2, 'Register the books', 'Register your books with BIR before using them.', false, 60, 'https://www.bir.gov.ph', 'TO VERIFY: process and timing'),
  ('d0000000-0000-0000-0000-000000000008', 1, 'Apply for authority to print', 'Apply for authority to print invoices through an accredited printer, or register a computerized invoicing system.', false, 60, 'https://www.bir.gov.ph', 'TO VERIFY'),
  ('d0000000-0000-0000-0000-000000000008', 2, 'Issue invoices for every sale', 'Issue an invoice for each transaction with the required details.', false, null, 'https://www.bir.gov.ph', 'TO VERIFY: required details'),
  ('d0000000-0000-0000-0000-000000000009', 1, 'Open eBIRForms and select 1701Q', 'Download or open the official eBIRForms package and choose BIR Form 1701Q.', true, 10, 'https://www.bir.gov.ph', 'TO VERIFY: download location and version'),
  ('d0000000-0000-0000-0000-000000000009', 2, 'Fill in the return', 'Enter your gross receipts, deductions (graduated rates) or gross (8%), and earlier quarterly payments.', true, 30, 'https://www.bir.gov.ph', 'TO VERIFY'),
  ('d0000000-0000-0000-0000-000000000009', 3, 'Validate, submit, and keep the confirmation', 'Validate the form, submit it online, and keep the confirmation email.', true, 10, 'https://www.bir.gov.ph', 'TO VERIFY'),
  ('d0000000-0000-0000-0000-000000000009', 4, 'Pay the tax due', 'Pay through an authorized payment channel before the deadline and keep the proof of payment.', true, 15, 'https://www.bir.gov.ph', 'TO VERIFY: payment channels');

insert into public.tax_rules (rule_key, description, parameters, effective_from, effective_to, source_url, to_verify_note) values
  ('income_tax.graduated', 'Graduated income tax table for individuals (TRAIN law, from 2023)',
   '{"brackets":[{"over":0,"upTo":250000,"base":0,"rate":0},{"over":250000,"upTo":400000,"base":0,"rate":0.15},{"over":400000,"upTo":800000,"base":22500,"rate":0.2},{"over":800000,"upTo":2000000,"base":102500,"rate":0.25},{"over":2000000,"upTo":8000000,"base":402500,"rate":0.3},{"over":8000000,"upTo":null,"base":2202500,"rate":0.35}]}',
   '2023-01-01', null, 'https://www.officialgazette.gov.ph', 'TO VERIFY WITH CPA: brackets and base amounts (RA 10963, from 2023)'),
  ('income_tax.eight_percent', '8% income tax option for self-employed individuals and professionals',
   '{"rate":0.08,"exemptAmount":250000,"grossThreshold":3000000}',
   '2018-01-01', null, 'https://www.officialgazette.gov.ph', 'TO VERIFY WITH CPA: rate, ₱250,000 reduction (purely self-employed only), ₱3,000,000 threshold'),
  ('income_tax.osd', 'Optional standard deduction for individuals',
   '{"rate":0.4}', '2018-01-01', null, 'https://www.bir.gov.ph', 'TO VERIFY WITH CPA: 40% of gross sales/receipts'),
  ('percentage_tax.rate', 'Percentage tax for non-VAT taxpayers (temporary reduced rate)',
   '{"rate":0.01}', '2020-07-01', '2023-07-01', 'https://www.bir.gov.ph', 'TO VERIFY WITH CPA: 1% under RA 11534 until June 30, 2023'),
  ('percentage_tax.rate', 'Percentage tax for non-VAT taxpayers',
   '{"rate":0.03}', '2023-07-01', null, 'https://www.bir.gov.ph', 'TO VERIFY WITH CPA: 3% from July 1, 2023');

insert into public.tax_deadlines (form_code, frequency, due_rule, applies_to, description, effective_from, source_url, to_verify_note) values
  ('1701Q', 'quarterly', '{"kind":"quarterly_fixed","dates":[{"quarter":1,"month":5,"day":15},{"quarter":2,"month":8,"day":15},{"quarter":3,"month":11,"day":15}]}',
   '{all}', 'Quarterly income tax return for individuals', '2018-01-01', 'https://www.bir.gov.ph', 'TO VERIFY WITH CPA: due dates'),
  ('2551Q', 'quarterly', '{"kind":"after_quarter_end","days":25}',
   '{graduated}', 'Quarterly percentage tax return (non-VAT, not on the 8% option)', '2018-01-01', 'https://www.bir.gov.ph', 'TO VERIFY WITH CPA: due date rule and who files'),
  ('1701', 'annual', '{"kind":"annual_fixed","month":4,"day":15,"yearOffset":1}',
   '{all}', 'Annual income tax return for individuals (1701 or 1701A)', '2018-01-01', 'https://www.bir.gov.ph', 'TO VERIFY WITH CPA: which annual form applies (1701 vs 1701A) and due date');

-- =============================================================================
-- Phase 9: Marites Negosyo seed (ALL DRAFTS, TO VERIFY). Agencies, business
-- registration guides, contribution rules and remittance deadlines (TO VERIFY
-- WITH CPA), permit renewal processes for 3 NCR cities, and city sources.
-- =============================================================================
insert into public.agencies (id, name, acronym, official_url, source_url, to_verify_note) values
  ('a0000000-0000-0000-0000-000000000006', 'Department of Trade and Industry', 'DTI', 'https://www.dti.gov.ph', 'https://www.dti.gov.ph', 'TO VERIFY: official name and URL'),
  ('a0000000-0000-0000-0000-000000000007', 'Social Security System', 'SSS', 'https://www.sss.gov.ph', 'https://www.sss.gov.ph', 'TO VERIFY: official name and URL'),
  ('a0000000-0000-0000-0000-000000000008', 'Philippine Health Insurance Corporation', 'PhilHealth', 'https://www.philhealth.gov.ph', 'https://www.philhealth.gov.ph', 'TO VERIFY: official name and URL'),
  ('a0000000-0000-0000-0000-000000000009', 'Home Development Mutual Fund', 'Pag-IBIG', 'https://www.pagibigfund.gov.ph', 'https://www.pagibigfund.gov.ph', 'TO VERIFY: official name and URL');

insert into public.documents (id, slug, name, type, agency_id, purpose_tags, description, source_url, to_verify_note) values
  ('d0000000-0000-0000-0000-000000000010', 'dti-business-name', 'DTI business name registration', 'registration', 'a0000000-0000-0000-0000-000000000006', '{business}',
   'Registering a business name for a sole proprietorship online.', 'https://www.dti.gov.ph', 'TO VERIFY: online system (BNRS), fees by territorial scope, validity, requirements'),
  ('d0000000-0000-0000-0000-000000000011', 'barangay-business-clearance', 'Barangay business clearance', 'permit', null, '{business}',
   'Clearance from the barangay where the business operates, needed for the mayor''s permit.', 'https://www.dilg.gov.ph', 'TO VERIFY: varies by barangay; general requirements'),
  ('d0000000-0000-0000-0000-000000000012', 'mayors-permit-new-business', 'Mayor''s permit for a new business', 'permit', null, '{business}',
   'Getting a business permit from the city or municipality (one-stop business registration).', 'https://www.dilg.gov.ph', 'TO VERIFY: varies by LGU; see the city pages in the permit planner'),
  ('d0000000-0000-0000-0000-000000000013', 'employer-registration', 'Registering as an employer with SSS, PhilHealth, and Pag-IBIG', 'registration', 'a0000000-0000-0000-0000-000000000007', '{business,employer}',
   'Getting employer numbers and reporting employees to SSS, PhilHealth, and Pag-IBIG.', 'https://www.sss.gov.ph', 'TO VERIFY: each agency''s online registration and reporting steps');

insert into public.guide_steps (document_id, step_order, title, body_md, is_online, estimated_minutes, source_url, to_verify_note) values
  ('d0000000-0000-0000-0000-000000000010', 1, 'Search and register the name online', 'Check that the name is available, choose the territorial scope, and register online.', true, 30, 'https://www.dti.gov.ph', 'TO VERIFY'),
  ('d0000000-0000-0000-0000-000000000010', 2, 'Pay and download the certificate', 'Pay the fee online and download your business name certificate.', true, 15, 'https://www.dti.gov.ph', 'TO VERIFY: fee and payment channels'),
  ('d0000000-0000-0000-0000-000000000011', 1, 'Apply at the barangay hall', 'Bring your DTI certificate and proof of address to the barangay where the business operates.', false, 60, 'https://www.dilg.gov.ph', 'TO VERIFY'),
  ('d0000000-0000-0000-0000-000000000012', 1, 'File at the city''s business one-stop shop', 'Submit the application with your DTI certificate, barangay clearance, and lease or proof of ownership.', false, 120, 'https://www.dilg.gov.ph', 'TO VERIFY: online options per city'),
  ('d0000000-0000-0000-0000-000000000012', 2, 'Pay the assessed fees and claim the permit', 'Pay the taxes and fees assessed by the city treasurer and claim your mayor''s permit.', false, 60, 'https://www.dilg.gov.ph', 'TO VERIFY'),
  ('d0000000-0000-0000-0000-000000000013', 1, 'Register with SSS', 'Register as an employer online and report each employee.', true, 45, 'https://www.sss.gov.ph', 'TO VERIFY'),
  ('d0000000-0000-0000-0000-000000000013', 2, 'Register with PhilHealth', 'Register as an employer and get your PhilHealth employer number.', true, 45, 'https://www.philhealth.gov.ph', 'TO VERIFY'),
  ('d0000000-0000-0000-0000-000000000013', 3, 'Register with Pag-IBIG', 'Register as an employer and enroll your employees.', true, 45, 'https://www.pagibigfund.gov.ph', 'TO VERIFY');

insert into public.tax_rules (rule_key, description, parameters, effective_from, source_url, to_verify_note) values
  ('contribution.sss', 'SSS contribution schedule (employer and employee)',
   '{"mscMin":5000,"mscMax":35000,"mscStep":500,"employeeRate":0.05,"employerRate":0.10,"ecThreshold":15000,"ecLow":10,"ecHigh":30}',
   '2025-01-01', 'https://www.sss.gov.ph', 'TO VERIFY WITH CPA: 2025 schedule (15%, MSC ₱5,000–₱35,000), EC amounts, MPF split above ₱20,000 MSC'),
  ('contribution.philhealth', 'PhilHealth premium for employed members',
   '{"rate":0.05,"floor":10000,"ceiling":100000,"employeeShare":0.5}',
   '2024-01-01', 'https://www.philhealth.gov.ph', 'TO VERIFY WITH CPA: 5% rate, ₱10,000 floor, ₱100,000 ceiling, 50/50 split'),
  ('contribution.pagibig', 'Pag-IBIG Fund contributions',
   '{"employeeRateLow":0.01,"employeeRateHigh":0.02,"lowThreshold":1500,"employerRate":0.02,"maxCompensation":10000}',
   '2024-02-01', 'https://www.pagibigfund.gov.ph', 'TO VERIFY WITH CPA: rates and ₱10,000 maximum fund salary');

insert into public.tax_deadlines (form_code, frequency, due_rule, applies_to, description, effective_from, source_url, to_verify_note) values
  ('SSS', 'monthly', '{"kind":"monthly_by_digit","digitOf":"sss","days":{"1":10,"2":10,"3":15,"4":15,"5":20,"6":20,"7":25,"8":25,"9":25,"0":25}}',
   '{employer}', 'SSS contributions for the month', '2025-01-01', 'https://www.sss.gov.ph', 'TO VERIFY WITH CPA: due-date schedule by employer number digit'),
  ('PhilHealth', 'monthly', '{"kind":"monthly_by_digit","digitOf":"philhealth","days":{"1":11,"2":11,"3":11,"4":11,"5":15,"6":15,"7":15,"8":15,"9":15,"0":15}}',
   '{employer}', 'PhilHealth premiums for the month', '2024-01-01', 'https://www.philhealth.gov.ph', 'TO VERIFY WITH CPA: due-date schedule by employer number digit'),
  ('Pag-IBIG', 'monthly', '{"kind":"monthly_fixed","day":15}',
   '{employer}', 'Pag-IBIG contributions for the month', '2024-01-01', 'https://www.pagibigfund.gov.ph', 'TO VERIFY WITH CPA: due date (may depend on employer name)');

insert into public.lgu_processes (city, process_type, title, steps, requirements, fees, deadlines, source_url, to_verify_note) values
  ('Quezon City', 'business_permit_renewal', 'Business permit renewal in Quezon City',
   '[{"title":"Renew online or at the business permits office","body":"Submit your renewal with your gross sales for last year."},{"title":"Pay the assessed taxes and fees","body":"Pay in full or by quarter if allowed."},{"title":"Claim or download your renewed permit"}]',
   '[{"text":"Previous year''s business permit"},{"text":"Barangay business clearance for the new year"},{"text":"Gross sales declaration or audited financial statements"},{"text":"Community tax certificate (cedula)"}]',
   '[{"label":"Business tax","amount":null,"note":"Based on last year''s gross sales"},{"label":"Mayor''s permit and regulatory fees","amount":null,"note":"Depends on business type and size"}]',
   '[{"label":"Renew without surcharge","month":1,"day":20}]',
   'https://quezoncity.gov.ph', 'TO VERIFY: online system, requirements, deadline, payment options'),
  ('Manila', 'business_permit_renewal', 'Business permit renewal in Manila',
   '[{"title":"Renew online or at the Bureau of Permits"},{"title":"Pay the assessed taxes and fees"},{"title":"Claim your renewed permit"}]',
   '[{"text":"Previous year''s business permit"},{"text":"Barangay business clearance for the new year"},{"text":"Gross sales declaration"}]',
   '[{"label":"Business tax","amount":null,"note":"Based on last year''s gross sales"}]',
   '[{"label":"Renew without surcharge","month":1,"day":20}]',
   'https://manila.gov.ph', 'TO VERIFY: online system, requirements, deadline'),
  ('Makati', 'business_permit_renewal', 'Business permit renewal in Makati',
   '[{"title":"Renew online through the city''s business portal"},{"title":"Pay the assessed taxes and fees"},{"title":"Download your renewed permit"}]',
   '[{"text":"Previous year''s business permit"},{"text":"Barangay business clearance for the new year"},{"text":"Gross sales declaration"}]',
   '[{"label":"Business tax","amount":null,"note":"Based on last year''s gross sales"}]',
   '[{"label":"Renew without surcharge","month":1,"day":20}]',
   'https://www.makati.gov.ph', 'TO VERIFY: online system, requirements, deadline');

insert into public.official_sources (name, url, source_type, parser_key, topic, crawl_frequency_hours, to_verify_note) values
  ('Quezon City advisories', 'https://quezoncity.gov.ph/', 'html_list', 'html_links', 'business', 48, 'TO VERIFY: listing page for business permit advisories and ordinances'),
  ('Manila City advisories', 'https://manila.gov.ph/', 'html_list', 'html_links', 'business', 48, 'TO VERIFY: listing page for advisories and ordinances'),
  ('Makati City advisories', 'https://www.makati.gov.ph/', 'html_list', 'html_links', 'business', 48, 'TO VERIFY: listing page for advisories and ordinances');
