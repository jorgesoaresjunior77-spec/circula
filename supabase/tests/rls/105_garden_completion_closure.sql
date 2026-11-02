-- =====================================================================
-- 105 — MEU JARDIM: fechamento do anel mensal (100 pontos) e estornos
-- (migration 20261030140000)
-- =====================================================================
-- Complementa o 102 (que só cobre o GRANT/RLS). Aqui a LÓGICA:
--   • 99 pontos NÃO fecham o mês; o 100o fecha (garden_monthly_completions);
--   • estornar um ponto depois de fechado NÃO apaga a conclusão (conquista
--     permanente) — só `total_points` acompanha a soma ativa;
--   • restaurar devolve o total;
--   • apagar um comentário (hard DELETE, não há botão no app) estorna o
--     ponto do comentário via gatilho.
--
-- Mês sintético (2030-01-01) para os pontos inseridos direto — nunca
-- colide com dados reais. O caso do comentário usa `prof` (sem pontos
-- reais hoje), para não esbarrar no limite diário de 3 comentários da
-- `member`. Tudo roda como `postgres` e some no ROLLBACK.
-- =====================================================================

-- 20 linhas de 5 pontos = 100. As 19 primeiras = 95 (ainda NÃO fecha).
insert into public.garden_monthly_points
  (profile_id, community_id, period_month, source, source_id, points)
select pg_temp.fx('member'), pg_temp.fx('commA'), date '2030-01-01', 'post',
       ('c0000000-0000-4000-8000-0000000000' || lpad(g::text, 2, '0'))::uuid, 5
from generate_series(1, 19) g;

select public._garden_recompute_completion(pg_temp.fx('member'), pg_temp.fx('commA'), date '2030-01-01');

select pg_temp.expect_count('95 pontos: o mês NÃO fecha (sem linha em garden_monthly_completions)',
  pg_temp.fx('member'),
  'select count(*) from public.garden_monthly_completions where period_month = date ''2030-01-01''', 0);

-- 20o ponto -> 100.
insert into public.garden_monthly_points
  (profile_id, community_id, period_month, source, source_id, points)
values (pg_temp.fx('member'), pg_temp.fx('commA'), date '2030-01-01', 'post',
        'c0000000-0000-4000-8000-000000000020', 5);

select public._garden_recompute_completion(pg_temp.fx('member'), pg_temp.fx('commA'), date '2030-01-01');

select pg_temp.expect_count('100 pontos: o mês FECHA (1 conclusão, total_points = 100)',
  pg_temp.fx('member'),
  'select count(*) from public.garden_monthly_completions where period_month = date ''2030-01-01'' and total_points = 100', 1);

-- Estorna 1 ponto depois de fechado: conclusão permanece, total cai p/ 95.
select public._garden_reverse_points('post', 'c0000000-0000-4000-8000-000000000020');

select pg_temp.expect_count('estorno depois de fechado: a conclusão PERMANECE (conquista permanente)',
  pg_temp.fx('member'),
  'select count(*) from public.garden_monthly_completions where period_month = date ''2030-01-01''', 1);

select pg_temp.expect_count('estorno depois de fechado: total_points acompanha a soma ativa (95)',
  pg_temp.fx('member'),
  'select count(*) from public.garden_monthly_completions where period_month = date ''2030-01-01'' and total_points = 95', 1);

select public._garden_restore_points('post', 'c0000000-0000-4000-8000-000000000020');

select pg_temp.expect_count('restauração: total_points volta a 100',
  pg_temp.fx('member'),
  'select count(*) from public.garden_monthly_completions where period_month = date ''2030-01-01'' and total_points = 100', 1);

-- ================= comentário apagado -> estorno via gatilho ===========
-- (`prof` comenta no post de teste da própria comunidade; o gatilho
-- concede 2 pontos no mês corrente; o DELETE estorna.)
insert into public.post_comments (id, post_id, author_id, content)
values ('c0000000-0000-4000-8000-0000000000c1', pg_temp.fx('postA'), pg_temp.fx('prof'), '[rls-suite] comentário de teste');

select pg_temp.expect_count('comentário criado: gatilho concede 2 pontos ATIVOS à autora',
  pg_temp.fx('prof'),
  'select coalesce(sum(points),0) from public.garden_monthly_points where source = ''comment'' and source_id = ''c0000000-0000-4000-8000-0000000000c1'' and reversed_at is null', 2);

delete from public.post_comments where id = 'c0000000-0000-4000-8000-0000000000c1';

select pg_temp.expect_count('comentário APAGADO: o ponto fica estornado (reversed_at preenchido)',
  pg_temp.fx('prof'),
  'select count(*) from public.garden_monthly_points where source = ''comment'' and source_id = ''c0000000-0000-4000-8000-0000000000c1'' and reversed_at is not null', 1);

select pg_temp.expect_count('comentário APAGADO: nenhum ponto ativo restante dele',
  pg_temp.fx('prof'),
  'select count(*) from public.garden_monthly_points where source = ''comment'' and source_id = ''c0000000-0000-4000-8000-0000000000c1'' and reversed_at is null', 0);

-- ---------- RESULTADO --------------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
