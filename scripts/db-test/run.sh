#!/usr/bin/env bash
# Applies all migrations to a throwaway Postgres database (with a Supabase
# shim) and runs the RLS/guardrail assertions.
#
# Usage: DATABASE_URL=postgres://user:pass@localhost:5432/postgres scripts/db-test/run.sh
# Requires: psql, a Postgres 15+ server you can create databases on.
# This is a fast, Docker-free check. The real reference is `supabase db reset`.
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to a Postgres server you can create databases on}"
DB="marites_migration_test_$$"
SEED_DB="marites_seed_test_$$"
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"

psql "$DATABASE_URL" -qc "create database $DB"
trap 'psql "$DATABASE_URL" -qc "drop database if exists $DB" >/dev/null; psql "$DATABASE_URL" -qc "drop database if exists $SEED_DB" >/dev/null' EXIT
TEST_URL="${DATABASE_URL%/*}/$DB"

psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f "$DIR/00_supabase_shim.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "applying $(basename "$f")"
  psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f "$f"
done
# Assertion files run in order on the same database (later files reuse fixtures).
for f in "$DIR"/[1-8]*_assertions.sql; do
  echo "running $(basename "$f")"
  psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f "$f"
done

# Seed check on a separate database, so fixtures above don't interfere.
psql "$DATABASE_URL" -qc "create database $SEED_DB"
SEED_URL="${DATABASE_URL%/*}/$SEED_DB"
psql "$SEED_URL" -q -v ON_ERROR_STOP=1 -f "$DIR/00_supabase_shim.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do psql "$SEED_URL" -q -v ON_ERROR_STOP=1 -f "$f"; done
echo "applying seed.sql"
psql "$SEED_URL" -q -v ON_ERROR_STOP=1 -f "$ROOT/supabase/seed.sql"
psql "$SEED_URL" -q -v ON_ERROR_STOP=1 -f "$DIR/90_seed_check.sql"
# Schema-wide security audit on the fully migrated, seeded database.
psql "$SEED_URL" -q -v ON_ERROR_STOP=1 -f "$DIR/95_security_audit.sql"
