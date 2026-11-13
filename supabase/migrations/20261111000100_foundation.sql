-- =============================================================================
-- Marites PH — Migration 1: foundation (extensions, enums, shared helpers)
-- =============================================================================
-- Conventions used by every later migration:
--   * Every table has RLS enabled. No exceptions.
--   * Government facts live in content tables with: status, source_url,
--     last_verified_at, verified_by, to_verify_note.
--   * A row can only be 'published' if it has a source_url and last_verified_at
--     (enforced with CHECK constraints in the content migration).
--   * to_verify_note is NOT NULL while a fact is still unconfirmed. The admin
--     panel (Phase 2) and README list every row where it is set.
-- =============================================================================

-- btree_gist lets us forbid overlapping effective-date ranges on tax rules.
create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- Verification workflow for all admin-managed content.
--   draft     -> entered, not yet checked against the official source
--   verified  -> checked by an admin against source_url, not yet public
--   published -> publicly visible
--   archived  -> kept for history, hidden from the public
create type public.content_status as enum ('draft', 'verified', 'published', 'archived');

create type public.document_type as enum (
  'id', 'certificate', 'clearance', 'registration', 'permit', 'other'
);

create type public.user_role as enum ('user', 'admin', 'cpa');

create type public.app_locale as enum ('en', 'fil');

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at current
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger helper: sets updated_at = now() on every UPDATE.';
