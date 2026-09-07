-- =====================================================================
-- 81 — BILLING SWEEP: idempotência das transições (16.2.4-C)
-- =====================================================================
-- Sem tocar a Asaas. Verifica que as transições do `billing-daily-sweep`:
--   • bloqueiam trial expirado / past_due sem grace / canceled vencida;
--   • são idempotentes (re-rodar = 0 linhas);
--   • NÃO criam/alteram payment_charges nem subscription_payouts;
--   • `billing_notifications_log` (UNIQUE) impede notificação duplicada;
--   • canceled com `current_period_end` no FUTURO não é bloqueada.
-- Fixtures sintéticas como `postgres` (ignora RLS); tudo em ROLLBACK.
-- =====================================================================

insert into public.communities (id, owner_id, name, slug, is_discoverable)
values ((select v::uuid from _fx where k='commC'),
        (select v::uuid from _fx where k='master'),
        '[rls-suite] Comunidade C (sweep)', 'rls-suite-c-sweep', false);

insert into public.subscriptions
  (id, subject, profile_id, community_id, plan_id, status,
   trial_ends_at, current_period_start, current_period_end, grace_period_ends_at)
values
  ('eeeeeeee-0000-4000-8000-0000000000e1', 'community',
   (select v::uuid from _fx where k='member'), (select v::uuid from _fx where k='commC'),
   (select v::uuid from _fx where k='member_plan'), 'trial',
   now() - interval '1 day', now() - interval '22 days', now() - interval '1 day', null),
  ('eeeeeeee-0000-4000-8000-0000000000e2', 'community',
   (select v::uuid from _fx where k='prof'), (select v::uuid from _fx where k='commC'),
   (select v::uuid from _fx where k='member_plan'), 'past_due',
   now() - interval '30 days', now() - interval '30 days', now() - interval '2 days', null),
  ('eeeeeeee-0000-4000-8000-0000000000e3', 'community',
   (select v::uuid from _fx where k='master'), (select v::uuid from _fx where k='commC'),
   (select v::uuid from _fx where k='member_plan'), 'canceled',
   now() - interval '30 days', now() - interval '30 days', now() + interval '10 days', null);

do $$
declare n bigint;
begin
  -- (A) trial expirado -> blocked (1a passada)
  update public.subscriptions set status='blocked'
   where status='trial' and trial_ends_at <= now()
     and id = 'eeeeeeee-0000-4000-8000-0000000000e1';
  get diagnostics n = row_count;
  insert into _r(name,kind,expect,got,ok) values
    ('sweep: trial expirado bloqueia (1a passada)','count','1',n::text, n = 1);

  -- (A) 2a passada -> 0 (idempotente)
  update public.subscriptions set status='blocked'
   where status='trial' and trial_ends_at <= now()
     and id = 'eeeeeeee-0000-4000-8000-0000000000e1';
  get diagnostics n = row_count;
  insert into _r(name,kind,expect,got,ok) values
    ('sweep: trial expirado 2a passada e no-op','count','0',n::text, n = 0);

  -- (B) past_due sem grace -> blocked, e idempotente
  update public.subscriptions set status='blocked'
   where status='past_due' and grace_period_ends_at is null
     and id = 'eeeeeeee-0000-4000-8000-0000000000e2';
  get diagnostics n = row_count;
  insert into _r(name,kind,expect,got,ok) values
    ('sweep: past_due sem grace bloqueia','count','1',n::text, n = 1);
  update public.subscriptions set status='blocked'
   where status='past_due' and grace_period_ends_at is null
     and id = 'eeeeeeee-0000-4000-8000-0000000000e2';
  get diagnostics n = row_count;
  insert into _r(name,kind,expect,got,ok) values
    ('sweep: past_due sem grace 2a passada e no-op','count','0',n::text, n = 0);

  -- (G) canceled com periodo FUTURO -> NAO bloqueia
  update public.subscriptions set status='blocked'
   where status='canceled' and current_period_end <= now()
     and id = 'eeeeeeee-0000-4000-8000-0000000000e3';
  get diagnostics n = row_count;
  insert into _r(name,kind,expect,got,ok) values
    ('sweep: canceled periodo futuro NAO bloqueia','count','0',n::text, n = 0);

  -- vence o periodo -> bloqueia
  update public.subscriptions set current_period_end = now() - interval '1 day'
   where id = 'eeeeeeee-0000-4000-8000-0000000000e3';
  update public.subscriptions set status='blocked'
   where status='canceled' and current_period_end <= now()
     and id = 'eeeeeeee-0000-4000-8000-0000000000e3';
  get diagnostics n = row_count;
  insert into _r(name,kind,expect,got,ok) values
    ('sweep: canceled periodo vencido bloqueia','count','1',n::text, n = 1);

  -- billing_notifications_log: 1a inserção ok; 2a identica -> 23505
  insert into public.billing_notifications_log (subscription_id, milestone, channel)
  values ('eeeeeeee-0000-4000-8000-0000000000e1','blocked','in_app');
  insert into _r(name,kind,expect,got,ok) values
    ('sweep: 1o log de notificacao aceito','write','ALLOWED','ALLOWED', true);
  begin
    insert into public.billing_notifications_log (subscription_id, milestone, channel)
    values ('eeeeeeee-0000-4000-8000-0000000000e1','blocked','in_app');
    insert into _r(name,kind,expect,got,ok) values
      ('sweep: log identico barrado (UNIQUE)','write','BLOCKED','ALLOWED', false);
  exception when unique_violation then
    insert into _r(name,kind,expect,got,ok) values
      ('sweep: log identico barrado (UNIQUE)','write','BLOCKED','BLOCKED(23505)', true);
  end;

  -- sem efeito financeiro
  select count(*) into n from public.payment_charges
   where subscription_id in ('eeeeeeee-0000-4000-8000-0000000000e1',
                             'eeeeeeee-0000-4000-8000-0000000000e2',
                             'eeeeeeee-0000-4000-8000-0000000000e3');
  insert into _r(name,kind,expect,got,ok) values
    ('sweep: nenhuma payment_charges criada','count','0',n::text, n = 0);

  select count(*) into n from public.subscription_payouts
   where subscription_id in ('eeeeeeee-0000-4000-8000-0000000000e1',
                             'eeeeeeee-0000-4000-8000-0000000000e2',
                             'eeeeeeee-0000-4000-8000-0000000000e3');
  insert into _r(name,kind,expect,got,ok) values
    ('sweep: nenhuma subscription_payouts criada','count','0',n::text, n = 0);
end $$;

select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
