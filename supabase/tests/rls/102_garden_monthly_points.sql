-- =====================================================================
-- 102 — MOTOR DE PONTUAÇÃO: garden_monthly_points / garden_monthly_completions
-- (migration 20261030140000, v2 pós-auditoria — NÃO APLICADA ainda)
-- =====================================================================
-- NÃO EXECUTÁVEL até a migration 20261030140000 ser aplicada no banco
-- alvo (`circle_requests`/`garden_monthly_points`/
-- `garden_monthly_completions` ainda não existem) — escrito e revisado
-- nesta etapa, pendente de rodar depois da autorização + aplicação.
--
-- Cobre o achado MAIS GRAVE da auditoria de correções: sem GRANT
-- explícito, `authenticated` não lê NADA aqui mesmo com RLS liberando
-- (mesmo "gotcha" de infra do projeto — ver 83_social_notifications.sql
-- para o mesmo padrão em outra tabela). Os testes abaixo provam:
--   • member LÊ a própria linha, NUNCA a de outra pessoa;
--   • dona da comunidade LÊ as linhas de quem participa da comunidade
--     dela, NUNCA de outra comunidade;
--   • NINGUÉM (nem a própria autora) consegue INSERT/UPDATE/DELETE
--     direto — só os gatilhos SECURITY DEFINER escrevem;
--   • anon não lê nada.
--
-- Fixtures sintéticas (linhas de pontos/conclusão para `member` em
-- `commA`, e para `prof` — dona de `commA` — numa comunidade que ela
-- NÃO possui) criadas como `postgres` (ignora RLS) e somem no ROLLBACK.
-- =====================================================================

insert into public.garden_monthly_points
  (id, profile_id, community_id, period_month, source, source_id, points)
values
  ('a0000000-0000-4000-8000-000000000a01', pg_temp.fx('member'), pg_temp.fx('commA'),
   '2026-11-01', 'post', pg_temp.fx('postA'), 5);

insert into public.garden_monthly_completions
  (id, profile_id, community_id, period_month, total_points)
values
  ('a0000000-0000-4000-8000-000000000a02', pg_temp.fx('member'), pg_temp.fx('commA'), '2026-11-01', 100);

-- ================= SELECT — garden_monthly_points =====================

select pg_temp.expect_count('member: vê o próprio ponto',
  pg_temp.fx('member'),
  format('select count(*) from public.garden_monthly_points where id = %L', 'a0000000-0000-4000-8000-000000000a01'), 1);

select pg_temp.expect_count('prof (dona de commA): vê o ponto do member da própria comunidade',
  pg_temp.fx('prof'),
  format('select count(*) from public.garden_monthly_points where id = %L', 'a0000000-0000-4000-8000-000000000a01'), 1);

select pg_temp.expect_count('master: NÃO vê ponto de comunidade que não é sua (sem bypass de plataforma aqui)',
  pg_temp.fx('master'),
  format('select count(*) from public.garden_monthly_points where id = %L', 'a0000000-0000-4000-8000-000000000a01'), 0);

select pg_temp.expect_locked('anon: NÃO vê garden_monthly_points',
  null,
  'select count(*) from public.garden_monthly_points');

-- ================= SELECT — garden_monthly_completions ================

select pg_temp.expect_count('member: vê a própria conclusão',
  pg_temp.fx('member'),
  format('select count(*) from public.garden_monthly_completions where id = %L', 'a0000000-0000-4000-8000-000000000a02'), 1);

select pg_temp.expect_count('prof (dona de commA): vê a conclusão do member da própria comunidade',
  pg_temp.fx('prof'),
  format('select count(*) from public.garden_monthly_completions where id = %L', 'a0000000-0000-4000-8000-000000000a02'), 1);

select pg_temp.expect_locked('anon: NÃO vê garden_monthly_completions',
  null,
  'select count(*) from public.garden_monthly_completions');

-- ========= INSERT/UPDATE/DELETE — NINGUÉM, só os gatilhos SECURITY DEFINER =========
-- Correção pós-auditoria: GRANT concede SELECT apenas (nunca INSERT/
-- UPDATE/DELETE) para `authenticated` — qualquer tentativa direta é
-- barrada no GRANT, antes mesmo de qualquer policy entrar em jogo.

select pg_temp.expect_write('member: INSERT direto de pontos para si mesma -> BLOQUEADO',
  pg_temp.fx('member'),
  format('insert into public.garden_monthly_points (profile_id, community_id, period_month, source, source_id, points) values (%L,%L,''2026-11-01'',''post'',%L,999)',
         pg_temp.fx('member'), pg_temp.fx('commA'), pg_temp.fx('nil')), false);

select pg_temp.expect_write('member: tenta inflar os próprios pontos via UPDATE -> BLOQUEADO',
  pg_temp.fx('member'),
  format('update public.garden_monthly_points set points = 999999 where id = %L', 'a0000000-0000-4000-8000-000000000a01'), false);

select pg_temp.expect_write('member: tenta apagar o próprio estorno (burlar reversed_at) via DELETE -> BLOQUEADO',
  pg_temp.fx('member'),
  format('delete from public.garden_monthly_points where id = %L', 'a0000000-0000-4000-8000-000000000a01'), false);

select pg_temp.expect_write('prof (dona): também não consegue escrever direto -> BLOQUEADO',
  pg_temp.fx('prof'),
  format('update public.garden_monthly_points set points = 1 where id = %L', 'a0000000-0000-4000-8000-000000000a01'), false);

select pg_temp.expect_write('member: INSERT direto forjando uma conclusão -> BLOQUEADO',
  pg_temp.fx('member'),
  format('insert into public.garden_monthly_completions (profile_id, community_id, period_month, total_points) values (%L,%L,''2026-12-01'',100)',
         pg_temp.fx('member'), pg_temp.fx('commA')), false);

-- ---------- RESULTADO --------------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
