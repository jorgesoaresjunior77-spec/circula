-- =====================================================================
-- 113 — PÁGINAS DAS RECEITAS EM REVISTA (migration 20261107140000)
-- =====================================================================
-- Membro ativo lê só as páginas de receita PUBLICADA; dona e master leem
-- também as de rascunho; só a dona escreve, e só em conteúdo da própria
-- comunidade. anon não lê. Tudo em ROLLBACK.
-- OBS: o conteúdo de teste usa type='material' porque o CHECK atual de
-- community_content.type não aceita 'recipe' (a política não olha o tipo).
-- =====================================================================

-- Receita publicada e receita rascunho em A (inseridas como postgres).
insert into public.community_content (id, community_id, created_by, type, title, status) values
  ('dddddddd-0000-4000-8000-0000000000d1', pg_temp.fx('commA'), pg_temp.fx('prof'), 'material', '[rls-suite] receita publicada', 'published'),
  ('dddddddd-0000-4000-8000-0000000000d2', pg_temp.fx('commA'), pg_temp.fx('prof'), 'material', '[rls-suite] receita rascunho',  'draft');

insert into public.recipe_pages (content_id, community_id, position, image_path) values
  ('dddddddd-0000-4000-8000-0000000000d1', pg_temp.fx('commA'), 0, 'rls-suite/pub-0.png'),
  ('dddddddd-0000-4000-8000-0000000000d1', pg_temp.fx('commA'), 1, 'rls-suite/pub-1.png'),
  ('dddddddd-0000-4000-8000-0000000000d2', pg_temp.fx('commA'), 0, 'rls-suite/rasc-0.png');

-- Comunidade B sintética (dono = master) com uma receita publicada, para
-- provar que a dona de A não escreve nem lê nada de B.
insert into public.communities (id, owner_id, name, slug, is_discoverable)
values (pg_temp.fx('commB'), pg_temp.fx('master'), '[rls-suite] Comunidade B', 'rls-suite-b', false);
insert into public.community_content (id, community_id, created_by, type, title, status)
values ('dddddddd-0000-4000-8000-0000000000d3', pg_temp.fx('commB'), pg_temp.fx('master'), 'material', '[rls-suite] receita em B', 'published');
insert into public.recipe_pages (content_id, community_id, position, image_path)
values ('dddddddd-0000-4000-8000-0000000000d3', pg_temp.fx('commB'), 0, 'rls-suite/b-0.png');

-- ---------- LEITURA ----------------------------------------------------
select pg_temp.expect_locked('recipe_pages: anon NÃO lê', null,
  'select count(*) from public.recipe_pages');
select pg_temp.expect_count('recipe_pages: member ativo lê só as da receita PUBLICADA (2)', pg_temp.fx('member'),
  format('select count(*) from public.recipe_pages where community_id = %L', pg_temp.fx('commA')), 2);
select pg_temp.expect_count('recipe_pages: dona lê publicada e rascunho (3)', pg_temp.fx('prof'),
  format('select count(*) from public.recipe_pages where community_id = %L', pg_temp.fx('commA')), 3);
select pg_temp.expect_count('recipe_pages: master lê publicada e rascunho (3)', pg_temp.fx('master'),
  format('select count(*) from public.recipe_pages where community_id = %L', pg_temp.fx('commA')), 3);

-- ---------- ISOLAMENTO ENTRE COMUNIDADES -------------------------------
select pg_temp.expect_count('recipe_pages: member de A NÃO lê páginas de B (0)', pg_temp.fx('member'),
  format('select count(*) from public.recipe_pages where community_id = %L', pg_temp.fx('commB')), 0);
select pg_temp.expect_count('recipe_pages: dona de A NÃO lê páginas de B (0)', pg_temp.fx('prof'),
  format('select count(*) from public.recipe_pages where community_id = %L', pg_temp.fx('commB')), 0);

-- ---------- ESCRITA ----------------------------------------------------
select pg_temp.expect_write('recipe_pages: dona insere página na receita de A -> PERMITIDO', pg_temp.fx('prof'),
  format('insert into public.recipe_pages (content_id, community_id, position, image_path) values (%L, %L, 2, %L)',
         'dddddddd-0000-4000-8000-0000000000d1', pg_temp.fx('commA'), 'rls-suite/novo.png'), true);
select pg_temp.expect_write('recipe_pages: dona insere página em receita de B -> BLOQUEADO', pg_temp.fx('prof'),
  format('insert into public.recipe_pages (content_id, community_id, position, image_path) values (%L, %L, 0, %L)',
         'dddddddd-0000-4000-8000-0000000000d3', pg_temp.fx('commB'), 'rls-suite/x.png'), false);
select pg_temp.expect_write('recipe_pages: dona usa community_id de A com content_id de B -> BLOQUEADO (with check)', pg_temp.fx('prof'),
  format('insert into public.recipe_pages (content_id, community_id, position, image_path) values (%L, %L, 0, %L)',
         'dddddddd-0000-4000-8000-0000000000d3', pg_temp.fx('commA'), 'rls-suite/x.png'), false);
select pg_temp.expect_write('recipe_pages: image_path vazio -> BLOQUEADO (check)', pg_temp.fx('prof'),
  format('insert into public.recipe_pages (content_id, community_id, position, image_path) values (%L, %L, 0, %L)',
         'dddddddd-0000-4000-8000-0000000000d1', pg_temp.fx('commA'), '  '), false);
select pg_temp.expect_write('recipe_pages: member insere -> BLOQUEADO', pg_temp.fx('member'),
  format('insert into public.recipe_pages (content_id, community_id, position, image_path) values (%L, %L, 0, %L)',
         'dddddddd-0000-4000-8000-0000000000d1', pg_temp.fx('commA'), 'rls-suite/m.png'), false);
select pg_temp.expect_write('recipe_pages: master insere (não é a dona) -> BLOQUEADO', pg_temp.fx('master'),
  format('insert into public.recipe_pages (content_id, community_id, position, image_path) values (%L, %L, 0, %L)',
         'dddddddd-0000-4000-8000-0000000000d1', pg_temp.fx('commA'), 'rls-suite/ma.png'), false);
select pg_temp.expect_write('recipe_pages: member apaga página -> BLOQUEADO (0 linhas)', pg_temp.fx('member'),
  format('delete from public.recipe_pages where community_id = %L and image_path = %L',
         pg_temp.fx('commA'), 'rls-suite/pub-0.png'), false);
select pg_temp.expect_write('recipe_pages: dona apaga página de A -> PERMITIDO', pg_temp.fx('prof'),
  format('delete from public.recipe_pages where community_id = %L and image_path = %L',
         pg_temp.fx('commA'), 'rls-suite/pub-0.png'), true);

-- ---------- RESULTADO --------------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
