-- =====================================================================
-- 89 — CATÁLOGO DE PRODUTOS: products
-- =====================================================================
-- Fase P1-F3.1 (terceira tabela do cluster Split & Pricing).
-- `public.products` (`20260828130000`) é o catálogo de produtos
-- digitais/físicos à venda em cada comunidade — `price_cents` alimenta
-- diretamente `create_product_order()` (que trava a linha com
-- `FOR UPDATE` e congela o preço no pedido via `resolve_split()`).
-- Nunca teve cenário de RLS.
--
-- Estrutura auditada ao vivo (information_schema + pg_constraint):
--   id uuid pk · community_id uuid not null (fk -> communities.id,
--   ON DELETE CASCADE) · created_by uuid not null (fk -> profiles.id,
--   ON DELETE CASCADE) · type text (check: course|ebook|workshop|
--   event|consultation|physical) · title · description · cover_image_url
--   · price_cents int >= 0 (check: published exige price_cents > 0) ·
--   currency (check: só 'BRL') · status text (check: draft|published|
--   archived) · max_quantity int > 0 nullable · deliverable_kind (check:
--   none|file|external_link|scheduling) · deliverable_url ·
--   deliverable_file_path · event_* · requires_shipping · checkout_url
--   (check: https) · created_at/updated_at.
--   SEM relação com billing_plans (catálogo de produto é independente
--   do catálogo de planos de assinatura).
--
-- Policies auditadas ao vivo (pg_policies):
--   products_select = is_master() OR owns_community(community_id)
--                      OR (is_community_member(community_id) AND status = 'published')
--   products_insert (WITH CHECK) = owns_community(community_id) AND created_by = auth.uid()
--   products_update (USING + WITH CHECK) = owns_community(community_id)
--   products_delete = owns_community(community_id)
--
-- Diferença estrutural importante em relação a `revenue_split_rules`/
-- `platform_split_settings` (87/88): lá o GRANT já bloqueava
-- UPDATE/DELETE para todo mundo, inclusive Master. Aqui o GRANT a
-- `authenticated` é CRUD completo (INSERT, SELECT, UPDATE, DELETE) —
-- a RLS é a ÚNICA linha de defesa. E, diferente de `revenue_split_rules`/
-- `platform_split_settings`, a policy de UPDATE/DELETE NÃO tem bypass
-- de `is_master()` — só `owns_community()`. Ou seja: Master VÊ todos os
-- produtos (bypass só no SELECT) mas NÃO PODE editar/apagar produto de
-- Professional nenhuma — confirmado por execução (bloqueio por
-- `USING`/0 linhas, não por GRANT).
-- `anon`: nenhum GRANT (nem SELECT) — bloqueado antes da RLS.
--
-- Relação com outras tabelas:
--   `product_orders.product_id` e `product_entitlements.product_id`
--   referenciam `products(id)` com `ON DELETE RESTRICT` — um produto
--   com pedido/entitlement associado NÃO PODE ser apagado, nem pelo
--   próprio dono (constraint de banco, não RLS). O fixture de DELETE
--   "autorizado" abaixo usa um produto sintético sem nenhum pedido.
--   `product_payouts`/`revenue_split_rules`/`platform_split_settings`
--   não referenciam `products` diretamente — a ponte é `product_orders`
--   (já coberto no cenário 82) e `resolve_split()` (87/88).
--
-- SECURITY DEFINER: só `create_product_order()` lê `public.products`
-- (`SELECT ... FOR UPDATE` para travar o preço no pedido) — `EXECUTE`
-- continua revogado de `anon`/`authenticated` (mesmo achado de 87/88):
-- não roda direto do cliente, só via Edge Function server-side. Como a
-- função é SECURITY DEFINER e lê a linha inteira (inclusive rascunho/
-- preço), uma falha na policy de `products` não comprometeria o
-- congelamento do preço em si (a função já bypassa RLS por design) —
-- o que a RLS desta tabela protege é QUEM PODE VER/ALTERAR o catálogo
-- ANTES da compra (preço, status, estoque de outra comunidade).
--
-- Este cenário testa SÓ a segurança de acesso à tabela — não a lógica
-- de criação de pedido/preço (fora de escopo, `create_product_order()`
-- não foi alterada aqui).
--
-- Fixtures: 1 comunidade sintética C (dona = master, mesma técnica de
-- 82/86/87/88) + 3 produtos sintéticos em A (real, dona = prof) e C.
-- Reaproveita o produto REAL publicado de A
-- (`1f1c7430-03d6-4c9b-ae27-ed0bd854c88b`, 3 pedidos reais associados)
-- só para leitura e para uma tentativa de escrita sempre bloqueada —
-- nunca é alterado de fato (toda escrita roda em transação com
-- ROLLBACK final). Tudo desfeito no ROLLBACK — nenhum dado persiste.
-- =====================================================================

insert into public.communities (id, owner_id, name, slug, is_discoverable)
values (pg_temp.fx('commC'), pg_temp.fx('master'),
        '[rls-suite] Comunidade C (products)', 'rls-suite-c-products', false);

insert into public.products (id, community_id, created_by, type, title, price_cents, status)
values
  ('91111111-0000-4000-8000-000000000001', pg_temp.fx('commA'), pg_temp.fx('prof'), 'ebook', '[rls-suite] P1 draft A', 0, 'draft'),
  ('91111111-0000-4000-8000-000000000002', pg_temp.fx('commA'), pg_temp.fx('prof'), 'ebook', '[rls-suite] P2 published A', 1500, 'published'),
  ('91111111-0000-4000-8000-000000000003', pg_temp.fx('commC'), pg_temp.fx('master'), 'ebook', '[rls-suite] P3 published C', 2500, 'published');

-- ================= LEITURA ==============================================

-- dono/profissional autorizada: prof vê o próprio rascunho (P1) — não
-- depende de status='published', é a dona.
select pg_temp.expect_count('prof: vê o próprio rascunho P1 (dona)',
  pg_temp.fx('prof'),
  'select count(*) from public.products where id = ''91111111-0000-4000-8000-000000000001''', 1);

-- membro autorizado: member (ativo em A) vê o produto REAL publicado de
-- A, mas NÃO vê o rascunho sintético P1 (mesma comunidade, mas
-- status<>'published' e member não é dona).
select pg_temp.expect_count('member: vê o produto REAL publicado de A',
  pg_temp.fx('member'),
  format('select count(*) from public.products where id = %L', '1f1c7430-03d6-4c9b-ae27-ed0bd854c88b'), 1);

select pg_temp.expect_count('member: NÃO vê o rascunho P1 de A (mesma comunidade, mas draft)',
  pg_temp.fx('member'),
  'select count(*) from public.products where id = ''91111111-0000-4000-8000-000000000001''', 0);

-- usuário de outra comunidade: prof (dona de A) não vê produto de C.
select pg_temp.expect_count('prof: NÃO vê produto de C (outra comunidade, isolamento)',
  pg_temp.fx('prof'),
  'select count(*) from public.products where id = ''91111111-0000-4000-8000-000000000003''', 0);

-- usuário sem vínculo algum: member não é membro de C.
select pg_temp.expect_count('member: NÃO vê produto de C (sem vínculo)',
  pg_temp.fx('member'),
  'select count(*) from public.products where id = ''91111111-0000-4000-8000-000000000003''', 0);

-- anon bloqueado.
select pg_temp.expect_locked('anon: NÃO vê products (sem GRANT)',
  null,
  'select count(*) from public.products');

-- Master conforme a policy real: bypass só no SELECT, vê rascunho e
-- publicado, de A e de C.
select pg_temp.expect_count('master: vê P1 (draft A), P2 (published A) e P3 (published C) — bypass by design',
  pg_temp.fx('master'),
  'select count(*) from public.products where id in (''91111111-0000-4000-8000-000000000001'',''91111111-0000-4000-8000-000000000002'',''91111111-0000-4000-8000-000000000003'')', 3);

-- ================= ESCRITA: criação ======================================

-- persona autorizada: prof cria produto na própria comunidade A.
select pg_temp.expect_write('prof: INSERT produto em A (dona) -> PERMITIDO',
  pg_temp.fx('prof'),
  format('insert into public.products (community_id, created_by, type, title, price_cents, status) values (%L,%L,''ebook'',''x'',100,''draft'')',
         pg_temp.fx('commA'), pg_temp.fx('prof')),
  true);

-- persona não autorizada: prof tenta criar produto em C (não é dona).
select pg_temp.expect_write('prof: INSERT produto em C (não é dona) -> BLOQUEADO',
  pg_temp.fx('prof'),
  format('insert into public.products (community_id, created_by, type, title, price_cents, status) values (%L,%L,''ebook'',''x'',100,''draft'')',
         pg_temp.fx('commC'), pg_temp.fx('prof')),
  false);

-- persona não autorizada: member (só membro ativo, não dona) tenta
-- criar produto em A.
select pg_temp.expect_write('member: INSERT produto em A (só membro, não dona) -> BLOQUEADO',
  pg_temp.fx('member'),
  format('insert into public.products (community_id, created_by, type, title, price_cents, status) values (%L,%L,''ebook'',''x'',100,''draft'')',
         pg_temp.fx('commA'), pg_temp.fx('member')),
  false);

-- ownership: prof (dona de A) tenta criar produto atribuindo a autoria
-- a outra pessoa (spoof de created_by) -> bloqueado pelo próprio
-- WITH CHECK (created_by = auth.uid()).
select pg_temp.expect_write('prof: INSERT em A com created_by de outra pessoa (spoof) -> BLOQUEADO',
  pg_temp.fx('prof'),
  format('insert into public.products (community_id, created_by, type, title, price_cents, status) values (%L,%L,''ebook'',''x'',100,''draft'')',
         pg_temp.fx('commA'), pg_temp.fx('member')),
  false);

-- ================= ESCRITA: UPDATE =======================================

-- autorizado: prof altera preço do próprio produto (P2).
select pg_temp.expect_write('prof: UPDATE price_cents do próprio P2 -> PERMITIDO',
  pg_temp.fx('prof'),
  'update public.products set price_cents = 2000 where id = ''91111111-0000-4000-8000-000000000002''',
  true);

-- outra pessoa/comunidade bloqueado: member sem vínculo de dona.
select pg_temp.expect_write('member: UPDATE price_cents de P2 (sem vínculo de dona) -> BLOQUEADO',
  pg_temp.fx('member'),
  'update public.products set price_cents = 1 where id = ''91111111-0000-4000-8000-000000000002''',
  false);

-- Master NÃO tem bypass de UPDATE (só de SELECT) — mesmo vendo o
-- produto, não pode editá-lo.
select pg_temp.expect_write('master: UPDATE price_cents de P2 -> BLOQUEADO (sem bypass de escrita)',
  pg_temp.fx('master'),
  'update public.products set price_cents = 1 where id = ''91111111-0000-4000-8000-000000000002''',
  false);

-- tentativa de alterar status/publicação: member tenta "publicar" o
-- rascunho alheio (o que o tornaria visível via a cláusula
-- status='published' da própria policy de SELECT).
select pg_temp.expect_write('member: UPDATE status de P1 draft->published (não é dona) -> BLOQUEADO',
  pg_temp.fx('member'),
  'update public.products set status = ''published'' where id = ''91111111-0000-4000-8000-000000000001''',
  false);

-- tentativa de alterar community_id (hijack): prof tenta mover o
-- próprio produto para C, comunidade que ela NÃO possui — o WITH CHECK
-- reavalia owns_community() sobre o community_id NOVO, não o antigo.
select pg_temp.expect_write('prof: UPDATE community_id de P2 para C (hijack, não é dona de C) -> BLOQUEADO',
  pg_temp.fx('prof'),
  format('update public.products set community_id = %L where id = ''91111111-0000-4000-8000-000000000002''',
         pg_temp.fx('commC')),
  false);

-- ================= INTEGRIDADE COMERCIAL =================================
-- Ler um produto (via bypass de member ativo + published) não implica
-- poder alterá-lo. Testado contra o produto REAL de A (3 pedidos
-- associados) — prova que RLS separa leitura de escrita mesmo em dado
-- de produção, sem nunca de fato alterar preço/pedido/entitlement/
-- payout ligados a ele (escrita sempre bloqueada, e mesmo se não
-- fosse, o ROLLBACK final desfaria).
select pg_temp.expect_write('member: UPDATE price_cents do produto REAL de A (consegue LER, não ESCREVER) -> BLOQUEADO',
  pg_temp.fx('member'),
  'update public.products set price_cents = 1 where id = ''1f1c7430-03d6-4c9b-ae27-ed0bd854c88b''',
  false);

-- ================= ESCRITA: DELETE ========================================

-- autorizado: prof apaga o PRÓPRIO rascunho sintético P1, que não tem
-- nenhum product_order/product_entitlement associado (FK ON DELETE
-- RESTRICT bloquearia mesmo um DELETE autorizado por RLS se houvesse).
select pg_temp.expect_write('prof: DELETE do próprio P1 (draft, sem pedidos) -> PERMITIDO',
  pg_temp.fx('prof'),
  'delete from public.products where id = ''91111111-0000-4000-8000-000000000001''',
  true);

-- não autorizado: member sem vínculo de dona.
select pg_temp.expect_write('member: DELETE de P2 (sem vínculo de dona) -> BLOQUEADO',
  pg_temp.fx('member'),
  'delete from public.products where id = ''91111111-0000-4000-8000-000000000002''',
  false);

-- Master também não tem bypass de DELETE.
select pg_temp.expect_write('master: DELETE de P2 -> BLOQUEADO (sem bypass de escrita)',
  pg_temp.fx('master'),
  'delete from public.products where id = ''91111111-0000-4000-8000-000000000002''',
  false);

-- anon bloqueado também em escrita (SELECT já provado acima).
select pg_temp.expect_write('anon: INSERT produto -> BLOQUEADO',
  null,
  format('insert into public.products (community_id, created_by, type, title, price_cents, status) values (%L,%L,''ebook'',''x'',100,''draft'')',
         pg_temp.fx('commA'), pg_temp.fx('prof')),
  false);

-- ---------- RESULTADO --------------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
