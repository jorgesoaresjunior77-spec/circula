-- =====================================================================
-- 111 — POP-UP DIÁRIO DE INSPIRAÇÃO (migration 20261106160000)
-- =====================================================================
-- NÃO EXECUTÁVEL até a migration ser aplicada no banco alvo.
--
-- Regras: membro ativo lê só o PUBLICADO; a dona (e a master) lê também os
-- rascunhos; só a dona escreve, na própria comunidade; citação exige
-- autor E obra. Tudo em ROLLBACK.
-- =====================================================================

insert into public.daily_inspirations (community_id, kind, body, author, source, status, created_by) values
  (pg_temp.fx('commA'), 'citacao',   '[rls-suite] citacao publicada', 'Autora Teste', 'Obra Teste', 'published', pg_temp.fx('prof')),
  (pg_temp.fx('commA'), 'editorial', '[rls-suite] editorial rascunho', null, null, 'draft', pg_temp.fx('prof'));

-- ================= leitura =============================================
select pg_temp.expect_locked('inspiração: anon NÃO lê', null,
  'select count(*) from public.daily_inspirations');
select pg_temp.expect_count('inspiração: member ativo lê só o PUBLICADO (1)', pg_temp.fx('member'),
  'select count(*) from public.daily_inspirations where body like ''[rls-suite]%''', 1);
select pg_temp.expect_count('inspiração: dona lê publicado e rascunho (2)', pg_temp.fx('prof'),
  'select count(*) from public.daily_inspirations where body like ''[rls-suite]%''', 2);
select pg_temp.expect_count('inspiração: master lê publicado e rascunho (2)', pg_temp.fx('master'),
  'select count(*) from public.daily_inspirations where body like ''[rls-suite]%''', 2);

-- ================= escrita =============================================
select pg_temp.expect_write('inspiração: dona cadastra texto editorial -> PERMITIDO', pg_temp.fx('prof'),
  format('insert into public.daily_inspirations (community_id, kind, body) values (%L, ''editorial'', ''[rls-suite] novo'')', pg_temp.fx('commA')), true);
select pg_temp.expect_write('inspiração: dona cadastra citação com autor e obra -> PERMITIDO', pg_temp.fx('prof'),
  format('insert into public.daily_inspirations (community_id, kind, body, author, source) values (%L, ''citacao'', ''[rls-suite] c'', ''A'', ''O'')', pg_temp.fx('commA')), true);
select pg_temp.expect_write('inspiração: citação SEM autor -> BLOQUEADO (check)', pg_temp.fx('prof'),
  format('insert into public.daily_inspirations (community_id, kind, body, source) values (%L, ''citacao'', ''[rls-suite] x'', ''Obra'')', pg_temp.fx('commA')), false);
select pg_temp.expect_write('inspiração: citação SEM obra -> BLOQUEADO (check)', pg_temp.fx('prof'),
  format('insert into public.daily_inspirations (community_id, kind, body, author) values (%L, ''citacao'', ''[rls-suite] x'', ''Autora'')', pg_temp.fx('commA')), false);
select pg_temp.expect_write('inspiração: citação com autor em branco -> BLOQUEADO (check)', pg_temp.fx('prof'),
  format('insert into public.daily_inspirations (community_id, kind, body, author, source) values (%L, ''citacao'', ''[rls-suite] x'', ''  '', ''Obra'')', pg_temp.fx('commA')), false);
select pg_temp.expect_write('inspiração: texto vazio -> BLOQUEADO (check)', pg_temp.fx('prof'),
  format('insert into public.daily_inspirations (community_id, kind, body) values (%L, ''editorial'', ''   '')', pg_temp.fx('commA')), false);
select pg_temp.expect_write('inspiração: tipo inválido -> BLOQUEADO (check)', pg_temp.fx('prof'),
  format('insert into public.daily_inspirations (community_id, kind, body) values (%L, ''proverbio'', ''[rls-suite] x'')', pg_temp.fx('commA')), false);
select pg_temp.expect_write('inspiração: member cadastra -> BLOQUEADO', pg_temp.fx('member'),
  format('insert into public.daily_inspirations (community_id, kind, body) values (%L, ''editorial'', ''[rls-suite] forjado'')', pg_temp.fx('commA')), false);
select pg_temp.expect_write('inspiração: anon cadastra -> BLOQUEADO', null,
  format('insert into public.daily_inspirations (community_id, kind, body) values (%L, ''editorial'', ''[rls-suite] anon'')', pg_temp.fx('commA')), false);
select pg_temp.expect_write('inspiração: dona em comunidade de OUTRA dona -> BLOQUEADO', pg_temp.fx('prof'),
  format('insert into public.daily_inspirations (community_id, kind, body) values (%L, ''editorial'', ''[rls-suite] alheio'')', pg_temp.fx('commC')), false);
select pg_temp.expect_count('inspiração: member UPDATE não afeta nenhuma linha', pg_temp.fx('member'),
  'with u as (update public.daily_inspirations set body = ''invadido'' where body like ''[rls-suite]%'' returning 1) select count(*) from u', 0);
select pg_temp.expect_count('inspiração: member DELETE não afeta nenhuma linha', pg_temp.fx('member'),
  'with d as (delete from public.daily_inspirations where body like ''[rls-suite]%'' returning 1) select count(*) from d', 0);
select pg_temp.expect_write('inspiração: dona edita o próprio texto -> PERMITIDO', pg_temp.fx('prof'),
  'update public.daily_inspirations set body = ''[rls-suite] editado'' where body = ''[rls-suite] editorial rascunho''', true);
select pg_temp.expect_write('inspiração: dona exclui o próprio texto -> PERMITIDO', pg_temp.fx('prof'),
  'delete from public.daily_inspirations where body = ''[rls-suite] citacao publicada''', true);

-- ---------- RESULTADO --------------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
