-- =====================================================================
-- 100 — CÍRCULOS: community_circles + circle_members
-- =====================================================================
-- Promove os 24+ cenários da auditoria ad-hoc de `community_circles` +
-- `circle_members` a cobertura permanente de regressão. A auditoria
-- expôs uma vulnerabilidade real (autoria forjada em `created_by` no
-- INSERT de `community_circles`), corrigida pela migration
-- `20260930120000_community_circles_insert_require_created_by.sql`
-- (aplicada e validada antes deste arquivo existir). Este teste fixa o
-- comportamento PÓS-correção: o cenário que antes demonstrava a falha
-- (dona + created_by forjado -> ALLOWED) hoje é BLOCKED e DEVE
-- permanecer BLOCKED — se a proteção for removida no futuro, a seção
-- 2 abaixo quebra a suíte.
--
-- Policies auditadas ao vivo (pg_policies, projeto linkado):
--   community_circles_select = owns_community(community_id)
--     OR is_community_member(community_id)          -- sem bypass de Master
--   community_circles_insert (WITH CHECK) =
--     owns_community(community_id) AND created_by = auth.uid()   -- corrigido aqui
--   community_circles_update (USING e WITH CHECK) = owns_community(community_id)
--   community_circles_delete = owns_community(community_id)
--   circle_members_select = can_view_circle(circle_id)
--   circle_members_insert (WITH CHECK) =
--     profile_id = auth.uid() AND EXISTS (community_circles cc
--       WHERE cc.id = circle_id AND is_community_member(cc.community_id))
--   circle_members_delete = profile_id = auth.uid()   -- SEM policy de UPDATE
--     (grant também não tem UPDATE para authenticated -- inalcançável)
--
-- can_view_circle(p_circle_id) [SECURITY DEFINER] =
--   exists circle cc where owns_community(cc.community_id)
--                        OR is_community_member(cc.community_id)
-- Ou seja: a dona da comunidade enxerga circle_members mesmo sem ter
-- uma linha própria na tabela (bypass via owns_community), e um member
-- ativo enxerga TODAS as linhas do círculo da própria comunidade, não
-- só a própria -- nenhuma das duas policies filtra por profile_id no
-- SELECT.
--
-- Achado de design confirmado nos dados reais: `prof` (dona de A) TEM
-- uma linha ativa em `community_members` para A (além de ser dona) --
-- por isso ela consegue entrar em um círculo de A via
-- circle_members_insert (que depende só de is_community_member(), não
-- de owns_community()). Isso é estado real do fixture, não suposição.
--
-- Fixtures: `circleA1` (círculo real em `commA`, dona=`prof`, com
-- `member` já dentro -- usado pelos testes de SELECT/UPDATE/DELETE),
-- `circleA2` (círculo vazio em `commA` -- usado pelos testes de INSERT
-- em `circle_members`, para não colidir com a linha única de
-- `circleA1`), `circleC1` (círculo sintético em `commC`, comunidade
-- sintética dona=`master`, com `master` como circle_member -- usado só
-- para os testes de isolamento cross-community). Tudo em ROLLBACK --
-- nada persiste.
-- =====================================================================

insert into public.communities (id, owner_id, name, slug, is_discoverable)
values (pg_temp.fx('commC'), pg_temp.fx('master'),
        '[rls-suite] Comunidade C (circles)', 'rls-suite-c-circles', false);

insert into public.community_circles (id, community_id, name, created_by)
values
  ('1001c000-0000-4000-8000-00000000a001', pg_temp.fx('commA'), '[rls-suite] Círculo A1', pg_temp.fx('prof')),
  ('1001c000-0000-4000-8000-00000000a002', pg_temp.fx('commA'), '[rls-suite] Círculo A2 (vazio)', pg_temp.fx('prof')),
  ('1001c000-0000-4000-8000-00000000c001', pg_temp.fx('commC'), '[rls-suite] Círculo C1', pg_temp.fx('master'));

insert into public.circle_members (id, circle_id, profile_id)
values
  ('1001c000-0000-4000-8000-00000000d001', '1001c000-0000-4000-8000-00000000a001', pg_temp.fx('member')),
  ('1001c000-0000-4000-8000-00000000d002', '1001c000-0000-4000-8000-00000000c001', pg_temp.fx('master'));

-- ================= 1. community_circles — SELECT =======================

select pg_temp.expect_count('100: prof (dona de A) vê círculo A1 da própria comunidade',
  pg_temp.fx('prof'),
  format('select count(*) from public.community_circles where id = %L', '1001c000-0000-4000-8000-00000000a001'), 1);

select pg_temp.expect_count('100: member (ativo em A) vê círculo A1 da própria comunidade',
  pg_temp.fx('member'),
  format('select count(*) from public.community_circles where id = %L', '1001c000-0000-4000-8000-00000000a001'), 1);

select pg_temp.expect_count('100: member (de A) NÃO vê círculo C1 (outra comunidade, sem vínculo)',
  pg_temp.fx('member'),
  format('select count(*) from public.community_circles where id = %L', '1001c000-0000-4000-8000-00000000c001'), 0);

select pg_temp.expect_count('100: master (fora da comunidade A) NÃO vê círculo A1 -- sem bypass de plataforma',
  pg_temp.fx('master'),
  format('select count(*) from public.community_circles where id = %L', '1001c000-0000-4000-8000-00000000a001'), 0);

select pg_temp.expect_locked('100: anon NÃO vê community_circles',
  null,
  'select count(*) from public.community_circles');

-- ================= 2. community_circles — INSERT ========================
-- Seção que fixa a correção da vulnerabilidade de `created_by` forjado.

select pg_temp.expect_write('100: prof (dona de A) cria círculo em A com created_by próprio -> PERMITIDO',
  pg_temp.fx('prof'),
  format('insert into public.community_circles (community_id,name,created_by) values (%L,''[rls-suite] novo'',%L)',
         pg_temp.fx('commA'), pg_temp.fx('prof')), true);

select pg_temp.expect_write('100: member (não-dona de A) tenta criar círculo em A -> BLOQUEADO',
  pg_temp.fx('member'),
  format('insert into public.community_circles (community_id,name,created_by) values (%L,''[rls-suite] novo'',%L)',
         pg_temp.fx('commA'), pg_temp.fx('member')), false);

select pg_temp.expect_write('100: prof tenta criar círculo em C (comunidade da qual NÃO é dona) -> BLOQUEADO',
  pg_temp.fx('prof'),
  format('insert into public.community_circles (community_id,name,created_by) values (%L,''[rls-suite] novo'',%L)',
         pg_temp.fx('commC'), pg_temp.fx('prof')), false);

-- ANTES da correção: ALLOWED (vulnerabilidade real, confirmada por
-- execução). DEPOIS da migration 20260930120000: DEVE ser BLOCKED. Se
-- este teste passar a ALLOWED no futuro, a proteção foi removida.
select pg_temp.expect_write('100: prof (dona de A) tenta usar created_by de outro perfil (member) -> BLOQUEADO (correção da vulnerabilidade)',
  pg_temp.fx('prof'),
  format('insert into public.community_circles (community_id,name,created_by) values (%L,''[rls-suite] forjado'',%L)',
         pg_temp.fx('commA'), pg_temp.fx('member')), false);

-- ================= 3. community_circles — UPDATE ========================

select pg_temp.expect_write('100: prof (dona de A) edita o próprio círculo A1 -> PERMITIDO',
  pg_temp.fx('prof'),
  format('update public.community_circles set name = ''[rls-suite] A1 editado'' where id = %L', '1001c000-0000-4000-8000-00000000a001'), true);

select pg_temp.expect_write('100: member tenta editar círculo A1 (não é dona) -> BLOQUEADO',
  pg_temp.fx('member'),
  format('update public.community_circles set name = ''[rls-suite] A1 editado2'' where id = %L', '1001c000-0000-4000-8000-00000000a001'), false);

select pg_temp.expect_write('100: master tenta editar círculo A1 (não é dona de A) -> BLOQUEADO',
  pg_temp.fx('master'),
  format('update public.community_circles set name = ''[rls-suite] A1 editado3'' where id = %L', '1001c000-0000-4000-8000-00000000a001'), false);

select pg_temp.expect_write('100: prof tenta mover círculo A1 para C via community_id (hijack, não é dona de C) -> BLOQUEADO',
  pg_temp.fx('prof'),
  format('update public.community_circles set community_id = %L where id = %L', pg_temp.fx('commC'), '1001c000-0000-4000-8000-00000000a001'), false);

-- ================= 4. community_circles — DELETE ========================

select pg_temp.expect_write('100: member tenta excluir círculo A1 -> BLOQUEADO',
  pg_temp.fx('member'),
  format('delete from public.community_circles where id = %L', '1001c000-0000-4000-8000-00000000a001'), false);

select pg_temp.expect_write('100: master tenta excluir círculo A1 -> BLOQUEADO',
  pg_temp.fx('master'),
  format('delete from public.community_circles where id = %L', '1001c000-0000-4000-8000-00000000a001'), false);

select pg_temp.expect_write('100: prof (dona de A) exclui o próprio círculo A1 -> PERMITIDO',
  pg_temp.fx('prof'),
  format('delete from public.community_circles where id = %L', '1001c000-0000-4000-8000-00000000a001'), true);

-- ================= 5. circle_members — SELECT ===========================

select pg_temp.expect_count('100: member (ativo em A) vê os membros do próprio círculo A1',
  pg_temp.fx('member'),
  format('select count(*) from public.circle_members where circle_id = %L', '1001c000-0000-4000-8000-00000000a001'), 1);

select pg_temp.expect_count('100: member (de A) NÃO vê membros do círculo C1 (outra comunidade)',
  pg_temp.fx('member'),
  format('select count(*) from public.circle_members where circle_id = %L', '1001c000-0000-4000-8000-00000000c001'), 0);

select pg_temp.expect_count('100: master (fora da comunidade A) NÃO consegue acessar circle_members de A1',
  pg_temp.fx('master'),
  format('select count(*) from public.circle_members where circle_id = %L', '1001c000-0000-4000-8000-00000000a001'), 0);

select pg_temp.expect_locked('100: anon NÃO consegue acessar circle_members',
  null,
  'select count(*) from public.circle_members');

-- prof (dona de A) enxerga circle_members de A1 via can_view_circle() ->
-- owns_community(), mesmo NÃO tendo linha própria em circle_members ali.
select pg_temp.expect_count('100: prof (dona de A, sem linha própria em A1) vê membros de A1 via can_view_circle()/owns_community',
  pg_temp.fx('prof'),
  format('select count(*) from public.circle_members where circle_id = %L', '1001c000-0000-4000-8000-00000000a001'), 1);

select pg_temp.expect_bool('100: can_view_circle(A1) para prof (dona) -> true (regra real da função)',
  pg_temp.fx('prof'),
  format('select public.can_view_circle(%L)', '1001c000-0000-4000-8000-00000000a001'), true);

-- ================= 6. circle_members — INSERT ============================
-- Usa circleA2 (vazio) para não colidir com a linha única de circleA1.

select pg_temp.expect_write('100: member consegue entrar no próprio círculo (A2, comunidade ativa) -> PERMITIDO',
  pg_temp.fx('member'),
  format('insert into public.circle_members (circle_id, profile_id) values (%L,%L)',
         '1001c000-0000-4000-8000-00000000a002', pg_temp.fx('member')), true);

select pg_temp.expect_write('100: member tenta inserir outra pessoa (prof) em A2 -> BLOQUEADO (profile_id != auth.uid())',
  pg_temp.fx('member'),
  format('insert into public.circle_members (circle_id, profile_id) values (%L,%L)',
         '1001c000-0000-4000-8000-00000000a002', pg_temp.fx('prof')), false);

select pg_temp.expect_write('100: master (não pertence à comunidade A) tenta entrar em A2 -> BLOQUEADO',
  pg_temp.fx('master'),
  format('insert into public.circle_members (circle_id, profile_id) values (%L,%L)',
         '1001c000-0000-4000-8000-00000000a002', pg_temp.fx('master')), false);

-- estado real do fixture: prof é dona de A E tem linha ativa em
-- community_members para A -> is_community_member(A) = true para ela
-- também, então o INSERT é PERMITIDO (não é um bypass de owns_community,
-- é o estado real de membership dela).
select pg_temp.expect_write('100: prof (dona de A, também membro ativo real) entra em A2 -> PERMITIDO (estado real de membership)',
  pg_temp.fx('prof'),
  format('insert into public.circle_members (circle_id, profile_id) values (%L,%L)',
         '1001c000-0000-4000-8000-00000000a002', pg_temp.fx('prof')), true);

-- ================= 7. circle_members — DELETE ============================

select pg_temp.expect_write('100: member consegue sair do próprio círculo A1 -> PERMITIDO',
  pg_temp.fx('member'),
  format('delete from public.circle_members where id = %L', '1001c000-0000-4000-8000-00000000d001'), true);

select pg_temp.expect_write('100: outra pessoa (master, estranha) NÃO consegue remover o member de A1 -> BLOQUEADO',
  pg_temp.fx('master'),
  format('delete from public.circle_members where id = %L', '1001c000-0000-4000-8000-00000000d001'), false);

select pg_temp.expect_write('100: prof (dona de A) NÃO consegue fazer kick do member em A1 -> BLOQUEADO (comportamento arquitetural atual)',
  pg_temp.fx('prof'),
  format('delete from public.circle_members where id = %L', '1001c000-0000-4000-8000-00000000d001'), false);

-- ---------- RESULTADO --------------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
