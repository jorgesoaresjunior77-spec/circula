-- =====================================================================
-- 90 — CATÁLOGO DE PLANOS DE ASSINATURA: billing_plans
-- =====================================================================
-- Fase P1-F3.1 (quarta e última tabela do cluster Split & Pricing).
-- `public.billing_plans` (`20260827000000`, baseline) é o catálogo de
-- planos de assinatura da plataforma (Professional × platform, Member
-- × community) — `subscriptions.plan_id`/`next_plan_id` referenciam
-- esta tabela. Nunca teve cenário de RLS.
--
-- Estrutura auditada ao vivo (information_schema + pg_constraint):
--   id uuid pk · subject subscription_subject not null ('platform' ou
--   'community') · code text UNIQUE not null · name text not null ·
--   price_cents int not null (check > 0) · billing_cycle
--   billing_cycle not null · is_active boolean not null default true ·
--   created_at/updated_at.
--   SEM community_id — é catálogo GLOBAL da plataforma. `subject`
--   distingue o TIPO de assinante (Professional paga a plataforma
--   direto = 'platform'; Member paga a comunidade = 'community'), não
--   uma comunidade específica. "Isolamento por comunidade" do roteiro
--   não se aplica (coluna inexistente) — confirmado com os 6 planos
--   reais: 3 `subject='platform'` (Professional mensal/semestral/
--   anual) + 3 `subject='community'` (Member mensal/semestral/anual),
--   nenhum atrelado a uma comunidade.
--   SEM relação com `products` (catálogo de produto é independente do
--   catálogo de planos de assinatura — mesma conclusão já confirmada
--   no cenário 89).
--
-- Policies auditadas ao vivo (pg_policies):
--   billing_plans_select = true (SEM restrição de role — qualquer
--     authenticated lê o catálogo inteiro; é intencional, é preço
--     público do produto, não configuração de comissão)
--   billing_plans_write (ALL — cobre INSERT/UPDATE/DELETE juntos,
--     WITH CHECK) = is_master()
--
-- Diferente de `revenue_split_rules`/`platform_split_settings` (87/88):
-- SELECT é aberto a TODO mundo autenticado (não só master/professional)
-- — é preço público, não comissão interna. Igual a `products` (89): o
-- GRANT a `authenticated` é CRUD completo (INSERT/SELECT/UPDATE/DELETE),
-- a RLS é a ÚNICA linha de defesa para escrita. `anon`: nenhum GRANT
-- (nem SELECT) — bloqueado antes da RLS, mesmo padrão das demais.
-- `service_role` aqui tem GRANT SELECT explícito (diferente de 87/88),
-- sem impacto de segurança — é leitura server-side normal.
--
-- Relação com `subscriptions`: `plan_id`/`next_plan_id` (FK, sem
-- `ON DELETE` explícito = `NO ACTION`/RESTRICT — um plano referenciado
-- por qualquer assinatura não pode ser apagado). Alterações de
-- `price_cents`/`is_active` em `billing_plans` **NÃO afetam
-- assinaturas já existentes**: `subscriptions` tem
-- `price_cents_snapshot`/`billing_cycle_snapshot`/`currency_snapshot`
-- próprios, congelados na criação — `billing_plans` só influencia
-- assinaturas NOVAS ou renovações futuras. Fora do escopo deste
-- cenário reproduzir esse fluxo (RPC de criação de assinatura não
-- testado aqui, só o acesso à tabela).
--
-- SECURITY DEFINER: `create_community_trial`, `create_platform_trial`
-- e `handle_new_user` leem `billing_plans` para escolher o plano da
-- assinatura inicial — as 3 são **funções de TRIGGER** (`RETURNS
-- trigger`), não chamáveis diretamente via RPC pelo cliente (só
-- disparadas por INSERT em `communities`/`subscriptions`/`auth.users`)
-- — sem caminho indireto de leitura/escrita explorável por essa via.
-- Nenhuma das 3 escreve em `billing_plans` (grep confirmado no código
-- das funções). `platform_overview()` também lê `billing_plans`
-- (campo `plans`, catálogo completo) mas já é gated por `is_master()`
-- internamente (confirmado no cenário 88) — como o SELECT direto da
-- tabela já é aberto a qualquer authenticated, essa função não
-- introduz um vazamento novo (é, na prática, mais restritiva que a
-- policy da própria tabela), não repetido aqui para não duplicar 88.
--
-- Este cenário testa SÓ a segurança de acesso à tabela — não o fluxo
-- de criação/renovação de assinatura (fora de escopo, não alterado).
--
-- Nenhuma fixture sintética de comunidade é necessária (tabela não
-- tem `community_id`). Usa os 6 planos reais já existentes (somente
-- leitura) e testa escrita com INSERT/UPDATE/DELETE dentro da
-- transação, desfeitos no ROLLBACK final — nenhuma alteração persiste.
-- =====================================================================

-- ================= SELECT ================================================

-- acesso legítimo: qualquer authenticated lê o catálogo inteiro — não
-- há distinção de role para leitura (preço é público do produto).
select pg_temp.expect_count('member: vê os 6 planos reais (policy aberta a qualquer authenticated)',
  pg_temp.fx('member'),
  'select count(*) from public.billing_plans', 6);

select pg_temp.expect_count('prof: vê os 6 planos reais',
  pg_temp.fx('prof'),
  'select count(*) from public.billing_plans', 6);

-- Master: mesma policy aberta, sem bypass adicional necessário aqui
-- (ao contrário de 87/88/89, onde Master tinha um `OR is_master()`
-- explícito — aqui a policy já é `true` para todo mundo).
select pg_temp.expect_count('master: vê os 6 planos reais',
  pg_temp.fx('master'),
  'select count(*) from public.billing_plans', 6);

-- isolamento por comunidade: NÃO APLICÁVEL — tabela não tem
-- community_id (ver auditoria acima). Nenhuma asserção de isolamento
-- entre comunidades é possível ou necessária aqui.

-- anon bloqueado.
select pg_temp.expect_locked('anon: NÃO vê billing_plans (sem GRANT)',
  null,
  'select count(*) from public.billing_plans');

-- ================= ESCRITA: INSERT ========================================

select pg_temp.expect_write('member: INSERT novo plano -> BLOQUEADO',
  pg_temp.fx('member'),
  'insert into public.billing_plans (subject, code, name, price_cents, billing_cycle) values (''community'',''rls-suite-90-i1'',''x'',100,''MONTHLY'')',
  false);

select pg_temp.expect_write('prof: INSERT novo plano -> BLOQUEADO',
  pg_temp.fx('prof'),
  'insert into public.billing_plans (subject, code, name, price_cents, billing_cycle) values (''community'',''rls-suite-90-i2'',''x'',100,''MONTHLY'')',
  false);

select pg_temp.expect_write('anon: INSERT novo plano -> BLOQUEADO',
  null,
  'insert into public.billing_plans (subject, code, name, price_cents, billing_cycle) values (''community'',''rls-suite-90-i3'',''x'',100,''MONTHLY'')',
  false);

select pg_temp.expect_write('master: INSERT novo plano -> PERMITIDO',
  pg_temp.fx('master'),
  'insert into public.billing_plans (subject, code, name, price_cents, billing_cycle) values (''community'',''rls-suite-90-i4'',''x'',100,''MONTHLY'')',
  true);

-- ================= ESCRITA: UPDATE (preço) ================================

select pg_temp.expect_write('member: UPDATE price_cents de member_monthly -> BLOQUEADO',
  pg_temp.fx('member'),
  'update public.billing_plans set price_cents = 1 where code = ''member_monthly''',
  false);

select pg_temp.expect_write('prof: UPDATE price_cents de member_monthly -> BLOQUEADO',
  pg_temp.fx('prof'),
  'update public.billing_plans set price_cents = 1 where code = ''member_monthly''',
  false);

select pg_temp.expect_write('master: UPDATE price_cents de member_monthly -> PERMITIDO',
  pg_temp.fx('master'),
  'update public.billing_plans set price_cents = 1490 where code = ''member_monthly''',
  true);

-- ================= ESCRITA: UPDATE (status/ativo) =========================

select pg_temp.expect_write('member: UPDATE is_active de member_monthly -> BLOQUEADO',
  pg_temp.fx('member'),
  'update public.billing_plans set is_active = false where code = ''member_monthly''',
  false);

select pg_temp.expect_write('prof: UPDATE is_active de member_monthly -> BLOQUEADO',
  pg_temp.fx('prof'),
  'update public.billing_plans set is_active = false where code = ''member_monthly''',
  false);

select pg_temp.expect_write('master: UPDATE is_active de member_monthly -> PERMITIDO',
  pg_temp.fx('master'),
  'update public.billing_plans set is_active = true where code = ''member_monthly''',
  true);

-- Ownership/community_id: NÃO APLICÁVEL — tabela não tem essas
-- colunas (ver auditoria acima). Nenhuma tentativa de hijack é
-- possível ou necessária aqui.

-- ================= ESCRITA: DELETE =========================================

select pg_temp.expect_write('member: DELETE de member_monthly -> BLOQUEADO',
  pg_temp.fx('member'),
  'delete from public.billing_plans where code = ''member_monthly''',
  false);

select pg_temp.expect_write('prof: DELETE de member_monthly -> BLOQUEADO',
  pg_temp.fx('prof'),
  'delete from public.billing_plans where code = ''member_monthly''',
  false);

-- Master consegue apagar — testado num plano SINTÉTICO (criado e
-- apagado na mesma instrução, técnica documentada em `_framework.sql`
-- para garantir que `row_count` reflita o DELETE, não o INSERT) para
-- não esbarrar no `ON DELETE` implícito (RESTRICT) dos planos reais,
-- todos referenciados por assinaturas existentes.
select pg_temp.expect_write('master: DELETE de plano sintético próprio (sem subscription) -> PERMITIDO',
  pg_temp.fx('master'),
  'insert into public.billing_plans (subject, code, name, price_cents, billing_cycle) values (''community'',''rls-suite-90-d1'',''x'',100,''MONTHLY''); delete from public.billing_plans where code = ''rls-suite-90-d1''',
  true);

-- ================= INTEGRIDADE DE COBRANÇA ================================
-- billing_plans não é por comunidade, então "manipular plano de outra
-- comunidade" não se aplica ao pé da letra — o risco real e MAIOR é o
-- oposto: um plano é usado por TODAS as comunidades ao mesmo tempo, e
-- nenhuma Professional individual — nem a dona da comunidade real A —
-- deveria conseguir alterar um preço que afeta a plataforma inteira.
select pg_temp.expect_write('prof (dona de A): UPDATE de member_monthly (afeta TODAS as comunidades, não só a própria) -> BLOQUEADO',
  pg_temp.fx('prof'),
  'update public.billing_plans set price_cents = 999999 where code = ''member_monthly''',
  false);

-- ---------- RESULTADO --------------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
