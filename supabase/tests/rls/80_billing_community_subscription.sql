-- =====================================================================
-- 80 — BILLING: assinatura de comunidade (16.2.4-B)  (após _framework.sql)
-- =====================================================================
-- Cobre a RLS / grants das estruturas financeiras da assinatura de
-- comunidade introduzidas / ativadas pela 16.2.4-B:
--   • subscription_payouts  — Professional vê os próprios repasses;
--                             Member NÃO vê; isolamento entre comunidades;
--                             sem escrita para o cliente (só service_role).
--   • payment_charges       — Member vê a própria cobrança; Professional
--                             vê as da própria comunidade; isolamento.
--   • resolve_split         — inacessível a `authenticated`.
--
-- Fixtures sintéticas (comunidade C, assinatura em C, cobranças e
-- payouts) são criadas como `postgres` (dono da tabela -> ignora RLS) e
-- somem no ROLLBACK final. NADA é persistido.
-- =====================================================================

-- comunidade C (dona = Master) — mesma técnica de 30_professional.sql
insert into public.communities (id, owner_id, name, slug, is_discoverable)
values ((select v::uuid from _fx where k='commC'),
        (select v::uuid from _fx where k='master'),
        '[rls-suite] Comunidade C (billing)', 'rls-suite-c-billing', false);

-- assinatura de comunidade em C (assinante = Master; raw insert, RLS
-- ignorada). subject='community' exige community_id not null.
insert into public.subscriptions
  (id, subject, profile_id, community_id, plan_id, status,
   trial_ends_at, current_period_start, current_period_end,
   price_cents_snapshot, billing_cycle_snapshot, currency_snapshot,
   split_model_snapshot, circula_percent_snapshot,
   circula_amount_cents_snapshot, professional_amount_cents_snapshot,
   professional_wallet_id_snapshot)
values
  ('dddddddd-0000-4000-8000-0000000000d1',
   'community',
   (select v::uuid from _fx where k='master'),
   (select v::uuid from _fx where k='commC'),
   (select v::uuid from _fx where k='member_plan'),
   'active',
   now() + interval '21 days', now(), now() + interval '30 days',
   4990, 'MONTHLY', 'BRL', 'native', 10.00, 499, 4491,
   'wallet_sintetico_C');

-- cobrança confirmada + reconciliação de split — assinatura do Member em A
insert into public.payment_charges
  (id, subscription_id, asaas_payment_id, status, amount_cents, due_date,
   paid_at, invoice_url,
   net_value_cents, split_professional_cents, split_circula_cents, asaas_fee_cents)
values
  ('dddddddd-0000-4000-8000-0000000000d2',
   (select v::uuid from _fx where k='member_sub_A'),
   'pay_sintetico_A', 'RECEIVED', 4990, current_date,
   now(), 'https://sandbox.asaas.com/i/sintetico_A',
   4840, 4356, 484, 150);

-- cobrança da assinatura em C
insert into public.payment_charges
  (id, subscription_id, asaas_payment_id, status, amount_cents, due_date,
   net_value_cents, split_professional_cents, split_circula_cents, asaas_fee_cents)
values
  ('dddddddd-0000-4000-8000-0000000000d3',
   'dddddddd-0000-4000-8000-0000000000d1',
   'pay_sintetico_C', 'RECEIVED', 4990, current_date,
   4840, 4356, 484, 150);

-- payout (sale) da comunidade A -> destino = prof (dona de A)
insert into public.subscription_payouts
  (id, subscription_id, payment_charge_id, community_id, professional_id,
   kind, split_model, gross_amount_cents, asaas_fee_cents,
   circula_fee_cents, net_amount_cents, status)
values
  ('dddddddd-0000-4000-8000-0000000000d4',
   (select v::uuid from _fx where k='member_sub_A'),
   'dddddddd-0000-4000-8000-0000000000d2',
   (select v::uuid from _fx where k='commA'),
   (select v::uuid from _fx where k='prof'),
   'sale', 'native', 4990, 150, 484, 4356, 'paid');

-- payout (sale) da comunidade C -> destino = master (dona de C)
insert into public.subscription_payouts
  (id, subscription_id, payment_charge_id, community_id, professional_id,
   kind, split_model, gross_amount_cents, asaas_fee_cents,
   circula_fee_cents, net_amount_cents, status)
values
  ('dddddddd-0000-4000-8000-0000000000d5',
   'dddddddd-0000-4000-8000-0000000000d1',
   'dddddddd-0000-4000-8000-0000000000d3',
   (select v::uuid from _fx where k='commC'),
   (select v::uuid from _fx where k='master'),
   'sale', 'native', 4990, 150, 484, 4356, 'paid');

-- ================= subscription_payouts — LEITURA =====================

-- Professional vê o repasse da PRÓPRIA comunidade (A)
select pg_temp.expect_count('prof: vê subscription_payouts de A',
  pg_temp.fx('prof'),
  format('select count(*) from public.subscription_payouts where community_id = %L', pg_temp.fx('commA')), 1);

-- Professional NÃO vê repasse de comunidade alheia (C)
select pg_temp.expect_count('prof: NÃO vê subscription_payouts de C (isolamento)',
  pg_temp.fx('prof'),
  format('select count(*) from public.subscription_payouts where community_id = %L', pg_temp.fx('commC')), 0);

-- Member NÃO vê NENHUM repasse (não é o dinheiro dele)
select pg_temp.expect_locked('member: NÃO vê subscription_payouts',
  pg_temp.fx('member'),
  'select count(*) from public.subscription_payouts');

select pg_temp.expect_count('member: subscription_payouts de A = 0',
  pg_temp.fx('member'),
  format('select count(*) from public.subscription_payouts where community_id = %L', pg_temp.fx('commA')), 0);

-- Master (admin de billing) vê os dois
select pg_temp.expect_count('master: vê subscription_payouts de A e C',
  pg_temp.fx('master'),
  format('select count(*) from public.subscription_payouts where community_id in (%L,%L)',
         pg_temp.fx('commA'), pg_temp.fx('commC')), 2);

-- anon não vê nada
select pg_temp.expect_locked('anon: NÃO vê subscription_payouts',
  null,
  'select count(*) from public.subscription_payouts');

-- ================= subscription_payouts — ESCRITA =====================
-- Não há policy de INSERT/UPDATE/DELETE nem GRANT para authenticated.

select pg_temp.expect_write('member: INSERT subscription_payouts -> BLOQUEADO',
  pg_temp.fx('member'),
  format('insert into public.subscription_payouts
            (subscription_id, community_id, professional_id, kind, split_model,
             gross_amount_cents, circula_fee_cents, net_amount_cents, status)
          values (%L,%L,%L,''sale'',''native'',4990,484,4356,''paid'')',
         pg_temp.fx('member_sub_A'), pg_temp.fx('commA'), pg_temp.fx('member')), false);

select pg_temp.expect_write('prof: INSERT subscription_payouts em A -> BLOQUEADO (sem policy de escrita)',
  pg_temp.fx('prof'),
  format('insert into public.subscription_payouts
            (subscription_id, community_id, professional_id, kind, split_model,
             gross_amount_cents, circula_fee_cents, net_amount_cents, status)
          values (%L,%L,%L,''sale'',''native'',4990,484,4356,''paid'')',
         pg_temp.fx('member_sub_A'), pg_temp.fx('commA'), pg_temp.fx('prof')), false);

select pg_temp.expect_write('prof: UPDATE subscription_payouts de A -> BLOQUEADO',
  pg_temp.fx('prof'),
  format('update public.subscription_payouts set status = ''pending'' where id = %L',
         'dddddddd-0000-4000-8000-0000000000d4'), false);

select pg_temp.expect_write('member: DELETE subscription_payouts -> BLOQUEADO',
  pg_temp.fx('member'),
  format('delete from public.subscription_payouts where id = %L',
         'dddddddd-0000-4000-8000-0000000000d4'), false);

-- ================= payment_charges — reconciliação =====================

-- Member vê a PRÓPRIA cobrança (assinatura dele em A), com as colunas de split
select pg_temp.expect_count('member: vê a própria payment_charge (A)',
  pg_temp.fx('member'),
  format('select count(*) from public.payment_charges
          where subscription_id = %L and split_professional_cents = 4356', pg_temp.fx('member_sub_A')), 1);

-- Professional vê as cobranças da PRÓPRIA comunidade (A)
select pg_temp.expect_count('prof: vê payment_charges de A',
  pg_temp.fx('prof'),
  format('select count(*) from public.payment_charges
          where subscription_id = %L and asaas_payment_id = ''pay_sintetico_A''',
         pg_temp.fx('member_sub_A')), 1);

-- Professional NÃO vê cobranças de comunidade alheia (C)
select pg_temp.expect_count('prof: NÃO vê payment_charges de C (isolamento)',
  pg_temp.fx('prof'),
  'select count(*) from public.payment_charges where subscription_id = ''dddddddd-0000-4000-8000-0000000000d1''', 0);

-- Member NÃO vê cobranças de assinatura alheia (a de C, do Master)
select pg_temp.expect_locked('member: NÃO vê payment_charges da assinatura de C',
  pg_temp.fx('member'),
  'select count(*) from public.payment_charges where subscription_id = ''dddddddd-0000-4000-8000-0000000000d1''');

-- Member não escreve payment_charges (grant é só service_role)
select pg_temp.expect_write('member: UPDATE payment_charges -> BLOQUEADO',
  pg_temp.fx('member'),
  format('update public.payment_charges set status = ''hack'' where id = %L',
         'dddddddd-0000-4000-8000-0000000000d2'), false);

-- ================= resolve_split — não exposto a authenticated ==========

select pg_temp.expect_rpc('member: resolve_split() -> RAISE (execute só service_role)',
  pg_temp.fx('member'),
  format('public.resolve_split(%L, 1490)', pg_temp.fx('commA')), false);

select pg_temp.expect_rpc('prof: resolve_split() -> RAISE (execute só service_role)',
  pg_temp.fx('prof'),
  format('public.resolve_split(%L, 1490)', pg_temp.fx('commA')), false);

-- ================= community_billing_settings — leitura pública =========
-- USING(true): qualquer autenticada lê o preço (semi-público p/ discovery).
select pg_temp.expect_count('member: lê community_billing_settings de A',
  pg_temp.fx('member'),
  format('select count(*) from public.community_billing_settings where community_id = %L', pg_temp.fx('commA')), 1);

-- mas NÃO escreve (só via RPC set_community_price / service_role)
select pg_temp.expect_write('member: UPDATE community_billing_settings -> BLOQUEADO',
  pg_temp.fx('member'),
  format('update public.community_billing_settings set price_cents = 1490 where community_id = %L', pg_temp.fx('commA')), false);

-- ---------- RESULTADO --------------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
