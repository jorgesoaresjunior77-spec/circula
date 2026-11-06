-- =====================================================================
-- 110 — DICAS DE LEITURA E RESPIRAÇÃO/MEDITAÇÃO (migration 20261106150000)
-- =====================================================================
-- NÃO EXECUTÁVEL até a migration ser aplicada no banco alvo.
--
-- Regras: membro ativo lê só o PUBLICADO; a dona da comunidade (e a master)
-- lê também os rascunhos; só a dona escreve, e só na própria comunidade.
-- Áudio só por https. Tudo em ROLLBACK.
-- =====================================================================

-- Dados de apoio (como superusuário): 1 publicado e 1 rascunho de cada.
insert into public.reading_tips (community_id, theme, title, author, status, created_by) values
  (pg_temp.fx('commA'), 'saude', '[rls-suite] livro publicado', 'Autora Teste', 'published', pg_temp.fx('prof')),
  (pg_temp.fx('commA'), 'saude', '[rls-suite] livro rascunho',  'Autora Teste', 'draft',     pg_temp.fx('prof'));

insert into public.wellness_sessions (community_id, kind, title, duration_minutes, status, created_by) values
  (pg_temp.fx('commA'), 'respiracao', '[rls-suite] sessao publicada', 5, 'published', pg_temp.fx('prof')),
  (pg_temp.fx('commA'), 'meditacao',  '[rls-suite] sessao rascunho',  10, 'draft',    pg_temp.fx('prof'));

-- ================= leitura: dicas de leitura ===========================
select pg_temp.expect_count('leitura: anon NÃO lê', null,
  'select count(*) from public.reading_tips', 0);
select pg_temp.expect_count('leitura: member ativo lê só o PUBLICADO (1)', pg_temp.fx('member'),
  'select count(*) from public.reading_tips where title like ''[rls-suite]%''', 1);
select pg_temp.expect_count('leitura: dona lê publicado e rascunho (2)', pg_temp.fx('prof'),
  'select count(*) from public.reading_tips where title like ''[rls-suite]%''', 2);
select pg_temp.expect_count('leitura: master lê publicado e rascunho (2)', pg_temp.fx('master'),
  'select count(*) from public.reading_tips where title like ''[rls-suite]%''', 2);

-- ================= leitura: sessões ====================================
select pg_temp.expect_count('sessões: anon NÃO lê', null,
  'select count(*) from public.wellness_sessions', 0);
select pg_temp.expect_count('sessões: member ativo lê só o PUBLICADO (1)', pg_temp.fx('member'),
  'select count(*) from public.wellness_sessions where title like ''[rls-suite]%''', 1);
select pg_temp.expect_count('sessões: dona lê publicada e rascunho (2)', pg_temp.fx('prof'),
  'select count(*) from public.wellness_sessions where title like ''[rls-suite]%''', 2);

-- ================= escrita: dicas de leitura ===========================
select pg_temp.expect_write('leitura: dona cadastra livro na própria comunidade -> PERMITIDO', pg_temp.fx('prof'),
  format('insert into public.reading_tips (community_id, theme, title, author) values (%L, ''saude'', ''[rls-suite] novo'', ''X'')', pg_temp.fx('commA')), true);
select pg_temp.expect_write('leitura: member cadastra livro -> BLOQUEADO', pg_temp.fx('member'),
  format('insert into public.reading_tips (community_id, theme, title, author) values (%L, ''saude'', ''[rls-suite] forjado'', ''X'')', pg_temp.fx('commA')), false);
select pg_temp.expect_write('leitura: anon cadastra livro -> BLOQUEADO', null,
  format('insert into public.reading_tips (community_id, theme, title, author) values (%L, ''saude'', ''[rls-suite] anon'', ''X'')', pg_temp.fx('commA')), false);
select pg_temp.expect_write('leitura: dona cadastra livro em comunidade de OUTRA dona -> BLOQUEADO', pg_temp.fx('prof'),
  format('insert into public.reading_tips (community_id, theme, title, author) values (%L, ''saude'', ''[rls-suite] alheio'', ''X'')', pg_temp.fx('commC')), false);
select pg_temp.expect_write('leitura: tema inválido -> BLOQUEADO (check)', pg_temp.fx('prof'),
  format('insert into public.reading_tips (community_id, theme, title, author) values (%L, ''astrologia'', ''[rls-suite] x'', ''X'')', pg_temp.fx('commA')), false);
select pg_temp.expect_write('leitura: título vazio -> BLOQUEADO (check)', pg_temp.fx('prof'),
  format('insert into public.reading_tips (community_id, theme, title, author) values (%L, ''saude'', ''  '', ''X'')', pg_temp.fx('commA')), false);
select pg_temp.expect_count('leitura: member UPDATE não afeta nenhuma linha', pg_temp.fx('member'),
  'with u as (update public.reading_tips set title = ''invadido'' where title like ''[rls-suite]%'' returning 1) select count(*) from u', 0);
select pg_temp.expect_count('leitura: member DELETE não afeta nenhuma linha', pg_temp.fx('member'),
  'with d as (delete from public.reading_tips where title like ''[rls-suite]%'' returning 1) select count(*) from d', 0);
select pg_temp.expect_write('leitura: dona edita o próprio livro -> PERMITIDO', pg_temp.fx('prof'),
  'update public.reading_tips set summary = ''ok'' where title = ''[rls-suite] livro publicado''', true);
select pg_temp.expect_write('leitura: dona exclui o próprio livro -> PERMITIDO', pg_temp.fx('prof'),
  'delete from public.reading_tips where title = ''[rls-suite] livro rascunho''', true);

-- ================= escrita: sessões ====================================
select pg_temp.expect_write('sessões: dona cadastra sessão -> PERMITIDO', pg_temp.fx('prof'),
  format('insert into public.wellness_sessions (community_id, kind, title, duration_minutes) values (%L, ''pausa'', ''[rls-suite] nova'', 3)', pg_temp.fx('commA')), true);
select pg_temp.expect_write('sessões: member cadastra sessão -> BLOQUEADO', pg_temp.fx('member'),
  format('insert into public.wellness_sessions (community_id, kind, title, duration_minutes) values (%L, ''pausa'', ''[rls-suite] forjada'', 3)', pg_temp.fx('commA')), false);
select pg_temp.expect_write('sessões: dona em comunidade de OUTRA dona -> BLOQUEADO', pg_temp.fx('prof'),
  format('insert into public.wellness_sessions (community_id, kind, title, duration_minutes) values (%L, ''pausa'', ''[rls-suite] alheia'', 3)', pg_temp.fx('commC')), false);
select pg_temp.expect_write('sessões: duração 0 -> BLOQUEADO (check)', pg_temp.fx('prof'),
  format('insert into public.wellness_sessions (community_id, kind, title, duration_minutes) values (%L, ''pausa'', ''[rls-suite] x'', 0)', pg_temp.fx('commA')), false);
select pg_temp.expect_write('sessões: duração de 5 horas -> BLOQUEADO (check)', pg_temp.fx('prof'),
  format('insert into public.wellness_sessions (community_id, kind, title, duration_minutes) values (%L, ''pausa'', ''[rls-suite] x'', 300)', pg_temp.fx('commA')), false);
select pg_temp.expect_write('sessões: tipo inválido -> BLOQUEADO (check)', pg_temp.fx('prof'),
  format('insert into public.wellness_sessions (community_id, kind, title, duration_minutes) values (%L, ''apneia'', ''[rls-suite] x'', 3)', pg_temp.fx('commA')), false);
select pg_temp.expect_write('sessões: áudio em http (sem s) -> BLOQUEADO (check)', pg_temp.fx('prof'),
  format('insert into public.wellness_sessions (community_id, kind, title, duration_minutes, audio_url) values (%L, ''pausa'', ''[rls-suite] x'', 3, ''http://exemplo.com/a.mp3'')', pg_temp.fx('commA')), false);
select pg_temp.expect_write('sessões: áudio em https -> PERMITIDO', pg_temp.fx('prof'),
  format('insert into public.wellness_sessions (community_id, kind, title, duration_minutes, audio_url) values (%L, ''pausa'', ''[rls-suite] ok'', 3, ''https://exemplo.com/a.mp3'')', pg_temp.fx('commA')), true);
select pg_temp.expect_count('sessões: member DELETE não afeta nenhuma linha', pg_temp.fx('member'),
  'with d as (delete from public.wellness_sessions where title like ''[rls-suite]%'' returning 1) select count(*) from d', 0);

-- ---------- RESULTADO --------------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
