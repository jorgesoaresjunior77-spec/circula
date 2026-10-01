-- =====================================================================
-- 101 — SECURITY DEFINER: guard de autorização em funções de billing
-- =====================================================================
-- Promove a prova de runtime da auditoria de SECURITY DEFINER a
-- cobertura permanente de regressão. A auditoria confirmou, por
-- execução real, que 3 funções RPC públicas (GRANT para `anon` desde o
-- bloco de grant em lote da baseline) não validavam relação entre quem
-- chama e o recurso consultado:
--
--   • calculate_subscription_state(p_subscription_id)  — zero guard,
--     devolvia o estado de QUALQUER subscription para QUALQUER um.
--   • has_active_access(p_profile_id, p_community_id)
--   • community_subscription_active(p_member_id, p_community_id)
--     — ambas recebiam o profile-alvo como parâmetro explícito (sem
--     usar auth.uid() internamente) e devolviam o boolean real de
--     acesso pago de QUALQUER perfil em QUALQUER comunidade.
--
-- Corrigido pela migration `20261001120000_security_definer_authz_
-- guards.sql` (aplicada e validada antes deste arquivo existir), que
-- espelha o predicado já existente em `subscriptions_select`:
--   profile_id = auth.uid() OR is_master()
--     OR (subject='community' AND owns_community(community_id, false))
--
-- Este teste fixa o comportamento PÓS-correção:
--   • calculate_subscription_state  -> NULL quando não autorizado (MESMO
--     caminho já usado para "não encontrada" — sem oráculo de
--     enumeração).
--   • has_active_access / community_subscription_active -> `false`
--     (nunca RAISE — teria quebrado a composição booleana usada por
--     `is_community_member()`, hoje referenciada em dezenas de
--     policies de RLS) quando não autorizado.
--
-- Se a autorização for removida no futuro, as seções 1-3 abaixo
-- quebram a suíte.
--
-- Fixtures adicionais (sintéticas, só nesta transação, via insert
-- direto como role de conexão — some no ROLLBACK):
--   • subC: subscription sintética em commC (subject=community,
--     profile_id=master, dona de C), usada para provar bloqueio
--     cross-community (prof/member não têm nenhum vínculo com C).
--   • prof_platform_sub: a subscription de PLATAFORMA real e já
--     existente de `prof` (subject=platform, status=past_due) — prova
--     que `owns_community` NÃO estende acesso a subscriptions de
--     plataforma de terceiros (só profile_id=auth.uid() ou is_master
--     valem para subject=platform; um member da comunidade de `prof`
--     continua BLOQUEADO mesmo sendo "da casa").
-- =====================================================================

insert into _fx (k, v) values
  ('subC',              'ccccccc0-0000-4000-8000-0000000000c3'),
  ('prof_platform_sub', '7f6c1fd4-bfba-452f-aa69-31784e2ed75c');

-- commC só existe de verdade dentro desta transação (sintética, como em
-- 100_circles.sql) — necessária para a FK de subscriptions.community_id.
insert into public.communities (id, owner_id, name, slug, is_discoverable)
values (pg_temp.fx('commC'), pg_temp.fx('master'), '[rls-suite] Comunidade C (secdef)', 'rls-suite-c-secdef', false);

insert into public.subscriptions
  (id, subject, profile_id, community_id, plan_id, status, trial_ends_at, current_period_start, current_period_end)
values
  (pg_temp.fx('subC'), 'community', pg_temp.fx('master'), pg_temp.fx('commC'), pg_temp.fx('member_plan'),
   'active', now() + interval '21 days', now(), now() + interval '30 days');

-- ================= 1. calculate_subscription_state =====================

select pg_temp.expect_bool('101: member le o proprio estado (member_sub_A) -> ALLOWED (profile_id = auth.uid())',
  pg_temp.fx('member'),
  format('select public.calculate_subscription_state(%L) is not null', pg_temp.fx('member_sub_A')), true);

select pg_temp.expect_bool('101: prof (dona de A) le o estado da subscription do member em A -> ALLOWED (owns_community)',
  pg_temp.fx('prof'),
  format('select public.calculate_subscription_state(%L) is not null', pg_temp.fx('member_sub_A')), true);

select pg_temp.expect_bool('101: master le o estado da subscription do member em A -> ALLOWED (is_master, admin de billing)',
  pg_temp.fx('master'),
  format('select public.calculate_subscription_state(%L) is not null', pg_temp.fx('member_sub_A')), true);

select pg_temp.expect_bool('101: member (sem vinculo com C) le subscription sintetica de C -> BLOQUEADO (NULL)',
  pg_temp.fx('member'),
  format('select public.calculate_subscription_state(%L) is null', pg_temp.fx('subC')), true);

select pg_temp.expect_bool('101: prof (dona de A, NAO de C) le subscription sintetica de C -> BLOQUEADO (NULL)',
  pg_temp.fx('prof'),
  format('select public.calculate_subscription_state(%L) is null', pg_temp.fx('subC')), true);

select pg_temp.expect_bool('101: master le subscription sintetica de C -> ALLOWED (is_master)',
  pg_temp.fx('master'),
  format('select public.calculate_subscription_state(%L) is not null', pg_temp.fx('subC')), true);

select pg_temp.expect_bool('101: prof le a PROPRIA subscription de plataforma -> ALLOWED (profile_id = auth.uid())',
  pg_temp.fx('prof'),
  format('select public.calculate_subscription_state(%L) is not null', pg_temp.fx('prof_platform_sub')), true);

select pg_temp.expect_bool('101: member (da comunidade de prof) le subscription de PLATAFORMA de prof -> BLOQUEADO (subject=platform exclui owns_community)',
  pg_temp.fx('member'),
  format('select public.calculate_subscription_state(%L) is null', pg_temp.fx('prof_platform_sub')), true);

select pg_temp.expect_bool('101: master le subscription de plataforma de prof -> ALLOWED (is_master)',
  pg_temp.fx('master'),
  format('select public.calculate_subscription_state(%L) is not null', pg_temp.fx('prof_platform_sub')), true);

select pg_temp.expect_bool('101: anon tenta ler member_sub_A -> BLOQUEADO (NULL)',
  null,
  format('select public.calculate_subscription_state(%L) is null', pg_temp.fx('member_sub_A')), true);

select pg_temp.expect_bool('101: UUID inexistente -> NULL para qualquer persona (sem diferenciar "nao existe" de "nao e seu")',
  pg_temp.fx('member'),
  format('select public.calculate_subscription_state(%L) is null', pg_temp.fx('nil')), true);

-- ================= 2. community_subscription_active =====================

select pg_temp.expect_bool('101: member consulta a propria community_subscription_active em A -> true (trial nao bloqueada)',
  pg_temp.fx('member'),
  format('select public.community_subscription_active(%L,%L)', pg_temp.fx('member'), pg_temp.fx('commA')), true);

select pg_temp.expect_bool('101: prof (dona de A) consulta community_subscription_active do member em A -> true (owns_community)',
  pg_temp.fx('prof'),
  format('select public.community_subscription_active(%L,%L)', pg_temp.fx('member'), pg_temp.fx('commA')), true);

select pg_temp.expect_bool('101: master consulta community_subscription_active do member em A -> true (is_master)',
  pg_temp.fx('master'),
  format('select public.community_subscription_active(%L,%L)', pg_temp.fx('member'), pg_temp.fx('commA')), true);

select pg_temp.expect_bool('101: member (sem vinculo com C) consulta community_subscription_active de master em C -> BLOQUEADO (false, nao vaza)',
  pg_temp.fx('member'),
  format('select public.community_subscription_active(%L,%L)', pg_temp.fx('master'), pg_temp.fx('commC')), false);

select pg_temp.expect_bool('101: prof (dona de A, NAO de C) consulta community_subscription_active de master em C -> BLOQUEADO',
  pg_temp.fx('prof'),
  format('select public.community_subscription_active(%L,%L)', pg_temp.fx('master'), pg_temp.fx('commC')), false);

select pg_temp.expect_bool('101: anon tenta community_subscription_active(member, A) -> BLOQUEADO (false)',
  null,
  format('select public.community_subscription_active(%L,%L)', pg_temp.fx('member'), pg_temp.fx('commA')), false);

-- ================= 3. has_active_access =====================

select pg_temp.expect_bool('101: member consulta o proprio has_active_access em A -> completa sem erro (nao-regressao)',
  pg_temp.fx('member'),
  format('select public.has_active_access(%L,%L) is not null', pg_temp.fx('member'), pg_temp.fx('commA')), true);

select pg_temp.expect_bool('101: prof (dona de A) consulta has_active_access do member em A -> completa sem erro (owns_community)',
  pg_temp.fx('prof'),
  format('select public.has_active_access(%L,%L) is not null', pg_temp.fx('member'), pg_temp.fx('commA')), true);

select pg_temp.expect_bool('101: master consulta has_active_access do member em A -> completa sem erro (is_master)',
  pg_temp.fx('master'),
  format('select public.has_active_access(%L,%L) is not null', pg_temp.fx('member'), pg_temp.fx('commA')), true);

select pg_temp.expect_bool('101: member (sem vinculo com C) consulta has_active_access de master em C -> BLOQUEADO (false, nao vaza)',
  pg_temp.fx('member'),
  format('select public.has_active_access(%L,%L)', pg_temp.fx('master'), pg_temp.fx('commC')), false);

select pg_temp.expect_bool('101: prof (dona de A, NAO de C) consulta has_active_access de master em C -> BLOQUEADO',
  pg_temp.fx('prof'),
  format('select public.has_active_access(%L,%L)', pg_temp.fx('master'), pg_temp.fx('commC')), false);

select pg_temp.expect_bool('101: anon tenta has_active_access(member, A) -> BLOQUEADO (false)',
  null,
  format('select public.has_active_access(%L,%L)', pg_temp.fx('member'), pg_temp.fx('commA')), false);

-- ================= 4. nao-regressao: is_community_member(cid, true) segue intacta ====
-- Caminho interno real (is_community_member -> has_active_access(auth.uid(), cid)) nao
-- pode ser afetado pelo guard novo: ele sempre chama com o profile = o proprio chamador.

select pg_temp.expect_bool('101: anon chama is_community_member(A, true) -> false, SEM raise (guard novo nao quebra o caminho interno)',
  null,
  format('select public.is_community_member(%L, true)', pg_temp.fx('commA')), false);

select pg_temp.expect_bool('101: member chama is_community_member(A, true) -> completa sem erro (caminho interno preservado)',
  pg_temp.fx('member'),
  format('select public.is_community_member(%L, true) is not null', pg_temp.fx('commA')), true);

-- ---------- RESULTADO --------------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
