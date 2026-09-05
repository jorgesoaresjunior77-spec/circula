-- =====================================================================
-- 10 — MEMBER ATIVO  (concatenar após _framework.sql)
-- =====================================================================
-- "Usuario Teste" (94bc…), membro ATIVO de "Fluir & Florescer" (A).
-- Valida: lê só o que deve, cria conteúdo permitido, não toca dados de
-- terceiros, não vê conteúdo oculto/privado.
-- =====================================================================

-- ---------- LEITURA — o que o member ATIVO deve enxergar ----------
select pg_temp.expect_count('member-ativo: SELECT posts de A',
  pg_temp.fx('member'),
  format('select count(*) from public.posts where community_id = %L', pg_temp.fx('commA')), 11);

select pg_temp.expect_count('member-ativo: SELECT post_comments (via can_view_post)',
  pg_temp.fx('member'),
  'select count(*) from public.post_comments', 19);

select pg_temp.expect_count('member-ativo: SELECT post_reactions',
  pg_temp.fx('member'),
  'select count(*) from public.post_reactions', 11);

select pg_temp.expect_count('member-ativo: SELECT joy_moments de A',
  pg_temp.fx('member'),
  format('select count(*) from public.joy_moments where community_id = %L', pg_temp.fx('commA')), 1);

select pg_temp.expect_count('member-ativo: SELECT community_content publicado de A',
  pg_temp.fx('member'),
  format('select count(*) from public.community_content where community_id = %L', pg_temp.fx('commA')), 2);

select pg_temp.expect_count('member-ativo: SELECT community_members (só a própria linha)',
  pg_temp.fx('member'),
  'select count(*) from public.community_members', 1);

select pg_temp.expect_count('member-ativo: SELECT challenge_progress próprio',
  pg_temp.fx('member'),
  format('select count(*) from public.challenge_progress where profile_id = %L', pg_temp.fx('member')), 2);

select pg_temp.expect_bool('member-ativo: can_view_post(postA) = true',
  pg_temp.fx('member'),
  format('select public.can_view_post(%L)', pg_temp.fx('postA')), true);

select pg_temp.expect_count('member-ativo: profiles visíveis (próprio + quem compartilha comunidade ativa)',
  pg_temp.fx('member'),
  'select count(*) from public.profiles', 2);

-- ---------- LEITURA — o que o member NÃO deve enxergar -----------
select pg_temp.expect_count('member-ativo: NÃO lê daily_mood de terceiros',
  pg_temp.fx('member'),
  format('select count(*) from public.daily_mood_entries where profile_id <> %L', pg_temp.fx('member')), 0);

select pg_temp.expect_count('member-ativo: NÃO lê challenge_progress de terceiros',
  pg_temp.fx('member'),
  format('select count(*) from public.challenge_progress where profile_id <> %L', pg_temp.fx('member')), 0);

select pg_temp.expect_count('member-ativo: NÃO lê help_requests privados de terceiros (audience=professional)',
  pg_temp.fx('member'),
  format('select count(*) from public.help_requests where audience = ''professional'' and profile_id <> %L', pg_temp.fx('member')), 0);

select pg_temp.expect_count('member-ativo: NÃO lê subscriptions de terceiros',
  pg_temp.fx('member'),
  format('select count(*) from public.subscriptions where profile_id <> %L', pg_temp.fx('member')), 0);

-- conteúdo OCULTO: escondemos postA temporariamente (postgres), testamos, desfazemos
update public.posts set hidden_at = now() where id = pg_temp.fx('postA');
select pg_temp.expect_count('member-ativo: NÃO lê post oculto',
  pg_temp.fx('member'),
  format('select count(*) from public.posts where id = %L', pg_temp.fx('postA')), 0);
select pg_temp.expect_bool('member-ativo: can_view_post(oculto) = false',
  pg_temp.fx('member'),
  format('select public.can_view_post(%L)', pg_temp.fx('postA')), false);
update public.posts set hidden_at = null where id = pg_temp.fx('postA');

-- ---------- ESCRITA — o que o member ATIVO PODE criar -----------
select pg_temp.expect_write('member-ativo: INSERT post em A (autor = próprio)',
  pg_temp.fx('member'),
  format('insert into public.posts(community_id,author_id,content) values (%L,%L,%L)',
         pg_temp.fx('commA'), pg_temp.fx('member'), '[rls-suite] post'), true);

select pg_temp.expect_write('member-ativo: INSERT comentário em post visível',
  pg_temp.fx('member'),
  format('insert into public.post_comments(post_id,author_id,content) values (%L,%L,%L)',
         pg_temp.fx('postA'), pg_temp.fx('member'), '[rls-suite] comment'), true);

select pg_temp.expect_write('member-ativo: INSERT reação em post visível',
  pg_temp.fx('member'),
  format('delete from public.post_reactions where post_id=%L and profile_id=%L; insert into public.post_reactions(post_id,profile_id) values (%L,%L)',
         pg_temp.fx('postA'), pg_temp.fx('member'), pg_temp.fx('postA'), pg_temp.fx('member')), true);

select pg_temp.expect_write('member-ativo: INSERT joy_moment (profile = próprio)',
  pg_temp.fx('member'),
  format('insert into public.joy_moments(community_id,profile_id,body) values (%L,%L,%L)',
         pg_temp.fx('commA'), pg_temp.fx('member'), '[rls-suite] alegria'), true);

select pg_temp.expect_write('member-ativo: INSERT daily_mood (upsert do próprio)',
  pg_temp.fx('member'),
  format('delete from public.daily_mood_entries where profile_id=%L and community_id=%L and entry_date=current_date; insert into public.daily_mood_entries(profile_id,community_id,mood,entry_date) values (%L,%L,''happy'',current_date)',
         pg_temp.fx('member'), pg_temp.fx('commA'), pg_temp.fx('member'), pg_temp.fx('commA')), true);

select pg_temp.expect_write('member-ativo: INSERT help_request (próprio, em A)',
  pg_temp.fx('member'),
  format('insert into public.help_requests(community_id,profile_id,audience,body) values (%L,%L,''community'',%L)',
         pg_temp.fx('commA'), pg_temp.fx('member'), '[rls-suite] ajuda'), true);

select pg_temp.expect_write('member-ativo: INSERT challenge_progress próprio (dia 3 <= dia atual)',
  pg_temp.fx('member'),
  format('delete from public.challenge_progress where challenge_id=%L and profile_id=%L and day_number=3; insert into public.challenge_progress(challenge_id,profile_id,day_number) values (%L,%L,3)',
         pg_temp.fx('challA'), pg_temp.fx('member'), pg_temp.fx('challA'), pg_temp.fx('member')), true);

-- ---------- ESCRITA — o que o member ATIVO NÃO PODE fazer -------
select pg_temp.expect_write('member-ativo: NÃO faz UPDATE de post (nenhuma policy de update)',
  pg_temp.fx('member'),
  format('update public.posts set content = ''hack'' where id = %L', pg_temp.fx('postA')), false);

select pg_temp.expect_write('member-ativo: NÃO faz DELETE de post (nenhuma policy de delete)',
  pg_temp.fx('member'),
  format('delete from public.posts where id = %L', pg_temp.fx('postA')), false);

select pg_temp.expect_write('member-ativo: NÃO edita profile de terceiro',
  pg_temp.fx('member'),
  format('update public.profiles set full_name = ''hack'' where id = %L', pg_temp.fx('prof')), false);

select pg_temp.expect_write('member-ativo: NÃO edita a própria linha de community_members (status)',
  pg_temp.fx('member'),
  format('update public.community_members set status = ''active'' where profile_id = %L and community_id = %L',
         pg_temp.fx('member'), pg_temp.fx('commA')), false);

select pg_temp.expect_write('member-ativo: NÃO cria community_content (precisa ser dona)',
  pg_temp.fx('member'),
  format('insert into public.community_content(community_id,created_by,type,title,status) values (%L,%L,''article'',''x'',''published'')',
         pg_temp.fx('commA'), pg_temp.fx('member')), false);

select pg_temp.expect_write('member-ativo: NÃO cria post_comment como OUTRO autor (author_id spoof)',
  pg_temp.fx('member'),
  format('insert into public.post_comments(post_id,author_id,content) values (%L,%L,%L)',
         pg_temp.fx('postA'), pg_temp.fx('prof'), '[rls-suite] spoof'), false);

select pg_temp.expect_write('member-ativo: NÃO deleta reação de terceiro',
  pg_temp.fx('member'),
  format('delete from public.post_reactions where profile_id = %L', pg_temp.fx('prof')), false);

-- ---------- ESCALADA DE PRIVILÉGIO ------------------------------
select pg_temp.expect_write('member-ativo: UPDATE do próprio role=master (retorna ok; trigger reverte)',
  pg_temp.fx('member'),
  format('update public.profiles set role = ''master'' where id = %L', pg_temp.fx('member')), true);
-- confirma que o trigger prevent_role_escalation manteve o role:
select pg_temp.expect_count('member-ativo: role continua ''member'' após tentativa de escalada',
  pg_temp.fx('member'),
  format('select count(*) from public.profiles where id = %L and role = ''member''', pg_temp.fx('member')), 1);

select pg_temp.expect_rpc('member-ativo: platform_overview() -> RAISE',
  pg_temp.fx('member'), 'public.platform_overview()', false);
select pg_temp.expect_rpc('member-ativo: platform_communities() -> RAISE',
  pg_temp.fx('member'), 'public.platform_communities()', false);
select pg_temp.expect_rpc('member-ativo: community_metrics(A) -> RAISE (não é dona)',
  pg_temp.fx('member'), format('public.community_metrics(%L)', pg_temp.fx('commA')), false);

-- ---------- RESULTADO ----------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
