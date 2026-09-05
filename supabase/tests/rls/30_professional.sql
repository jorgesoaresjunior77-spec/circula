-- =====================================================================
-- 30 — PROFESSIONAL (dona da comunidade)  (concatenar após _framework.sql)
-- =====================================================================
-- "Nutri Marluce Bassani" (1c20d81a…), dona de "Fluir & Florescer" (A).
-- Valida: administra A por inteiro; NÃO acessa nem administra a
-- comunidade alheia C (dona = Master).
-- =====================================================================

-- fixture sintético: comunidade C (dona = Master) + 1 post em C.
-- Inserido como `postgres` (dono da tabela -> ignora RLS). Sumidouro
-- garantido pelo ROLLBACK final.
insert into public.communities (id, owner_id, name, slug, is_discoverable)
values ((select v::uuid from _fx where k='commC'),
        (select v::uuid from _fx where k='master'),
        '[rls-suite] Comunidade C', 'rls-suite-c', false);
insert into public.posts (id, community_id, author_id, content)
values ((select v::uuid from _fx where k='postC'),
        (select v::uuid from _fx where k='commC'),
        (select v::uuid from _fx where k='master'),
        '[rls-suite] post em C');

-- ---------- ACESSO À PRÓPRIA COMUNIDADE (A) -----------------------
select pg_temp.expect_count('prof: SELECT posts de A',
  pg_temp.fx('prof'),
  format('select count(*) from public.posts where community_id = %L', pg_temp.fx('commA')), 11);

select pg_temp.expect_count('prof: SELECT community_members de A (todas)',
  pg_temp.fx('prof'),
  format('select count(*) from public.community_members where community_id = %L', pg_temp.fx('commA')), 2);

select pg_temp.expect_count('prof: SELECT challenge_progress de A (dona vê todos)',
  pg_temp.fx('prof'),
  'select count(*) from public.challenge_progress', 5);

select pg_temp.expect_count('prof: SELECT challenge_completions de A (dona vê todos)',
  pg_temp.fx('prof'),
  'select count(*) from public.challenge_completions', 1);

select pg_temp.expect_count('prof: SELECT community_content de A',
  pg_temp.fx('prof'),
  format('select count(*) from public.community_content where community_id = %L', pg_temp.fx('commA')), 2);

select pg_temp.expect_bool('prof: can_view_post(postA) = true',
  pg_temp.fx('prof'),
  format('select public.can_view_post(%L)', pg_temp.fx('postA')), true);

-- ---------- ADMINISTRA A -----------------------------------------
select pg_temp.expect_write('prof: INSERT post em A',
  pg_temp.fx('prof'),
  format('insert into public.posts(community_id,author_id,content) values (%L,%L,%L)',
         pg_temp.fx('commA'), pg_temp.fx('prof'), '[rls-suite]'), true);

select pg_temp.expect_write('prof: INSERT community_content em A',
  pg_temp.fx('prof'),
  format('insert into public.community_content(community_id,created_by,type,title,status) values (%L,%L,''article'',%L,''published'')',
         pg_temp.fx('commA'), pg_temp.fx('prof'), '[rls-suite]'), true);

select pg_temp.expect_write('prof: UPDATE community_content de A',
  pg_temp.fx('prof'),
  format('update public.community_content set title = ''x'' where id = %L', pg_temp.fx('contentA')), true);

select pg_temp.expect_write('prof: INSERT challenge em A',
  pg_temp.fx('prof'),
  format('insert into public.community_challenges(community_id,created_by,title,starts_on,ends_on) values (%L,%L,%L,current_date,current_date+7)',
         pg_temp.fx('commA'), pg_temp.fx('prof'), '[rls-suite]'), true);

-- Gestão de membros NÃO é feita por UPDATE direto: o role `authenticated`
-- não tem GRANT UPDATE/DELETE em community_members (apenas INSERT/SELECT).
-- Alterar status de assinante é server-side (webhook/trigger da 12.2) ou
-- via RPC futura de aprovação. A policy community_members_update existe
-- mas fica inalcançável pelo cliente — o que é uma trava a mais.
select pg_temp.expect_write('prof: UPDATE direto em community_members de A -> BLOQUEADO (sem GRANT ao cliente)',
  pg_temp.fx('prof'),
  format('update public.community_members set status = ''active'' where community_id = %L and profile_id = %L',
         pg_temp.fx('commA'), pg_temp.fx('member')), false);

select pg_temp.expect_write('prof: DELETE direto em community_members de A -> BLOQUEADO (sem GRANT ao cliente)',
  pg_temp.fx('prof'),
  format('delete from public.community_members where community_id = %L and profile_id = %L',
         pg_temp.fx('commA'), pg_temp.fx('member')), false);

select pg_temp.expect_rpc('prof: community_metrics(A) -> OK',
  pg_temp.fx('prof'), format('public.community_metrics(%L)', pg_temp.fx('commA')), true);

select pg_temp.expect_rpc('prof: community_participants_overview(A) -> OK',
  pg_temp.fx('prof'), format('public.community_participants_overview(%L)', pg_temp.fx('commA')), true);

-- ---------- ISOLAMENTO — comunidade ALHEIA (C, dona = Master) ---
select pg_temp.expect_count('prof: NÃO lê posts de C (comunidade alheia)',
  pg_temp.fx('prof'),
  format('select count(*) from public.posts where community_id = %L', pg_temp.fx('commC')), 0);

select pg_temp.expect_count('prof: NÃO lê community_members de C',
  pg_temp.fx('prof'),
  format('select count(*) from public.community_members where community_id = %L', pg_temp.fx('commC')), 0);

select pg_temp.expect_bool('prof: can_view_post(postC) = false',
  pg_temp.fx('prof'),
  format('select public.can_view_post(%L)', pg_temp.fx('postC')), false);

select pg_temp.expect_write('prof: NÃO insere post em C',
  pg_temp.fx('prof'),
  format('insert into public.posts(community_id,author_id,content) values (%L,%L,%L)',
         pg_temp.fx('commC'), pg_temp.fx('prof'), '[rls-suite]'), false);

select pg_temp.expect_write('prof: NÃO insere community_content em C',
  pg_temp.fx('prof'),
  format('insert into public.community_content(community_id,created_by,type,title,status) values (%L,%L,''article'',''x'',''published'')',
         pg_temp.fx('commC'), pg_temp.fx('prof')), false);

select pg_temp.expect_write('prof: NÃO faz UPDATE em community de C',
  pg_temp.fx('prof'),
  format('update public.communities set name = ''hack'' where id = %L', pg_temp.fx('commC')), false);

select pg_temp.expect_write('prof: NÃO deleta membros de C',
  pg_temp.fx('prof'),
  format('delete from public.community_members where community_id = %L', pg_temp.fx('commC')), false);

select pg_temp.expect_rpc('prof: community_metrics(C) -> RAISE (não é dona de C)',
  pg_temp.fx('prof'), format('public.community_metrics(%L)', pg_temp.fx('commC')), false);

-- ---------- ESCALADA -------------------------------------------
select pg_temp.expect_rpc('prof: platform_overview() -> RAISE',
  pg_temp.fx('prof'), 'public.platform_overview()', false);
select pg_temp.expect_rpc('prof: platform_communities() -> RAISE',
  pg_temp.fx('prof'), 'public.platform_communities()', false);

select pg_temp.expect_write('prof: NÃO edita profile de terceiro',
  pg_temp.fx('prof'),
  format('update public.profiles set full_name = ''hack'' where id = %L', pg_temp.fx('member')), false);

-- ---------- RESULTADO ----------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
