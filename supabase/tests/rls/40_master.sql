-- =====================================================================
-- 40 — MASTER  (concatenar após _framework.sql)
-- =====================================================================
-- Master (18004064…). Após a Fase 12.4 NÃO deve mais ler diretamente
-- dados individuais de comunidade; usa RPCs agregadas (`platform_*`).
-- Não pode escalar privilégio.
-- =====================================================================

-- fixture sintético: comunidade B + post em B, para confirmar que o
-- Master também não lê comunidade da qual não é dono.
-- owner_id = member: `communities` tem UNIQUE(owner_id) e o Prof já é
-- dono de A; o dono precisa apenas existir em profiles (FK), sem CHECK
-- de role (o INSERT roda como `postgres`, ignorando RLS). O ponto do
-- teste é: o Master não vê B independentemente de quem seja o dono.
insert into public.communities (id, owner_id, name, slug, is_discoverable)
values ((select v::uuid from _fx where k='commB'),
        (select v::uuid from _fx where k='member'),
        '[rls-suite] Comunidade B', 'rls-suite-b', false);
insert into public.posts (id, community_id, author_id, content)
values ((select v::uuid from _fx where k='postB'),
        (select v::uuid from _fx where k='commB'),
        (select v::uuid from _fx where k='prof'),
        '[rls-suite] post em B');

-- ---------- 12.4 — SEM leitura direta de dados individuais -------
select pg_temp.expect_count('master: NÃO lê posts (nenhum)',
  pg_temp.fx('master'), 'select count(*) from public.posts', 0);

select pg_temp.expect_count('master: NÃO lê post_comments',
  pg_temp.fx('master'), 'select count(*) from public.post_comments', 0);

select pg_temp.expect_count('master: NÃO lê post_reactions',
  pg_temp.fx('master'), 'select count(*) from public.post_reactions', 0);

select pg_temp.expect_count('master: NÃO lê profiles de terceiros (só o próprio)',
  pg_temp.fx('master'), 'select count(*) from public.profiles', 1);

select pg_temp.expect_count('master: NÃO lê community_members',
  pg_temp.fx('master'), 'select count(*) from public.community_members', 0);

select pg_temp.expect_count('master: NÃO lê community_content',
  pg_temp.fx('master'), 'select count(*) from public.community_content', 0);

select pg_temp.expect_count('master: NÃO lê joy_moments',
  pg_temp.fx('master'), 'select count(*) from public.joy_moments', 0);

select pg_temp.expect_count('master: NÃO lê challenge_progress',
  pg_temp.fx('master'), 'select count(*) from public.challenge_progress', 0);

select pg_temp.expect_count('master: NÃO lê challenge_completions',
  pg_temp.fx('master'), 'select count(*) from public.challenge_completions', 0);

select pg_temp.expect_bool('master: can_view_post(postA) = false',
  pg_temp.fx('master'),
  format('select public.can_view_post(%L)', pg_temp.fx('postA')), false);

select pg_temp.expect_bool('master: can_view_post(postB, comunidade alheia) = false',
  pg_temp.fx('master'),
  format('select public.can_view_post(%L)', pg_temp.fx('postB')), false);

-- dados já protegidos antes da 12.4 (Fase 9) — continuam protegidos:
select pg_temp.expect_count('master: NÃO lê daily_mood_entries',
  pg_temp.fx('master'), 'select count(*) from public.daily_mood_entries', 0);
select pg_temp.expect_count('master: NÃO lê checkin_responses',
  pg_temp.fx('master'), 'select count(*) from public.checkin_responses', 0);
select pg_temp.expect_count('master: NÃO lê help_requests',
  pg_temp.fx('master'), 'select count(*) from public.help_requests', 0);
select pg_temp.expect_count('master: NÃO lê point_ledger',
  pg_temp.fx('master'), 'select count(*) from public.point_ledger', 0);
select pg_temp.expect_count('master: NÃO lê messages',
  pg_temp.fx('master'), 'select count(*) from public.messages', 0);

-- ---------- RPCs agregadas — Master CONTINUA usando -------------
select pg_temp.expect_rpc('master: platform_overview() -> OK',
  pg_temp.fx('master'), 'public.platform_overview()', true);
select pg_temp.expect_rpc('master: platform_communities() -> OK',
  pg_temp.fx('master'), 'public.platform_communities()', true);
select pg_temp.expect_rpc('master: platform_professionals() -> OK',
  pg_temp.fx('master'), 'public.platform_professionals()', true);

-- ---------- Master NÃO escreve conteúdo de comunidade ----------
select pg_temp.expect_write('master: NÃO insere post em A',
  pg_temp.fx('master'),
  format('insert into public.posts(community_id,author_id,content) values (%L,%L,%L)',
         pg_temp.fx('commA'), pg_temp.fx('master'), '[rls-suite]'), false);

select pg_temp.expect_write('master: NÃO insere comentário',
  pg_temp.fx('master'),
  format('insert into public.post_comments(post_id,author_id,content) values (%L,%L,%L)',
         pg_temp.fx('postA'), pg_temp.fx('master'), '[rls-suite]'), false);

-- ---------- Master NÃO tem caminho de escrita direta -----------
-- Depois da 12.4, o Master administra a plataforma SÓ por RPC agregada
-- e por service_role (server-side). O role `authenticated` do Master
-- não recebe GRANT UPDATE/DELETE em community_members nem GRANT DELETE
-- em communities — então mesmo as policies que citam is_master()
-- (community_members_update, communities_delete) ficam inalcançáveis
-- pelo cliente. É uma trava a mais, não um bug.
select pg_temp.expect_write('master: UPDATE direto em community_members -> BLOQUEADO (sem GRANT ao cliente)',
  pg_temp.fx('master'),
  format('update public.community_members set status = ''active'' where community_id = %L and profile_id = %L',
         pg_temp.fx('commA'), pg_temp.fx('member')), false);

select pg_temp.expect_write('master: DELETE direto em communities -> BLOQUEADO (sem GRANT ao cliente)',
  pg_temp.fx('master'),
  format('delete from public.communities where id = %L', pg_temp.fx('commB')), false);

-- (Nota: a 12.4 endureceu LEITURA. O Master mantém, por is_master(),
--  UPDATE em communities e em profiles via RLS — não foi alvo da 12.4.
--  Registrado aqui como comportamento conhecido, não testado como trava.)

-- ---------- RESULTADO ----------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
