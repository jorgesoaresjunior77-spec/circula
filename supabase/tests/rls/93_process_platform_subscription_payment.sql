-- =====================================================================
-- 93 — process_platform_subscription_payment (idempotência do webhook
-- Asaas, ramo subject='platform')
-- =====================================================================
-- Migration: 20260929120000_process_platform_subscription_payment.sql.
-- Não é um cenário de RLS de tabela (não há policy nova); é o teste
-- funcional + de privilégios da RPC que fecha o achado registrado em
-- 20260928120000 (duplicação de current_period_end no ramo `platform`
-- do `asaas-webhook` — ver histórico da auditoria).
--
-- Cobre: primeiro processamento, retry idempotente do MESMO
-- asaas_event_id (current_period_end avança só uma vez), payment_charges
-- correto, processed_at preenchido, rollback total quando a subscription
-- não existe, um segundo asaas_event_id LEGÍTIMO (pagamento diferente)
-- continuando a avançar o período normalmente, e EXECUTE restrito a
-- service_role (anon/authenticated bloqueados, service_role permitido).
--
-- Fixtures sintéticas criadas como `postgres` (dono, ignora RLS) e
-- desfeitas no ROLLBACK final do framework — nenhum dado persiste,
-- inclusive o que a própria RPC grava (webhook_events/payment_charges/
-- subscriptions), porque tudo roda dentro da MESMA transação do
-- cenário.
--
-- >>> CONCORRÊNCIA REAL: NÃO testada aqui. Cada cenário desta suíte
-- roda como UM ÚNICO script SQL, numa ÚNICA conexão/transação
-- (`supabase db query --linked`, ver run.mjs) — não há como abrir uma
-- segunda transação verdadeiramente concorrente (duas conexões, uma
-- travando a linha enquanto a outra espera) sem infraestrutura que
-- esta suíte não tem hoje (ex.: um segundo processo/conexão via
-- dblink/pg_background, ou um script Node orquestrando duas chamadas
-- HTTP em paralelo contra a Edge Function real). Inventar uma simulação
-- de "concorrência" dentro de uma única transação sequencial não prova
-- nada sobre o lock real (`SELECT ... FOR UPDATE` só serializa quando
-- há, de fato, duas transações disputando a mesma linha) — por isso
-- este arquivo NÃO inclui esse teste, em vez de fingir cobertura que
-- não existe. A prova de que a serialização funciona fica com a
-- revisão de desenho (SELECT...FOR UPDATE reavalia contra o valor
-- committed, não contra o snapshot da transação que espera) e deveria,
-- se necessário no futuro, ser validada por um teste de integração à
-- parte (duas chamadas HTTP reais e simultâneas à Edge Function).
-- =====================================================================

set local time zone 'UTC';

-- v_base_end ancorado no dia 11 do mes SEGUINTE (00:00 UTC + 10 dias + 12h):
-- dia 11 existe em qualquer mes, e a base fica sempre no futuro em relacao
-- a `now()` (bate a condicao current_period_end > now() -> base =
-- current_period_end, nao "now()"). Evita que o teste dependa de sorte de
-- calendario (ex.: rodar num dia perto do fim do mes faria a aritmetica
-- "ingenua" deste arquivo divergir do transbordo UTC deliberado da RPC —
-- ver nota de fidelidade de addCycleMonths na migration).
do $$
declare
  v_plan_id   uuid;
  v_sub_id    uuid := '93939393-0000-4000-8000-000000000001';
  v_base_end  timestamptz := date_trunc('month', now()) + interval '1 month'
                              + interval '10 days' + interval '12 hours';
  v_result    jsonb;
  v_period_1  timestamptz;
  v_period_2  timestamptz;
  v_n         bigint;
  v_paid_at   timestamptz;
  v_raised    boolean;
  v_sqlstate  text;
begin
  select id into v_plan_id from public.billing_plans where code = 'professional_monthly';
  if v_plan_id is null then
    raise exception '93: fixture ausente — billing_plans.code=professional_monthly não encontrado';
  end if;

  -- usa o profile_id do fixture 'master': o profile por tras da chave
  -- 'member' do framework (94bc64f8-...) nao existe mais em
  -- public.profiles (conta de teste removida da producao depois que
  -- este cenario foi escrito) — o INSERT abaixo violava
  -- subscriptions_profile_id_fkey. 'prof' tambem nao serve: confirmado
  -- por leitura direta antes deste ajuste, a Professional real (Nutri
  -- Marluce) JA tem uma subscription subject='platform' genuina
  -- (status='past_due'), que colidiria com
  -- subscriptions_platform_unique_idx (indice unico parcial em
  -- profile_id WHERE subject='platform' AND status<>'canceled').
  -- 'master' e um profile real sem NENHUMA linha em subscriptions hoje
  -- (confirmado por leitura direta) — satisfaz a FK e nao colide com
  -- o indice. A funcao testada nao tem nenhuma regra de negocio
  -- amarrada ao role do profile dono da subscription.
  insert into public.subscriptions (
    id, subject, profile_id, community_id, plan_id, status,
    trial_ends_at, current_period_start, current_period_end, grace_period_ends_at
  ) values (
    v_sub_id, 'platform', (select v::uuid from _fx where k = 'master'), null, v_plan_id, 'active',
    now() - interval '40 days', now() - interval '10 days', v_base_end, null
  );

  -- ================= (1) primeiro processamento ========================
  select public.process_platform_subscription_payment(
    'rls93-evt-A', 'PAYMENT_CONFIRMED', '{}'::jsonb, v_sub_id,
    'rls93-pay-A', 'CONFIRMED', 9990, current_date, 'CREDIT_CARD', 'https://example.test/rls93-a'
  ) into v_result;

  insert into _r(name,kind,expect,got,ok) values
    ('93: 1o processamento -> duplicate=false','bool','false',(v_result->>'duplicate'), (v_result->>'duplicate') = 'false');

  select current_period_end into v_period_1 from public.subscriptions where id = v_sub_id;
  insert into _r(name,kind,expect,got,ok) values
    ('93: current_period_end avancou 1 mes (base era futuro)','bool','true',
     (v_period_1 = v_base_end + interval '1 month')::text,
     v_period_1 = v_base_end + interval '1 month');

  -- ================= (2) retry do MESMO asaas_event_id ==================
  select public.process_platform_subscription_payment(
    'rls93-evt-A', 'PAYMENT_CONFIRMED', '{}'::jsonb, v_sub_id,
    'rls93-pay-A', 'CONFIRMED', 9990, current_date, 'CREDIT_CARD', 'https://example.test/rls93-a'
  ) into v_result;

  insert into _r(name,kind,expect,got,ok) values
    ('93: retry mesmo evento -> duplicate=true','bool','true',(v_result->>'duplicate'), (v_result->>'duplicate') = 'true');

  select current_period_end into v_period_2 from public.subscriptions where id = v_sub_id;
  insert into _r(name,kind,expect,got,ok) values
    ('93: retry NAO reestende current_period_end (avancou so 1x)','bool','true',
     (v_period_2 = v_period_1)::text, v_period_2 = v_period_1);

  -- ================= (3) payment_charges gravado corretamente ==========
  select count(*), max(paid_at) into v_n, v_paid_at
  from public.payment_charges
  where asaas_payment_id = 'rls93-pay-A' and subscription_id = v_sub_id and amount_cents = 9990;
  insert into _r(name,kind,expect,got,ok) values
    ('93: payment_charges gravado (1 linha, amount correto)','count','1',v_n::text, v_n = 1);
  insert into _r(name,kind,expect,got,ok) values
    ('93: payment_charges.paid_at preenchido (evento confirmado)','bool','true',
     (v_paid_at is not null)::text, v_paid_at is not null);

  -- ================= (4) processed_at preenchido ========================
  select count(*) into v_n
  from public.webhook_events
  where asaas_event_id = 'rls93-evt-A' and processed_at is not null;
  insert into _r(name,kind,expect,got,ok) values
    ('93: webhook_events.processed_at preenchido','count','1',v_n::text, v_n = 1);

  -- ================= (5) rollback quando subscription nao existe =======
  v_raised := false;
  begin
    perform public.process_platform_subscription_payment(
      'rls93-evt-missing', 'PAYMENT_CONFIRMED', '{}'::jsonb,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'rls93-pay-missing', 'CONFIRMED', 1000, current_date, null, null
    );
  exception when others then
    v_raised := true;
    v_sqlstate := sqlstate;
  end;
  insert into _r(name,kind,expect,got,ok) values
    ('93: subscription inexistente -> RAISE (no_data_found)','bool','true',
     (v_raised and v_sqlstate = 'P0002')::text, v_raised and v_sqlstate = 'P0002');

  select count(*) into v_n from public.webhook_events where asaas_event_id = 'rls93-evt-missing';
  insert into _r(name,kind,expect,got,ok) values
    ('93: rollback total -- webhook_events nao ficou com linha orfa','count','0',v_n::text, v_n = 0);

  -- ================= (6) novo evento LEGITIMO (pagamento diferente) ====
  select public.process_platform_subscription_payment(
    'rls93-evt-B', 'PAYMENT_CONFIRMED', '{}'::jsonb, v_sub_id,
    'rls93-pay-B', 'CONFIRMED', 9990, current_date, 'CREDIT_CARD', 'https://example.test/rls93-b'
  ) into v_result;

  insert into _r(name,kind,expect,got,ok) values
    ('93: novo evento legitimo (pagamento diferente) -> duplicate=false','bool','true',
     ((v_result->>'duplicate') = 'false')::text, (v_result->>'duplicate') = 'false');

  select current_period_end into v_period_2 from public.subscriptions where id = v_sub_id;
  insert into _r(name,kind,expect,got,ok) values
    ('93: novo pagamento legitimo AVANCA current_period_end de novo','bool','true',
     (v_period_2 = v_period_1 + interval '1 month')::text, v_period_2 = v_period_1 + interval '1 month');
end $$;

-- ================= (7)+(8) EXECUTE negado a anon/authenticated ========

select pg_temp.expect_locked('93: anon SEM EXECUTE na RPC',
  null,
  format(
    'select public.process_platform_subscription_payment(%L,%L,%L::jsonb,%L::uuid,%L,%L,%L,%L::date,%L,%L)::text',
    'rls93-evt-anon', 'PAYMENT_CONFIRMED', '{}', '93939393-0000-4000-8000-000000000001',
    'rls93-pay-anon', 'CONFIRMED', 1000, current_date, 'CREDIT_CARD', 'https://example.test/rls93-anon'
  ));

select pg_temp.expect_locked('93: authenticated (member) SEM EXECUTE na RPC',
  pg_temp.fx('member'),
  format(
    'select public.process_platform_subscription_payment(%L,%L,%L::jsonb,%L::uuid,%L,%L,%L,%L::date,%L,%L)::text',
    'rls93-evt-member', 'PAYMENT_CONFIRMED', '{}', '93939393-0000-4000-8000-000000000001',
    'rls93-pay-member', 'CONFIRMED', 1000, current_date, 'CREDIT_CARD', 'https://example.test/rls93-member'
  ));

-- ================= (9) service_role TEM EXECUTE ========================

do $$
declare v_ok boolean := false; v_code text := ''; v_result jsonb;
begin
  execute 'set local role service_role';
  begin
    select public.process_platform_subscription_payment(
      'rls93-evt-svc', 'PAYMENT_CONFIRMED', '{}'::jsonb,
      '93939393-0000-4000-8000-000000000001'::uuid,
      'rls93-pay-svc', 'CONFIRMED', 1000, current_date, 'CREDIT_CARD', 'https://example.test/rls93-svc'
    ) into v_result;
    v_ok := true;
  exception when others then
    v_ok := false; v_code := sqlstate;
  end;
  execute 'reset role';
  insert into _r(name,kind,expect,got,ok) values
    ('93: service_role TEM EXECUTE na RPC','rpc','OK',
     case when v_ok then 'OK' else 'RAISE('||v_code||')' end, v_ok);
end $$;

select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
