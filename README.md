# Marites PH

> **Si Marites, pero tama ang info.**
> Personalized, verified, step-by-step help for Philippine government paperwork.

Current status: **All 11 build phases complete.** Next: verify content, configure production, and work through the launch checklist (see "Offline, performance, and launch"). See [`FILES.md`](FILES.md) for every file and the phase it belongs to.

## Contents

1. [Project overview](#1-project-overview)
2. [Brand and voice](#2-brand-and-voice)
3. [Features](#3-features)
4. [Tech stack](#4-tech-stack)
5. [Architecture](#5-architecture)
6. [Environment variables](#6-environment-variables)
7. [Local development setup](#7-local-development-setup)
8. [Database](#8-database)
9. [Content and verification workflow](#9-content-and-verification-workflow)
10. [Engines](#10-engines)
11. [Tax rules management](#11-tax-rules-management)
12. [AI usage](#12-ai-usage)
13. [Payments](#13-payments)
14. [Deployment](#14-deployment)
15. [Testing](#15-testing)
16. [Security, privacy, and legal](#16-security-privacy-and-legal)
17. [Known issues and limitations](#17-known-issues-and-limitations)
18. [Roadmap](#18-roadmap)
19. [Changelog](#19-changelog)

Addendum sections (Law, mandate, and community monitoring):
[Monitoring (Bantay Batas)](#monitoring-bantay-batas) ·
[Live context check](#live-context-check) ·
[Source hierarchy and conflict rules](#source-hierarchy-and-conflict-rules) ·
[Official source registry](#official-source-registry) ·
[Crawling and platform compliance](#crawling-and-platform-compliance) ·
[Change review workflow](#change-review-workflow) ·
[Alerts](#alerts)

---

## 1. Project overview

Marites PH gives Filipinos personalized, step-by-step instructions for government paperwork. It starts with IDs and grows into freelancer and small-business compliance: registration, tax filing, permit renewals, and employer contributions.

It is an **instructions app first**. On top of verified instructions it will:

- recommend which ID or registration to do first, based on what the user already has;
- recommend which office to go to, not just the nearest;
- build a plan around the user's real schedule (8-to-5 job, night shift, no leave);
- show options with trade-offs (time, cost, leave needed, risk) and recommend one;
- summarize community discussions (Reddit) about similar problems, with source links;
- remind paying users of tax and renewal deadlines;
- monitor laws, regulations, and agency issuances and turn changes into reviewed updates.

**Who it's for:** Filipino adults, mostly on low-end Android phones with prepaid data. Everything is mobile-first, lightweight, and fast on slow connections.

**Business model**

| Tier | Price | What's included |
|---|---|---|
| Free | ₱0 | ID and registration guides, office finder, Chika sa Pila troubleshooter, public "Ano'ng Bago?" feed. This is the SEO traffic engine. |
| Marites Freelancer | Monthly (TBD) | Taxpayer profile, deadline calendar, reminders, tax calculator, income/expense tracker, filing walkthroughs, Marites Alerts |
| Marites Negosyo | Monthly (TBD) | Permit renewal planner, employer contribution tracker, multiple businesses, Marites Alerts |
| Later | Platform fee | CPA/bookkeeper marketplace |

**Not affiliated with any government agency.** Marites PH never files returns, issues invoices, books appointments, or sells slots on anyone's behalf.

## 2. Brand and voice

"Marites" is Filipino slang for the neighborhood gossip who knows everything. This Marites shares only **verified** info: *all the chika you need, but accurate.*

| Where | Voice | Example |
|---|---|---|
| UI copy, empty states, loading, onboarding, notifications, marketing | Playful, light Taglish | "Ano'ng lakad natin today?", "Verified 'to, hindi chismis." |
| Instructions, requirements, fees, office details, tax computations, deadlines, disclaimers, legal text | Serious and plain. No jokes. | "Bring one valid government-issued ID." |

Rules: never mean-spirited, never mocking government workers or users, never political.

**Feature names** (identical in both languages; enforced by a unit test):

| Name | Feature |
|---|---|
| Ano'ng Lakad Mo? | Situation wizard |
| Mga Diskarte | Plan options with trade-offs |
| Chika sa Pila | Community troubleshooter. Always labeled "community experience, unverified" |
| Verified ni Marites | Badge on verified content, with last-verified date and source |
| Bakit ganito? | Legal basis section on guides |
| Ano'ng bago? | Recent updates panel and public feed |
| Bantay Batas | Law and issuance monitoring |
| Marites Alerts | Paid personalized change notifications |

**Where copy lives:** every user-facing string is in `src/i18n/messages/en.json` and `src/i18n/messages/fil.json`. Playful brand lines are grouped under the `brand` key so tone can be tuned in one place without touching code. Legal page text lives in `src/content/legal/*.ts`.

**Visual direction.** Friendly and trustworthy, drawn from the world of paperwork:

| Token | Light | Meaning |
|---|---|---|
| `primary` | `#1d3a72` passport navy | Text emphasis and primary actions |
| `background` | `#f5f7fa` cool off-white | Page |
| `folder` / `accent` | `#e0b357` / `#f3e2b8` manila kraft | Warm accent surfaces (the "long brown envelope") |
| `stamp` | `#1b7247` official-stamp green | **Only** for verified content |
| `caution` | `#9f3f1c` rust | Outdated or unverified warnings |

The signature element is the "Verified ni Marites" mark, drawn as a rubber stamp (`src/components/verified-stamp.tsx`). The brand icon (`src/components/brand-mark.tsx`) is a **placeholder**: a manila folder with a speech bubble. Fonts are system fonts (Roboto on Android) so nothing downloads.

## 3. Features

| Feature | Phase | Status | Tier | Description |
|---|---|---|---|---|
| Foundation: layout, i18n (EN/FIL), light/dark mode | 1 | Done | Free | Base app shell, branding placeholders, brand copy files |
| Auth: email magic link + Google, consent at signup | 1 | Done | Free | Supabase Auth; RA 10173 consent recorded server-side |
| Content + profile schema with RLS | 1 | Done | – | Verified-content tables with publish guardrails |
| Legal pages (privacy, terms, disclaimer) | 1 | Done (drafts, TO REVIEW) | Free | Placeholders pending lawyer review |
| **Mobile responsiveness** | 1–2 | Done (ongoing rule) | Free | 360px-first layouts, 44px tap targets, safe areas, automated checks at 360/768/1280px. See below |
| Admin content system | 2 | Done | – | Role-protected admin panel: CRUD for agencies, documents, requirements (OR-groups), guide steps, accepted purposes, offices, office services, legal references |
| Verification workflow | 2 | Done | – | draft → verified → published (→ archived), with an audit trail and re-verification rules |
| Admin queues | 2 | Done | – | Dashboard, TO VERIFY queue, ready-to-publish, stale-content queue with one-tap re-verify, flag review queue, sources page |
| Legal basis records ("Bakit ganito?" data) | 2 | Done | – | `legal_references`, managed in admin; shown publicly from Phase 3 |
| Content flags | 2 | Done | – | Table, RLS, admin review queue; public reporting added in Phase 3 |
| Seed: passport, national ID, NBI clearance, postal ID (+ PSA birth certificate), NCR offices | 2 | Done (all TO VERIFY) | – | Draft only; cannot be published until verified |
| Public ID guides | 3 | Done | Free | `/[locale]/ids` and `/[locale]/ids/[slug]`: verified stamp (oldest date on the page), stale warning, quick facts, requirements in plain AND/OR wording, steps, where to apply, official sources |
| "Bakit ganito?" legal basis | 3 | Done | Free | Laws and issuances behind a guide or office, ordered by the source hierarchy |
| Office finder | 3 | Done | Free | `/[locale]/offices`: filters (document, agency, city, weekend hours, walk-ins), sort by distance (location stays on the phone), open-now in Manila time, map on request |
| Office pages | 3 | Done | Free | `/[locale]/offices/[city]/[agency]` and `/[locale]/offices/[city]/[agency]/[office]`: hours, directions, services, map, legal basis |
| "Report outdated info" | 3 | Done | Free | On every guide and office page; rate-limited, honeypot, anonymous or signed in; lands in the admin Flags queue |
| SEO | 3 | Done | Free | Static pages refreshed on publish, sitemap.xml with hreflang, robots.txt, HowTo/BreadcrumbList/GovernmentOffice structured data, Open Graph images |
| Situation landing pages | 4 | Done | Free | `/[locale]/ids/[slug]/for-8-to-5-workers` (also night shift, weekends): generated from the planner |
| Dependency, office ranking, and plan engines | 4 | Done | Free | Pure, tested engines; see section 10 |
| "Ano'ng Lakad Mo?" wizard | 4 | Done | Free | `/[locale]/lakad`: 4 short steps (goal, what you have, schedule/leave/urgency/budget, location/transport); can start from a guide (`?goal=`) |
| "Mga Diskarte" | 4 | Done | Free | Up to 4 options with trips, leave days, fees, time, steps, and risks; recommended option with reasons |
| Saved plans | 4 | Done | Free (sign-in) | `/[locale]/plans`: snapshot of a plan, recomputed on the server when saved; location never stored |
| My documents | 4 | Done | Free (sign-in) | `/[locale]/my-documents`: have / in progress / need, expiry date; prefills the wizard |
| Data export and account deletion (RA 10173) | 4 | Done | Free | Account page: download all your data as JSON; delete your account (typed confirmation) |
| AI layer | 5 | Done | – | `src/lib/ai/`: one client, off unless fully configured, monthly budget cap, usage log, prompts with voice rules, source grounding |
| AI plan summary ("Ipaliwanag ni Marites") | 5 | Done | Free | Optional rephrasing of the recommended option; rejected if it adds numbers, prices, links, or names outside the plan |
| Chika sa Pila troubleshooter | 5 | Done | Free | `/[locale]/chika`: cached answers for similar questions; otherwise Reddit-restricted web search; labeled unverified, every link grounded |
| "Ano'ng bago?" live context | 5 | Done | Free | On guide pages: official updates (gov.ph) and community experience, never mixed; possible conflicts show a banner and flag the guide |
| Community tips + moderation | 5 | Done | Free | Office pages: tips, typical wait; anti-fixer rules; admin approval queue; wait times feed office ranking |
| Bantay Batas pipeline | 6 | Done | – | Official source registry, polite crawler (robots.txt, user agent, per-site spacing), RSS/HTML/PDF listings, text extraction (unpdf), AI classification and change proposals, Vercel Cron |
| Bantay Batas review | 6 | Done | – | Admin queue: issuance, AI summary, extracted text, editable diff; approve applies + verifies + attaches a draft legal reference + alerts trackers; stale-proposal check |
| Source health and community signals | 6 | Done | – | Last crawl, failures (alert after 3), add/activate/pause sources, run now; signals from tips (long queues, extra requirements) |
| "Ano'ng Bago?" public feed | 6 | Done | Free | `/[locale]/ano-ng-bago`: approved changes and published issuances, topic filters |
| Change alerts (records) | 6 | Done (stored) | – | Created on approval for users tracking the document; delivery (Marites Alerts) in Phase 8 |
| Business and freelancer guides | 7 | Done | Free | `/[locale]/business` and `/[locale]/business/[slug]` (shared guide page factory): BIR registration, books of accounts, invoices, 1701Q filing walkthrough (seeded drafts, TO VERIFY) |
| Taxpayer profile | 7 | Done | Freelancer | Tax option, deduction method, VAT status, RDO; TIN/name/address encrypted (AES-256-GCM); reminder settings |
| Income and expense tracker | 7 | Done | Freelancer | Entries per year, foreign currency with the rate used (PHP computed and checked server-side), totals per quarter, encrypted notes |
| Tax engine and computation | 7 | Done | Freelancer | 8% vs graduated (+ percentage tax), mixed income, quarterly breakdown, rules used and CPA status shown; only published, CPA-reviewed rules |
| Filing calendar and email reminders | 7 | Done | Freelancer | Deadlines from rules (weekends → Monday), walkthrough links, daily reminder cron via Resend; SMS interface stubbed |
| CPA review | 7 | Done | – | `/[locale]/cpa`: only role `cpa` can review tax rules/deadlines (database-enforced); tax proposals from Bantay Batas need a CPA to apply |
| Plans and pricing | 8 | Done | – | `/[locale]/pricing`: prices from `subscription_plans` (set in Admin → Billing; nothing hardcoded); prepaid 1/3/6/12 months |
| PayMongo checkout and webhook | 8 | Done | Paid | v2 Checkout Sessions (GCash, Maya, cards, QR Ph); signed webhook with idempotency and amount checks; `apply_payment()` is the only path to access |
| Entitlements and gating | 8 | Done | Paid | `requirePlan()` decides access from `entitlements` only; Marites Freelancer requires a plan (Negosyo includes it) |
| Billing page | 8 | Done | – | `/[locale]/account/billing`: plan, end date, history, stop renewal reminders, Marites Alerts, account ID |
| Marites Alerts delivery and renewal reminders | 8 | Done | Paid | Daily notifications cron: alerts (last 7 days) to paid users, renewal reminder 3 days before the end |
| Admin billing | 8 | Done | – | Prices and activation, recent payments (review flags), complimentary grants through the same `apply_payment()` |
| Business registration guides | 9 | Done | Free | DTI business name, barangay clearance, mayor's permit, employer registration with SSS/PhilHealth/Pag-IBIG (seeded drafts, TO VERIFY) under `/[locale]/business` |
| Marites Negosyo businesses | 9 | Done | Negosyo | `/[locale]/negosyo`: up to 10 businesses; registration numbers encrypted |
| Permit renewal planner | 9 | Done | Negosyo | From published `lgu_processes` for the business's city: next deadline, checklist, steps, fees, mark renewed (seeded: Quezon City, Manila, Makati, TO VERIFY) |
| Employee contributions and remittances | 9 | Done | Negosyo | SSS, PhilHealth, Pag-IBIG computed from rule rows (`contribution.*` in `tax_rules`); monthly remittance deadlines (fixed day or by employer-number digit); record remittances |
| LGU processes in admin | 9 | Done | – | Admin → LGU processes with validated JSON (steps, requirements, fees, deadlines); city advisory sources seeded (inactive) |
| CPA directory and profiles | 10 | Done | Free | `/[locale]/cpas` (filters by service and city) and `/[locale]/cpas/[id]`; verified listings only, rating summary, no contact details shown |
| Professional listings | 10 | Done | Free | `/[locale]/account/listing`: CPAs and bookkeepers apply; admin verifies the PRC license; name or license changes send it back to review; does NOT grant the tax-review `cpa` role |
| Quote requests | 10 | Done | Free | Request → accept/decline with reply and quoted fee → complete with final fee; emails exchanged only on acceptance; 5 requests a day; email notifications |
| Reviews and platform fees | 10 | Done | – | One review per completed request (moderated); platform fee recorded at the admin-set rate when an engagement completes; Admin → Marketplace |
| Installable app and offline | 11 | Done | Free | Manifest and icons; service worker keeps visited guides, offices, planner, feed, and saved plans for offline use; offline page; never caches admin/account/login/API |
| Cache clearing on sign-out | 11 | Done | – | `Clear-Site-Data` on sign-out and after account deletion (`/auth/cleared`) |
| Security headers | 11 | Done | – | CSP, HSTS, nosniff, frame denial, Referrer-Policy, Permissions-Policy (`next.config.ts`) |
| Security audit and bundle scan | 11 | Done | – | `95_security_audit.sql` (RLS everywhere, no anon writes, definer `search_path`, view allowlist); `npm run check:bundle` (no secrets in browser JS) |
| Health check and launch check | 11 | Done | – | `/api/health` (public status; details with `CRON_SECRET`); `npm run launch:check` |
| Performance | 11 | Done | – | Zod kept out of browser bundles (`hours-core.ts`); site-wide links don't prefetch; Lighthouse mobile medians ≥ 90 on guide pages |
| Privacy-friendly analytics | 11 | Done (optional) | – | Vercel Web Analytics (cookieless) only when `NEXT_PUBLIC_ANALYTICS=vercel` |

### Mobile responsiveness

Most users are on low-end Android phones, so mobile is the primary design target, not an afterthought. These rules apply to every page in every phase, and the automated suite enforces them:

| Rule | How it's met | Checked by |
|---|---|---|
| Works at **360px** width with no sideways scrolling | Single-column layouts by default; wider layouts only from `sm`/`md`/`lg` up; long URLs wrap; wide content (tables, nav rows) scrolls inside its own `overflow-x-auto` container | `tests/e2e/mobile-layout.spec.ts` (overflow check) |
| Tap targets at least **44×44px** | `min-h-11` on buttons, links in nav/header/footer, inputs, selects, `<summary>`; icon buttons are `size-11` | Same suite (tap-target check) |
| No zoom-on-focus on iPhone | Inputs, selects, and textareas use 16px text | Same suite (font-size check) |
| Notched phones | `viewport-fit=cover` plus `safe-top`, `safe-bottom`, `safe-x` padding utilities (`globals.css`) | Same suite (viewport check) |
| Users can still pinch-zoom | No `user-scalable=no` or `maximum-scale=1` | Same suite |
| Header fits in both languages | Short language code (FIL/EN) below `sm`; brand text sizes down and truncates only as a last resort | Visual check at 360px |
| Admin works on a phone | Lists become cards below `md` (table from `md` up); forms are one column; admin nav is one scrollable row; hours editor stacks per day | `/ui-preview` page in the same suite |
| Light and dark mode | Color tokens for both; dark mode tested | Same suite |
| Light on data | System fonts (no downloads), Server Components by default, client JS only where interaction needs it | Bundle review (Lighthouse pass in Phase 11) |

Phase 3 pages follow the same rules: the finder's filters stack on phones, office and guide cards are single-column below `md`, the map loads only on request (saving data), and breadcrumb links are 44px targets.

When you add a page, add its path to `PAGES` (or `SAMPLE_PAGES` if it needs the sample fixture) in `tests/e2e/mobile-layout.spec.ts`.

## 4. Tech stack

All versions are pinned in `package.json` (exact versions for runtime dependencies).

| Area | Choice | Version |
|---|---|---|
| Runtime | Node.js | 22 LTS (`engines: >=22`) |
| Framework | Next.js (App Router, TypeScript, Cache Components on) | 16.4.6 |
| UI library | React | 19.3.0 |
| Styling | Tailwind CSS (+ `@tailwindcss/turbopack`) | 4.3.3 |
| Components | shadcn/ui conventions (`components.json`), CVA, clsx, tailwind-merge, `@radix-ui/react-slot` | 0.7.1 / 2.1.1 / 3.7.0 / 1.5.0 |
| Database + Auth | Supabase (`@supabase/supabase-js`, `@supabase/ssr`) | 2.119.0 / 0.12.7 |
| Validation | Zod (full on server, `zod/mini` in the browser) | 4.3.5 |
| Unit tests | Vitest | 5.1.0 |
| End-to-end tests | Playwright (`@playwright/test`) | 1.64.1 |
| Maps | Leaflet + OpenStreetMap tiles | 1.9.4 |
| Language | TypeScript | 5.9 |
| Hosting | Vercel (+ Vercel Cron, from Phase 6) | – |
| Later | `@anthropic-ai/sdk`, Leaflet or MapLibre, Resend, PayMongo | Added in their phases |

**Dependency justifications** (README rule: justify every new dependency):

- `@supabase/ssr`: official cookie-based Supabase sessions for Next.js server rendering.
- `class-variance-authority`, `clsx`, `tailwind-merge`, `@radix-ui/react-slot`: the standard shadcn/ui building blocks. Tiny, and they let `npx shadcn add <component>` work later.
- `server-only`: makes the build fail if server code (secrets) is imported into a Client Component.
- `leaflet` (added Phase 3): the brief's map choice; ~40 KB, loaded only when a visitor taps "Show map". 1.9.4 is the current stable release (2.0 is in beta). `@types/leaflet` (dev) for types.
- `@playwright/test` (dev only, added Phase 2): the brief's chosen E2E tool; used now for the mobile layout suite. Pinned to 1.64.1 rather than the newest release, which was under two weeks old.
- **Not used, on purpose:** `next-intl` (Next's native dictionary pattern + `next/root-params` is enough, ships no i18n JavaScript to the browser, and has no friction with Cache Components); `next-themes` (a 20-line inline script does the job); web fonts (system fonts cost zero data); `vite-tsconfig-paths` (Vite resolves tsconfig paths natively); a form library (one generic admin form driven by resource definitions is enough).

## 5. Architecture

### Folder structure

```
.
├── src/
│   ├── proxy.ts                    # Next 16 "proxy" (was middleware): locale redirect + session refresh
│   ├── app/
│   │   ├── globals.css             # Design tokens (light/dark), safe-area utilities, base styles
│   │   ├── [locale]/               # Root layout lives here; every page is /en/... or /fil/...
│   │   │   ├── layout.tsx          # <html lang>, header, footer, metadata, hreflang, viewport
│   │   │   ├── page.tsx            # Home (placeholder, no government facts)
│   │   │   ├── not-found.tsx
│   │   │   ├── login/              # Sign-in page + client form with consent checkbox
│   │   │   ├── account/            # Profile, consent status, data-rights info, sign out
│   │   │   ├── legal/{privacy,terms,disclaimer}/
│   │   │   ├── ids/                # Phase 3: guide index + /ids/[slug] guide pages (+ Open Graph image)
│   │   │   ├── offices/            # Phase 3: finder, /[city]/[agency], /[city]/[agency]/[office]
│   │   │   ├── lakad/              # Phase 4: "Ano'ng Lakad Mo?" wizard
│   │   │   ├── ids/[slug]/[situation]/  # Phase 4: situation landing pages
│   │   │   ├── plans/              # Phase 4: saved plans (list + detail)
│   │   │   ├── my-documents/       # Phase 4: document tracker
│   │   │   ├── chika/              # Phase 5: Chika sa Pila troubleshooter
│   │   │   ├── ano-ng-bago/        # Phase 6: public feed of approved changes and issuances
│   │   │   ├── business/           # Phase 7: business/freelancer guides (index + [slug])
│   │   │   ├── freelancer/         # Phase 7: hub, profile, tracker, tax, calendar
│   │   │   ├── cpa/                # Phase 7: CPA review (role cpa)
│   │   │   ├── pricing/            # Phase 8: plans (prices from the database)
│   │   │   ├── account/billing/    # Phase 8: plan, history, alerts
│   │   │   ├── account/listing/    # Phase 10: professional listing
│   │   │   ├── account/quotes/     # Phase 10: quote requests sent and received
│   │   │   ├── cpas/               # Phase 10: directory, [id] profile
│   │   │   ├── offline/            # Phase 11: shown by the service worker when offline
│   │   │   ├── negosyo/            # Phase 9: businesses, [id] (permit planner, contributions, remittances, employees)
│   │   │   ├── opengraph-image.tsx # Default branded share image
│   │   │   ├── admin/              # Phase 2 admin panel (English-only internal tool)
│   │   │   │   ├── layout.tsx      # Admin nav + action messages
│   │   │   │   ├── page.tsx        # Dashboard (content health counts)
│   │   │   │   ├── [resource]/     # Generic list, new, and edit pages for every content type
│   │   │   │   ├── queue/          # TO VERIFY + ready to publish
│   │   │   │   ├── stale/          # Re-verification queue
│   │   │   │   ├── flags/          # Flag review queue
│   │   │   │   └── sources/        # Official websites the content relies on
│   │   │   └── ui-preview/         # Admin components with sample data (only if ENABLE_UI_PREVIEW=true)
│   │   ├── auth/                   # Route handlers (no locale prefix): callback, confirm, signout
│   │   ├── api/account/export/     # Phase 4: RA 10173 data export (JSON)
│   │   ├── api/context/            # Phase 5: "Ano'ng bago?" live context (cached, rate-limited)
│   │   ├── api/cron/monitor/       # Phase 6: Bantay Batas cron entry (CRON_SECRET)
│   │   ├── api/cron/reminders/     # Phase 7-8: daily notifications: filing reminders, Marites Alerts, renewals
│   │   ├── api/webhooks/paymongo/  # Phase 8: signed PayMongo webhook
│   │   ├── api/health/             # Phase 11: uptime check (details with CRON_SECRET)
│   │   ├── auth/cleared/           # Phase 11: Clear-Site-Data after account deletion
│   │   ├── icons/[size]/           # Phase 11: generated app icons
│   │   ├── manifest.ts             # Phase 11: web app manifest
│   │   ├── sitemap.ts              # sitemap.xml (both languages, hreflang)
│   │   └── robots.ts               # robots.txt
│   ├── components/                 # Site components (header, footer, stamp, theme, locale switcher)
│   │   ├── ui/                     # shadcn/ui-style primitives (button, card, input, label, alert)
│   │   ├── admin/                  # Record form, responsive list, workflow panel, queues, nav
│   │   ├── public/                 # Guide sections, office cards, finder, lazy map, open-now badge, report form
│   │   ├── planner/                # Wizard and "Mga Diskarte" view
│   │   ├── me/                     # My documents row, delete account
│   │   └── community/              # Chika form, live context panel, tips list and form
│   ├── content/legal/              # Legal page text (EN + FIL), TO REVIEW
│   ├── i18n/                       # Locale config, dictionaries, {placeholder} formatting, messages/{en,fil}.json
│   └── lib/
│       ├── admin/
│       │   ├── resources.ts        # One definition per content type: fields, parent, which fields are facts
│       │   ├── schemas.ts          # Zod schemas mirroring the database constraints
│       │   ├── form.ts             # Form fields → typed values → validation
│       │   ├── workflow.ts         # Status transitions and re-verification rules (pure, tested)
│       │   ├── actions.ts          # Server Actions: save, transition, re-verify, delete, resolve flag
│       │   ├── data.ts             # Admin gate + queries (always the admin's own session, RLS applies)
│       │   ├── paths.ts, sources.ts, time.ts
│       ├── content/
│       │   ├── freshness.ts        # fresh / stale / unverified
│       │   ├── hours.ts            # Office hours schema and helpers
│       │   ├── requirements.ts     # AND-of-groups / OR-of-options grouping and satisfaction check
│       │   ├── offices.ts          # Office URLs, filters, distance, open-now (Manila time), address formatting
│       │   └── public.ts           # Cached public queries (tag "content"), Zod-validated
│       ├── engines/                # dependencies, offices (ranking), planner, troubleshoot (Phase 5), tax (Phase 7), contributions and lgu (Phase 9); pure, tested
│       ├── planner/                # Wizard input schema, Server Actions, wording (describe.ts), situations
│       ├── ai/                     # Phase 5: config, client (budget, logging), core (JSON, grounding), plan summary, prompts/
│       ├── context/live.ts         # Phase 5: live context engine (official + community, cached)
│       ├── community/              # Phase 5: tip moderation rules, community Server Actions
│       ├── monitoring/             # Phase 6: robots, parsers, extract, classify, pipeline, fetcher, run, signals
│       ├── freelancer/             # Phase 7: access (Phase 8 gating point), data, actions, reminders, year
│       ├── crypto/fields.ts        # Phase 7: AES-256-GCM field encryption
│       ├── notify/                 # Phase 7: email (Resend HTTP API), SMS interface (stub)
│       ├── negosyo/                # Phase 9: data loaders, Server Actions
│       ├── marketplace/            # Phase 10: rules, data, Server Actions
│       ├── billing/                # Phase 8: rules, access (entitlements), PayMongo client, signature, webhook parsing, actions
│       ├── me/                     # Personal data actions (my documents, delete plan, delete account)
│       ├── seo/                    # Metadata/hreflang helpers, JSON-LD builders, Open Graph card
│       ├── report/                 # "Report outdated info" schema + Server Action
│       ├── rate-limit.ts           # Postgres-backed rate limiter, IP hashing
│       ├── slug.ts, format.ts
│       ├── auth/, profiles/, supabase/, env.ts, env.server.ts, legal.ts, safe-redirect.ts, utils.ts
├── supabase/
│   ├── migrations/                 # SQL migrations (source of truth for the schema)
│   └── seed.sql                    # Phase 2 seed: drafts only, every row TO VERIFY
├── scripts/db-test/                # Docker-free migration, RLS, workflow, and seed tests
├── tests/
│   ├── unit/                       # Vitest
│   ├── e2e/                        # Playwright: mobile layout suite + public flows
│   └── fixtures/sample-published.sql  # Clearly fake published data for local dev and E2E (never production)
├── playwright.config.ts, vitest.config.mts, components.json
├── FILES.md                        # Every file, which phase introduced it, and what it does
└── AGENTS.md                       # Auto-maintained by `next dev` (points AI agents to Next 16 docs)
```

Planned folders (created in their phases): `src/lib/monitoring/`, `src/lib/context/`.

### Data flow

- **Pages** are React Server Components. They read copy from the dictionary and, from Phase 3, published content from Supabase. Public pages are prerendered into a static shell (fast, cacheable, indexable).
- **Anything that reads the login session or the URL at request time** (header user button, account page, all admin pages, components using `usePathname`) sits behind `<Suspense>`. Next 16 Cache Components makes this a build error otherwise, which the build caught twice in Phase 2.
- **The proxy** (`src/proxy.ts`) redirects un-prefixed paths to `/en` or `/fil` and refreshes the Supabase session only when an auth cookie exists, so anonymous guide readers cost no Supabase round-trip.
- **Supabase** is always queried with the user's own session and the publishable key, so Row Level Security decides what each request may see. Admin pages and actions also check `role = 'admin'` first, but RLS is the real gate.
- **Admin writes** go through Server Actions (`src/lib/admin/actions.ts`): admin check → Zod validation → workflow rules → write → audit trail (written by a database trigger, not the app).
- **One content index:** the `content_index` view lists every content row in one shape. The dashboard, queues, and sources page read from it, so new content types show up in every queue automatically once added to the view.
- **Public pages** (guides, finder, offices, sitemap) are prerendered from cached queries in `src/lib/content/public.ts` (`'use cache'`, tag `content`, `cacheLife("hours")`), using a cookie-free publishable-key client, so RLS returns only published rows. Every admin change calls `updateTag("content")`, so publishing or unpublishing shows on the next request; the hourly lifetime keeps "may be outdated" warnings accurate to the hour.
- **Status codes:** with Cache Components the prerendered shell starts a `200` before a page can decide it's missing. Search crawlers still get real `404`s and `308`s (Next waits for metadata for bots; verified with a Googlebot user agent); people see the not-found page marked `noindex`, and moved-office redirects happen in the browser. Unpublished content is never rendered either way.
- **Secret key** (`SUPABASE_SECRET_KEY`) is used in exactly two places: the rate limiter and inserting anonymous reports after the limit check (`src/lib/supabase/service.ts`).
- **Planner:** the wizard is a static page; "Show my options" calls the `generatePlan` Server Action, which runs the engines on the cached catalog (no database writes, no AI). Saving recomputes the plan on the server, so stored plans never come from the browser.
- **Claude** (Phase 5): server-side only, through `runAi()` in `src/lib/ai/client.ts`, which checks the configuration and the monthly budget, calls the Messages API (web search tool `web_search_20250305` with `allowed_domains`), and logs usage. Engines receive the runner as a parameter, so they are unit-tested with a fake. Every response is validated with Zod, and every link must be one the search actually returned on an allowed domain.
- **Live context** loads after the guide page (`/api/context`), so guides stay static; results are cached per guide and language in `live_context_cache`.
- **Vercel Cron** (Phase 6+) and **PayMongo** (Phase 8): see their sections.

## 6. Environment variables

Kept in sync with `.env.example`. Copy it to `.env.local` for development.

| Variable | Phase | Scope | Purpose | Where to get it |
|---|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | 1 | Public | Base URL for canonical, hreflang, Open Graph. Default `http://localhost:3000` | Your domain |
| `NEXT_PUBLIC_SUPABASE_URL` | 1 | Public | Supabase project URL. If empty, site builds but sign-in is disabled | Supabase → Project Settings → API Keys; locally from `supabase start` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 1 | Public | Supabase publishable key (`sb_publishable_...`; the legacy anon key also works) | Same place |
| `NEXT_PUBLIC_CONTACT_EMAIL` | 1 | Public | Address shown for data-privacy requests | Your DPO mailbox |
| `CONTENT_STALE_DAYS` | 1 | Server | Days before content shows "may be outdated" and enters the Stale queue. Default 90 | Choose |
| `ENABLE_UI_PREVIEW` | 2 | Server | `true` enables `/[locale]/ui-preview` (admin components with sample data) for layout checks and E2E tests. **Never set in production** | Local/CI only |
| `E2E_SAMPLE_DATA` | 3 | Test only | `1` runs the public-flow tests and sample pages; needs `tests/fixtures/sample-published.sql` loaded | Local/CI only |
| `PLAYWRIGHT_CHROMIUM_PATH` | 2 | Test only | Optional path to a preinstalled Chromium for E2E tests (CI or sandboxes) | Leave empty normally |
| `SUPABASE_SECRET_KEY` | 3 | Server | Bypasses RLS. Used only by the rate limiter and to store anonymous reports. Without it, visitors must sign in to report | Supabase → API Keys (secret) |
| `RATE_LIMIT_SALT` | 3 | Server | Salt for hashing IP addresses in rate-limit keys (16+ random characters). Required for anonymous reports | Generate a random string |
| `ANTHROPIC_API_KEY` | 5 | Server | Claude API | Claude Console |
| `ANTHROPIC_MODEL` | 5 | Server | Model name (never hardcoded); must support web search | Anthropic docs |
| `AI_MONTHLY_BUDGET_USD` | 5 | Server | Monthly AI spend cap; AI features pause gracefully when reached | Choose |
| `AI_INPUT_USD_PER_MTOK`, `AI_OUTPUT_USD_PER_MTOK`, `AI_WEB_SEARCH_USD_PER_1K` | 5 | Server | Prices used to estimate cost for the cap. Required for AI to turn on | Anthropic pricing page, for your model |
| `OFFICIAL_SEARCH_DOMAINS` | 5 | Server | Allowed domains for official live search. Default `gov.ph` | Choose |
| `COMMUNITY_SEARCH_DOMAINS` | 5 | Server | Allowed domains for community search. Default `reddit.com` | Choose |
| `LIVE_CONTEXT_OFFICIAL_TTL_HOURS` | 5 | Server | Official live-context cache. Default 24 | Choose |
| `LIVE_CONTEXT_COMMUNITY_TTL_HOURS` | 5 | Server | Community live-context cache. Default 12 | Choose |
| `CRON_SECRET` | 6 | Server | Required by `/api/cron/monitor` (Vercel Cron sends it as a Bearer token). 16+ characters | Generate a random string |
| `CRAWLER_USER_AGENT` | 6 | Server | Identifies the monitoring crawler | Choose |
| `CRAWLER_CONTACT_EMAIL` | 6 | Server | Contact in the crawler user agent | Your mailbox |
| `ENABLE_REDDIT_API` | 6 | Server | Feature flag. Must stay `false` until Reddit commercial terms are reviewed (not read by any code yet) | – |
| `NEXT_PUBLIC_ANALYTICS` | 11 | Public | `vercel` turns on cookieless Vercel Web Analytics (aggregate page views, no personal data); anything else = off | – |
| `FIELD_ENCRYPTION_KEY` | 7 | Server | AES-256-GCM key for TIN, registered name/address, entry notes. Without it those fields aren't saved (everything else is) | `openssl rand -base64 32`; back it up |
| `RESEND_API_KEY` | 7 | Server | Sends filing reminder emails; empty = no emails | resend.com |
| `EMAIL_FROM` | 7 | Server | Sender for reminder emails (verified domain) | Resend dashboard |
| `PAYMONGO_SECRET_KEY` | 8 | Server | Checkout API (`sk_test_` = test mode, `sk_live_` = live; decides which webhook signature slot is checked) | PayMongo → Developers |
| `PAYMONGO_WEBHOOK_SECRET` | 8 | Server | The webhook's signing secret (`whsk_…`), shown when the webhook is created | PayMongo → Webhooks |
| `PAYMONGO_PAYMENT_METHODS` | 8 | Server | Checkout methods (default `gcash,paymaya,card,qrph`) | Your enabled methods |

Only Phase 1–11 variables are read by code today (`ENABLE_REDDIT_API` is reserved). Public variables are validated in `src/lib/env.ts`; server variables in `src/lib/env.server.ts` (which cannot be imported by browser code).

## 7. Local development setup

Prerequisites: Node.js 22+, npm, Docker (for the local Supabase stack), and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).

```bash
# 1. Install
git clone <your-repo-url> marites-ph && cd marites-ph
npm install

# 2. Start local Supabase (Postgres, Auth, Studio, and a local email inbox)
supabase init        # first time only; creates supabase/config.toml, keeps existing migrations
supabase start       # prints API URL and publishable key

# 3. Apply migrations + seed (wipes the LOCAL database; loads the Phase 2 draft seed)
supabase db reset

# 4. Configure env
cp .env.example .env.local
#   set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY from step 2

# 5. Run
npm run dev          # http://localhost:3000 → redirects to /en or /fil
```

**Local auth settings.** In `supabase/config.toml` (created by `supabase init`), set `[auth] site_url = "http://localhost:3000"` and add `"http://localhost:3000/auth/callback**"` to `additional_redirect_urls`, then `supabase stop && supabase start`. Magic-link emails appear in the local inbox (Mailpit/Inbucket, URL printed by `supabase start`). Open the link in the **same browser** you requested it from.

**Google sign-in locally** needs a Google OAuth client: see [Deployment](#14-deployment), step 3, and configure `[auth.external.google]` in `config.toml`.

**Become an admin** (needed for `/en/admin`): sign in once, then run this in Supabase Studio's SQL editor:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```

Sign out and back in is not needed; reload the page. An **Admin** link appears in the header. Non-admins who visit `/admin` get a 404 (the panel's existence isn't revealed).

**Seed data in production.** `seed.sql` runs only on local resets. To load the drafts into production once, run it in the Supabase SQL editor (it is all drafts, so nothing becomes public). Do not re-run it after editing records there; the fixed IDs would conflict.

**Sample data for the public pages.** The real seed is all drafts, so guide and office pages are empty until you verify content. To see them working locally, load the clearly fake sample fixture (never in production):

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f tests/fixtures/sample-published.sql
# then open /en/ids/sample-id, /en/offices, /en/offices/sample-city/sa/sample-office-main
```

The file's header shows how to remove it.

**Anonymous reports locally:** set `SUPABASE_SECRET_KEY` (from `supabase start`) and `RATE_LIMIT_SALT` in `.env.local`. Without a proxy in front, there's no `X-Forwarded-For` header, so anonymous visitors are asked to sign in; signed-in reports always work.

**UI preview.** Set `ENABLE_UI_PREVIEW=true` in `.env.local` and open `/en/ui-preview` to see the admin components with sample data. Handy for checking layouts on your phone over your local network (`npm run dev -- -H 0.0.0.0`, then open your computer's IP on port 3000). Keep it off in production.

## 8. Database

### Schema summary

| Migration | Phase | Contents |
|---|---|---|
| `20261111000100_foundation.sql` | 1 | `btree_gist`; enums `content_status` (draft, verified, published, archived), `document_type`, `user_role` (user, admin, cpa), `app_locale`; `set_updated_at()` |
| `20261111000200_profiles_and_auth.sql` | 1 | `profiles` (+ consent fields); `current_user_role()`, `is_admin()`; signup trigger; consent RPC `record_privacy_consent(version)` |
| `20261111000300_content.sql` | 1 | `agencies`, `documents`, `document_requirements`, `accepted_for`, `guide_steps`, `offices`, `office_services`, `lgu_processes`, `tax_rules`, `tax_deadlines` |
| `20261120000100_marketplace.sql` | 10 | `marketplace_settings` (fee rate), `cpa_listings` (owner can't verify; edits to name/license re-queue review), `quote_requests` (transition trigger), `quote_contacts` + `release_quote_contacts()` (server only), `cpa_reviews` (completed requests only), `platform_fees` (recorded on completion), `cpa_directory` view (verified, unexpired, no emails), `is_verified_listing()` |
| `20261119000100_negosyo.sql` | 9 | `businesses` (≤10 per user, encrypted registration numbers, due-date digits), `employees` (encrypted names), `remittances` (one per business, agency, month); ownership trigger; owner-only RLS |
| `20261118000100_billing.sql` | 8 | `subscription_plans` (price required before active; named to avoid the planner's `plans`), `payments`, `entitlements` (owner may only set `canceled`), `webhook_events`; `apply_payment()` (service role only; idempotent; stacking, upgrade carry-over, downgrade held for review); `plan_renewal` reminders |
| `20261117000100_freelancer.sql` | 7 | `taxpayer_profiles` (encrypted columns must start `v1:`), `income_entries`/`expense_entries` (PHP amount must equal amount × rate), `reminders`; owner-only RLS (admins can't read); `reset_cpa_review` trigger; `cpa_review_tax_item()` (role `cpa` only); CPA read policies; `document_type` value `filing` |
| `20261116000100_bantay_batas.sql` | 6 | `issuance_type` enum; `official_sources` (can't be active while TO VERIFY); `issuances`; `issuance_links`; `change_proposals` (reviewed_at required once decided); `community_signals`; `change_alerts`; `legal_references.issuance_id` foreign key |
| `20261115000100_community_ai.sql` | 5 | `pg_trgm`; `tips` (moderated); `office_wait_stats` view (median wait, approved tips, 90 days); `troubleshoot_queries` (cached answers, trigram index) + `find_similar_troubleshoot()` (service role only); `live_context_cache` (official/community per guide and language) |
| `20261114000100_planner.sql` | 4 | `user_documents` (have / in progress / need, expiry), `plans` (saved snapshots, size-capped), `ai_usage_log` (for the AI budget cap, written only with the secret key), `ai_spend_this_month()` (service role only) |
| `20261113000100_public_guides.sql` | 3 | `slugify()` (mirrors `src/lib/slug.ts`); `offices.slug` (unique, auto-generated from the name, backfilled); `rate_limits` table + `hit_rate_limit(key, limit, window_seconds)` (service role only) |
| `20261112000100_admin_workflow.sql` | 2 | Stable `id` on `accepted_for` and `office_services`; `content_target_type` enum + target validator; `legal_references`; `content_flags`; `verification_events` (audit trail) with status-change triggers on every content table; `content_index` view |

Every content table carries a **verification block**: `status`, `source_url`, `last_verified_at`, `verified_by`, `to_verify_note`, plus `created_at`/`updated_at`.

**Guardrails enforced by the database itself:**

- `verified` or `published` requires `source_url` and `last_verified_at`.
- `published` requires `to_verify_note IS NULL`, so a guessed fact can never go live.
- `tax_rules` and `tax_deadlines` can be `published` only when `cpa_reviewed = true`.
- Two `verified`/`published` versions of the same tax rule (or form + frequency deadline) can't have overlapping effective dates.
- URLs must start with `http(s)://`; fee and processing-day ranges must have min ≤ max; office coordinates must fall in rough Philippine bounds.
- Legal references and flags must point at a record that exists (trigger), and legal references accept only official source ranks 1–4.
- Flags can't be closed without `resolved_at`.

**Tables added in Phase 2:**

| Table / view | Purpose |
|---|---|
| `legal_references` | The law or issuance behind a document, requirement, step, purpose, office, or service. `source_rank` follows the source hierarchy (1 law, 2 IRR/EO, 3 agency issuance, 4 advisory). `issuance_id` will link to `issuances` once Bantay Batas exists (Phase 6) |
| `content_flags` | "Report outdated info" from users (`source = 'user'`) and automatic flags (`source = 'system'`, written with the secret key from Phase 5). Reasons: outdated, incorrect, fixer, other |
| `verification_events` | Append-only history of every status change, with who made it. Written only by triggers |
| `content_index` (view) | Every content row in one shape (`target_type`, `id`, `label`, `parent_type`, `parent_id`, status and verification fields). `security_invoker`, so RLS applies |

**Refinements to the brief (assumptions):**

- **Requirements** use "AND of groups, OR of options, AND of items." All `group_key`s are required; within a group, any one `option_key` suffices; an option needs all its rows. "A, OR B + C" = group `g`, option `a`: [A]; option `b`: [B, C]. Each row is either another document or free text, never both.
- **Office hours** are one `hours` JSON object for the whole week (`{"mon": [["08:00","17:00"]], "sun": []}`, Philippine time, up to 3 intervals a day) instead of separate weekday and weekend fields, so they can't disagree.
- **Validity and processing time** are stored as numbers plus a display note, so the planner can compute with them.
- **"Sources" in the Phase 2 brief** is read as the source URLs on every record (shown on the admin Sources page), not a separate table. The crawlable official-source registry (`official_sources`) is Phase 6.
- **Polymorphic links** (`legal_references`, `content_flags`) use `target_type` + `target_id` with a validating trigger instead of foreign keys. Content is archived, not deleted, so dangling links are not expected; deleting a never-verified draft that has links attached is blocked only for real foreign keys, so check its legal references first.

### RLS overview

- RLS is enabled on **every** table.
- `profiles`: users read and update only their own row (and only `display_name`, `language_pref`, `region`, `city`); admins read all. Users can't change their role or forge consent.
- Content tables and `legal_references`: anyone can read `published` rows (children only if the parent is published too); admins read everything and are the only writers.
- `content_flags`: signed-in users can file a flag **as themselves only**, as an open user flag, and read their own flags. Only admins can read all flags and resolve them. Anonymous visitors can't file flags (Phase 3 adds the public button with rate limiting).
- `verification_events`: admins read; nobody writes directly (triggers only).
- `content_index`: inherits the RLS of the underlying tables.
- Marketplace: raw listings (with contact emails) are readable only by the owner and admins; the public reads the `cpa_directory` view. Requests are visible only to the two parties; status changes are limited per side by a trigger. Emails are released to both parties only when the professional accepts (server function). Reviews require a completed request of your own. Platform fees are visible to the professional and admins.
- Negosyo data (`businesses`, `employees`, `remittances`) is owner-only (admins can't read it); employees and remittances must belong to a business the same user owns (trigger); deleting the account or the business removes them.
- Billing: users read their own payments and entitlement and may only mark it `canceled` (stops reminders); only the server's `apply_payment()` creates paid payments or extends access; `webhook_events` is server-only.
- Freelancer data (`taxpayer_profiles`, income/expense entries, reminders) is owner-only; not even admins can read it. Reminders are written by the server. Deleting an account deletes all of it.
- Tax rules: editing a rule's content clears its CPA review (trigger), and a published rule must be CPA-reviewed (Phase 1 constraint), so a published rule can't change without a new review. Only `cpa_review_tax_item()` can set the review, and only for role `cpa`.
- Monitoring tables are admin-only (read/update; sources also insert/delete by admins); the pipeline writes with the secret key. The public can read only `published` issuances and `approved` change proposals (for the feed). `change_alerts`: each user reads their own; written by the server.
- `tips`: public sees approved tips only; authors see their own; users can submit only as themselves and only as pending; admins moderate.
- `troubleshoot_queries`: private to the asker (questions may contain personal details); similarity lookups only through the service-role function. `live_context_cache`: public read (no personal data), server writes only.
- `user_documents` and `plans`: owners only (select/insert/update/delete); not even admins can read them. Deleting an account cascades to both.
- `ai_usage_log`: admins read; no direct writes from users.
- `rate_limits`: RLS on with no policies; `anon` and `authenticated` have no access; `hit_rate_limit()` is executable only by the service role. Keys are opaque (`flag:user:<id>`, `flag:ip:<salted sha256>`), never raw IPs.
- Helper functions are `SECURITY DEFINER` with `search_path = ''`; `EXECUTE` is revoked from roles that shouldn't call them.

### Creating and applying migrations

```bash
supabase migration new short_description   # creates supabase/migrations/<timestamp>_short_description.sql
# write SQL (always include RLS policies for new tables)
supabase db reset                          # apply all locally (wipes local data, reloads seed)
npm run test:db                            # Docker-free check (see Testing)
supabase db push                           # apply to the linked remote project
npm run db:types                           # regenerate TypeScript types from the local DB
```

Never edit a migration that has already been applied to production; add a new one. When you add a content table, also add it to the `content_index` view, the status-change trigger loop, and `content_table_for()`.

## 9. Content and verification workflow

Everything below happens in the admin panel at `/en/admin`.

```
 draft ──Mark verified──▶ verified ──Publish──▶ published
   ▲                         │                      │
   └──────Back to draft──────┴──Unpublish───────────┘
 any status ──Archive──▶ archived ──Restore──▶ draft
```

1. **Add** a record (it starts as `draft`). Fill in the official **source URL** and describe anything unconfirmed in the **TO VERIFY note** ("TO VERIFY: rush processing fee").
2. **Verify:** open the source, correct the record, clear the TO VERIFY note, then press **Mark verified**. This stamps today's date and your name. It's refused if there's no source or the note isn't empty.
3. **Publish:** press **Publish** on a verified record. (Draft can't jump straight to published.) Children (requirements, steps, purposes, services) are public only when they **and** their parent document or office are published.
4. **Editing a published or verified record:** if you change a fact (anything except the URL slug, step number, or sort order), the record goes back to **draft** automatically, unless you tick **"I re-checked every changed fact against the official source just now,"** which re-verifies it with today's date instead. Adding a TO VERIFY note always sends it back to draft.
5. **Re-verify:** content last checked more than `CONTENT_STALE_DAYS` (default 90) days ago appears in **Stale**. Users will see a "may be outdated" warning on it (Phase 3). If it's still correct, press **Still correct: re-verify today**; if not, edit it.
6. **Flags:** reports appear in **Flags**. Fix the record first, then resolve the flag with a note, or dismiss it. Fixer reports: remove the content and review the account.
7. **Archive** instead of deleting. Only drafts that were never verified can be deleted.
8. **History:** each document and office page shows every status change for it and its children.
9. **Going live:** publishing, unpublishing, editing, or re-verifying updates the public site on the next request (cache tag `content`). Published documents and offices show a **View public page** link. A guide appears publicly only when the document *and* its agency are published; requirements and steps appear only when they're published too.

The workflow rules live in `src/lib/admin/workflow.ts` (unit-tested); the database enforces the same guardrails as a backstop.

**Legal basis.** On a document, office, or agency page, use **Add legal reference** to record the law or issuance behind the record or one of its requirements or steps. Only official sources (ranks 1–4) are accepted. These become the public "Bakit ganito?" section in Phase 3.

### All TO VERIFY / TO REVIEW items

**Seed data (Phase 2). All of it is unverified and entered from general knowledge, not from the sources.** The **Verify queue** in the admin panel lists every item with its exact note. Summary:

| Area | What to check |
|---|---|
| Agencies (DFA, PSA, NBI, PHLPost) | Official names and URLs |
| Philippine Passport | Fees (₱950 regular / ₱1,200 expedited entered), adult validity (10 years entered), NCR processing days, appointment rules, legal basis (RA 11983 entered; confirm it supersedes RA 8239) |
| National ID (PhilID) | Fee (₱0 entered), validity, card vs ePhilID, delivery time, registration steps, proof-of-identity combinations, RA 11055 |
| NBI Clearance | Fee (₱130 entered) and service charges, validity (12 months entered), "hit" delays, online flow, number of IDs, RA 10867 |
| Postal ID | Fee (**left empty**), validity, processing time, walk-in policy, accepted proofs, application form, legal basis (RA 7354 entered; may instead rest on a PHLPost issuance) |
| PSA Birth Certificate | Walk-in and online fees (₱155 / ₱365 entered), release times, requester rules, RA 10625 |
| Accepted-for purposes | Bank account acceptance (BSP and bank policy), employment |
| Guide steps (15) | Each step's flow against the official site |
| NCR offices (6) | Addresses, coordinates (approximate), **hours (placeholder Mon–Fri 08:00–17:00)**, walk-in policy, whether each office still operates and offers the listed service. No PhilSys registration center is seeded yet |

**Legal and copy:**

| Item | Where | Owner |
|---|---|---|
| Privacy policy: operator name, address, DPO, retention periods, processor regions, cross-border safeguards | `src/content/legal/privacy.ts` | Founder + lawyer |
| Terms of use: operator, contact, liability wording, paid-plan terms | `src/content/legal/terms.ts` | Founder + lawyer |
| Disclaimer wording | `src/content/legal/disclaimer.ts` | Lawyer |
| Filipino versions of legal pages are summaries; English prevails until translated and reviewed | `src/content/legal/*.ts` | Translator + lawyer |
| Filipino UI copy: native-speaker review of tone and terms | `src/i18n/messages/fil.json` | Founder |
| Office coordinate bounds (lat 4–22, lng 116–127) are approximate | content migration | Low priority |

## CPA marketplace (Phase 10)

- **Listing and verification:** anyone can apply as a CPA (license number required) or bookkeeper. Admins verify after checking the license on the PRC online verification service; changes to the name, profession, license number, or validity send a verified listing back to pending. Expired licenses drop out of the directory automatically. Verification never grants the `cpa` role (tax rule review), which stays a manual assignment.
- **Engagement flow:** request (signed in, 5 a day, no contact details in the text) → the professional accepts or declines with a reply and optional quoted fee → on acceptance both emails are released → the professional marks it completed with the final fee → the requester may leave one review. Marites PH is not a party to the engagement; payment happens directly between them.
- **Platform fee:** rate set in Admin → Marketplace (a business setting, default 0%); recorded at the current rate when an engagement completes; invoiced to the professional outside the app; marked paid or waived in admin.
- **Contact details** in messages, replies, bios, and reviews are refused (same patterns as the anti-fixer rules), so contacts flow only through the acceptance step.

## Contributions and permits (Phase 9)

- **Rates are rule rows, not code.** `contribution.sss` (salary credit: salary rounded to `mscStep`, clamped to `mscMin`–`mscMax`; `employeeRate`, `employerRate`; employer EC `ecLow`/`ecHigh` around `ecThreshold`), `contribution.philhealth` (`rate` × salary clamped to `floor`–`ceiling`; `employeeShare`), `contribution.pagibig` (`employeeRateLow`/`High` around `lowThreshold`, `employerRate`, `maxCompensation`). They live in `tax_rules` so they share effective dating, admin validation, and CPA review (a deliberate choice: payroll is usually handled with an accountant). Seeded values are drafts "TO VERIFY WITH CPA"; the SSS MPF split above ₱20,000 MSC is shown as part of the total, not separately (TO VERIFY).
- **Remittance deadlines** are `tax_deadlines` rows with `applies_to` = `employer` and a monthly rule: `monthly_fixed` (`day` of the following month) or `monthly_by_digit` (`digitOf` sss/philhealth → `days` per digit). Businesses store only the digit used for the schedule. Weekends move to Monday; holidays aren't applied.
- **Permit renewals** come from published `lgu_processes` (`business_permit_renewal`) matched by city name. JSON shapes: steps `[{title, body?}]`, requirements `[{text, note?}]`, fees `[{label, amount|null, note?}]` (null = depends on assessment), deadlines `[{label, month, day}]`. Seeded for Quezon City, Manila, Makati (TO VERIFY; deadline January 20 per the usual rule, to confirm per city). Add a city in Admin → LGU processes.
- **Remittance records** are computed on the server from active employees and published rules when the owner taps "Record as paid"; Marites PH never remits or files.

## 10. Engines

All engines are pure TypeScript in `src/lib/engines/`: no database, no AI, fully unit-tested (`tests/unit/engines.test.ts`). They work on a snapshot of **published** content (`getPlannerCatalog()` in `src/lib/content/public.ts`), so a plan can never route someone through unverified information.

### Dependency engine (`dependencies.ts`)

Given a goal (a document, or a purpose like "opening a bank account") and the documents someone has, it finds which documents they still need, in order.

- Requirements follow the database rule: every group is required; any **one** option per group; **all** items in that option.
- **"Need an ID to get an ID" loops** are handled by never using an option that needs a document already being worked out higher up the chain. Example: the national ID's "passport" option is skipped while planning a passport, so it falls back to "birth certificate + photo ID". If every option of a group is refused, that path is blocked.
- A requirement pointing at an **unpublished** document can't be planned through (blocked), never guessed.
- Free-text requirements become "also prepare" items.
- Paths are ranked by: in-person visits, documents to get, maximum fees, maximum processing days.

| Constant / assumption | Value | Meaning |
|---|---|---|
| `DEPENDENCY_LIMITS.beamWidth` | 6 | Paths kept per document while searching |
| `DEPENDENCY_LIMITS.maxPaths` | 4 | Paths returned |
| `DEPENDENCY_LIMITS.maxDepth` | 8 | Recursion guard |
| Visits per document | 1 if any published step is in person; 0 if all are online; 1 if no steps | Assumption |
| Unknown fees / processing | Counted as 0, flagged (`costUnknown`, `daysUnknown`) | Shown to users as "some unknown" |
| Processing time | Critical path: a document starts when the documents it needs are done; independent ones run in parallel | |

### Office ranking (`offices.ts`)

Ranks offices that handle a document. It isn't just distance; every ranking comes with reasons.

| Weight (`RANKING_WEIGHTS`) | Value |
|---|---|
| Base score | 100 |
| Distance | −2 per km, at most −40 |
| Open during the person's free time (overlap ≥ 30 min) | +30 |
| Only open while they work (needs leave) | −10 |
| Walk-ins accepted / appointment needed / unknown | +10 / −5 / 0 |
| Weekend hours | +5 |
| Stale data (older than `CONTENT_STALE_DAYS`) | −15 |
| Reported wait time (from Phase 5 tips) | −1 per 6 min, at most −20 |

Travel time estimate (`TRAVEL_SPEED_KMH`): walking 4 km/h, public transport 15 km/h, car or motorcycle 20 km/h (rough Metro Manila door-to-door speeds; an assumption).

### Plan engine (`planner.ts`): "Ano'ng Lakad Mo?" and "Mga Diskarte"

Builds up to four options, each from a chosen path and ranked offices:

| Strategy | Path chosen by | Office chosen |
|---|---|---|
| `fastest` (Pinakamabilis) | Shortest processing time | Best-ranked, even if leave is needed |
| `no_leave` (Hindi na kailangang mag-leave) | Fewest visits; tries other paths until none needs leave | Only offices open during free time; unavailable otherwise |
| `cheapest` (Pinakamura) | Lowest maximum fees | Best open during free time, else best-ranked |
| `fewest_visits` (Pinakakaunting lakad) | Fewest in-person trips | Same as cheapest |

Identical options merge (e.g. "Pinakamabilis, also: Pinakamura"). Each option lists steps (document, office, when to go, what to prepare), totals (trips, leave days, fees, processing time) and risks (stale info, appointment needed, walk-in unknown, no verified office, over budget, needs more leave than available, slower than the urgency, unknown fees or times).

**Recommendation rules, in order:** only one option → it ("best on every count" if all strategies agree); no leave available and a no-leave plan exists → that; "as soon as possible" → fastest; a budget is set and the cheapest fits → cheapest; otherwise fewest trips.

**Schedule presets** (free time; assumptions, the person can set custom hours):

| Preset | Free time |
|---|---|
| 8 to 5 worker | Weekdays 6–8 AM and 5–8 PM; weekends 8 AM–6 PM |
| Night shift | Weekdays 1–6 PM (after sleeping); weekends 9 AM–6 PM |
| Weekends only | Saturday and Sunday, 8 AM–6 PM |
| Flexible | Every day, 8 AM–6 PM |

Urgency limits (`URGENCY_DAYS`): "as soon as possible" 14 days, "within the month" 30 days.

The engine returns codes, not sentences; `src/lib/planner/describe.ts` turns them into English or Filipino from the message files.

**Situation landing pages** (`/[locale]/ids/[slug]/[situation]`, e.g. `for-8-to-5-workers`, `for-night-shift-workers`, `on-weekends`) run the same engine with a preset and no personal data, for every published guide.

### Troubleshooter (`troubleshoot.ts`) and live context (`src/lib/context/live.ts`)

Both take their dependencies (AI runner, cache, storage, rate limiter) as parameters and are unit-tested with fakes; see section 12 for their rules. Cache similarity threshold: 0.45 (trigram), answers kept 14 days.

### Office ranking: wait times

From Phase 5, median reported waits from approved tips feed `RANKING_WEIGHTS.perWaitMinute`, but only for offices with **3 or more** reports in the last 90 days, so one tip can't swing a ranking.

### Tax engine (`tax.ts`)

`compareOptions()` computes, for one taxable year: graduated rates (net business income by OSD or itemized expenses, plus compensation for mixed-income earners) with percentage tax for non-VAT taxpayers, against the 8% option (gross minus the exempt amount for purely self-employed; mixed earners pay 8% on business gross and graduated tax on compensation; unavailable to VAT-registered or above the threshold). It recommends the lower total and returns the rules used with their CPA status. `quarterlyBreakdown()` applies the cumulative method for Q1–Q3; `filingCalendar()` builds due dates. All worked examples in `tests/unit/tax.test.ts` are marked TO VERIFY WITH CPA.

## 11. Tax rules management

**Status: built (Phase 7).** Code: `src/lib/engines/tax.ts`; admin: Tax rules, Tax deadlines; CPA: `/[locale]/cpa`.

- **Nothing is hardcoded.** The engine reads every rate, bracket, threshold, and due date from `tax_rules` / `tax_deadlines` rows, effective-dated (`effective_from` inclusive, `effective_to` exclusive). If any rule it needs is missing or malformed, it refuses to compute (no hidden defaults). Computations for a taxable year use the rules in force on December 31 of that year (mid-year changes such as the July 2023 percentage tax rate are not pro-rated: TO VERIFY WITH CPA).
- **Rule keys and parameters** (validated in the admin form and by the engine):

| Key | Parameters |
|---|---|
| `income_tax.graduated` | `{"brackets":[{"over","upTo","base","rate"}]}`: tax = base + rate × (taxable − over) |
| `income_tax.eight_percent` | `{"rate","exemptAmount","grossThreshold"}`: exemption only for purely self-employed |
| `income_tax.osd` | `{"rate"}`: optional standard deduction share of gross |
| `percentage_tax.rate` | `{"rate"}`: non-VAT percentage tax (not on the 8% option) |

- **Deadline rules** (`due_rule`): `quarterly_fixed` (dates per quarter), `after_quarter_end` (N days after quarter end), `annual_fixed` (month/day, year offset). `applies_to`: `eight_percent`, `graduated`, or `all`. Dates on weekends move to Monday; Philippine holidays are not applied yet.
- **Adding or changing a rule:** create a new version as a draft (new `effective_from`, end-date the old one) → verify against the source → a **CPA** reviews it at `/[locale]/cpa` → publish. A published rule can't be edited in place: move it back to draft, change it, and get a new review. Overlapping live versions of a rule are refused by the database.
- **From Bantay Batas:** proposals for tax rules or deadlines go to `needs_cpa` when an admin approves them; a CPA applies them.
- **CPA accounts:** set `profiles.role = 'cpa'` for the CPA's account (SQL editor). Admins can view the CPA page but can't approve.
- **Seeded values** (TRAIN-law-shaped tables, 8% option, OSD, percentage tax 1%→3%, 1701Q/2551Q/1701 deadlines) are drafts marked "TO VERIFY WITH CPA"; unit tests check they parse.

## 12. AI usage

AI is used in three places, all optional and all fenced in. It never publishes anything and is never the source of a requirement, fee, office, or deadline.

| Use | Where | What the AI does | Guardrails |
|---|---|---|---|
| Plan summary ("Ipaliwanag ni Marites") | Planner results | Rephrases the recommended option | Gets only the plan's steps; output rejected if it has digits, money, links, unknown step ids, or any document/office name not in the plan; labeled AI-written |
| Chika sa Pila | `/[locale]/chika` | Searches community domains and summarizes causes, fixes, official channels | Cache first (trigram match, same document and language, 14 days); search limited to `COMMUNITY_SEARCH_DOMAINS`; links kept only if returned by the search; paraphrase only, no thread text stored; labeled unverified; 5 questions/hour |
| "Ano'ng bago?" | Guide pages | Finds official updates newer than the guide's verification, and recent community experience | Two separate searches and caches (official 24 h, community 12 h); official limited to `OFFICIAL_SEARCH_DOMAINS`; links grounded; a possible conflict raises a system flag for admins and a banner, never an edit; 20 cache-miss calls/hour per IP |

**Controls (`src/lib/ai/`):**

- `config.ts`: AI is off unless key, model, budget, and all three prices are set; malformed values turn it off instead of crashing.
- `client.ts`: the only code that calls Claude. Checks month-to-date spend (`ai_spend_this_month()`) against `AI_MONTHLY_BUDGET_USD` before every call; logs tokens, searches, estimated cost, and outcome to `ai_usage_log`; no account details in prompts; prompts are never logged.
- `core.ts`: cost estimate, JSON extraction, URL normalization, domain checks, grounding.
- `prompts/`: one file per task, each commented; `voice.ts` holds the Marites voice and safety rules, plus the source hierarchy for official searches.

**When AI is off or over budget:** cached Chika answers still work; new questions get a clear "resting" message; "Ano'ng bago?" shows cached (possibly stale, labeled) results or nothing; the plan summary button is hidden. The admin dashboard shows spend against the budget.

## 13. Payments

**Status: built (Phase 8).** Code: `src/lib/billing/`, `src/app/api/webhooks/paymongo/`. Checked against PayMongo's Hosted Checkout and webhook docs (November 2026).

**Model: prepaid periods.** Users pay for 1, 3, 6, or 12 months (price × months) through PayMongo Checkout with GCash, Maya, cards, or QR Ph. No automatic charges: e-wallets can't be auto-debited, and this avoids depending on PayMongo's subscription product (a possible later upgrade). A renewal reminder goes out 3 days before the end. Same-plan renewals stack after the current end; upgrading starts now and carries remaining days over; buying a lower plan while a higher one runs is refused at checkout (and held for review if it ever arrives). No proration or in-app refunds: refund in the PayMongo dashboard, then mark the payment `refunded` and adjust the entitlement in the SQL editor.

**Flow:**
1. `startCheckout` (signed in): reads the price from `subscription_plans`, inserts a `pending` payment, creates a v2 Checkout Session (`POST https://api.paymongo.com/v2/checkout_sessions`, Basic auth with the secret key, amount in centavos, our payment id as `reference_number`), stores the session id, redirects to the PayMongo-hosted `checkout_url` (only `*.paymongo.com` URLs are followed).
2. The user returns to Billing (`?checkout=success|canceled`); that page never grants access itself.
3. `POST /api/webhooks/paymongo`: verifies `Paymongo-Signature` (HMAC-SHA256 of `"<t>.<raw body>"` with the webhook secret; `te` in test mode, `li` in live mode; 72-hour window because PayMongo retries up to 12 times), ignores events from the other mode, records the event key (idempotency), finds the payment by `reference_number`, checks the line-item total equals the charged amount (else `review`), then calls `apply_payment()`.

**Set up PayMongo:** create the account and finish KYC; copy the secret key; in Settings → Webhooks add `https://<your domain>/api/webhooks/paymongo` subscribed to `checkout_session.payment.paid` and copy its `whsk_…` secret; set both in Vercel; set prices in Admin → Billing and activate the plans. Rehearse in test mode first (PayMongo test payment methods, or `scripts/paymongo-webhook-smoke.mjs` against a preview deployment with the test webhook secret). Test and live webhooks are separate endpoints with separate secrets.

**Reconciliation:** Admin → Billing lists recent payments; `review` means the amount didn't match or a lower plan was bought: compare with the PayMongo dashboard. `pending` means a checkout that wasn't completed.

**Complimentary access:** Admin → Billing → Grant (account ID from the user's Billing page, with a reason): a ₱0 manual payment applied by the same function.

## 14. Deployment

### Supabase (production)

1. Create a project. Choose the region closest to the Philippines (e.g. Singapore) and note it for the privacy policy.
2. Link and push migrations:
   ```bash
   supabase login
   supabase link --project-ref <project-ref>
   supabase db push
   ```
3. **Google sign-in:** in Google Cloud Console, create an OAuth client (Web). Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`. In Supabase → Authentication → Sign In / Providers → Google, paste the client ID and secret.
4. **URL configuration** (Authentication → URL Configuration):
   - Site URL: your production URL (same as `NEXT_PUBLIC_SITE_URL`).
   - Redirect URLs: `https://<your-domain>/auth/callback**` and, for Vercel previews, `https://*-<your-team>.vercel.app/auth/callback**`.
5. **Magic-link email template** (Authentication → Emails → Magic Link). Replace the link with this so links work even when opened on another device:
   ```html
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&redirect_to={{ .RedirectTo }}">Sign in to Marites PH</a>
   ```
   Do the same for the "Confirm signup" template with `type=signup`. Without this change, magic links still work via `/auth/callback`, but only in the same browser.
6. **Custom SMTP** before launch (Authentication → Emails → SMTP), e.g. Resend. Supabase's built-in email is heavily rate-limited.
7. **RLS check:** Supabase → Advisors → Security should show no tables without RLS.
8. **Backups:** enable daily backups / point-in-time recovery on a paid plan before storing real user data.

### Vercel

1. Import the Git repository in Vercel. Framework preset: Next.js. Build command `npm run build`; Node.js 22.
2. Environment variables (Project → Settings → Environment Variables): every Phase 1 variable from section 6, for **Production** and **Preview**. Use the production `NEXT_PUBLIC_SITE_URL` for Production; for Preview it can be left as default or set per branch.
3. Domains: add your domain, then update Supabase Site URL and redirect URLs (step 4 above).
4. Preview vs production: previews use the same Supabase project unless you create a separate staging project (recommended before real users). Previews must be in the Supabase redirect allow-list to sign in.
5. Cron jobs: none in Phase 1. From Phase 6 they'll be declared in `vercel.json` and protected with `CRON_SECRET`.

## Offline, performance, and launch (Phase 11)

**Installable app and offline.** `src/app/manifest.ts` and `/icons/{192,512,maskable}` (generated) make the site installable. `public/sw.js` (registered in production by `ServiceWorkerRegistration`):
- `/_next/static/*`: cache-first (file names change with content).
- Navigations to guides, business guides, offices, the planner, the feed, CPA pages, saved plans, and My documents: network-first (4 s timeout); successful HTML is kept; offline, the saved copy is shown, otherwise `/[locale]/offline`.
- Never cached: admin, account, login, CPA review, `/api`, `/auth`, URLs with query strings.
- Personal pages are removed from the device on sign-out and account deletion (`Clear-Site-Data: "cache", "storage"`). Bump `VERSION` in `sw.js` to drop old caches. `sw.js` is served with `no-cache` so updates reach phones quickly.

**Security headers** (`next.config.ts`): CSP (`default-src 'self'`; scripts and styles self plus `'unsafe-inline'`, needed for Next's inline bootstrap and the pre-paint theme script on statically prerendered pages; external scripts blocked; images self, data, and OpenStreetMap tiles; connect self and Supabase; `frame-ancestors 'none'`; `form-action` self, PayMongo, Google, Supabase; `object-src 'none'`; `upgrade-insecure-requests` on HTTPS deployments only), HSTS with preload, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` (geolocation self only), no `X-Powered-By`. When you switch map tile providers, update `img-src`.

**Performance.** Lighthouse 13.6 mobile (simulated slow 4G, 4× CPU slowdown) against a production build with the sample data, 3 runs each, median (Lighthouse's recommended method):

| Page | Performance (runs → median) | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| `/en/ids/sample-id` | 93, 93, 86 → **93** | 100 | 100 | 100 |
| `/fil/ids/sample-certificate` | 80, 94, 90 → **90** | 100 | 100 | 100 |
| `/en` | 99, 92, 97 → **97** | 100 | 100 | 100 |

Before Phase 11 fixes: 87 / 79 / 88. The fixes: Zod was in every guide page's browser bundle through `content/offices.ts` → `hours.ts` (now `hours-core.ts`, no Zod, with a compile-time check that its `Hours` type matches the schema), and Zod's `eval` probe tripped the CSP (best practices 96 → 100); site-wide header and footer links no longer prefetch. Largest Contentful Paint ≈ 1 s, layout shift 0. Single runs vary in this environment: re-measure on the production URL (PageSpeed Insights) and keep client components small. Rule of thumb: never import a module that uses `zod` from a `"use client"` file (type-only imports are fine).

**Operations.**
- `GET /api/health`: `{status}` publicly (503 if the database is unreachable); with `Authorization: Bearer <CRON_SECRET>`, also configuration presence (booleans only) and monitoring freshness. Point an uptime monitor at it.
- `npm run launch:check`: checks production settings are present and well-formed without printing values (`vercel env pull .env.production.local && node --env-file=.env.production.local scripts/launch-check.mjs`).
- `npm run check:bundle` (after a build): fails if secret names, key-like prefixes, or the values of secret variables appear in browser JavaScript.
- Analytics: optional, cookieless Vercel Web Analytics (`NEXT_PUBLIC_ANALYTICS=vercel`); mention it in the privacy policy if you turn it on.

**Launch checklist** (the product plan document has the same list with checkboxes):
1. Content: verify and publish the seeded guides, offices, legal references, BIR and business guides, city renewal processes; have your CPA review tax and contribution rules, then publish.
2. Legal: fill the placeholders in the privacy policy, terms, and disclaimer; lawyer review (including marketplace terms and the platform fee); native-speaker review of Filipino copy; NPC registration if required.
3. Supabase (Singapore): `supabase db push`; auth URLs, Google sign-in, email templates and custom SMTP; backups on; make your account admin; give your CPA the `cpa` role.
4. Vercel: all variables (`npm run launch:check` passes); `CRON_SECRET`; production domain with HTTPS.
5. Payments: PayMongo KYC, live keys, live webhook; decide prices and activate plans; rehearse in test mode first.
6. Monitoring: verify and activate official sources; supervised "Run monitoring now".
7. Map: switch to a commercial tile provider and update the CSP `img-src`.
8. Measure: Lighthouse on the production URL; uptime monitor on `/api/health`; submit the sitemap to Google Search Console.
9. After a build of the production commit: `npm run check:bundle`.

## 15. Testing

```bash
npm run check        # lint + typecheck + unit tests (run before every commit)
npm run test         # unit tests only (Vitest)
npm run test:watch   # watch mode
npm run build        # production build; also enforces Cache Components rules
npm run test:db      # migrations, RLS, workflow and seed checks (needs DATABASE_URL)
npm run test:e2e     # Playwright mobile layout suite (needs a build; see below)
```

**Unit tests** (`tests/unit/`, 167 tests): locale negotiation; EN/FIL message parity (keys, `{placeholders}`, feature names); formatting; content freshness; redirect safety; env parsing; **verification workflow** (transitions, re-verification on edit, CPA gate, delete rules, change detection that ignores key order and numeric formatting); **office hours** schema and form parsing; **requirement grouping** and AND/OR satisfaction; **admin form parsing** for every resource type (including seed-style version-0 UUIDs); sources grouping; admin paths and slug uniqueness; **Phase 3:** slugs (matching the SQL version), office filters, distance sorting, open-now in Manila time (including lunch breaks and day rollover), address formatting, peso formatting, HowTo/Breadcrumb/GovernmentOffice structured data, JSON-LD escaping, and report validation; **Phase 4:** dependency engine (loops, OR-groups, purposes, unpublished prerequisites, unknown fees, critical-path days), office ranking (free-time overlap, stale data, waits), planner (strategies, merging, recommendation rules, no-leave availability, risks, missing offices), and planner wording (no "0 km"); **Phase 5** (`tests/unit/ai.test.ts`): AI settings (off unless complete, fail-safe on bad values), cost estimate, JSON extraction, link grounding, plan summary validation, troubleshooter engine (cache, domains, dropped invented links, fallbacks), live context engine (groups kept apart, conflicts flagged, cache and stale fallback, rate limit), and anti-fixer rules; **Phase 6** (`monitoring.test.ts`, `pipeline.test.ts`): robots.txt rules, RSS/Atom/HTML parsing with official-domain filtering, HTML text extraction, OCR detection, classification limited to candidates, proposal validation (factual fields only, form schema, no-op diffs), community signals, and the pipeline with fakes (crawl → propose, failures, unchanged listings, AI off, invalid proposals, scanned PDFs); **Phase 7** (`tax.test.ts`, `freelancer.test.ts`): field encryption (round trip, tamper, wrong key), effective-dated rules, worked 8% vs graduated examples (TO VERIFY WITH CPA), mixed income, eligibility, quarterly cumulative method, filing calendar with weekend moves, seeded tax rules and deadlines parse, JSON admin fields, year picking, quarter totals, reminder timing and content; **Phase 8** (`billing.test.ts`): PayMongo signature (test/live slots, tampering, wrong secret, malformed, stale, retries within 72 h), both webhook payload shapes, centavos, entitlement rules (rank, expiry, cancelation), checkout guard, renewal reminder timing; **Phase 9** (`negosyo.test.ts`): contributions worked examples (TO VERIFY), floors, ceilings, rounding, EC threshold, missing rules, remittance deadlines by digit and fixed day with weekend moves, permit renewal planner, LGU data shapes, contribution parameter validation; seeded contribution rules, employer deadlines, and city processes parse; **Phase 10** (`marketplace.test.ts`): platform fee, contact-detail screening, directory filters.

**Database tests** (`scripts/db-test/`): applies every migration to a throwaway Postgres database with a small Supabase shim, then runs:

- `10_rls_assertions.sql`: signup trigger, publish guardrails, CPA gate, tax-rule overlap, anon/user/admin visibility, no role escalation, no forged consent.
- `20_admin_workflow_assertions.sql`: legal references must point at real records and can't cite news; `content_index` resolves child records to their parent page; audit trail logs inserts and status changes with the actor; anon can't flag; users can flag only as themselves and can't resolve flags or touch the audit log; admins can resolve.
- `30_public_guides_assertions.sql`: `slugify()` (ñ, punctuation), automatic and collision-safe office slugs, slug format, rate limiter counts per window and per key, and only the service role can call it or read its table.
- `40_planner_assertions.sql`: my documents and plans are owner-only (even admins can't read them), invalid statuses rejected, users can't write the AI log, month-to-date AI spend is service-role only and correct, deleting an account cascades to plans and tracked documents while reports remain unlinked.
- `50_community_ai_assertions.sql`: users can't self-approve tips, pending tips hidden and excluded from wait stats, median wait, trigram lookup (similar found, unrelated and other-document not), lookup and questions not readable by the public, live context readable but not writable by the public.
- `60_bantay_batas_assertions.sql`: unverified sources can't be activated, proposals need an existing target and a review timestamp once decided, the public sees only published issuances and approved proposals, non-admins can't add sources or approve proposals, alerts are private to their user.
- `70_freelancer_assertions.sql`: plaintext TIN refused, PHP amounts must match amount × rate, users can't create reminders, admins can't read finances, admins can't perform CPA reviews, CPAs can, editing a reviewed rule clears the review, a published rule can't change without one, account deletion removes financial data.
- `80_billing_assertions.sql`: price required before activation, users can't create payments or entitlements or call `apply_payment`, period stacking, upgrade carry-over, downgrade held, idempotency, owners can cancel but not extend.
- `85_negosyo_assertions.sql`: plaintext employee names refused, invalid periods refused, 10-business limit, other users can't read or attach to a business, admins can't read payroll, account deletion removes everything.
- `88_marketplace_assertions.sql`: no self-verification (insert or update), CPA listings need a license, pending listings and raw emails stay private, license edits re-queue review, requests private to the parties, requesters can't accept, reviews only after completion, contacts released only on acceptance and only to the parties, completion needs a final fee, platform fee recorded, rating summary, verification doesn't grant the `cpa` role.
- `95_security_audit.sql` (on the fully migrated, seeded database): RLS on every table, no anon write policies, `search_path` pinned on every security definer function, RLS-bypassing views only from the allowlist.
- `90_seed_check.sql` (separate database): seed applies cleanly, every row is a draft with a TO VERIFY note, exactly one region.

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm run test:db
# Also works against the local Supabase Postgres (port 54322); it creates its own throwaway databases.
```

**End-to-end tests** (237 defined; 159 run and 78 behavior tests are skipped on the tablet and desktop projects):

- `tests/e2e/mobile-layout.spec.ts`: 38 pages at 360, 768, and 1280px, checking for sideways scrolling, tap targets under 44px, inputs under 16px, dark mode, and the viewport settings. See [Mobile responsiveness](#mobile-responsiveness).
- `tests/e2e/public-flows.spec.ts` (needs `E2E_SAMPLE_DATA=1` and the sample fixture): guide content and AND/OR wording, drafts never shown, unverified seed records 404, stale warning, Filipino copy, finder filters and URL filters, map loads only on request, moved-office redirect, anonymous report flow, rate limit after 5 reports, honeypot.
- `tests/e2e/planner.spec.ts` (needs the fixture): wizard from a guide link through to Mga Diskarte (and the results screen fits 360px), purpose goal already satisfied, Filipino validation, situation page, guide → planner links, sign-in required for My documents, My plans, and data export.
- `tests/e2e/community.spec.ts` (fixture, AI off): approved tips and typical wait shown, pending hidden, tips need sign-in, Ano'ng bago? keeps groups apart and shows the conflict banner, cached Chika answer with label and grounded source, "resting" message for new questions, no plan-summary button, context API validation.
- `tests/e2e/monitoring.spec.ts`: the feed shows approved changes and published issuances only, topic filters, link to the updated guide; the cron endpoint refuses requests without the secret.
- `tests/e2e/freelancer.spec.ts`: business guides under `/business` (no work-schedule links, no cross-serving with `/ids`), freelancer hub and disclaimers, tools ask signed-out visitors to sign in, reminders cron refuses without the secret, CPA page requires sign-in.
- `tests/e2e/billing.spec.ts`: prices from the database, buying requires sign-in, billing requires an account, Marites Negosyo requires sign-in (both languages), the webhook rejects unsigned and forged requests.
- **Webhook integration** (`scripts/paymongo-webhook-smoke.mjs` against a running server, checked in the database): valid → applied (30-day entitlement), replay → duplicate, tampered body and wrong secret → 401, wrong amount → review, unknown payment → ignored.
- `tests/e2e/marketplace.spec.ts`: directory with the disclaimer and service filter, profile shows license and starting fee but never the contact email, quote requests need sign-in, unknown profiles are not found, account pages need sign-in.
- `tests/e2e/pwa.spec.ts`: manifest and PNG icons, `sw.js` not cached, security headers, a guide viewed online opens offline and an unvisited page shows the offline page, sign-out sends `Clear-Site-Data`, the public health check reveals only its status.
- The planner wizard exposes `data-ready="true"` once hydrated; tests wait for exactly one ready wizard before interacting (removed an intermittent race: 16/18 → 30/30 on repeated runs).
- `tests/e2e/layout.ts`: shared layout checker.

```bash
# With the sample fixture loaded in the database the app uses:
E2E_SAMPLE_DATA=1 npm run test:e2e
```

```bash
npx playwright install chromium   # once
npm run build
npm run test:e2e                  # starts `next start` on port 3100 with ENABLE_UI_PREVIEW=true
```

Gotcha: if a server is already running on port 3100, the suite reuses it. **Stop it before rebuilding** (this bit twice: in Phase 2 and again in Phase 5). An old server keeps serving HTML that points at the previous build's CSS files, so pages load unstyled and every layout check fails. (This happened during Phase 2 testing.)

Critical user-flow E2E tests (sign-in, wizard, plans) start in Phase 4 and are completed in Phase 11.

## 16. Security, privacy, and legal

**Phase 11 hardening:** security headers and CSP (see "Offline, performance, and launch"); a schema-wide audit (`scripts/db-test/95_security_audit.sql`) that fails if any table lacks RLS, anon can write anywhere, a security definer function lacks a pinned `search_path`, or a view bypasses RLS outside the allowlist (`cpa_directory`), proven by planting each problem; a browser-bundle secret scan (`npm run check:bundle`), proven with a planted key; device caches cleared on sign-out and account deletion.

**RA 10173 (Data Privacy Act) measures in Phase 1:**

- Consent at signup: sign-in is blocked until the user ticks a consent box linking to the Privacy Policy and Terms. The consent date and policy version (`PRIVACY_POLICY_VERSION` in `src/lib/legal.ts`) are recorded server-side and can't be forged by the user. The account page asks again if consent is missing or the policy version changed.
- Minimal data: email, optional display name, language, region/city. No phone number, birthday, or ID numbers.
- Privacy policy draft listing data collected, purposes, processors, retention, and rights.
- **Data export (Phase 4):** account page → "Download my data" (`/api/account/export`): profile, tracked documents, saved plans, and reports, as JSON, read with the user's own session.
- **Account deletion (Phase 4):** account page, typed confirmation. Uses the secret key (`auth.admin.deleteUser`); cascades to profile, tracked documents, and plans; reports stay without the user link. Without the secret key, users are told to email the contact address.
- **Location:** used only to compute distances for a plan; never stored (saved plans drop it).
- Encryption of sensitive financial fields: built in Phase 7 (`FIELD_ENCRYPTION_KEY`).

**Security measures:** all secrets server-only (`server-only` guard); env validated with Zod; RLS on every table; open-redirect protection on all sign-in redirects; sign-out is POST-only and rejects cross-origin requests; identity checked with `getClaims()` (verifies the JWT) rather than trusting cookies; DB errors are logged by code only, never with user data.

**Admin access (Phase 2):** admin pages and actions check `role = 'admin'` and show a 404 to everyone else; every write still goes through RLS with the admin's own session, so a missed check can't bypass the database. Roles can only be changed with the secret key or SQL editor. Status changes are recorded in an audit trail nobody can edit.

**Phase 7 financial data:** owner-only RLS; TIN, registered name and address, and entry notes encrypted with AES-256-GCM (`FIELD_ENCRYPTION_KEY`; tampering detected; without the key those fields are not saved); amounts stored in plain numbers so they can be computed, protected by RLS; reminder emails contain no amounts; financial data is never logged. Key rotation: decrypt with the old key and re-encrypt with the new one in a one-off script (not built yet).

**Phase 5 abuse controls:** Chika sa Pila 5 questions/hour per account or hashed IP; tips 5/day per account, sign-in required; tips with phone numbers, emails, messaging links, or contact offers are refused and never stored (`src/lib/community/moderation.ts`); every other tip waits for admin approval; the context API limits AI calls on cache misses to 20/hour per hashed IP.

**Rate limiting (built in Phase 3):** a table-based fixed-window limiter in Postgres (`hit_rate_limit`), called with the secret key. Reports: 5 per hour per account, or per salted IP hash for anonymous visitors. The same limiter will cover AI routes and tips (Phase 5). Auth endpoints rely on Supabase Auth's built-in limits.

**Reports:** honeypot field for bots; anonymous reports only when the limiter is available; IP addresses are hashed with `RATE_LIMIT_SALT` and never stored. The client IP comes from `X-Forwarded-For`, which Vercel sets; on another host, make sure a trusted proxy sets it, or clients could spoof it to dodge the limit.

**Disclaimers:** every page footer states that Marites PH is not affiliated with any government agency. The disclaimer page covers "information, not professional advice" (recommend a licensed CPA for tax), "verify before you go," and the unverified status of community content.

**Anti-fixer policy:** the footer states that anyone selling slots or "assistance" outside official channels is a fixer. Terms prohibit offering fixer services; such content is removed and accounts may be suspended. Automated moderation rules arrive with tips in Phase 5.

## 17. Known issues and limitations

- Legal pages are **drafts with placeholders** and have not been reviewed by a lawyer. Do not launch publicly until reviewed.
- **All seed data is unverified.** Nothing is published, so the public site shows no guides until you verify records (Phase 3 builds the guide pages).
- Filipino UI copy and legal summaries need native-speaker review. The admin panel is English-only by design.
- **AI has not been exercised against the live Anthropic API in development** (no key here). The client follows the documented Messages API and web search tool (`web_search_20250305`, `allowed_domains`, `max_uses`, results in `web_search_tool_result` blocks); test it with a small budget first.
- **PayMongo hasn't been called with real keys from development**: the Checkout request follows the documented v2 API; the webhook path was verified end to end with locally signed events. Rehearse in test mode before going live, and log one real test event to confirm its payload shape (two documented shapes are accepted).
- Prepaid only: no auto-renewal, proration, or in-app refunds.
- **Lighthouse results are medians from this development environment**; single runs vary (one Filipino-guide run scored 80). Re-measure on production.
- The CSP allows inline scripts (`'unsafe-inline'`) because pages are statically prerendered; external scripts are still blocked. Moving to nonces would make every page dynamic.
- Offline copies exist only for pages a person has opened while online; the service worker doesn't prefetch whole guide lists (prepaid data).
- **Marketplace signed-in flows** (listing, requests, acceptance, reviews) were verified through database tests (every permission and transition) and unit tests, not a signed-in browser session here. Payments between clients and professionals happen outside the app; platform fees are tracked, not charged.
- **Negosyo signed-in flows** (business, employees, remittances) were verified through unit and database tests, not a signed-in browser session here. Contribution amounts depend on rules a CPA must review first; until published, the page says so.
- Permit processes are matched by city name (case-insensitive), not a city code; LGU coverage starts with 3 cities.
- **Tax tools need published, CPA-reviewed rules**; until then the tax page says rules aren't published and only the tracker works. Signed-in flows (profile save, entries, encryption round trip through the database) were tested through unit and database tests, not end to end in a browser here.
- Philippine holidays aren't applied to due dates; mid-year rate changes aren't pro-rated; exchange rates are entered by the user (no rate feed).
- **Bantay Batas has not crawled a real government site from development** (this sandbox can't reach them). The real cron route was run end to end against the database (auth, crawl attempt, failure recorded). Verify each seeded source and do a first supervised run with "Run monitoring now".
- Source URLs can't be edited in place yet (remove and re-add). OCR for scanned PDFs is not built (marked `needs_ocr`).
- Regex-based listing parsers suit simple pages; a source with a complex layout may need its own parser.
- **Reddit and the live check:** results depend on what the search engine indexes; Reddit's own API (proactive monitoring) stays off behind `ENABLE_REDDIT_API` until its commercial terms are reviewed (Phase 6).
- If someone types into Chika sa Pila before the page finishes loading a `?doc=` link, the form re-mounts once and clears what they typed.
- Tips are office-level only in the UI (the table also supports document-level tips).
- **Planner assumptions** (schedule presets, one visit per document, travel speeds, urgency limits) are stated in section 10 and may need tuning with real users.
- Saved plans are snapshots; they don't update when content changes (the page says so and suggests making a new plan). Marites Alerts (Phase 8) will notify affected users.
- Choosing a city uses the average position of its offices as the starting point, so distances inside one city are rough.
- **Map tiles:** the map uses OpenStreetMap's public tile server, whose usage policy doesn't allow heavy commercial traffic. Before launch, switch the tile URL in `src/components/public/office-map.tsx` to a tile provider (or self-host).
- **Status codes for people:** hidden or missing pages show "Page not found" with `noindex` but an HTTP `200` for human visitors (crawlers get `404`/`308`). This is how Next 16 Cache Components streams; returning a request-time `404` for everyone would need a database lookup in the Proxy on every request.
- A requirement that points at an unpublished document shows "Another document (its guide is not available yet)". Publish the referenced document or use a free-text requirement.
- No `FAQPage` structured data: there's no FAQ content yet.
- Situation landing pages ("How to get X if you work 8 to 5") move to Phase 4, because they're generated from the planner.
- Deleting a never-verified draft doesn't delete legal references or flags pointing at it (polymorphic links). Remove those first.
- Admin lists load up to 500 records per page and queues up to 300 items; pagination comes when content grows past that.
- Admin pages were verified with the UI preview (sample data) and unit/database tests. They have not been exercised end to end against a live Supabase instance in this environment; do a manual pass (see Phase 2 test steps in the changelog).
- Without the custom email template (Deployment step 5), magic links only work in the same browser they were requested from.
- Brand icon and mascot are placeholders.
- `npm audit` reports moderate advisories in dev/build tooling from the Next.js scaffold; none are in runtime code paths we use. Re-check on each dependency update.
- Unknown locale paths (e.g. `/de`) redirect to `/en/de`, which shows a 404.
- The Docker-free DB test harness uses a minimal Supabase shim. `supabase db reset` against the real local stack remains the reference.
- `AGENTS.md` is generated and kept by `next dev`; commit it to keep the working tree clean.

## 18. Roadmap

- **All 11 build phases are complete.** Candidate next steps after launch: PayMongo subscriptions for card users, Philippine holiday calendar for due dates, more LGUs, OCR for scanned issuances, SMS reminders through a Philippine provider, editing source URLs in admin.

---

## Monitoring (Bantay Batas)

**Status: built (Phase 6).** Code: `src/lib/monitoring/`. AI never publishes: it drafts proposals; an admin approves every change.

**Pipeline** (`pipeline.ts`, run by `run.ts`):

1. **Fetch** active sources that are due (`crawl_frequency_hours`), oldest first, at most 3 per run, through the polite fetcher (`fetcher.ts`): user agent `CRAWLER_USER_AGENT (+mailto:CRAWLER_CONTACT_EMAIL)`, robots.txt honoured (cached per site per run; 401/403 on robots.txt = don't crawl), ≥ 3 s between requests to one site, 20 s timeout, 5 MB cap, no cookies or logins, official domains only (also after redirects).
2. **Detect**: skip unchanged listings (SHA-256 of the page); parse RSS/Atom or HTML links (`parsers.ts`, optional `linkPattern`); keep only links on `OFFICIAL_SEARCH_DOMAINS`; insert new URLs as issuances (max 30 per listing). Failures increase `failure_count` with the cause; 3 in a row raise an alert on Source health.
3. **Extract** (`extract.ts`): HTML to text; PDFs with unpdf. Under 200 characters: PDFs are marked `needs_ocr` (OCR is a later enhancement), HTML `failed`.
4. **Classify** (AI, `prompts/monitoring.ts`): type, issuing body, number, dates, topic, plain summary, and affected records chosen ONLY from a pre-ranked candidate list (`classify.ts`); ids outside the list are dropped. No web search: the model reads only the extracted text.
5. **Propose** (AI) for records with relevance ≥ 0.6: new values for factual fields only (never slugs, sources, or notes). The edited record must pass the same Zod schema as the admin form, or the proposal is dropped. No change needed → the link stays as legal context (relevance ≥ 0.3).
6. **Review** (Admin → Bantay Batas): issuance, extracted text, AI rationale, editable before/after diff. Approve re-checks that the record still has the "before" values (if someone edited it since, re-review), applies the values, stamps verification, attaches a **draft** legal reference (to verify its section), publishes the issuance to "Ano'ng Bago?", confirms the link, and creates `change_alerts` for users tracking the document. Tax records go to `needs_cpa` (Phase 7).
7. **Signals** (`signals.ts`, deterministic): approved tips over 30 days → long queues (3+ waits of 120+ min) and repeated extra requirements (2+ reports), for admins only.

**Where and when it runs:** Vercel Cron calls `/api/cron/monitor` daily at 21:00 UTC (5:00 AM Manila; `vercel.json`) with `CRON_SECRET`; each run stops within ~50 s and leaves the rest for the next run. Admins can also press **Run monitoring now**. Vercel's Hobby plan allows daily crons only; on Pro, raise the frequency in `vercel.json`. If runs regularly hit the time limit (many sources, large PDFs), move the job to a Supabase Edge Function or a scheduled GitHub Action calling the same endpoint (decision recorded here when made). With AI off, issuances are still collected and extracted and wait as `pending`.

**Add a source:** Admin → Source health → Add a source (inactive, TO VERIFY). Check the URL lists issuances, read the site's terms and robots.txt, set the parser and an optional link pattern, then "I checked it: activate" (the database refuses to activate a source with an open TO VERIFY note).

**Broken parser:** the alert shows the error (HTTP status, robots.txt, network cause). Open the page: if the layout changed, adjust the link pattern or switch parser; if the address moved, update it (remove and re-add for now); pause the source until fixed.

## Live context check

**Status: Planned (Phase 5).** When a user opens a guide, generates a plan, or uses Chika sa Pila, the app checks `live_context_cache`, and if expired searches official domains (`OFFICIAL_SEARCH_DOMAINS`, default `gov.ph`, 24-hour cache) and community domains (`COMMUNITY_SEARCH_DOMAINS`, default `reddit.com`, 12-hour cache) for anything newer than the content's `last_verified_at`. Results are shown in two never-mixed groups: "Official updates" and "Chika sa Pila — community experience, unverified." A possibly conflicting official result shows the banner "May posibleng bagong update — i-verify muna bago pumunta" and auto-creates a content flag. When the AI budget is reached, cached results are shown or the panel is hidden.

## Source hierarchy and conflict rules

Used in all AI prompts and shown to users:

1. Laws (Republic Acts) and the Constitution
2. Implementing rules and regulations, executive orders
3. Agency issuances (revenue regulations, memorandum circulars, department orders)
4. Official agency advisories and announcements
5. Reputable news reports
6. Community posts (Reddit), always labeled unverified

Newer official issuances supersede older ones on the same subject. Community content never overrides official content; it only adds practical context. AI never auto-publishes changes.

## Official source registry

Seeded candidates (`supabase/seed.sql`), all **inactive and TO VERIFY** until checked:

| Source | URL | Type | Topic | Every | Status |
|---|---|---|---|---|---|
| Official Gazette (feed) | https://www.officialgazette.gov.ph/feed/ | RSS | General | 24 h | TO VERIFY: feed, terms, robots.txt |
| DFA passport advisories | https://consular.dfa.gov.ph/ | HTML list | IDs | 24 h | TO VERIFY: listing page, link pattern |
| PSA press releases and advisories | https://psa.gov.ph/ | HTML list | IDs | 24 h | TO VERIFY: listing page, link pattern |
| NBI clearance announcements | https://clearance.nbi.gov.ph/ | HTML list | IDs | 48 h | TO VERIFY: where announcements are, robots.txt |
| PHLPost announcements | https://phlpost.gov.ph/ | HTML list | IDs | 48 h | TO VERIFY: listing page |
| BIR revenue issuances | https://www.bir.gov.ph/ | PDF list | Tax | 24 h | TO VERIFY: issuances listing, PDF pattern (Phase 7) |

The live list (with crawl status) is in Admin → Source health.

## Crawling and platform compliance

Implemented in Phase 6 (`src/lib/monitoring/fetcher.ts`, `robots.ts`): identification, robots.txt, per-site spacing, timeouts, size caps, no logins, official domains only. Decisions (recorded 2026-11-11, from the project addendum):

- Respect robots.txt and site terms; identify the crawler with `CRAWLER_USER_AGENT` and `CRAWLER_CONTACT_EMAIL`; rate-limit per domain; cache aggressively; never bypass logins or paywalls.
- **Facebook: not scraped.** Agency announcements on Facebook are handled as admin-entered or user-submitted advisory links unless an approved official API is used.
- **Reddit:** query-time web search restricted to reddit.com only; store short summaries and links, never thread text. Proactive monitoring through Reddit's official API stays behind `ENABLE_REDDIT_API=false` until its commercial-use terms are reviewed and documented here.

## Change review workflow

**Status: built (Phase 6).** See step 6 of the pipeline above. Proposals: `open` → `approved` | `rejected`; tax records → `needs_cpa` until a CPA reviews them (Phase 7). Rejected proposals keep their link as legal context unless the link is also marked "Not related".

## Alerts

**Status: records built (Phase 6); delivery in Phase 8.** On approval, every user who tracks the affected document in My documents (any status; the parent document for requirements and steps) gets a `change_alerts` row with the change's public summary. Phase 8 sends them (email, later SMS) to paid "Marites Alerts" users and marks `sent_at`.

---

## 19. Changelog

### 2026-11-21 — Phase 11: Launch readiness

**What changed**
- Installable app: manifest, generated icons, service worker (offline guides, offices, planner, feed, saved plans), offline page; `Clear-Site-Data` on sign-out and after account deletion.
- Security headers and CSP; schema-wide security audit; browser-bundle secret scan; `/api/health`; `npm run launch:check`; optional cookieless analytics (`@vercel/analytics` 2.0.1).
- Performance: Zod removed from browser bundles (`hours-core.ts`), no prefetch on site-wide links; Lighthouse mobile medians 93 / 90 / 97 (guide EN, guide FIL, home), accessibility, best practices, and SEO 100.
- Planner wizard exposes `data-ready` after hydration; tests wait for it.
- Bugs found: app icons were caught by the locale proxy (404); the security audit file wasn't run by the test runner; `upgrade-insecure-requests` would break http://localhost; Zod in guide bundles (performance and a CSP report); an intermittent planner test race.

**New migration:** none. **New env vars:** `NEXT_PUBLIC_ANALYTICS` (optional). **New dependency:** `@vercel/analytics` 2.0.1.

**Manual steps after deploying:** work through the launch checklist in "Offline, performance, and launch"; run `npm run launch:check` with production settings and `npm run check:bundle` after the production build; measure Lighthouse on the live URL.

**How to test Phase 11 manually**
1. On an Android phone: open a guide, add to home screen, turn on airplane mode, reopen the guide (works), open an unvisited guide (offline page).
2. Sign in, open a saved plan, sign out: the saved plan no longer opens offline.
3. `curl -I` the site: security headers present. `curl /api/health`: `{"status":"ok"}`.

### 2026-11-20 — Phase 10: CPA marketplace

**What changed**
- Directory and profiles (`/[locale]/cpas`), professional listings (`/[locale]/account/listing`), quote requests (`/[locale]/account/quotes`), Admin → Marketplace (verify listings, moderate reviews, platform fees, fee rate).
- Database-enforced flow: listing verification by admins only, private requests with per-side transitions, contacts released on acceptance, reviews after completion, platform fees recorded on completion.
- Header link "Find a CPA"; account links to quote requests; sitemap entry.
- Bugs found: the quote request policy checked listings the requester can't read (no one could ever request a quote; fixed with `is_verified_listing()`); professionals couldn't read the fee rate (public read added); one E2E test matched the hidden previous page after client navigation.

**New migration:** `20261120000100_marketplace.sql`. **New env vars:** none. **New dependencies:** none.

**Manual steps after deploying**
1. `supabase db push`.
2. Decide the platform fee rate (default 0%) and set it in Admin → Marketplace; add it to the terms of use.
3. Invite a few professionals to apply; verify each license on the PRC online verification service before verifying their listing.
4. Have your lawyer review the marketplace disclaimer and terms (Marites PH isn't party to engagements).

**How to test Phase 10 manually**
1. Account A applies as a CPA; as admin, verify it; it appears at `/en/cpas`.
2. Account B requests a quote; A accepts with a reply and fee; both see each other's email on their quotes page.
3. A completes it with a final fee; check the platform fee in admin; B leaves a review; the rating shows on the profile.
4. Try a message with a phone number: refused.

### 2026-11-19 — Phase 9: Marites Negosyo

**What changed**
- Marites Negosyo (`/[locale]/negosyo`, Negosyo plan): up to 10 businesses with encrypted registration numbers; employees with encrypted names; monthly SSS, PhilHealth, and Pag-IBIG contributions; remittance deadlines and records; permit renewal planner per city.
- Engines: `contributions.ts` (rates from rule rows), `lgu.ts` (data shapes, renewal planner), monthly remittance due rules in `tax.ts`.
- Admin → LGU processes; `employer` deadlines; contribution rule keys validated in the tax rule form.
- Seed: DTI, SSS, PhilHealth, Pag-IBIG; 4 business guides; 3 contribution rules and 3 remittance deadlines (TO VERIFY WITH CPA); renewal processes for Quezon City, Manila, Makati; 3 city sources (inactive).
- Pricing copy for Negosyo now lists the real features.
- Bugs found: the business page awaited request-time params outside Suspense (build error; fixed with the /plans/[id] pattern); two test-only issues.

**New migration:** `20261119000100_negosyo.sql`. **New env vars:** none. **New dependencies:** none.

**Manual steps after deploying**
1. `supabase db push`; load the Phase 9 part of `seed.sql` if your database was seeded earlier.
2. Verify and publish the business guides; verify the city renewal processes with each city hall's site; have your CPA review the contribution rules and remittance deadlines, then publish.
3. Activate the city advisory sources once checked (Admin → Source health).

**How to test Phase 9 manually**
1. With a Negosyo plan (grant one in Admin → Billing): add a business in a city with a published process; check the deadline, checklist, and fees.
2. Add an employee with a ₱18,000 salary; compare the contributions with the worked example in `tests/unit/negosyo.test.ts` (after the rules are published).
3. Enter the SSS due-date digit; check last month's due date; record a remittance.
4. As another account, open the first business's URL: not found.

### 2026-11-18 — Phase 8: Payments and entitlements

**What changed**
- Plans with prices from the database (`subscription_plans`, Admin → Billing); `/[locale]/pricing`.
- PayMongo v2 Checkout (prepaid 1/3/6/12 months; GCash, Maya, cards, QR Ph); signed, idempotent webhook with mode and amount checks; `apply_payment()` as the only path to access.
- Entitlements decide paid access (`requirePlan`); Marites Freelancer requires a plan (Negosyo includes it); upgrade prompts.
- `/[locale]/account/billing`: plan, end date, history, stop renewal reminders, Marites Alerts, account ID.
- Daily notifications cron also sends Marites Alerts (paid users, last 7 days) and renewal reminders.
- Admin → Billing: prices, activation, payments, complimentary grants. `scripts/paymongo-webhook-smoke.mjs`.
- Bugs found: billing table name collided with the planner's `plans` (renamed `subscription_plans`); message parity test didn't type arrays; an E2E expectation used the wrong peso format.

**New migration:** `20261118000100_billing.sql`. **New env vars (now read):** `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET`, `PAYMONGO_PAYMENT_METHODS`. **New dependencies:** none.

**Manual steps after deploying**
1. `supabase db push`.
2. PayMongo: KYC, test keys, webhook for `checkout_session.payment.paid` → `/api/webhooks/paymongo`; set `PAYMONGO_SECRET_KEY` and `PAYMONGO_WEBHOOK_SECRET` in Vercel.
3. Decide prices; set them in Admin → Billing and activate the plans.
4. Rehearse a test-mode purchase end to end; then switch to live keys and a live webhook.
5. Freelancer-preview users now need a plan: grant complimentary access to testers in Admin → Billing.

**How to test Phase 8 manually**
1. Test mode: buy 1 month, pay with a test method, return to Billing, see the plan within a minute.
2. Resend the webhook from the PayMongo dashboard: no second extension.
3. Run the smoke script with `--tamper` (401) and a wrong `--amount` (payment shows "review" in Admin → Billing).

### 2026-11-17 — Phase 7: Freelancer compliance

**What changed**
- Tax engine (`src/lib/engines/tax.ts`): 8% vs graduated (+ percentage tax), mixed income, quarterly cumulative method, filing calendar; every number from effective-dated rules; results list rules used and CPA status.
- Marites Freelancer (`/[locale]/freelancer`, preview for signed-in users): taxpayer profile (TIN, registered name and address encrypted), income and expense tracker with foreign currency, tax computation, filing calendar with walkthrough links.
- Business guides under `/[locale]/business` (guide page factory shared with `/ids`), new document type `filing`; seeded BIR guides (drafts, TO VERIFY).
- Tax rules and deadlines in admin (JSON parameters validated per rule key); CPA review page; database-enforced CPA-only review; editing clears reviews; Bantay Batas tax proposals need a CPA.
- Filing reminder emails (daily cron `/api/cron/reminders`, Resend HTTP API); SMS provider interface (stub).
- Seed: BIR agency, 4 guides, 5 tax rules, 3 deadlines (TO VERIFY WITH CPA).
- Bugs found: an inner component in the tracker page (lint); the seed check's document count.

**New migration:** `20261117000100_freelancer.sql`. **New env vars (now read):** `FIELD_ENCRYPTION_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`. **New dependencies:** none.

**Manual steps after deploying**
1. `supabase db push`; load the Phase 7 part of `seed.sql` if your database was seeded earlier.
2. In Vercel: `FIELD_ENCRYPTION_KEY` (`openssl rand -base64 32`, keep a backup), `RESEND_API_KEY`, `EMAIL_FROM` (verified sender). The reminders cron uses the existing `CRON_SECRET`.
3. Give your CPA an account with `role = 'cpa'`; have them review the seeded tax rules and deadlines (after you verify them), then publish.
4. Verify and publish the four BIR guides.

**How to test Phase 7 manually**
1. Sign in, open `/en/freelancer/profile`, save a profile with a TIN; check in the database that `tin_enc` starts with `v1:` (never plaintext).
2. Add income in USD with a rate; check the PHP amount and quarter totals.
3. With CPA-reviewed published rules: open Tax computation; compare with a worked example from `tests/unit/tax.test.ts`; change numbers to see both options.
4. Turn on email reminders; run `/api/cron/reminders` with the secret near a deadline; check the email and the `reminders` row.
5. As a CPA account: review a verified rule at `/en/cpa`; as an admin, confirm you can't.

### 2026-11-16 — Phase 6: Bantay Batas monitoring

**What changed**
- Monitoring pipeline (`src/lib/monitoring/`): polite fetcher (robots.txt, user agent with contact, ≥3 s per site, timeouts, size caps, official domains only), RSS/Atom/HTML/PDF listings, text extraction (unpdf), AI classification limited to candidate records, AI change proposals validated against the admin form schemas.
- Vercel Cron (`vercel.json`, daily 5:00 AM Manila) → `/api/cron/monitor` (requires `CRON_SECRET`); admin "Run monitoring now".
- Admin: Bantay Batas review queue (editable diff, stale-proposal check, approve → apply + verify + draft legal reference + publish + alerts), Source health (alerts after 3 failures, add/activate/pause/remove), Community signals.
- Public "Ano'ng Bago?" feed (`/[locale]/ano-ng-bago`) with topic filters; header link; sitemap entries for the feed, planner, and Chika.
- Seed: 6 candidate official sources, inactive and TO VERIFY.
- Bugs found: HTML extraction left stray spaces at line starts; fetch errors were logged as a bare "TypeError" (now include the network cause).

**New migration:** `20261116000100_bantay_batas.sql`. **New env vars (now read):** `CRON_SECRET`, `CRAWLER_USER_AGENT`, `CRAWLER_CONTACT_EMAIL`. **New dependency:** `unpdf` 1.9.1 (PDF text; chosen over the 2.0.0 release, which was under three weeks old).

**Manual steps after deploying**
1. `supabase db push`; load the source candidates from `seed.sql` (the last insert) if your database was seeded before Phase 6.
2. In Vercel: set `CRON_SECRET` (16+ random characters), `CRAWLER_USER_AGENT`, `CRAWLER_CONTACT_EMAIL`. Cron jobs run on production deployments only.
3. Verify and activate sources one by one in Admin → Source health; press "Run monitoring now" and check the results before relying on the schedule.
4. With AI configured, review the first proposals carefully; reject anything not clearly stated in the issuance.

**How to test Phase 6 manually**
1. With the fixture: open `/en/ano-ng-bago` (one approved change, one issuance; topic filters).
2. In admin: add a source for an official listing page, activate it, press "Run monitoring now"; check Source health and Bantay Batas → Recent issuances.
3. With AI on: wait for a proposal, edit a value, approve; check the record, its new draft legal reference, and the feed.
4. Call `/api/cron/monitor` without the secret: 401.

### 2026-11-15 — Phase 5: Chika sa Pila, live context check, AI layer

**What changed**
- AI layer (`src/lib/ai/`): Anthropic SDK 1.3.0, server only; off unless fully configured; monthly budget cap with usage logging; prompts with the Marites voice and source hierarchy; link grounding (a cited link must come from the model's own web search, on an allowed domain).
- Chika sa Pila troubleshooter (`/[locale]/chika`): cache of similar questions (trigram), Reddit-restricted search, labeled unverified, grounded sources, official channel guidance, rate-limited.
- "Ano'ng bago?" on guide pages (`/api/context`): official and community results kept apart and cached; possible conflicts show a banner and create a system flag for admins.
- Community tips on office pages with anti-fixer rules (contact details refused, never stored), admin approval queue (`/admin/tips`), typical wait (3+ reports), waits fed into office ranking.
- "Ipaliwanag ni Marites": optional AI plan summary, validated, hidden when AI is off.
- Admin dashboard: AI spend this month vs budget; pending tips.
- Bugs found: malformed AI settings crashed instead of turning AI off; E2E runs hit a stale server again (documented).

**New migration:** `20261115000100_community_ai.sql`. **New env vars:** `AI_INPUT_USD_PER_MTOK`, `AI_OUTPUT_USD_PER_MTOK`, `AI_WEB_SEARCH_USD_PER_1K` (plus the existing `ANTHROPIC_*`, `AI_MONTHLY_BUDGET_USD`, search domains, and TTLs, now read). **New dependency:** `@anthropic-ai/sdk` 1.3.0 (chosen over newer releases under two weeks old).

**Manual steps after deploying**
1. `supabase db push`.
2. To turn AI on, set in Vercel: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (a model that supports web search), `AI_MONTHLY_BUDGET_USD` (start small), and the three prices from Anthropic's pricing page. Leave unset to keep AI off; everything else works.
3. Check the admin dashboard's AI card after a few days of traffic.
4. Moderate tips in Admin → Tips.

**How to test Phase 5 manually**
1. With the sample fixture: open `/en/ids/sample-certificate` (conflict banner, two separate groups), `/en/offices/sample-city/sa/sample-office-main` (tips, typical wait), `/en/chika?doc=sample-id` (ask about a misspelled name: cached answer).
2. With AI configured and a small budget: ask a new Chika question; check the answer's links open real threads; check `ai_usage_log` and the dashboard card.
3. Submit a tip containing a phone number (refused) and a normal tip (appears in Admin → Tips); approve it and see it on the office page.

### 2026-11-14 — Phase 4: "Ano'ng Lakad Mo?" wizard and planner

**What changed**
- Engines (`src/lib/engines/`): dependency engine (OR-groups, "need an ID to get an ID" loops, purposes, critical-path processing time), office ranking (free-time overlap, distance, walk-in, freshness, waits, with reasons), plan engine (fastest / no leave / cheapest / fewest trips, merged when identical, recommendation with reasons, risks). Pure and unit-tested.
- Wizard `/[locale]/lakad` (4 steps, starts from a guide with `?goal=`), "Mga Diskarte" results, save plan (signed in; recomputed on the server; location never stored).
- Situation landing pages `/[locale]/ids/[slug]/{for-8-to-5-workers,for-night-shift-workers,on-weekends}`, linked from every guide.
- My documents `/[locale]/my-documents` (prefills the wizard) and My plans `/[locale]/plans`.
- RA 10173: data export (`/api/account/export`, JSON) and self-service account deletion on the account page.
- Header: "Ano'ng Lakad Mo?" link. Guide pages: planner call-to-action and situation links.
- Bugs found during testing: the no-leave option claimed to be available when no office opened during free time (now falls back to the best office and marks the leave needed); plans said "0 km" and "0 minutes" for a city's own office.
- Deferred: the optional AI plan summary moves to Phase 5 with the shared AI layer.

**Files affected:** `src/lib/engines/**`, `src/lib/planner/**`, `src/lib/me/**`, `src/components/planner/**`, `src/components/me/**`, `src/app/[locale]/{lakad,plans,my-documents}/**`, `src/app/[locale]/ids/[slug]/[situation]/page.tsx`, `src/app/[locale]/ids/[slug]/page.tsx`, `src/app/[locale]/account/page.tsx`, `src/app/api/account/export/route.ts`, `src/lib/content/public.ts`, `src/components/site-header.tsx`, `src/i18n/messages/*.json`, `supabase/migrations/20261114000100_planner.sql`, `scripts/db-test/40_planner_assertions.sql`, `tests/unit/engines.test.ts`, `tests/e2e/{planner.spec.ts,layout.ts,mobile-layout.spec.ts}`, `README.md`, `FILES.md`.

**New migration:** `20261114000100_planner.sql`.

**New env vars:** none. `SUPABASE_SECRET_KEY` now also enables self-service account deletion.

**New dependencies:** none.

**Manual steps after deploying**
1. `supabase db push` (adds `user_documents`, `plans`, `ai_usage_log`).
2. Make sure `SUPABASE_SECRET_KEY` is set in Vercel, or account deletion falls back to "email us".
3. Update the privacy policy draft to mention saved plans and tracked documents (section "What we collect" already covers them generally; confirm with your lawyer).

**How to test Phase 4 manually**
1. With the sample fixture loaded, open `/en/ids/sample-id` and tap "Make my own plan". Answer the steps; check Mga Diskarte shows a recommendation, steps, and an office open during your free time.
2. Repeat with "Night shift" and "2 or more" leave days; the recommendation and offices change.
3. Sign in, tick a document in My documents as "I have this", start a new plan: it's pre-ticked.
4. Save a plan; open it from My plans; delete it.
5. Account page: download your data; delete a test account.
6. Open `/en/ids/sample-id/for-8-to-5-workers`.

### 2026-11-13 — Phase 3: Public ID guides and office finder

**What changed**
- Public guide pages (`/[locale]/ids`, `/[locale]/ids/[slug]`): "Verified ni Marites" stamp using the oldest verification date on the page, "may be outdated" warning, quick facts (fee, processing, validity, accepted purposes), requirements in plain AND/OR wording, steps, where to apply, "Bakit ganito?" legal basis, official sources, report button, disclaimer.
- Office finder (`/[locale]/offices`) with filters, sort by distance, open-now in Manila time, and a Leaflet/OpenStreetMap map loaded only on request; city/agency pages and office pages with hours, directions, services, and legal basis. Moved offices redirect to their new URL.
- "Report outdated info" on guide and office pages: rate-limited (5/hour), honeypot, anonymous (salted IP hash) or signed in; reports go to the admin Flags queue.
- SEO: static pages refreshed on publish (cache tag `content`, `updateTag` in admin actions), `sitemap.xml` with hreflang for both languages, `robots.txt`, HowTo / BreadcrumbList / GovernmentOffice JSON-LD, canonical + hreflang + `x-default` on every page, branded Open Graph images.
- Header: section links to "IDs & documents" and "Office finder". Home page lists published guides.
- Admin: office URL slugs, "View public page" link, public cache updated on every change.
- Sample fixture `tests/fixtures/sample-published.sql` (fake data) for local development and E2E.
- Bugs found and fixed during testing: Open Graph stamp used an unsupported CSS border style (build failure); office address repeated the city; breadcrumb "Home" link under 44px; fixture IDs used non-hex characters.

**Files affected:** `src/app/[locale]/{ids,offices}/**`, `src/app/[locale]/opengraph-image.tsx`, `src/app/{sitemap,robots}.ts`, `src/app/[locale]/page.tsx`, `src/components/public/**`, `src/components/{site-header,json-ld}.tsx`, `src/lib/content/{public,offices}.ts`, `src/lib/seo/**`, `src/lib/report/**`, `src/lib/{rate-limit,slug,format}.ts`, `src/lib/supabase/{public,service}.ts`, `src/lib/env.server.ts`, `src/lib/admin/{actions,resources,schemas}.ts`, `src/app/[locale]/admin/[resource]/[id]/page.tsx`, `src/i18n/messages/*.json`, `supabase/migrations/20261113000100_public_guides.sql`, `scripts/db-test/*`, `tests/**`, `package.json`, `.env.example`, `README.md`, `FILES.md`.

**New migration:** `20261113000100_public_guides.sql`.

**New env vars:** `RATE_LIMIT_SALT` (server), `E2E_SAMPLE_DATA` (tests). `SUPABASE_SECRET_KEY` is now used (rate limiter, anonymous reports).

**New dependencies:** `leaflet` 1.9.4, `@types/leaflet` 1.9.21 (dev).

**Manual steps after deploying**
1. `supabase db push` (adds office slugs and the rate limiter).
2. In Vercel, set `SUPABASE_SECRET_KEY` and `RATE_LIMIT_SALT` (server-only) to allow anonymous reports. Without them, visitors are asked to sign in to report.
3. Set `NEXT_PUBLIC_SITE_URL` to the production domain (used in the sitemap, canonical URLs, and share images).
4. After the first guides are published, submit `https://<your-domain>/sitemap.xml` in Google Search Console.
5. Before launch, move the map to a commercial tile provider (see Known issues).
6. Do not load `tests/fixtures/sample-published.sql` into production.

**How to test Phase 3 manually**
1. Locally, load the sample fixture (section 7) and open `/en/ids/sample-id`: check the stamp, the "Bring ONE of these choices" group, the legal basis, and the offices.
2. Open `/en/ids/sample-certificate`: the "may be outdated" warning appears (verified 200 days ago).
3. In admin, unpublish Sample ID, then reload the guide: it's gone. Publish it again: it's back.
4. Open `/en/offices`, tick "Open on weekends" (1 result), tap "Show map".
5. Send a report from a guide page, then find it in admin → Flags.
6. Check `/sitemap.xml` and `/robots.txt`.

### 2026-11-12 — Phase 2: Admin content system + mobile responsiveness

**What changed**
- Admin panel at `/[locale]/admin`, admins only (others get a 404): dashboard, list/create/edit for agencies, documents, offices; on a document page, requirements (grouped by AND/OR), guide steps, accepted purposes, legal basis, and history; on an office page, services, legal basis, and history.
- Verification workflow: draft → verified → published → archived, enforced in the app (`workflow.ts`) and the database. Editing a fact on a live record sends it back to draft unless the admin confirms re-verification.
- Queues: TO VERIFY, ready to publish, stale content with one-tap re-verify, flag review, sources.
- New tables: `legal_references`, `content_flags`, `verification_events`; new `content_index` view.
- Seed: 4 IDs + PSA birth certificate, 4 agencies, 16 requirements, 15 guide steps, 5 accepted purposes, 6 NCR offices with services, 5 legal references. All drafts, all TO VERIFY.
- Mobile responsiveness as a tracked feature: safe-area support for notched phones, compact header (FIL/EN code on small screens), responsive admin lists (cards on phones), scrollable admin nav, phone-friendly hours editor, and a Playwright suite checking 10 pages at 360/768/1280px.
- Bugs found and fixed by the new checks: brand truncated in the Filipino header at 360px; status pills stretching full width; hours editor overflowing at 768px (fieldset min-content width); `usePathname()` outside Suspense (build error on dynamic routes) in the admin nav and language switcher; Zod `z.uuid()` rejecting the seed's version-0 IDs (switched to `z.guid()`); DB test harness failing when roles already exist.
- `FILES.md`: manifest of every file with the phase that introduced it.

**Files affected:** `src/app/[locale]/admin/**`, `src/app/[locale]/ui-preview/page.tsx`, `src/components/admin/**`, `src/lib/admin/**`, `src/lib/content/{hours,requirements}.ts`, `src/components/{site-header,user-nav,locale-switcher,site-footer}.tsx`, `src/app/[locale]/layout.tsx`, `src/app/globals.css`, `src/i18n/messages/*.json`, `supabase/migrations/20261112000100_admin_workflow.sql`, `supabase/seed.sql`, `scripts/db-test/*`, `tests/unit/*`, `tests/e2e/*`, `playwright.config.ts`, `package.json`, `.env.example`, `.gitignore`, `README.md`, `FILES.md`.

**New migration:** `20261112000100_admin_workflow.sql`.

**New env vars:** `ENABLE_UI_PREVIEW` (dev/test only), `PLAYWRIGHT_CHROMIUM_PATH` (optional, CI/sandbox only).

**New dependency:** `@playwright/test` 1.64.1 (dev).

**Manual steps after deploying**
1. `supabase db push` to apply the new migration.
2. Make your account an admin (SQL in section 7).
3. Optional: load the draft seed into production by running `supabase/seed.sql` once in the SQL editor.
4. Do not set `ENABLE_UI_PREVIEW` in Vercel.

**How to test Phase 2 manually**
1. `supabase db reset`, sign in, make yourself admin, open `/en/admin`. The dashboard should show 62 open TO VERIFY items and 0 published.
2. Open Documents → Philippine Passport. Requirements show "Valid id: required, any one of 3 options".
3. Try **Mark verified**: it's refused (TO VERIFY note). Clear the note and save, then mark verified, then publish.
4. Edit the fee without ticking the re-verify box: the record returns to draft with a notice. Repeat with the box ticked: it stays published with today's date.
5. Add a legal reference with source type rank 1; check it appears under Legal basis and in History.
6. Open the admin on your phone (or a 360px browser window): lists show as cards, nav scrolls sideways, forms are one column.

### 2026-11-11 — Phase 1: Foundation

**What changed**
- Scaffolded Next.js 16.4.6 (App Router, TypeScript, Cache Components), Tailwind 4, shadcn/ui conventions.
- i18n: `/en` and `/fil` routing with Accept-Language and cookie negotiation, hreflang, server-only dictionaries, all brand copy in message files.
- Base layout: header (language switcher, light/dark toggle, sign-in), footer (non-affiliation and anti-fixer statements), skip link, "Verified ni Marites" stamp component, placeholder brand icon.
- Auth: email magic link + Google via Supabase, consent checkbox required, consent recorded server-side, same-browser (`/auth/callback`) and cross-device (`/auth/confirm`) magic links, POST-only sign-out.
- Pages: home (placeholder, no government facts), login, account, 404, draft privacy policy, terms, disclaimer.
- Schema: content tables and profiles with RLS and database-enforced publish guardrails.
- Tests: 30 unit tests; Docker-free migration + RLS test harness.
- README with all required sections; `.env.example`.

**Files affected:** `src/**`, `supabase/migrations/*`, `supabase/seed.sql`, `scripts/db-test/*`, `tests/**`, `vitest.config.mts`, `components.json`, `package.json`, `.env.example`, `.gitignore`, `README.md`.

**New migrations:** `20261111000100_foundation.sql`, `20261111000200_profiles_and_auth.sql`, `20261111000300_content.sql`.

**New env vars:** `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_CONTACT_EMAIL`, `CONTENT_STALE_DAYS`.

**Manual steps after deploying**
1. Create the Supabase project and run `supabase db push`.
2. Configure Google OAuth, Site URL, and redirect URLs (Deployment steps 3–4).
3. Update the Magic Link and Confirm signup email templates (Deployment step 5).
4. Set Phase 1 env vars in Vercel for Production and Preview.
5. Fill in the bracketed placeholders in `src/content/legal/*.ts` and get them reviewed before public launch.
