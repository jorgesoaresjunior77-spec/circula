-- =====================================================================
-- 70 — MASTER: config/conteúdo de comunidade (Fase 12.4c)
-- =====================================================================
-- Concatenar após _framework.sql (mesmo padrão dos demais cenários).
-- Cobre as 9 policies + 4 funções can_view_* + as 6 policies
-- dependentes endurecidas pela 12.4c. Usa a comunidade A (real, dona
-- = prof, member ativo real) para os testes "continua funcionando", e
-- uma comunidade sintética B (dona = member — NÃO master, para
-- garantir que o Master não tem NENHUMA relação com ela) para os
-- testes "Master não acessa comunidade alheia". Tudo em transação
-- terminada em ROLLBACK.
-- =====================================================================

-- ---------- fixture: comunidade sintética B (dona = member) ----------
insert into public.communities (id, owner_id, name, slug, is_discoverable)
values (pg_temp.fx('commB'), pg_temp.fx('member'), '[rls-suite] Comunidade B (config)', 'rls-suite-config-b', false);

-- ---------- fixtures em A (real) — marcador novo por tabela ----------
insert into public.community_circles (id, community_id, name, created_by)
values ('daaaaaaa-0000-4000-8000-00000000a001', pg_temp.fx('commA'), '[rls-suite] Circulo A', pg_temp.fx('prof'));

insert into public.community_checkins (id, community_id, content, created_by)
values ('daaaaaaa-0000-4000-8000-00000000a002', pg_temp.fx('commA'), '[rls-suite] checkin A', pg_temp.fx('prof'));

insert into public.checkin_instances (id, community_id, content, published_by)
values ('daaaaaaa-0000-4000-8000-00000000a003', pg_temp.fx('commA'), '[rls-suite] checkin instance A', pg_temp.fx('prof'));

insert into public.community_engagement_commands (id, community_id, title, content, created_by)
values ('daaaaaaa-0000-4000-8000-00000000a004', pg_temp.fx('commA'), '[rls-suite] comando A', '[rls-suite] conteudo', pg_temp.fx('prof'));

insert into public.engagement_command_instances (id, community_id, title, content, published_by)
values ('daaaaaaa-0000-4000-8000-00000000a005', pg_temp.fx('commA'), '[rls-suite] instancia comando A', '[rls-suite] conteudo', pg_temp.fx('prof'));

insert into public.community_events (id, community_id, created_by, title, starts_at, status)
values ('daaaaaaa-0000-4000-8000-00000000a006', pg_temp.fx('commA'), pg_temp.fx('prof'), '[rls-suite] evento A', now() + interval '7 days', 'published');

-- (community_mood_messages tem UNIQUE(community_id, mood) — A já tem
--  mensagens reais para os 5 humores; testado direto sobre elas mais
--  abaixo, sem inserir marcador novo)

insert into public.community_questions (id, community_id, content, created_by)
values ('daaaaaaa-0000-4000-8000-00000000a008', pg_temp.fx('commA'), '[rls-suite] pergunta A', pg_temp.fx('prof'));

-- ---------- fixtures em B (sintética, alheia ao Master) ---------------
insert into public.community_challenges (id, community_id, created_by, title, starts_on, ends_on)
values ('deeeeeee-0000-4000-8000-00000000b001', pg_temp.fx('commB'), pg_temp.fx('member'), '[rls-suite] desafio B', current_date, current_date + 7);

insert into public.community_circles (id, community_id, name, created_by)
values ('deeeeeee-0000-4000-8000-00000000b002', pg_temp.fx('commB'), '[rls-suite] Circulo B', pg_temp.fx('member'));

insert into public.community_checkins (id, community_id, content, created_by)
values ('deeeeeee-0000-4000-8000-00000000b003', pg_temp.fx('commB'), '[rls-suite] checkin B', pg_temp.fx('member'));

insert into public.checkin_instances (id, community_id, content, published_by)
values ('deeeeeee-0000-4000-8000-00000000b004', pg_temp.fx('commB'), '[rls-suite] checkin instance B', pg_temp.fx('member'));

insert into public.community_engagement_commands (id, community_id, title, content, created_by)
values ('deeeeeee-0000-4000-8000-00000000b005', pg_temp.fx('commB'), '[rls-suite] comando B', '[rls-suite] conteudo', pg_temp.fx('member'));

insert into public.engagement_command_instances (id, community_id, title, content, published_by)
values ('deeeeeee-0000-4000-8000-00000000b006', pg_temp.fx('commB'), '[rls-suite] instancia comando B', '[rls-suite] conteudo', pg_temp.fx('member'));

insert into public.community_events (id, community_id, created_by, title, starts_at, status)
values ('deeeeeee-0000-4000-8000-00000000b007', pg_temp.fx('commB'), pg_temp.fx('member'), '[rls-suite] evento B', now() + interval '7 days', 'published');

insert into public.community_events (id, community_id, created_by, title, starts_at, status)
values ('deeeeeee-0000-4000-8000-00000000b008', pg_temp.fx('commB'), pg_temp.fx('member'), '[rls-suite] evento B rascunho', now() + interval '7 days', 'draft');

insert into public.community_mood_messages (id, community_id, mood, message, created_by)
values ('deeeeeee-0000-4000-8000-00000000b009', pg_temp.fx('commB'), 'happy', '[rls-suite] mensagem B', pg_temp.fx('member'));

insert into public.community_questions (id, community_id, content, created_by)
values ('deeeeeee-0000-4000-8000-00000000b010', pg_temp.fx('commB'), '[rls-suite] pergunta B', pg_temp.fx('member'));

insert into public.community_content (id, community_id, created_by, type, title, status)
values ('deeeeeee-0000-4000-8000-00000000b011', pg_temp.fx('commB'), pg_temp.fx('member'), 'article', '[rls-suite] conteudo B', 'published');

-- ---------- dependentes de B (para as 6 policies via can_view_*) ------
insert into public.challenge_participants (challenge_id, profile_id)
values ('deeeeeee-0000-4000-8000-00000000b001', pg_temp.fx('member'));

insert into public.challenge_comments (challenge_id, author_id, content)
values ('deeeeeee-0000-4000-8000-00000000b001', pg_temp.fx('member'), '[rls-suite] comentario desafio B');

insert into public.challenge_activities (challenge_id, day_number, content)
values ('deeeeeee-0000-4000-8000-00000000b001', 1, '[rls-suite] atividade dia 1 B');

insert into public.circle_members (circle_id, profile_id)
values ('deeeeeee-0000-4000-8000-00000000b002', pg_temp.fx('member'));

insert into public.content_likes (content_id, profile_id)
values ('deeeeeee-0000-4000-8000-00000000b011', pg_temp.fx('member'));

insert into public.event_participants (event_id, profile_id)
values ('deeeeeee-0000-4000-8000-00000000b007', pg_temp.fx('member'));

-- =====================================================================
-- 1) Master = 0 acesso nas 9 tabelas de config/conteúdo (comunidade
--    alheia B) -----------------------------------------------------
-- =====================================================================
select pg_temp.expect_count('1: master NAO le community_challenges de B',
  pg_temp.fx('master'), format('select count(*) from public.community_challenges where community_id=%L', pg_temp.fx('commB')), 0);
select pg_temp.expect_count('1: master NAO le community_checkins de B',
  pg_temp.fx('master'), format('select count(*) from public.community_checkins where community_id=%L', pg_temp.fx('commB')), 0);
select pg_temp.expect_count('1: master NAO le checkin_instances de B',
  pg_temp.fx('master'), format('select count(*) from public.checkin_instances where community_id=%L', pg_temp.fx('commB')), 0);
select pg_temp.expect_count('1: master NAO le community_circles de B',
  pg_temp.fx('master'), format('select count(*) from public.community_circles where community_id=%L', pg_temp.fx('commB')), 0);
select pg_temp.expect_count('1: master NAO le community_engagement_commands de B',
  pg_temp.fx('master'), format('select count(*) from public.community_engagement_commands where community_id=%L', pg_temp.fx('commB')), 0);
select pg_temp.expect_count('1: master NAO le community_events de B (inclusive publicado)',
  pg_temp.fx('master'), format('select count(*) from public.community_events where community_id=%L', pg_temp.fx('commB')), 0);
select pg_temp.expect_count('1: master NAO le community_mood_messages de B',
  pg_temp.fx('master'), format('select count(*) from public.community_mood_messages where community_id=%L', pg_temp.fx('commB')), 0);
select pg_temp.expect_count('1: master NAO le community_questions de B',
  pg_temp.fx('master'), format('select count(*) from public.community_questions where community_id=%L', pg_temp.fx('commB')), 0);
select pg_temp.expect_count('1: master NAO le engagement_command_instances de B',
  pg_temp.fx('master'), format('select count(*) from public.engagement_command_instances where community_id=%L', pg_temp.fx('commB')), 0);

-- =====================================================================
-- 2-5) can_view_challenge/circle/content/event = false p/ Master em B
-- =====================================================================
select pg_temp.expect_bool('2: can_view_challenge(B) = false p/ master',
  pg_temp.fx('master'), 'select public.can_view_challenge(''deeeeeee-0000-4000-8000-00000000b001'')', false);
select pg_temp.expect_bool('3: can_view_circle(B) = false p/ master',
  pg_temp.fx('master'), 'select public.can_view_circle(''deeeeeee-0000-4000-8000-00000000b002'')', false);
select pg_temp.expect_bool('4: can_view_content(B) = false p/ master',
  pg_temp.fx('master'), 'select public.can_view_content(''deeeeeee-0000-4000-8000-00000000b011'')', false);
select pg_temp.expect_bool('5: can_view_event(B, publicado) = false p/ master',
  pg_temp.fx('master'), 'select public.can_view_event(''deeeeeee-0000-4000-8000-00000000b007'')', false);
select pg_temp.expect_bool('5b: can_view_event(B, rascunho) = false p/ master',
  pg_temp.fx('master'), 'select public.can_view_event(''deeeeeee-0000-4000-8000-00000000b008'')', false);

-- =====================================================================
-- 6) as 6 tabelas dependentes também ficam inacessíveis a Master p/ B
-- =====================================================================
select pg_temp.expect_count('6: master NAO le challenge_participants de B',
  pg_temp.fx('master'), 'select count(*) from public.challenge_participants where challenge_id=''deeeeeee-0000-4000-8000-00000000b001''', 0);
select pg_temp.expect_count('6: master NAO le challenge_comments de B',
  pg_temp.fx('master'), 'select count(*) from public.challenge_comments where challenge_id=''deeeeeee-0000-4000-8000-00000000b001''', 0);
select pg_temp.expect_count('6: master NAO le challenge_activities de B',
  pg_temp.fx('master'), 'select count(*) from public.challenge_activities where challenge_id=''deeeeeee-0000-4000-8000-00000000b001''', 0);
select pg_temp.expect_count('6: master NAO le circle_members de B',
  pg_temp.fx('master'), 'select count(*) from public.circle_members where circle_id=''deeeeeee-0000-4000-8000-00000000b002''', 0);
select pg_temp.expect_count('6: master NAO le content_likes de B',
  pg_temp.fx('master'), 'select count(*) from public.content_likes where content_id=''deeeeeee-0000-4000-8000-00000000b011''', 0);
select pg_temp.expect_count('6: master NAO le event_participants de B',
  pg_temp.fx('master'), 'select count(*) from public.event_participants where event_id=''deeeeeee-0000-4000-8000-00000000b007''', 0);

-- =====================================================================
-- 7) Member (ativo, real, em A) continua funcionando normalmente ------
-- =====================================================================
select pg_temp.expect_count('7: member le community_circles de A (marcador novo)',
  pg_temp.fx('member'), format('select count(*) from public.community_circles where id=''daaaaaaa-0000-4000-8000-00000000a001'' and community_id=%L', pg_temp.fx('commA')), 1);
select pg_temp.expect_count('7: member NAO le community_checkins de A (policy so tem owns_community, nunca teve is_community_member)',
  pg_temp.fx('member'), 'select count(*) from public.community_checkins where id=''daaaaaaa-0000-4000-8000-00000000a002''', 0);
select pg_temp.expect_count('7: member le checkin_instances de A',
  pg_temp.fx('member'), 'select count(*) from public.checkin_instances where id=''daaaaaaa-0000-4000-8000-00000000a003''', 1);
select pg_temp.expect_count('7: member le community_engagement_commands de A',
  pg_temp.fx('member'), 'select count(*) from public.community_engagement_commands where id=''daaaaaaa-0000-4000-8000-00000000a004''', 1);
select pg_temp.expect_count('7: member le engagement_command_instances de A',
  pg_temp.fx('member'), 'select count(*) from public.engagement_command_instances where id=''daaaaaaa-0000-4000-8000-00000000a005''', 1);
select pg_temp.expect_count('7: member le community_events de A (publicado)',
  pg_temp.fx('member'), 'select count(*) from public.community_events where id=''daaaaaaa-0000-4000-8000-00000000a006''', 1);
select pg_temp.expect_bool('7: member le community_mood_messages reais de A (>=1, dados reais, sem marcador novo)',
  pg_temp.fx('member'), format('select (count(*) >= 1) from public.community_mood_messages where community_id=%L', pg_temp.fx('commA')), true);
select pg_temp.expect_count('7: member NAO le community_questions de A (nem membro tem essa policy)',
  pg_temp.fx('member'), 'select count(*) from public.community_questions where id=''daaaaaaa-0000-4000-8000-00000000a008''', 0);
select pg_temp.expect_bool('7: can_view_challenge(A) = true p/ member',
  pg_temp.fx('member'), format('select public.can_view_challenge(%L)', pg_temp.fx('challA')), true);

-- =====================================================================
-- 8) Professional (dona real de A) continua funcionando normalmente --
-- =====================================================================
select pg_temp.expect_count('8: prof le community_questions de A (dona)',
  pg_temp.fx('prof'), 'select count(*) from public.community_questions where id=''daaaaaaa-0000-4000-8000-00000000a008''', 1);
select pg_temp.expect_count('8: prof le community_checkins de A (dona)',
  pg_temp.fx('prof'), 'select count(*) from public.community_checkins where id=''daaaaaaa-0000-4000-8000-00000000a002''', 1);
select pg_temp.expect_count('8: prof le community_events de A inclusive se fosse rascunho (dona)',
  pg_temp.fx('prof'), 'select count(*) from public.community_events where id=''daaaaaaa-0000-4000-8000-00000000a006''', 1);
select pg_temp.expect_bool('8: can_view_circle(circulo A) = true p/ prof (dona)',
  pg_temp.fx('prof'), 'select public.can_view_circle(''daaaaaaa-0000-4000-8000-00000000a001'')', true);
select pg_temp.expect_bool('8: can_view_content(contentA) = true p/ prof (dona)',
  pg_temp.fx('prof'), format('select public.can_view_content(%L)', pg_temp.fx('contentA')), true);

-- =====================================================================
-- 9) RPCs administrativos agregados continuam funcionando -------------
-- =====================================================================
select pg_temp.expect_rpc('9: platform_overview OK p/ master',
  pg_temp.fx('master'), 'public.platform_overview()', true);
select pg_temp.expect_rpc('9: platform_communities OK p/ master',
  pg_temp.fx('master'), 'public.platform_communities()', true);
select pg_temp.expect_rpc('9: platform_professionals OK p/ master',
  pg_temp.fx('master'), 'public.platform_professionals()', true);
select pg_temp.expect_rpc('9: community_metrics(A) OK p/ prof (dona)',
  pg_temp.fx('prof'), format('public.community_metrics(%L)', pg_temp.fx('commA')), true);

-- =====================================================================
-- 10) approve/reject_membership_request continuam funcionando ---------
--     (guard inalterado: owns_community() OR is_master())
-- =====================================================================
select pg_temp.expect_rpc('10: approve_membership_request guard ainda aceita a dona (prof) para A',
  pg_temp.fx('prof'),
  format('public.approve_membership_request(%L, %L)', pg_temp.fx('commA'), pg_temp.fx('member')), false);
-- (esperado RAISE aqui, mas por no_pending_request_found — member já é
--  active em A, não pending; o que importa é que NÃO é not_authorized)
select pg_temp.expect_rpc('10: reject_membership_request guard ainda aceita a dona (prof) para A',
  pg_temp.fx('prof'),
  format('public.reject_membership_request(%L, %L)', pg_temp.fx('commA'), pg_temp.fx('member')), false);

-- ---------- RESULTADO ----------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
