-- =====================================================================
-- 20 — MEMBER BLOQUEADO  (concatenar após _framework.sql)
-- =====================================================================
-- Dois modelos de "bloqueio":
--
--  (A) via community_members.status = 'blocked'
--      É o estado que o trigger da subfase 12.2 vai PRODUZIR quando a
--      assinatura da comunidade for para 'blocked'/'canceled'. Como
--      `is_community_member` já exige status='active', o RLS de conteúdo
--      corta o acesso imediatamente. Estes testes PASSAM hoje — validam
--      que o mecanismo de enforcement (via status) funciona.
--
--  (B) [GAP] via subscriptions.status = 'blocked' apenas (membership
--      continua 'active'). É o estado ATUAL de quem para de pagar (a
--      12.2 ainda não sincroniza). Aqui o member AINDA lê conteúdo pago.
--      Marcado como `gap=true` — a suíte reporta como "gap conhecido,
--      fechado na 12.2", NÃO como falha.
-- =====================================================================

-- ===== (A) bloqueio via community_members.status = 'blocked' =========
update public.community_members
   set status = 'blocked'
 where profile_id = (select v::uuid from _fx where k='member')
   and community_id = (select v::uuid from _fx where k='commA');

select pg_temp.expect_count('member-bloqueado(A): NÃO lê posts de A (conteúdo pago)',
  pg_temp.fx('member'),
  format('select count(*) from public.posts where community_id = %L', pg_temp.fx('commA')), 0);

select pg_temp.expect_count('member-bloqueado(A): NÃO lê post_comments',
  pg_temp.fx('member'),
  'select count(*) from public.post_comments', 0);

select pg_temp.expect_count('member-bloqueado(A): NÃO lê post_reactions',
  pg_temp.fx('member'),
  'select count(*) from public.post_reactions', 0);

select pg_temp.expect_count('member-bloqueado(A): NÃO lê joy_moments',
  pg_temp.fx('member'),
  format('select count(*) from public.joy_moments where community_id = %L', pg_temp.fx('commA')), 0);

select pg_temp.expect_count('member-bloqueado(A): NÃO lê community_content',
  pg_temp.fx('member'),
  format('select count(*) from public.community_content where community_id = %L', pg_temp.fx('commA')), 0);

select pg_temp.expect_count('member-bloqueado(A): NÃO lê challenge (community_challenges)',
  pg_temp.fx('member'),
  format('select count(*) from public.community_challenges where community_id = %L', pg_temp.fx('commA')), 0);

select pg_temp.expect_bool('member-bloqueado(A): can_view_post(postA) = false',
  pg_temp.fx('member'),
  format('select public.can_view_post(%L)', pg_temp.fx('postA')), false);

-- ainda pode ver a própria assinatura (para a tela de renovação):
select pg_temp.expect_count('member-bloqueado(A): AINDA vê a própria subscription',
  pg_temp.fx('member'),
  format('select count(*) from public.subscriptions where profile_id = %L', pg_temp.fx('member')), 1);

-- escrita bloqueada:
select pg_temp.expect_write('member-bloqueado(A): NÃO insere post em A',
  pg_temp.fx('member'),
  format('insert into public.posts(community_id,author_id,content) values (%L,%L,%L)',
         pg_temp.fx('commA'), pg_temp.fx('member'), '[rls-suite]'), false);

select pg_temp.expect_write('member-bloqueado(A): NÃO insere comentário',
  pg_temp.fx('member'),
  format('insert into public.post_comments(post_id,author_id,content) values (%L,%L,%L)',
         pg_temp.fx('postA'), pg_temp.fx('member'), '[rls-suite]'), false);

select pg_temp.expect_write('member-bloqueado(A): NÃO insere reação',
  pg_temp.fx('member'),
  format('insert into public.post_reactions(post_id,profile_id) values (%L,%L)',
         pg_temp.fx('postA'), pg_temp.fx('member')), false);

select pg_temp.expect_write('member-bloqueado(A): NÃO insere joy_moment',
  pg_temp.fx('member'),
  format('insert into public.joy_moments(community_id,profile_id,body) values (%L,%L,%L)',
         pg_temp.fx('commA'), pg_temp.fx('member'), '[rls-suite]'), false);

select pg_temp.expect_write('member-bloqueado(A): NÃO insere help_request',
  pg_temp.fx('member'),
  format('insert into public.help_requests(community_id,profile_id,audience,body) values (%L,%L,''community'',%L)',
         pg_temp.fx('commA'), pg_temp.fx('member'), '[rls-suite]'), false);

select pg_temp.expect_write('member-bloqueado(A): NÃO insere daily_mood',
  pg_temp.fx('member'),
  format('insert into public.daily_mood_entries(profile_id,community_id,mood,entry_date) values (%L,%L,''sad'',current_date - 7)',
         pg_temp.fx('member'), pg_temp.fx('commA')), false);

-- não contorna o bloqueio reativando a própria linha:
select pg_temp.expect_write('member-bloqueado(A): NÃO reativa a própria membership (bypass)',
  pg_temp.fx('member'),
  format('update public.community_members set status = ''active'' where profile_id = %L and community_id = %L',
         pg_temp.fx('member'), pg_temp.fx('commA')), false);

-- restaura o estado real
update public.community_members
   set status = 'active'
 where profile_id = (select v::uuid from _fx where k='member')
   and community_id = (select v::uuid from _fx where k='commA');


-- ===== (B) [GAP] bloqueio só na assinatura — membership ainda ativa ==
-- Estado atual de quem parou de pagar. A 12.2 fecha isso via trigger.
update public.subscriptions
   set status = 'blocked'
 where id = (select v::uuid from _fx where k='member_sub_A');

select pg_temp.expect_count('[GAP] member sub=blocked / membership=active AINDA lê posts de A (12.2 fecha)',
  pg_temp.fx('member'),
  format('select count(*) from public.posts where community_id = %L', pg_temp.fx('commA')),
  0, true);

select pg_temp.expect_write('[GAP] member sub=blocked AINDA insere comentário (12.2 fecha)',
  pg_temp.fx('member'),
  format('insert into public.post_comments(post_id,author_id,content) values (%L,%L,%L)',
         pg_temp.fx('postA'), pg_temp.fx('member'), '[rls-suite]'),
  false, true);

update public.subscriptions
   set status = 'trial'
 where id = (select v::uuid from _fx where k='member_sub_A');

-- ---------- RESULTADO ----------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
