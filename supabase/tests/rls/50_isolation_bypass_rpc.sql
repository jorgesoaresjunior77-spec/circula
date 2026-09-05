-- =====================================================================
-- 50 — ISOLAMENTO, BYPASS E RPC  (concatenar após _framework.sql)
-- =====================================================================
-- Testes transversais: isolamento entre comunidades, UUID inexistente,
-- acesso anônimo, tentativas diretas de INSERT/UPDATE/DELETE pela API,
-- guards de RPC (SECURITY DEFINER) e escalada de privilégio.
-- =====================================================================

-- comunidade B + post em B — para os testes de isolamento.
-- owner_id = master: a persona sob teste aqui é o `member`; o dono não
-- pode ser o próprio member (senão owns_community() liberaria o acesso)
-- nem o prof (UNIQUE(owner_id), já é dono de A). O INSERT roda como
-- `postgres`, então não há CHECK de role.
insert into public.communities (id, owner_id, name, slug, is_discoverable)
values ((select v::uuid from _fx where k='commB'),
        (select v::uuid from _fx where k='master'),
        '[rls-suite] Comunidade B', 'rls-suite-b', false);
insert into public.posts (id, community_id, author_id, content)
values ((select v::uuid from _fx where k='postB'),
        (select v::uuid from _fx where k='commB'),
        (select v::uuid from _fx where k='prof'),
        '[rls-suite] post em B');

-- ---------- ISOLAMENTO ENTRE COMUNIDADES -----------------------
select pg_temp.expect_count('isolamento: member de A NÃO lê posts de B',
  pg_temp.fx('member'),
  format('select count(*) from public.posts where community_id = %L', pg_temp.fx('commB')), 0);

select pg_temp.expect_write('isolamento: member de A NÃO insere post em B',
  pg_temp.fx('member'),
  format('insert into public.posts(community_id,author_id,content) values (%L,%L,%L)',
         pg_temp.fx('commB'), pg_temp.fx('member'), '[rls-suite]'), false);

select pg_temp.expect_write('isolamento: member de A NÃO comenta post de B',
  pg_temp.fx('member'),
  format('insert into public.post_comments(post_id,author_id,content) values (%L,%L,%L)',
         pg_temp.fx('postB'), pg_temp.fx('member'), '[rls-suite]'), false);

-- responder em postA usando como parent um comentário de OUTRO post:
-- a policy post_comments_insert exige parent.post_id = post_id. Pega
-- dinamicamente um comentário-raiz de outro post visível; se não houver,
-- o INSERT ... SELECT afeta 0 linhas e o framework também marca BLOCKED.
select pg_temp.expect_write('isolamento: member NÃO responde em postA com parent de outro post',
  pg_temp.fx('member'),
  format($q$insert into public.post_comments(post_id,author_id,content,parent_comment_id)
           select %L, %L, %L, pc.id
             from public.post_comments pc
            where pc.post_id <> %L and pc.parent_comment_id is null
            limit 1$q$,
         pg_temp.fx('postA'), pg_temp.fx('member'), '[rls-suite]', pg_temp.fx('postA')), false);

select pg_temp.expect_bool('isolamento: can_view_post(postB) = false para member de A',
  pg_temp.fx('member'),
  format('select public.can_view_post(%L)', pg_temp.fx('postB')), false);

-- ---------- UUID INEXISTENTE ----------------------------------
select pg_temp.expect_bool('uuid inexistente: can_view_post(nil) = false',
  pg_temp.fx('member'),
  format('select public.can_view_post(%L)', pg_temp.fx('nil')), false);

select pg_temp.expect_count('uuid inexistente: SELECT posts where id = nil -> 0',
  pg_temp.fx('member'),
  format('select count(*) from public.posts where id = %L', pg_temp.fx('nil')), 0);

select pg_temp.expect_write('uuid inexistente: INSERT comentário em post inexistente -> BLOCKED',
  pg_temp.fx('member'),
  format('insert into public.post_comments(post_id,author_id,content) values (%L,%L,%L)',
         pg_temp.fx('nil'), pg_temp.fx('member'), '[rls-suite]'), false);

-- ---------- ACESSO ANÔNIMO (sem auth.uid) --------------------
-- O role `anon` não tem GRANT SELECT nestas tabelas: a leitura direta é
-- barrada com permission denied (42501) ANTES mesmo de a RLS ser
-- consultada. `expect_locked` aceita tanto "0 linhas" quanto "denied".
-- Descoberta pública de comunidades, quando existir, será por RPC
-- própria (fora do escopo 12.1) — hoje o anon não lê nem communities.
select pg_temp.expect_locked('anon: NÃO lê posts',              null, 'select count(*) from public.posts');
select pg_temp.expect_locked('anon: NÃO lê post_comments',      null, 'select count(*) from public.post_comments');
select pg_temp.expect_locked('anon: NÃO lê post_reactions',     null, 'select count(*) from public.post_reactions');
select pg_temp.expect_locked('anon: NÃO lê profiles',           null, 'select count(*) from public.profiles');
select pg_temp.expect_locked('anon: NÃO lê joy_moments',        null, 'select count(*) from public.joy_moments');
select pg_temp.expect_locked('anon: NÃO lê community_members',  null, 'select count(*) from public.community_members');
select pg_temp.expect_locked('anon: NÃO lê community_content',  null, 'select count(*) from public.community_content');
select pg_temp.expect_locked('anon: NÃO lê communities',        null, 'select count(*) from public.communities');
select pg_temp.expect_locked('anon: NÃO lê daily_mood_entries', null, 'select count(*) from public.daily_mood_entries');
select pg_temp.expect_locked('anon: NÃO lê subscriptions',      null, 'select count(*) from public.subscriptions');

select pg_temp.expect_write('anon: NÃO insere post',
  null,
  format('insert into public.posts(community_id,author_id,content) values (%L,%L,%L)',
         pg_temp.fx('commA'), pg_temp.fx('member'), '[rls-suite]'), false);

-- ---------- MANIPULAÇÃO DE DADOS DE TERCEIROS (API direta) ----
select pg_temp.expect_write('bypass: member UPDATE role de terceiro -> BLOCKED',
  pg_temp.fx('member'),
  format('update public.profiles set role = ''member'' where id = %L', pg_temp.fx('prof')), false);

select pg_temp.expect_write('bypass: member DELETE comentário de terceiro -> BLOCKED (sem policy delete)',
  pg_temp.fx('member'),
  format('delete from public.post_comments where author_id = %L', pg_temp.fx('prof')), false);

select pg_temp.expect_write('bypass: member DELETE reação de terceiro -> BLOCKED',
  pg_temp.fx('member'),
  format('delete from public.post_reactions where profile_id = %L', pg_temp.fx('prof')), false);

select pg_temp.expect_write('bypass: member UPDATE challenge_progress de terceiro -> BLOCKED (sem policy update)',
  pg_temp.fx('member'),
  format('update public.challenge_progress set day_number = 1 where profile_id = %L', pg_temp.fx('prof')), false);

select pg_temp.expect_write('bypass: member DELETE saved_items de terceiro -> BLOCKED',
  pg_temp.fx('member'),
  format('delete from public.saved_items where profile_id = %L', pg_temp.fx('prof')), false);

-- ---------- RPC / SECURITY DEFINER / ESCALADA ----------------
-- guards de is_master():
select pg_temp.expect_rpc('rpc: member -> platform_overview() RAISE',
  pg_temp.fx('member'), 'public.platform_overview()', false);
select pg_temp.expect_rpc('rpc: prof -> platform_professionals() RAISE',
  pg_temp.fx('prof'), 'public.platform_professionals()', false);
select pg_temp.expect_rpc('rpc: master -> platform_overview() OK',
  pg_temp.fx('master'), 'public.platform_overview()', true);
select pg_temp.expect_rpc('rpc: anon -> platform_overview() RAISE',
  null, 'public.platform_overview()', false);

-- guards de owns_community():
select pg_temp.expect_rpc('rpc: member -> community_metrics(A) RAISE',
  pg_temp.fx('member'), format('public.community_metrics(%L)', pg_temp.fx('commA')), false);
select pg_temp.expect_rpc('rpc: prof -> community_metrics(A) OK (dona)',
  pg_temp.fx('prof'), format('public.community_metrics(%L)', pg_temp.fx('commA')), true);
select pg_temp.expect_rpc('rpc: prof -> community_metrics(B) RAISE (não dona)',
  pg_temp.fx('prof'), format('public.community_metrics(%L)', pg_temp.fx('commB')), false);
select pg_temp.expect_rpc('rpc: member -> community_participants_overview(A) RAISE',
  pg_temp.fx('member'), format('public.community_participants_overview(%L)', pg_temp.fx('commA')), false);
select pg_temp.expect_rpc('rpc: member -> community_posts_moderation(A) RAISE',
  pg_temp.fx('member'), format('public.community_posts_moderation(%L)', pg_temp.fx('commA')), false);
select pg_temp.expect_rpc('rpc: member -> moderate_post(postA, hide) RAISE',
  pg_temp.fx('member'), format('public.moderate_post(%L, ''hide'')', pg_temp.fx('postA')), false);

-- SECURITY DEFINER não vaza: RPC agregada não devolve linha individual
-- (checado indiretamente pelos guards acima; platform_* só roda para is_master()).

-- ---------- RESULTADO ----------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
