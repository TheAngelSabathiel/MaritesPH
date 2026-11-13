-- Phase 11 security audit over the whole schema (fails on regressions):
--   every public table has RLS; anon can't write anywhere; security definer
--   functions pin search_path; views that bypass RLS are an explicit allowlist.
\set ON_ERROR_STOP on
do $$
declare r record; bad text := '';
begin
  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity loop
    bad := bad || r.relname || ' ';
  end loop;
  if bad <> '' then raise exception 'FAIL: tables without RLS: %', bad; end if;

  for r in select table_name, privilege_type from information_schema.role_table_grants
           where grantee = 'anon' and table_schema = 'public' and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE') loop
    -- A grant alone is harmless only if no policy lets anon write; check policies.
    if exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = r.table_name
               and ('anon' = any (p.roles) or 'public' = any (p.roles)) and p.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')) then
      bad := bad || r.table_name || ':' || r.privilege_type || ' ';
    end if;
  end loop;
  if bad <> '' then raise exception 'FAIL: anon can write: %', bad; end if;

  for r in select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prosecdef
             and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%') loop
    bad := bad || r.proname || ' ';
  end loop;
  if bad <> '' then raise exception 'FAIL: security definer functions without search_path: %', bad; end if;

  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'v'
             and not coalesce((select option_value = 'true' from pg_options_to_table(c.reloptions) where option_name = 'security_invoker'), false)
             and c.relname not in ('cpa_directory') loop
    bad := bad || r.relname || ' ';
  end loop;
  if bad <> '' then raise exception 'FAIL: views bypassing RLS outside the allowlist: %', bad; end if;
end $$;
\echo 'SECURITY AUDIT PASSED'
