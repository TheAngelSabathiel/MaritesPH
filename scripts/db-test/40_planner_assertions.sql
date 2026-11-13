-- Phase 4 assertions: my documents, saved plans, AI usage log, account deletion cascade.
\set ON_ERROR_STOP on

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false) \gset ignored_
do $$ begin
  insert into public.user_documents (user_id, document_id, status) values (auth.uid(), '20000000-0000-0000-0000-000000000001', 'have');
  insert into public.plans (user_id, title, goal, inputs, generated_plan) values (auth.uid(), 'My plan', '{}', '{}', '{}');
  begin
    insert into public.plans (user_id, title, goal, inputs, generated_plan)
    values ('00000000-0000-0000-0000-00000000000a', 'Not mine', '{}', '{}', '{}');
    raise exception 'FAIL: user created a plan for someone else';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.user_documents (user_id, document_id, status) values (auth.uid(), '20000000-0000-0000-0000-000000000002', 'owned');
    raise exception 'FAIL: invalid status accepted';
  exception when check_violation then null; end;
  begin
    insert into public.ai_usage_log (purpose, model) values ('plan_summary', 'x');
    raise exception 'FAIL: user wrote to the AI usage log';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Another user sees nothing of user b's data.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false) \gset ignored_
do $$ begin
  assert (select count(*) from public.plans) = 0, 'admin should not see other users plans either';
  assert (select count(*) from public.user_documents) = 0, 'other user sees my documents';
end $$;
reset role;

-- Spend function: service role only, sums this month.
insert into public.ai_usage_log (purpose, model, cost_estimate) values ('plan_summary', 'm', 0.25), ('plan_summary', 'm', 0.5);
insert into public.ai_usage_log (purpose, model, cost_estimate, created_at) values ('plan_summary', 'm', 9, now() - interval '70 days');
set role anon;
do $$ begin
  begin
    perform public.ai_spend_this_month();
    raise exception 'FAIL: anon could read AI spend';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set role service_role;
do $$ begin
  assert public.ai_spend_this_month() = 0.75, 'month-to-date spend wrong';
end $$;
reset role;

-- Account deletion cascades to personal data; reports stay but lose the user link.
do $$ begin
  delete from auth.users where id = '00000000-0000-0000-0000-00000000000b';
  assert (select count(*) from public.plans) = 0, 'plans not deleted with account';
  assert (select count(*) from public.user_documents) = 0, 'user_documents not deleted with account';
  assert (select count(*) from public.content_flags where user_id is null and details = 'Fee changed') = 1, 'report should remain, unlinked';
end $$;

\echo 'ALL PLANNER ASSERTIONS PASSED'
