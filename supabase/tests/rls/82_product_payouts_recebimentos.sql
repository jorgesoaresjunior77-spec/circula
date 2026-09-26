-- =====================================================================
-- 82 — RECEBIMENTOS DA LOJA: product_payouts (+ leitura de product_orders)
-- =====================================================================
-- Cobre a RLS das estruturas de venda de produto (Loja) que a aba
-- "Recebimentos" da Professional passa a consumir nesta fase, ao lado
-- de `subscription_payouts` (já coberto pelo cenário 80):
--   • product_payouts — Professional vê os próprios repasses de venda de
--                       produto; Member NÃO vê; isolamento entre
--                       comunidades; sem escrita para o cliente (só
--                       service_role, mesmo padrão de subscription_payouts).
--   • product_orders  — SELECT apenas (o novo hook lê esta tabela para
--                       obter `product_title_snapshot`/comprador). Já tem
--                       policy própria (Fase Loja); aqui só confirmamos
--                       que o isolamento por comunidade também vale para
--                       o caminho novo de leitura. Nenhuma alteração de
--                       policy — leitura de regressão.
--
-- Fixtures sintéticas (produto + pedido + payout em A e em C) são criadas
-- como `postgres` (dono da tabela -> ignora RLS) e somem no ROLLBACK
-- final. NADA é persistido. Mesma técnica de 80_billing_community_subscription.sql.
-- =====================================================================

-- comunidade C (dona = Master) — sintética, só existe dentro desta
-- transação (mesma técnica de 80_billing_community_subscription.sql;
-- cada cenário é uma transação isolada, então precisa recriá-la aqui).
insert into public.communities (id, owner_id, name, slug, is_discoverable)
values (pg_temp.fx('commC'), pg_temp.fx('master'),
        '[rls-suite] Comunidade C (recebimentos loja)', 'rls-suite-c-recebimentos', false);

-- produto publicado em A (dona = prof, comunidade real)
insert into public.products
  (id, community_id, created_by, type, title, price_cents, currency, status)
values
  ('eeeeeeee-0000-4000-8000-0000000000e1',
   pg_temp.fx('commA'), pg_temp.fx('prof'),
   'course', '[rls-suite] Produto A', 2990, 'BRL', 'published');

-- produto publicado em C (dona = master, comunidade sintética)
insert into public.products
  (id, community_id, created_by, type, title, price_cents, currency, status)
values
  ('eeeeeeee-0000-4000-8000-0000000000e2',
   pg_temp.fx('commC'), pg_temp.fx('master'),
   'course', '[rls-suite] Produto C', 4990, 'BRL', 'published');

-- pedido completo em A — comprador = member, vendedora = prof
insert into public.product_orders
  (id, product_id, community_id, buyer_profile_id, seller_id, quantity,
   status, financial_status, fulfillment_status,
   product_title_snapshot, product_type_snapshot,
   unit_price_cents_snapshot, currency_snapshot, amount_total_cents,
   split_model_snapshot, split_rule_source,
   circula_percent_snapshot, circula_amount_cents_snapshot,
   professional_amount_cents_snapshot, professional_wallet_id_snapshot,
   idempotency_key)
values
  ('eeeeeeee-0000-4000-8000-0000000000e3',
   'eeeeeeee-0000-4000-8000-0000000000e1', pg_temp.fx('commA'),
   pg_temp.fx('member'), pg_temp.fx('prof'), 1,
   'completed', 'received', 'not_applicable',
   '[rls-suite] Produto A', 'course',
   2990, 'BRL', 2990,
   'native', 'none',
   10.00, 299, 2691, 'wallet_sintetico_A',
   'eeeeeeee-0000-4000-8000-0000000000e7');

-- pedido completo em C — comprador = master (mesmo padrão de 80: dona
-- de C também figura como "assinante"/compradora sintética)
insert into public.product_orders
  (id, product_id, community_id, buyer_profile_id, seller_id, quantity,
   status, financial_status, fulfillment_status,
   product_title_snapshot, product_type_snapshot,
   unit_price_cents_snapshot, currency_snapshot, amount_total_cents,
   split_model_snapshot, split_rule_source,
   circula_percent_snapshot, circula_amount_cents_snapshot,
   professional_amount_cents_snapshot, professional_wallet_id_snapshot,
   idempotency_key)
values
  ('eeeeeeee-0000-4000-8000-0000000000e4',
   'eeeeeeee-0000-4000-8000-0000000000e2', pg_temp.fx('commC'),
   pg_temp.fx('master'), pg_temp.fx('master'), 1,
   'completed', 'received', 'not_applicable',
   '[rls-suite] Produto C', 'course',
   4990, 'BRL', 4990,
   'native', 'none',
   10.00, 499, 4491, 'wallet_sintetico_C',
   'eeeeeeee-0000-4000-8000-0000000000e8');

-- payout (sale) do pedido em A -> destino = prof (dona de A)
insert into public.product_payouts
  (id, order_id, community_id, professional_id,
   kind, split_model, gross_amount_cents, asaas_fee_cents,
   circula_fee_cents, net_amount_cents, status)
values
  ('eeeeeeee-0000-4000-8000-0000000000e5',
   'eeeeeeee-0000-4000-8000-0000000000e3', pg_temp.fx('commA'), pg_temp.fx('prof'),
   'sale', 'native', 2990, 150, 299, 2541, 'paid');

-- payout (sale) do pedido em C -> destino = master (dona de C)
insert into public.product_payouts
  (id, order_id, community_id, professional_id,
   kind, split_model, gross_amount_cents, asaas_fee_cents,
   circula_fee_cents, net_amount_cents, status)
values
  ('eeeeeeee-0000-4000-8000-0000000000e6',
   'eeeeeeee-0000-4000-8000-0000000000e4', pg_temp.fx('commC'), pg_temp.fx('master'),
   'sale', 'native', 4990, 150, 499, 4341, 'paid');

-- ================= product_payouts — LEITURA ==========================

-- Professional vê o repasse da PRÓPRIA comunidade (A)
select pg_temp.expect_count('prof: vê product_payouts de A',
  pg_temp.fx('prof'),
  format('select count(*) from public.product_payouts where community_id = %L', pg_temp.fx('commA')), 1);

-- Professional NÃO vê repasse de comunidade alheia (C)
select pg_temp.expect_count('prof: NÃO vê product_payouts de C (isolamento)',
  pg_temp.fx('prof'),
  format('select count(*) from public.product_payouts where community_id = %L', pg_temp.fx('commC')), 0);

-- Member NÃO vê NENHUM repasse de produto (não é o dinheiro dele, é o da Professional)
select pg_temp.expect_locked('member: NÃO vê product_payouts',
  pg_temp.fx('member'),
  'select count(*) from public.product_payouts');

select pg_temp.expect_count('member: product_payouts de A = 0',
  pg_temp.fx('member'),
  format('select count(*) from public.product_payouts where community_id = %L', pg_temp.fx('commA')), 0);

-- Master (admin de billing) vê os dois
select pg_temp.expect_count('master: vê product_payouts de A e C',
  pg_temp.fx('master'),
  format('select count(*) from public.product_payouts where community_id in (%L,%L)',
         pg_temp.fx('commA'), pg_temp.fx('commC')), 2);

-- anon não vê nada
select pg_temp.expect_locked('anon: NÃO vê product_payouts',
  null,
  'select count(*) from public.product_payouts');

-- ================= product_payouts — ESCRITA ==========================
-- Não há policy de INSERT/UPDATE/DELETE nem GRANT para authenticated
-- (mesmo padrão de subscription_payouts — só service_role escreve).

select pg_temp.expect_write('member: INSERT product_payouts -> BLOQUEADO',
  pg_temp.fx('member'),
  format('insert into public.product_payouts
            (order_id, community_id, professional_id, kind, split_model,
             gross_amount_cents, circula_fee_cents, net_amount_cents, status)
          values (%L,%L,%L,''sale'',''native'',2990,299,2541,''paid'')',
         'eeeeeeee-0000-4000-8000-0000000000e3', pg_temp.fx('commA'), pg_temp.fx('member')), false);

select pg_temp.expect_write('prof: INSERT product_payouts em A -> BLOQUEADO (sem policy de escrita)',
  pg_temp.fx('prof'),
  format('insert into public.product_payouts
            (order_id, community_id, professional_id, kind, split_model,
             gross_amount_cents, circula_fee_cents, net_amount_cents, status)
          values (%L,%L,%L,''sale'',''native'',2990,299,2541,''paid'')',
         'eeeeeeee-0000-4000-8000-0000000000e3', pg_temp.fx('commA'), pg_temp.fx('prof')), false);

select pg_temp.expect_write('prof: UPDATE product_payouts de A -> BLOQUEADO',
  pg_temp.fx('prof'),
  format('update public.product_payouts set status = ''pending'' where id = %L',
         'eeeeeeee-0000-4000-8000-0000000000e5'), false);

select pg_temp.expect_write('member: DELETE product_payouts -> BLOQUEADO',
  pg_temp.fx('member'),
  format('delete from public.product_payouts where id = %L',
         'eeeeeeee-0000-4000-8000-0000000000e5'), false);

-- ================= product_orders — leitura (caminho novo do hook) =====
-- Sem alteração de policy: confirma que `product_orders_select`
-- (buyer_profile_id = auth.uid() OR owns_community OR is_master()) já
-- isola corretamente o que o novo `useProfessionalRevenue` passa a ler.

-- Member vê o PRÓPRIO pedido (comprador em A)
select pg_temp.expect_count('member: vê o próprio product_order em A',
  pg_temp.fx('member'),
  format('select count(*) from public.product_orders where id = %L', 'eeeeeeee-0000-4000-8000-0000000000e3'), 1);

-- Member NÃO vê o pedido de C (não é o comprador, não é dona)
select pg_temp.expect_count('member: NÃO vê product_order de C (isolamento)',
  pg_temp.fx('member'),
  format('select count(*) from public.product_orders where id = %L', 'eeeeeeee-0000-4000-8000-0000000000e4'), 0);

-- Professional vê o pedido da PRÓPRIA comunidade (A) — filtra pelo id
-- sintético, não por community_id: A é a comunidade real "Fluir &
-- Florescer" e já tem outros pedidos de produto em produção (mesmo
-- cuidado de data-count drift documentado em baseline-failures.txt).
select pg_temp.expect_count('prof: vê product_order sintético de A',
  pg_temp.fx('prof'),
  format('select count(*) from public.product_orders where id = %L', 'eeeeeeee-0000-4000-8000-0000000000e3'), 1);

-- Professional NÃO vê o pedido de comunidade alheia (C)
select pg_temp.expect_count('prof: NÃO vê product_order de C (isolamento)',
  pg_temp.fx('prof'),
  format('select count(*) from public.product_orders where id = %L', 'eeeeeeee-0000-4000-8000-0000000000e4'), 0);

-- Master vê os dois
select pg_temp.expect_count('master: vê product_orders de A e C',
  pg_temp.fx('master'),
  format('select count(*) from public.product_orders where id in (%L,%L)',
         'eeeeeeee-0000-4000-8000-0000000000e3', 'eeeeeeee-0000-4000-8000-0000000000e4'), 2);

-- ---------- RESULTADO --------------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
