-- =====================================================================
-- 86 — ACESSO A PRODUTO PAGO: product_entitlements (+ has_product_access)
-- =====================================================================
-- Fase P1-F2. `public.product_entitlements` (`20260829120000`) é a
-- fonte ÚNICA de acesso a produto digital pago — nunca teve cenário de
-- RLS. Especialmente sensível: uma falha aqui libera conteúdo pago sem
-- pagamento.
--
-- Policy auditada ao vivo (pg_policies):
--   product_entitlements_select = profile_id = auth.uid()
--                                  OR owns_community(community_id)
--                                  OR is_master()
-- GRANT a `authenticated`: SOMENTE SELECT (information_schema
-- confirma — sem INSERT/UPDATE/DELETE). Concessão/revogação é
-- EXCLUSIVA do servidor (webhook), via `service_role`.
--
-- `owns_community(community_id)` é bypass POR DESIGN, não falha: a dona
-- da comunidade precisa ver quem tem acesso aos produtos dela (mesmo
-- padrão já confirmado em `product_payouts`, fase P1-D). Por isso o
-- teste de "usuária A não vê entitlement de usuária B" usa a comunidade
-- ONDE NENHUMA DAS DUAS É DONA nem é Master — só assim isola o
-- vazamento real de "vê o que não devia" do acesso legítimo de dona.
--
-- Revogação: `revoked_at` (nullable) é o campo real de revogação no
-- schema. A policy de SELECT NÃO filtra por `revoked_at` — a linha
-- revogada continua visível para a própria dona/dona da comunidade/
-- master (histórico), e é `public.has_product_access(product_id)`
-- (SECURITY DEFINER, filtra `revoked_at is null`) quem decide de fato
-- se a pessoa tem acesso ao conteúdo. Os testes abaixo provam as duas
-- coisas separadamente.
--
-- Fixtures sintéticas (2 produtos, 2 pedidos, 3 entitlements — mesma
-- técnica de `82_product_payouts_recebimentos.sql`) em transação com
-- `ROLLBACK`. Nenhum dado real de produção é tocado (nenhuma das 3
-- personas tinha linha prévia em `product_entitlements`, conferido antes
-- de escrever este cenário).
-- =====================================================================

-- comunidade C (dona = master) — sintética, só existe dentro desta
-- transação (mesma técnica de 82_product_payouts_recebimentos.sql).
insert into public.communities (id, owner_id, name, slug, is_discoverable)
values (pg_temp.fx('commC'), pg_temp.fx('master'),
        '[rls-suite] Comunidade C (entitlements)', 'rls-suite-c-entitlements', false);

-- produto em A (comunidade real, dona = prof) — entitlement do member
insert into public.products
  (id, community_id, created_by, type, title, price_cents, currency, status)
values
  ('90000000-0000-4000-8000-000000000001',
   pg_temp.fx('commA'), pg_temp.fx('prof'),
   'ebook', '[rls-suite] Produto A', 1990, 'BRL', 'published');

-- produto em C (comunidade sintética, dona = master) — entitlement do prof
insert into public.products
  (id, community_id, created_by, type, title, price_cents, currency, status)
values
  ('90000000-0000-4000-8000-000000000002',
   pg_temp.fx('commC'), pg_temp.fx('master'),
   'ebook', '[rls-suite] Produto C', 2990, 'BRL', 'published');

-- pedido completo em A — comprador = member
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
  ('90000000-0000-4000-8000-000000000011',
   '90000000-0000-4000-8000-000000000001', pg_temp.fx('commA'),
   pg_temp.fx('member'), pg_temp.fx('prof'), 1,
   'completed', 'received', 'not_applicable',
   '[rls-suite] Produto A', 'ebook',
   1990, 'BRL', 1990,
   'native', 'none',
   10.00, 199, 1791, 'wallet_sintetico_A',
   '90000000-0000-4000-8000-000000000021');

-- pedido completo em C — comprador = prof
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
  ('90000000-0000-4000-8000-000000000012',
   '90000000-0000-4000-8000-000000000002', pg_temp.fx('commC'),
   pg_temp.fx('prof'), pg_temp.fx('master'), 1,
   'completed', 'received', 'not_applicable',
   '[rls-suite] Produto C', 'ebook',
   2990, 'BRL', 2990,
   'native', 'none',
   10.00, 299, 2691, 'wallet_sintetico_C',
   '90000000-0000-4000-8000-000000000022');

-- pedido do master em A (produto A), depois reembolsado -> entitlement
-- revogada (E3). order_id é UNIQUE em product_entitlements, então
-- precisa de um pedido PRÓPRIO (não pode reaproveitar o pedido do member).
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
  ('90000000-0000-4000-8000-000000000013',
   '90000000-0000-4000-8000-000000000001', pg_temp.fx('commA'),
   pg_temp.fx('master'), pg_temp.fx('prof'), 1,
   'refunded', 'refunded', 'not_applicable',
   '[rls-suite] Produto A', 'ebook',
   1990, 'BRL', 1990,
   'native', 'none',
   10.00, 199, 1791, 'wallet_sintetico_A',
   '90000000-0000-4000-8000-000000000023');

-- E1: member tem acesso ATIVO ao Produto A (comunidade A, dona = prof)
insert into public.product_entitlements
  (id, order_id, product_id, profile_id, community_id, source, revoked_at)
values
  ('90000000-0000-4000-8000-000000000031',
   '90000000-0000-4000-8000-000000000011', '90000000-0000-4000-8000-000000000001',
   pg_temp.fx('member'), pg_temp.fx('commA'), 'purchase', null);

-- E2: prof tem acesso ATIVO ao Produto C (comunidade C, dona = master)
insert into public.product_entitlements
  (id, order_id, product_id, profile_id, community_id, source, revoked_at)
values
  ('90000000-0000-4000-8000-000000000032',
   '90000000-0000-4000-8000-000000000012', '90000000-0000-4000-8000-000000000002',
   pg_temp.fx('prof'), pg_temp.fx('commC'), 'purchase', null);

-- E3: master tinha acesso ao Produto A, REVOGADO (reembolso/chargeback)
insert into public.product_entitlements
  (id, order_id, product_id, profile_id, community_id, source, revoked_at, revoke_reason)
values
  ('90000000-0000-4000-8000-000000000033',
   '90000000-0000-4000-8000-000000000013', '90000000-0000-4000-8000-000000000001',
   pg_temp.fx('master'), pg_temp.fx('commA'), 'purchase', now(), '[rls-suite] reembolso');

-- ================= SELECT — acesso à própria entitlement ================

-- (1) member consulta o PRÓPRIO acesso (E1)
select pg_temp.expect_count('member: vê a própria entitlement (E1, Produto A)',
  pg_temp.fx('member'),
  format('select count(*) from public.product_entitlements where id = %L', '90000000-0000-4000-8000-000000000031'), 1);

select pg_temp.expect_count('prof: vê a própria entitlement (E2, Produto C)',
  pg_temp.fx('prof'),
  format('select count(*) from public.product_entitlements where id = %L', '90000000-0000-4000-8000-000000000032'), 1);

-- ================= SELECT — usuária A não vê/altera entitlement de B ====

-- (3) member (nem dona de C, nem Master) NÃO vê a entitlement do prof em C
select pg_temp.expect_count('member: NÃO vê a entitlement do prof em C (isolamento real)',
  pg_temp.fx('member'),
  format('select count(*) from public.product_entitlements where id = %L', '90000000-0000-4000-8000-000000000032'), 0);

-- (6) isolamento entre comunidades: já provado acima por "member: NÃO vê a
-- entitlement do prof em C" — member não é dona de C nem é Master, é a
-- estranha genuína. (Um teste equivalente com `prof` não funcionaria: E2,
-- a única entitlement de C, pertence à própria prof — `profile_id =
-- auth.uid()` já a deixaria ver por ownership pessoal, não provaria
-- isolamento por comunidade. Evitado de propósito para não confundir
-- bypass legítimo de dono com vazamento real.)

-- Caso positivo (NÃO é vazamento — é o bypass by design de dona de
-- comunidade, mesmo padrão de product_payouts/P1-D): prof, dona de A,
-- vê TODAS as entitlements de A (E1 do member e E3 revogada do master).
select pg_temp.expect_count('prof: vê as entitlements de A como dona da comunidade (by design)',
  pg_temp.fx('prof'),
  format('select count(*) from public.product_entitlements where community_id = %L', pg_temp.fx('commA')), 2);

-- (7) Master vê tudo — bypass explícito na policy, confirmado por execução
select pg_temp.expect_count('master: vê as 3 entitlements (E1, E2, E3) — bypass by design',
  pg_temp.fx('master'),
  format('select count(*) from public.product_entitlements where id in (%L,%L,%L)',
         '90000000-0000-4000-8000-000000000031',
         '90000000-0000-4000-8000-000000000032',
         '90000000-0000-4000-8000-000000000033'), 3);

-- (8) anon bloqueado
select pg_temp.expect_locked('anon: NÃO vê product_entitlements',
  null,
  'select count(*) from public.product_entitlements');

-- ================= (4)+(5) escrita — sem GRANT para authenticated ========
-- Ninguém (nem a própria dona, nem a dona da comunidade, nem Master)
-- consegue criar ou alterar entitlement — só service_role (webhook).

select pg_temp.expect_write('member: INSERT entitlement para si mesma (produto C, sem ter comprado) -> BLOQUEADO',
  pg_temp.fx('member'),
  format('insert into public.product_entitlements (order_id, product_id, profile_id, community_id, source) values (%L,%L,%L,%L,''manual_grant'')',
         '90000000-0000-4000-8000-000000000012', '90000000-0000-4000-8000-000000000002',
         pg_temp.fx('member'), pg_temp.fx('commC')), false);

select pg_temp.expect_write('member: UPDATE reatribuindo profile_id de E2 (do prof) para si mesma -> BLOQUEADO',
  pg_temp.fx('member'),
  format('update public.product_entitlements set profile_id = %L where id = %L',
         pg_temp.fx('member'), '90000000-0000-4000-8000-000000000032'), false);

select pg_temp.expect_write('master: UPDATE reativando a própria entitlement revogada (E3) -> BLOQUEADO',
  pg_temp.fx('master'),
  format('update public.product_entitlements set revoked_at = null where id = %L',
         '90000000-0000-4000-8000-000000000033'), false);

select pg_temp.expect_write('prof: UPDATE revogando a entitlement do member (E1), mesmo sendo dona da comunidade -> BLOQUEADO',
  pg_temp.fx('prof'),
  format('update public.product_entitlements set revoked_at = now() where id = %L',
         '90000000-0000-4000-8000-000000000031'), false);

select pg_temp.expect_write('member: DELETE da própria entitlement (E1) -> BLOQUEADO',
  pg_temp.fx('member'),
  format('delete from public.product_entitlements where id = %L', '90000000-0000-4000-8000-000000000031'), false);

-- ================= (9) revogado/inativo — has_product_access ============
-- A RLS de SELECT não filtra revoked_at (linha revogada continua
-- visível para dona/dona-da-comunidade/master — histórico). O GATE real
-- de acesso ao conteúdo é `has_product_access()`, que filtra
-- `revoked_at is null`.

-- master ainda VÊ a própria linha revogada (E3) — visibilidade histórica,
-- não é acesso ao produto.
select pg_temp.expect_count('master: ainda vê a própria entitlement revogada (E3, histórico)',
  pg_temp.fx('master'),
  format('select count(*) from public.product_entitlements where id = %L', '90000000-0000-4000-8000-000000000033'), 1);

-- has_product_access: member (E1 ativa) -> true
select pg_temp.expect_bool('member: has_product_access(Produto A) com entitlement ATIVA -> true',
  pg_temp.fx('member'),
  format('select public.has_product_access(%L)', '90000000-0000-4000-8000-000000000001'), true);

-- has_product_access: master (E3 revogada, MESMO produto A) -> false
select pg_temp.expect_bool('master: has_product_access(Produto A) com entitlement REVOGADA -> false',
  pg_temp.fx('master'),
  format('select public.has_product_access(%L)', '90000000-0000-4000-8000-000000000001'), false);

-- has_product_access: prof nunca comprou o Produto A -> false
select pg_temp.expect_bool('prof: has_product_access(Produto A) sem NENHUMA entitlement -> false',
  pg_temp.fx('prof'),
  format('select public.has_product_access(%L)', '90000000-0000-4000-8000-000000000001'), false);

-- ---------- RESULTADO --------------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
