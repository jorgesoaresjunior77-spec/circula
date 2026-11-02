-- =====================================================================
-- 104 — ONBOARDING/TOUR: profiles.onboarding_answers / _completed_at /
-- tour_completed_at (migration 20261030150000, v2 — NÃO APLICADA ainda)
-- =====================================================================
-- NÃO EXECUTÁVEL até a migration 20261030150000 ser aplicada no banco
-- alvo (as 3 colunas ainda não existem).
--
-- As 3 colunas novas entram sob a policy `profiles_update` JÁ
-- existente (nunca alterada por esta migration) — este arquivo prova
-- isso na prática: cada profile só edita as PRÓPRIAS respostas,
-- ninguém edita a de outra pessoa (nem a dona da comunidade, nem
-- Master — a 12.4 já tirou o bypass de profiles_update deles).
--
-- O BACKFILL em si (contas antigas marcadas como já concluídas) NÃO é
-- testável por fixture sintética (toda fixture nasce DEPOIS da coluna
-- já existir, logo sempre NULL) — é uma verificação pontual, feita uma
-- vez, direto no banco real, logo após a aplicação:
--   select id, role, onboarding_completed_at from public.profiles
--   where role = 'member';
-- Esperado: TODAS as linhas (as que já existiam antes da migration)
-- com onboarding_completed_at preenchido, nenhuma NULL.
-- =====================================================================

-- ================= UPDATE — só a própria conta =========================

select pg_temp.expect_write('member: marca o próprio onboarding como concluído -> PERMITIDO',
  pg_temp.fx('member'),
  format('update public.profiles set onboarding_completed_at = now(), onboarding_answers = ''{"current_moment":"Cuidando de mim"}''::jsonb where id = %L',
         pg_temp.fx('member')), true);

select pg_temp.expect_write('member: marca o próprio tour como revisto -> PERMITIDO',
  pg_temp.fx('member'),
  format('update public.profiles set tour_completed_at = now() where id = %L', pg_temp.fx('member')), true);

select pg_temp.expect_write('member: tenta marcar o onboarding da prof como concluído -> BLOQUEADO',
  pg_temp.fx('member'),
  format('update public.profiles set onboarding_completed_at = now() where id = %L', pg_temp.fx('prof')), false);

select pg_temp.expect_write('prof (dona da comunidade do member): NÃO consegue editar onboarding do member -> BLOQUEADO (profiles_update é só auth.uid() = id, sem bypass de dona)',
  pg_temp.fx('prof'),
  format('update public.profiles set onboarding_completed_at = now() where id = %L', pg_temp.fx('member')), false);

select pg_temp.expect_write('master: NÃO consegue editar onboarding de ninguém -> BLOQUEADO (sem bypass desde a 12.4)',
  pg_temp.fx('master'),
  format('update public.profiles set onboarding_completed_at = now() where id = %L', pg_temp.fx('member')), false);

-- ================= SELECT — as colunas acompanham a visibilidade normal do perfil =====
-- (profiles_select já é ampla — não é escopo desta migration; só
-- confirmamos que as 3 colunas novas não quebram uma leitura comum.)

select pg_temp.expect_count('member: consegue ler o próprio onboarding_answers',
  pg_temp.fx('member'),
  format('select count(*) from public.profiles where id = %L and onboarding_answers is not null', pg_temp.fx('member')), 1);

-- ---------- RESULTADO --------------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
