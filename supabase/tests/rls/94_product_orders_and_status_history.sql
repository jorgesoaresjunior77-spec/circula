-- =====================================================================
-- 94 — product_orders + product_order_status_history (RLS conjunta)
-- =====================================================================
-- Fecha o gap identificado na auditoria: `product_orders` nunca teve
-- cenário PRÓPRIO de RLS (só aparecia como fixture em 86/82), e
-- `product_order_status_history` nunca foi testada. A policy do
-- histórico DERIVA ownership inteiramente de `product_orders` (não tem
-- community_id/profile_id próprios), então este cenário prova os dois
-- níveis juntos, na mesma transação, com as MESMAS fixtures.
--
-- Policies auditadas ao vivo (pg_policies) — nenhuma alterada aqui:
--   product_orders_select =
--     buyer_profile_id = auth.uid() OR owns_community(community_id) OR is_master()
--   product_order_status_history_select =
--     is_master() OR EXISTS(product_orders o WHERE o.id = order_id
--       AND (o.buyer_profile_id = auth.uid() OR owns_community(o.community_id)))
--
-- GRANTs auditados ao vivo (information_schema.role_table_grants):
--   product_orders:               anon=nenhum · authenticated=SELECT ·
--                                  service_role=SELECT,INSERT,UPDATE (SEM DELETE) ·
--                                  postgres=CRUD completo
--   product_order_status_history: anon=nenhum · authenticated=SELECT ·
--                                  service_role=SELECT (SEM INSERT, SEM UPDATE, SEM DELETE) ·
--                                  postgres=CRUD completo
-- O INSERT de service_role em product_order_status_history existia até
-- a migration 20260929130000 -- era redundante (o trigger, SECURITY
-- DEFINER de propriedade de postgres, nunca dependeu dele) e sem
-- nenhum consumidor real no repositório; foi revogado. Ver auditoria
-- que precedeu essa migration para as evidências completas.
-- Ou seja: mesmo Master (que é só `authenticated` com profiles.role=
-- 'master' — NÃO é um role de Postgres à parte) não tem NENHUM grant de
-- escrita nas duas tabelas. `owns_community()` só concede SELECT via
-- policy — nunca escrita, confirmado abaixo por execução real.
--
-- `owns_community(p_community_id)` (STABLE SECURITY DEFINER) é só
-- `communities.owner_id = auth.uid()` — sem checar `profiles.role`,
-- então qualquer perfil real pode ser "dona" de uma comunidade
-- sintética para fins de teste (confirmado lendo a função antes de
-- escrever este cenário).
--
-- Personas usadas:
--   comprador A       = member (fixture, compra em A)
--   comprador B       = perfil real PRÉ-EXISTENTE '335783ca-e125-4aaf-
--                       91c3-0ded657723fb' ("Professional B", role=
--                       professional, mesmo perfil já usado em
--                       91_professional_billing_accounts.sql para
--                       isolamento profissional-a-profissional
--                       genuíno — sem nenhuma order prévia como
--                       comprador, confirmado antes de escrever este
--                       cenário) — ela também assume o papel de DONA da
--                       comunidade B sintética abaixo (dois papéis
--                       diferentes, mesmo perfil, mesma técnica de
--                       "master dono de C" em 82/86).
--   Professional A    = prof (fixture, dona da comunidade REAL A)
--   Professional B    = perfil acima, dona da comunidade B SINTÉTICA
--   Master            = master (fixture, bypass by design)
--   anon / authenticated genérico = cobertos pelas próprias personas
--                       acima (member/ProfB nunca têm relação com a
--                       ordem da outra — já prova o caso "authenticated
--                       sem vínculo nenhum")
--   service_role      = testado à parte (sem helper pronto no
--                       framework — usa `execute 'set local role
--                       service_role'`, mesmo padrão já usado em
--                       93_process_platform_subscription_payment.sql)
--
-- Fixtures 100% sintéticas (produtos A/B, comunidade B, 3 pedidos) com
-- prefixo 94000000-... — nenhuma colide com dado real nem com fixtures
-- de outros arquivos (cada cenário é uma transação isolada). Tudo em
-- ROLLBACK final — nada persiste, inclusive as escritas de service_role
-- que forem ALLOWED.
-- =====================================================================

-- comunidade B: `communities.owner_id` é UNIQUE (confirmado por
-- execução real — a tentativa de criar uma comunidade SINTÉTICA para
-- Professional B colidiu com "communities_owner_id_key", porque ela já
-- é dona de 1 comunidade REAL). Por isso reusamos a comunidade REAL
-- dela (buscada dinamicamente, não hardcoded) em vez de criar uma nova
-- — os testes abaixo sempre filtram por id específico de pedido/
-- histórico, nunca por contagem agregada de community_id, então
-- qualquer dado pré-existente nessa comunidade real não interfere.
do $$
declare v_commB uuid;
begin
  select id into v_commB from public.communities
    where owner_id = '335783ca-e125-4aaf-91c3-0ded657723fb' limit 1;
  if v_commB is null then
    raise exception '94: fixture ausente — Professional B (335783ca-...) não é dona de nenhuma comunidade';
  end if;

  insert into public.products
    (id, community_id, created_by, type, title, price_cents, currency, status)
  values
    ('94000000-0000-4000-8000-0000000000a1',
     pg_temp.fx('commA'), pg_temp.fx('prof'),
     'ebook', '[rls-suite] Produto A (94)', 1000, 'BRL', 'published');

  insert into public.products
    (id, community_id, created_by, type, title, price_cents, currency, status)
  values
    ('94000000-0000-4000-8000-0000000000b1',
     v_commB, '335783ca-e125-4aaf-91c3-0ded657723fb',
     'ebook', '[rls-suite] Produto B (94)', 1000, 'BRL', 'published');

  -- Order B1: produto B (comunidade REAL de Professional B), comprador =
  -- master -- prova isolamento por COMUNIDADE (prof/A não deveria ver,
  -- Professional B deveria ver como dona).
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
    ('94000000-0000-4000-8000-0000000000e3',
     '94000000-0000-4000-8000-0000000000b1', v_commB,
     pg_temp.fx('master'), '335783ca-e125-4aaf-91c3-0ded657723fb', 1,
     'awaiting_payment', 'pending', 'not_applicable',
     '[rls-suite] Produto B (94)', 'ebook',
     1000, 'BRL', 1000,
     'native', 'none',
     10.00, 100, 900, 'wallet_sintetico_B_94',
     '94000000-0000-4000-8000-0000000000f3');
end $$;

-- Order A1: produto A, comprador = member (comprador A). Começa em
-- awaiting_payment/pending/not_applicable de propósito — é a ordem que
-- vamos UPDATE mais abaixo para provar o trigger (secao 8).
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
  ('94000000-0000-4000-8000-0000000000e1',
   '94000000-0000-4000-8000-0000000000a1', pg_temp.fx('commA'),
   pg_temp.fx('member'), pg_temp.fx('prof'), 1,
   'awaiting_payment', 'pending', 'not_applicable',
   '[rls-suite] Produto A (94)', 'ebook',
   1000, 'BRL', 1000,
   'native', 'none',
   10.00, 100, 900, 'wallet_sintetico_A_94',
   '94000000-0000-4000-8000-0000000000f1');

-- Order A2: MESMO produto A (mesma comunidade), comprador = Professional
-- B (comprador B) -- prova isolamento comprador-a-comprador DENTRO da
-- MESMA comunidade, independente de quem é dona.
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
  ('94000000-0000-4000-8000-0000000000e2',
   '94000000-0000-4000-8000-0000000000a1', pg_temp.fx('commA'),
   '335783ca-e125-4aaf-91c3-0ded657723fb', pg_temp.fx('prof'), 1,
   'awaiting_payment', 'pending', 'not_applicable',
   '[rls-suite] Produto A (94)', 'ebook',
   1000, 'BRL', 1000,
   'native', 'none',
   10.00, 100, 900, 'wallet_sintetico_A_94',
   '94000000-0000-4000-8000-0000000000f2');

-- transicao de A2 e B1 (fixture, como postgres/dono -> ignora RLS) só
-- para cada uma gerar EXATAMENTE 1 linha de historico, usada nas
-- asercoes de isolamento da secao 5. A transicao de A1 (com o trigger
-- documentado passo a passo) vem depois, feita como service_role.
update public.product_orders set status = 'completed', financial_status = 'received'
  where id = '94000000-0000-4000-8000-0000000000e2';
update public.product_orders set status = 'completed', financial_status = 'received'
  where id = '94000000-0000-4000-8000-0000000000e3';

-- =====================================================================
-- SECAO 4 — product_orders: SELECT
-- =====================================================================

select pg_temp.expect_count('product_orders: comprador A (member) vê o próprio pedido A1',
  pg_temp.fx('member'),
  'select count(*) from public.product_orders where id = ''94000000-0000-4000-8000-0000000000e1''', 1);

select pg_temp.expect_count('product_orders: comprador A (member) NÃO vê pedido de comprador B na MESMA comunidade (A2)',
  pg_temp.fx('member'),
  'select count(*) from public.product_orders where id = ''94000000-0000-4000-8000-0000000000e2''', 0);

select pg_temp.expect_count('product_orders: comprador A (member) NÃO vê pedido de outra comunidade (B1)',
  pg_temp.fx('member'),
  'select count(*) from public.product_orders where id = ''94000000-0000-4000-8000-0000000000e3''', 0);

select pg_temp.expect_count('product_orders: comprador B (ProfB) vê o próprio pedido A2',
  '335783ca-e125-4aaf-91c3-0ded657723fb',
  'select count(*) from public.product_orders where id = ''94000000-0000-4000-8000-0000000000e2''', 1);

select pg_temp.expect_count('product_orders: Professional A (prof) vê os 2 pedidos da própria comunidade A (A1+A2)',
  pg_temp.fx('prof'),
  'select count(*) from public.product_orders where id in (''94000000-0000-4000-8000-0000000000e1'',''94000000-0000-4000-8000-0000000000e2'')', 2);

select pg_temp.expect_count('product_orders: Professional A (prof) NÃO vê pedido da comunidade B (B1)',
  pg_temp.fx('prof'),
  'select count(*) from public.product_orders where id = ''94000000-0000-4000-8000-0000000000e3''', 0);

select pg_temp.expect_count('product_orders: Professional B vê o pedido da própria comunidade B (B1, como DONA)',
  '335783ca-e125-4aaf-91c3-0ded657723fb',
  'select count(*) from public.product_orders where id = ''94000000-0000-4000-8000-0000000000e3''', 1);

select pg_temp.expect_count('product_orders: Professional B NÃO vê pedido A1 (nem compradora, nem dona de A)',
  '335783ca-e125-4aaf-91c3-0ded657723fb',
  'select count(*) from public.product_orders where id = ''94000000-0000-4000-8000-0000000000e1''', 0);

select pg_temp.expect_count('product_orders: Master vê os 3 pedidos (A1, A2, B1) — bypass by design',
  pg_temp.fx('master'),
  'select count(*) from public.product_orders where id in (''94000000-0000-4000-8000-0000000000e1'',''94000000-0000-4000-8000-0000000000e2'',''94000000-0000-4000-8000-0000000000e3'')', 3);

select pg_temp.expect_locked('product_orders: anon NÃO vê nada (sem GRANT)',
  null,
  'select count(*) from public.product_orders');

-- =====================================================================
-- SECAO 4 (continuacao) — product_orders: INSERT/UPDATE/DELETE
-- Nao presumido: confirmado acima por information_schema que
-- authenticated so tem SELECT e service_role so tem SELECT/INSERT/
-- UPDATE (sem DELETE). Testado abaixo por execucao real.
-- =====================================================================

select pg_temp.expect_write('product_orders: member INSERT pedido forjado -> BLOQUEADO (sem GRANT)',
  pg_temp.fx('member'),
  format('insert into public.product_orders
            (product_id, community_id, buyer_profile_id, seller_id,
             status, financial_status, fulfillment_status,
             product_title_snapshot, product_type_snapshot,
             unit_price_cents_snapshot, currency_snapshot, amount_total_cents,
             split_model_snapshot, split_rule_source,
             circula_percent_snapshot, circula_amount_cents_snapshot,
             professional_amount_cents_snapshot, professional_wallet_id_snapshot,
             idempotency_key)
          values (%L,%L,%L,%L,''completed'',''received'',''not_applicable'',
                  ''forjado'',''ebook'',1000,''BRL'',1000,''native'',''none'',
                  10.00,100,900,''wallet_forjada'',gen_random_uuid())',
         '94000000-0000-4000-8000-0000000000a1', pg_temp.fx('commA'),
         pg_temp.fx('member'), pg_temp.fx('prof')), false);

select pg_temp.expect_write('product_orders: member UPDATE do PRÓPRIO pedido A1 (marcar completed) -> BLOQUEADO (sem GRANT, nem no próprio)',
  pg_temp.fx('member'),
  'update public.product_orders set status = ''completed'' where id = ''94000000-0000-4000-8000-0000000000e1''', false);

select pg_temp.expect_write('product_orders: prof UPDATE de pedido da PRÓPRIA comunidade A -> BLOQUEADO (owns_community só dá SELECT)',
  pg_temp.fx('prof'),
  'update public.product_orders set status = ''canceled'' where id = ''94000000-0000-4000-8000-0000000000e1''', false);

select pg_temp.expect_write('product_orders: master UPDATE direto -> BLOQUEADO (sem GRANT de escrita, mesmo sendo master)',
  pg_temp.fx('master'),
  'update public.product_orders set status = ''canceled'' where id = ''94000000-0000-4000-8000-0000000000e1''', false);

select pg_temp.expect_write('product_orders: member DELETE -> BLOQUEADO',
  pg_temp.fx('member'),
  'delete from public.product_orders where id = ''94000000-0000-4000-8000-0000000000e1''', false);

-- =====================================================================
-- SECAO 8 — TRIGGER product_orders_log_status_change (passo a passo)
-- Transicao de A1 feita como service_role (mesma role usada pela Edge
-- Function em producao) -- prova ao mesmo tempo que service_role TEM
-- UPDATE em product_orders (grant real) e dispara o trigger.
-- =====================================================================

do $$
declare
  v_before      bigint;
  v_after       bigint;
  v_ok          boolean := false;
  v_code        text := '';
  v_order_id    uuid;
  v_old_status  text;
  v_new_status  text;
  v_old_fin     text;
  v_new_fin     text;
  v_old_ful     text;
  v_new_ful     text;
begin
  select count(*) into v_before from public.product_order_status_history
    where order_id = '94000000-0000-4000-8000-0000000000e1';

  execute 'set local role service_role';
  begin
    update public.product_orders
      set status = 'completed', financial_status = 'received'
      where id = '94000000-0000-4000-8000-0000000000e1';
    v_ok := true;
  exception when others then
    v_ok := false; v_code := sqlstate;
  end;
  execute 'reset role';

  insert into _r(name,kind,expect,got,ok) values
    ('94: service_role UPDATE product_orders (transição A1) -> ALLOWED (grant real)','write','ALLOWED',
     case when v_ok then 'ALLOWED' else 'BLOCKED('||v_code||')' end, v_ok);

  select count(*) into v_after from public.product_order_status_history
    where order_id = '94000000-0000-4000-8000-0000000000e1';

  insert into _r(name,kind,expect,got,ok) values
    ('94: trigger gerou exatamente 1 linha nova de histórico para A1','count','1',
     (v_after - v_before)::text, (v_after - v_before) = 1);

  select order_id, old_status, new_status, old_financial_status, new_financial_status,
         old_fulfillment_status, new_fulfillment_status
    into v_order_id, v_old_status, v_new_status, v_old_fin, v_new_fin, v_old_ful, v_new_ful
    from public.product_order_status_history
    where order_id = '94000000-0000-4000-8000-0000000000e1'
    order by created_at desc limit 1;

  insert into _r(name,kind,expect,got,ok) values
    ('94: histórico A1 -- order_id correto','bool','true',
     (v_order_id = '94000000-0000-4000-8000-0000000000e1')::text, v_order_id = '94000000-0000-4000-8000-0000000000e1');
  insert into _r(name,kind,expect,got,ok) values
    ('94: histórico A1 -- old_status/new_status corretos','bool','true',
     (v_old_status = 'awaiting_payment' and v_new_status = 'completed')::text,
     v_old_status = 'awaiting_payment' and v_new_status = 'completed');
  insert into _r(name,kind,expect,got,ok) values
    ('94: histórico A1 -- old_financial_status/new_financial_status corretos','bool','true',
     (v_old_fin = 'pending' and v_new_fin = 'received')::text,
     v_old_fin = 'pending' and v_new_fin = 'received');
  insert into _r(name,kind,expect,got,ok) values
    ('94: histórico A1 -- fulfillment_status não mudou (old=new=not_applicable)','bool','true',
     (v_old_ful = 'not_applicable' and v_new_ful = 'not_applicable')::text,
     v_old_ful = 'not_applicable' and v_new_ful = 'not_applicable');
end $$;

-- =====================================================================
-- SECAO 5 + 9 — product_order_status_history: SELECT (isolamento NÍVEL 2)
-- =====================================================================

select pg_temp.expect_count('histórico: comprador A (member) vê o histórico do PRÓPRIO pedido (A1)',
  pg_temp.fx('member'),
  'select count(*) from public.product_order_status_history where order_id = ''94000000-0000-4000-8000-0000000000e1''', 1);

select pg_temp.expect_count('histórico: comprador A (member) NÃO vê histórico do pedido de comprador B na MESMA comunidade (A2)',
  pg_temp.fx('member'),
  'select count(*) from public.product_order_status_history where order_id = ''94000000-0000-4000-8000-0000000000e2''', 0);

select pg_temp.expect_count('histórico: comprador A (member) NÃO vê histórico de outra comunidade (B1)',
  pg_temp.fx('member'),
  'select count(*) from public.product_order_status_history where order_id = ''94000000-0000-4000-8000-0000000000e3''', 0);

select pg_temp.expect_count('histórico: Professional A (prof) vê histórico dos 2 pedidos da própria comunidade A (A1+A2)',
  pg_temp.fx('prof'),
  'select count(*) from public.product_order_status_history where order_id in (''94000000-0000-4000-8000-0000000000e1'',''94000000-0000-4000-8000-0000000000e2'')', 2);

select pg_temp.expect_count('histórico: Professional A (prof) NÃO vê histórico da comunidade B (B1)',
  pg_temp.fx('prof'),
  'select count(*) from public.product_order_status_history where order_id = ''94000000-0000-4000-8000-0000000000e3''', 0);

select pg_temp.expect_count('histórico: Professional B vê o PRÓPRIO histórico como compradora (A2)',
  '335783ca-e125-4aaf-91c3-0ded657723fb',
  'select count(*) from public.product_order_status_history where order_id = ''94000000-0000-4000-8000-0000000000e2''', 1);

select pg_temp.expect_count('histórico: Professional B vê histórico da PRÓPRIA comunidade B, como dona (B1)',
  '335783ca-e125-4aaf-91c3-0ded657723fb',
  'select count(*) from public.product_order_status_history where order_id = ''94000000-0000-4000-8000-0000000000e3''', 1);

select pg_temp.expect_count('histórico: Professional B NÃO vê histórico de A1 (nem compradora, nem dona de A)',
  '335783ca-e125-4aaf-91c3-0ded657723fb',
  'select count(*) from public.product_order_status_history where order_id = ''94000000-0000-4000-8000-0000000000e1''', 0);

select pg_temp.expect_count('histórico: Master vê o histórico dos 3 pedidos (A1, A2, B1) — bypass by design',
  pg_temp.fx('master'),
  'select count(*) from public.product_order_status_history where order_id in (''94000000-0000-4000-8000-0000000000e1'',''94000000-0000-4000-8000-0000000000e2'',''94000000-0000-4000-8000-0000000000e3'')', 3);

select pg_temp.expect_locked('histórico: anon NÃO vê nada (sem GRANT)',
  null,
  'select count(*) from public.product_order_status_history');

-- =====================================================================
-- SECAO 6 + 7 — APPEND-ONLY: UPDATE/DELETE sempre bloqueados; INSERT
-- forjado por authenticated bloqueado; superfície real de service_role
-- documentada por execução (sem alterar grants para o teste passar).
-- =====================================================================

select pg_temp.expect_write('histórico: member UPDATE (reason) -> BLOQUEADO (sem GRANT)',
  pg_temp.fx('member'),
  'update public.product_order_status_history set reason = ''forjado'' where order_id = ''94000000-0000-4000-8000-0000000000e1''', false);

select pg_temp.expect_write('histórico: member DELETE do próprio histórico -> BLOQUEADO (sem GRANT)',
  pg_temp.fx('member'),
  'delete from public.product_order_status_history where order_id = ''94000000-0000-4000-8000-0000000000e1''', false);

select pg_temp.expect_write('histórico: member INSERT forjado -> BLOQUEADO (sem GRANT de INSERT para authenticated)',
  pg_temp.fx('member'),
  format('insert into public.product_order_status_history (order_id, old_status, new_status) values (%L,''completed'',''canceled'')',
         '94000000-0000-4000-8000-0000000000e1'), false);

select pg_temp.expect_write('histórico: master UPDATE direto -> BLOQUEADO (master não tem GRANT de escrita, só bypass de SELECT)',
  pg_temp.fx('master'),
  'update public.product_order_status_history set reason = ''forjado por master'' where order_id = ''94000000-0000-4000-8000-0000000000e1''', false);

select pg_temp.expect_write('histórico: master DELETE direto -> BLOQUEADO',
  pg_temp.fx('master'),
  'delete from public.product_order_status_history where order_id = ''94000000-0000-4000-8000-0000000000e1''', false);

do $$
declare v_ok boolean; v_code text := '';
begin
  -- service_role UPDATE -> deve ser BLOQUEADO (grant real confirmado: SEM UPDATE)
  execute 'set local role service_role';
  begin
    update public.product_order_status_history set reason = 'forjado por service_role'
      where order_id = '94000000-0000-4000-8000-0000000000e1';
    v_ok := true;
  exception when others then
    v_ok := false; v_code := sqlstate;
  end;
  execute 'reset role';
  insert into _r(name,kind,expect,got,ok) values
    ('94: histórico -- service_role UPDATE -> BLOQUEADO (sem GRANT de UPDATE)','write','BLOCKED',
     case when v_ok then 'ALLOWED' else 'BLOCKED('||v_code||')' end, not v_ok);
end $$;

do $$
declare v_ok boolean; v_code text := '';
begin
  -- service_role DELETE -> deve ser BLOQUEADO (grant real confirmado: SEM DELETE)
  execute 'set local role service_role';
  begin
    delete from public.product_order_status_history
      where order_id = '94000000-0000-4000-8000-0000000000e1';
    v_ok := true;
  exception when others then
    v_ok := false; v_code := sqlstate;
  end;
  execute 'reset role';
  insert into _r(name,kind,expect,got,ok) values
    ('94: histórico -- service_role DELETE -> BLOQUEADO (sem GRANT de DELETE)','write','BLOCKED',
     case when v_ok then 'ALLOWED' else 'BLOCKED('||v_code||')' end, not v_ok);
end $$;

do $$
declare v_ok boolean; v_code text := '';
begin
  -- service_role INSERT direto (fora do trigger) -> BLOQUEADO desde a
  -- migration 20260929130000 (REVOKE INSERT ... FROM service_role).
  -- Achado da auditoria anterior: esse grant nunca foi necessário para
  -- o trigger (SECURITY DEFINER, dono postgres, não depende do
  -- privilégio de quem chamou o UPDATE em product_orders) e nenhum
  -- código do repositório fazia INSERT direto nesta tabela. Revogado.
  -- O SELECT de service_role permanece intacto (não tocado por essa
  -- migration) e o trigger continua criando histórico normalmente
  -- (provado logo acima, seção do trigger, usando o mesmo service_role
  -- para o UPDATE em product_orders -- só o INSERT direto mudou).
  execute 'set local role service_role';
  begin
    insert into public.product_order_status_history (order_id, old_status, new_status)
      values ('94000000-0000-4000-8000-0000000000e1', 'completed', 'refunded');
    v_ok := true;
  exception when others then
    v_ok := false; v_code := sqlstate;
  end;
  execute 'reset role';
  insert into _r(name,kind,expect,got,ok) values
    ('94: histórico -- service_role INSERT direto (fora do trigger) -> BLOQUEADO (grant redundante revogado em 20260929130000)',
     'write','BLOCKED',
     case when v_ok then 'ALLOWED' else 'BLOCKED('||v_code||')' end, not v_ok);
end $$;

do $$
declare v_ok boolean; v_code text := ''; v_n bigint;
begin
  -- service_role SELECT -> continua ALLOWED (grant não tocado pela
  -- migration 20260929130000, que revogou só o INSERT).
  execute 'set local role service_role';
  begin
    select count(*) into v_n from public.product_order_status_history
      where order_id = '94000000-0000-4000-8000-0000000000e1';
    v_ok := true;
  exception when others then
    v_ok := false; v_code := sqlstate;
  end;
  execute 'reset role';
  insert into _r(name,kind,expect,got,ok) values
    ('94: histórico -- service_role SELECT -> ALLOWED (grant intacto, não tocado pelo REVOKE do INSERT)',
     'write','ALLOWED',
     case when v_ok then 'ALLOWED' else 'BLOCKED('||v_code||')' end, v_ok);
end $$;

-- ---------- RESULTADO --------------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
