-- =====================================================================
-- FASE 12.4c — Endurecimento do Master (config/conteúdo de comunidade)
-- =====================================================================
-- Contexto: a auditoria da 12.4c (read-only) confirmou 15 superfícies
-- de leitura ainda com `is_master()` depois da 12.4/12.4b — as 9
-- policies e as 4 funções `can_view_*` corrigidas aqui, mais as 6
-- policies que DEPENDEM dessas funções (não tocadas diretamente,
-- recebem a restrição automaticamente):
--
--   challenge_activities_select, challenge_comments_select,
--   challenge_participants_select, circle_members_select,
--   content_likes_select, event_participants_select
--
-- Confirmado por grep no frontend: NENHUMA tela do MasterPanel (nem
-- `MasterDashboard`, `MasterCommunitiesPanel`, `MasterProfessionalsPanel`,
-- `MasterPlatformPanel`) importa qualquer hook que toque nessas 15
-- tabelas (`useChallenges`, `useCheckins`, `useCircles`,
-- `useEngagementCommands`, `useEvents`, `useDailyMood`/
-- `MoodMessageManager`, `useQuestions`, `useContent`). Confirmado
-- também que, em todas as 9 policies, `is_master()` só aparecia no
-- SELECT — nenhuma tinha ramo de escrita (INSERT/UPDATE/DELETE
-- continuam só `owns_community()`, intocados).
--
-- Mesmo padrão exato da migration 12.4 original
-- (`20260908120000_master_rls_narrowing.sql`): remove só o disjuntor
-- `is_master()` de cada condição, sem tocar em mais nada.
--
-- NÃO TOCADO NESTA MIGRATION:
--   • As 6 policies dependentes listadas acima — continuam chamando
--     can_view_challenge/circle/content/event() como já chamavam; a
--     restrição chega automaticamente por essas funções terem sido
--     corrigidas.
--   • approve_membership_request, reject_membership_request,
--     platform_overview, platform_communities, platform_professionals,
--     community_metrics, points_community_summary — inalterados.
--   • Todas as regras de billing.
--   • Os 4 endurecimentos da 12.4b (profiles_update,
--     community_members_insert, help_requests_update,
--     find_member_by_email) — inalterados.
--   • UNIQUE(owner_id), modelo 1 Professional = 1 comunidade,
--     arquitetura communities[0], Discovery/Pending da 12.3.
--   • INSERT/UPDATE/DELETE das 9 tabelas — nenhuma tinha is_master(),
--     nenhuma é tocada aqui.
--
-- SEGURANÇA — cada mudança é a remoção de um disjuntor `OR` de uma
-- condição de autorização já existente (nunca a adição de uma
-- condição nova) — por construção, só pode estreitar o acesso.
--
-- Aditivo na prática (substitui 9 policies + 4 funções por versões
-- estritamente mais restritas). Totalmente reversível (rodapé).
-- Transacional. Sem migração de dados, sem alteração de schema.
-- =====================================================================

begin;

-- ---- 1) community_challenges_select ---------------------------------
drop policy if exists "community_challenges_select" on public.community_challenges;
create policy "community_challenges_select" on public.community_challenges for select to public
  using (
    owns_community(community_id) or is_community_member(community_id)
  );

-- ---- 2) community_checkins_select -----------------------------------
drop policy if exists "community_checkins_select" on public.community_checkins;
create policy "community_checkins_select" on public.community_checkins for select to authenticated
  using (
    owns_community(community_id)
  );

-- ---- 3) checkin_instances_select -------------------------------------
drop policy if exists "checkin_instances_select" on public.checkin_instances;
create policy "checkin_instances_select" on public.checkin_instances for select to authenticated
  using (
    is_community_member(community_id) or owns_community(community_id)
  );

-- ---- 4) community_circles_select -------------------------------------
drop policy if exists "community_circles_select" on public.community_circles;
create policy "community_circles_select" on public.community_circles for select to authenticated
  using (
    owns_community(community_id) or is_community_member(community_id)
  );

-- ---- 5) community_engagement_commands_select -------------------------
drop policy if exists "community_engagement_commands_select" on public.community_engagement_commands;
create policy "community_engagement_commands_select" on public.community_engagement_commands for select to public
  using (
    owns_community(community_id) or is_community_member(community_id)
  );

-- ---- 6) community_events_select ---------------------------------------
drop policy if exists "community_events_select" on public.community_events;
create policy "community_events_select" on public.community_events for select to public
  using (
    owns_community(community_id)
    or (is_community_member(community_id) and (status <> 'draft'::text))
  );

-- ---- 7) community_mood_messages_select ---------------------------------
drop policy if exists "community_mood_messages_select" on public.community_mood_messages;
create policy "community_mood_messages_select" on public.community_mood_messages for select to authenticated
  using (
    owns_community(community_id) or is_community_member(community_id)
  );

-- ---- 8) community_questions_select -------------------------------------
drop policy if exists "community_questions_select" on public.community_questions;
create policy "community_questions_select" on public.community_questions for select to public
  using (
    owns_community(community_id)
  );

-- ---- 9) engagement_command_instances_select -----------------------------
drop policy if exists "engagement_command_instances_select" on public.engagement_command_instances;
create policy "engagement_command_instances_select" on public.engagement_command_instances for select to public
  using (
    owns_community(community_id) or is_community_member(community_id)
  );

-- ---- 10) can_view_challenge: remove o ramo is_master() ------------------
create or replace function public.can_view_challenge(p_challenge_id uuid)
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.community_challenges c
    where c.id = p_challenge_id
      and (owns_community(c.community_id) or is_community_member(c.community_id))
  );
$function$;

-- ---- 11) can_view_circle: remove o ramo is_master() ---------------------
create or replace function public.can_view_circle(p_circle_id uuid)
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.community_circles cc
    where cc.id = p_circle_id
      and (
        public.owns_community(cc.community_id)
        or public.is_community_member(cc.community_id)
      )
  );
$function$;

-- ---- 12) can_view_content: remove o ramo is_master() ---------------------
create or replace function public.can_view_content(p_content_id uuid)
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.community_content c
    where c.id = p_content_id
      and (
        public.owns_community(c.community_id)
        or public.is_community_member(c.community_id)
      )
  );
$function$;

-- ---- 13) can_view_event: remove o ramo is_master() -----------------------
create or replace function public.can_view_event(p_event_id uuid)
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.community_events e
    where e.id = p_event_id
      and (
        public.owns_community(e.community_id)
        or public.is_community_member(e.community_id)
      )
  );
$function$;

commit;

-- =====================================================================
-- Reversão (referência — recoloca o ramo is_master() em cada um):
--
-- begin;
-- drop policy if exists "community_challenges_select" on public.community_challenges;
-- create policy "community_challenges_select" on public.community_challenges for select to public
--   using (is_master() or owns_community(community_id) or is_community_member(community_id));
--
-- drop policy if exists "community_checkins_select" on public.community_checkins;
-- create policy "community_checkins_select" on public.community_checkins for select to authenticated
--   using (owns_community(community_id) or is_master());
--
-- drop policy if exists "checkin_instances_select" on public.checkin_instances;
-- create policy "checkin_instances_select" on public.checkin_instances for select to authenticated
--   using (is_community_member(community_id) or owns_community(community_id) or is_master());
--
-- drop policy if exists "community_circles_select" on public.community_circles;
-- create policy "community_circles_select" on public.community_circles for select to authenticated
--   using (is_master() or owns_community(community_id) or is_community_member(community_id));
--
-- drop policy if exists "community_engagement_commands_select" on public.community_engagement_commands;
-- create policy "community_engagement_commands_select" on public.community_engagement_commands for select to public
--   using (is_master() or owns_community(community_id) or is_community_member(community_id));
--
-- drop policy if exists "community_events_select" on public.community_events;
-- create policy "community_events_select" on public.community_events for select to public
--   using (is_master() or owns_community(community_id) or (is_community_member(community_id) and (status <> 'draft'::text)));
--
-- drop policy if exists "community_mood_messages_select" on public.community_mood_messages;
-- create policy "community_mood_messages_select" on public.community_mood_messages for select to authenticated
--   using (is_master() or owns_community(community_id) or is_community_member(community_id));
--
-- drop policy if exists "community_questions_select" on public.community_questions;
-- create policy "community_questions_select" on public.community_questions for select to public
--   using (is_master() or owns_community(community_id));
--
-- drop policy if exists "engagement_command_instances_select" on public.engagement_command_instances;
-- create policy "engagement_command_instances_select" on public.engagement_command_instances for select to public
--   using (is_master() or owns_community(community_id) or is_community_member(community_id));
--
-- create or replace function public.can_view_challenge(p_challenge_id uuid)
--  returns boolean language sql stable security definer set search_path to 'public'
-- as $function$
--   select exists (select 1 from public.community_challenges c where c.id = p_challenge_id
--     and (is_master() or owns_community(c.community_id) or is_community_member(c.community_id)));
-- $function$;
--
-- create or replace function public.can_view_circle(p_circle_id uuid)
--  returns boolean language sql stable security definer set search_path to 'public'
-- as $function$
--   select exists (select 1 from public.community_circles cc where cc.id = p_circle_id
--     and (public.is_master() or public.owns_community(cc.community_id) or public.is_community_member(cc.community_id)));
-- $function$;
--
-- create or replace function public.can_view_content(p_content_id uuid)
--  returns boolean language sql stable security definer set search_path to 'public'
-- as $function$
--   select exists (select 1 from public.community_content c where c.id = p_content_id
--     and (public.is_master() or public.owns_community(c.community_id) or public.is_community_member(c.community_id)));
-- $function$;
--
-- create or replace function public.can_view_event(p_event_id uuid)
--  returns boolean language sql stable security definer set search_path to 'public'
-- as $function$
--   select exists (select 1 from public.community_events e where e.id = p_event_id
--     and (public.is_master() or public.owns_community(e.community_id) or public.is_community_member(e.community_id)));
-- $function$;
-- commit;
-- =====================================================================
