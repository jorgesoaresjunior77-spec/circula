-- =====================================================================
-- Remoção de Desafios/Pontos/Conquistas — Etapa A, item "lógica
-- compartilhada"
-- =====================================================================
-- Contexto: auditoria aprovada pelo usuário para remover as
-- funcionalidades de Desafios, Pontos e Conquistas do produto, em duas
-- etapas. Etapa A remove código/interface mas MANTÉM todas as tabelas,
-- triggers, policies e constraints de Desafios/Pontos intactas (fica
-- para a Etapa B).
--
-- Esta migration faz SOMENTE `CREATE OR REPLACE FUNCTION` — nenhum
-- DROP, nenhuma mudança de RLS/policy/constraint/trigger. É a mesma
-- técnica (idempotente, reversível) já usada em toda a história do
-- projeto para evoluir corpo de função sem tocar em schema.
--
-- As 5 funções abaixo (e só estas 5, nomeadas explicitamente pelo
-- usuário) têm os campos de Desafios/Pontos removidos do retorno,
-- preservando TODOS os outros campos e comportamentos byte-a-byte:
--   • community_metrics()      — tira challenge_progress_count do
--     retorno e tira challenge_progress do cálculo de "membro ativo"
--     (agora: post, comentário, reação, check-in ou círculo).
--   • profile_overview()       — tira a chave 'challenges'.
--   • platform_overview()      — tira challenges_total/active/
--     completions_total/completions_30d/days_done_total e
--     points_distributed_total/30d.
--   • platform_communities()   — tira challenge_completions_30d/
--     points_30d/points_total, e tira challenge_progress do cálculo
--     de last_activity_at (agora: posts, comentários, check-ins).
--   • platform_professionals() — tira community_challenges do cálculo
--     de last_activity_at (agora: posts, eventos).
--
-- As tabelas challenge_* e point_* continuam existindo e acumulando
-- dados normalmente (os triggers que as alimentam não foram tocados);
-- só pararam de ser expostas por estas 5 funções e pela interface.
-- =====================================================================

begin;

-- ---- 1) community_metrics() ------------------------------------------
create or replace function public.community_metrics(p_community_id uuid, p_period_days integer default 30)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_total_members integer;
  v_active_members integer;
  v_inactive_members integer;
  v_new_members integer;
  v_posts_count integer;
  v_comments_count integer;
  v_reactions_count integer;
  v_checkin_responses_count integer;
  v_circle_joins_count integer;
  v_period_start timestamptz;
  v_activity_window timestamptz := now() - interval '30 days';
begin
  if not (public.is_master() or public.owns_community(p_community_id)) then
    raise exception 'not_authorized';
  end if;

  v_period_start := now() - (p_period_days || ' days')::interval;

  select count(*) into v_total_members
  from public.community_members
  where community_id = p_community_id and status = 'active';

  select count(*) into v_new_members
  from public.community_members
  where community_id = p_community_id and status = 'active' and joined_at >= v_period_start;

  select count(*) into v_active_members
  from public.community_members cm
  where cm.community_id = p_community_id and cm.status = 'active'
    and (
      exists (
        select 1 from public.posts p
        where p.community_id = p_community_id and p.author_id = cm.profile_id
          and p.created_at >= v_activity_window
      )
      or exists (
        select 1 from public.post_comments pc
        join public.posts p on p.id = pc.post_id
        where p.community_id = p_community_id and pc.author_id = cm.profile_id
          and pc.created_at >= v_activity_window
      )
      or exists (
        select 1 from public.post_reactions pr
        join public.posts p on p.id = pr.post_id
        where p.community_id = p_community_id and pr.profile_id = cm.profile_id
          and pr.created_at >= v_activity_window
      )
      or exists (
        select 1 from public.checkin_responses cr
        join public.checkin_instances ci on ci.id = cr.checkin_instance_id
        where ci.community_id = p_community_id and cr.profile_id = cm.profile_id
          and cr.created_at >= v_activity_window
      )
      or exists (
        select 1 from public.circle_members clm
        join public.community_circles ccl on ccl.id = clm.circle_id
        where ccl.community_id = p_community_id and clm.profile_id = cm.profile_id
          and clm.joined_at >= v_activity_window
      )
    );

  v_inactive_members := v_total_members - v_active_members;

  select count(*) into v_posts_count
  from public.posts
  where community_id = p_community_id and created_at >= v_period_start;

  select count(*) into v_comments_count
  from public.post_comments pc
  join public.posts p on p.id = pc.post_id
  where p.community_id = p_community_id and pc.created_at >= v_period_start;

  select count(*) into v_reactions_count
  from public.post_reactions pr
  join public.posts p on p.id = pr.post_id
  where p.community_id = p_community_id and pr.created_at >= v_period_start;

  select count(*) into v_checkin_responses_count
  from public.checkin_responses cr
  join public.checkin_instances ci on ci.id = cr.checkin_instance_id
  where ci.community_id = p_community_id and cr.created_at >= v_period_start;

  select count(*) into v_circle_joins_count
  from public.circle_members clm
  join public.community_circles ccl on ccl.id = clm.circle_id
  where ccl.community_id = p_community_id and clm.joined_at >= v_period_start;

  return jsonb_build_object(
    'total_members', v_total_members,
    'active_members', v_active_members,
    'inactive_members', v_inactive_members,
    'new_members', v_new_members,
    'posts_count', v_posts_count,
    'comments_count', v_comments_count,
    'reactions_count', v_reactions_count,
    'checkin_responses_count', v_checkin_responses_count,
    'circle_joins_count', v_circle_joins_count
  );
end;
$function$;

-- ---- 2) profile_overview() --------------------------------------------
create or replace function public.profile_overview(p_profile_id uuid)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with allowed as (
    select cm.community_id
    from public.community_members cm
    where cm.profile_id = p_profile_id
      and cm.status = 'active'
      and (
        public.is_master()
        or public.owns_community(cm.community_id)
        or public.is_community_member(cm.community_id)
      )
  )
  select case
    when not (
      p_profile_id = auth.uid()
      or public.is_master()
      or public.community_owner_of_profile(p_profile_id)
      or public.shares_active_community(p_profile_id)
    ) then null
    else jsonb_build_object(
      'posts', (
        select count(*) from public.posts
        where author_id = p_profile_id
          and community_id in (select community_id from allowed)
      ),
      'comments', (
        select count(*) from public.post_comments pc
        join public.posts p on p.id = pc.post_id
        where pc.author_id = p_profile_id
          and p.community_id in (select community_id from allowed)
      ),
      'circles', (
        select count(*) from public.circle_members cmb
        join public.community_circles cc on cc.id = cmb.circle_id
        where cmb.profile_id = p_profile_id
          and cc.community_id in (select community_id from allowed)
      ),
      'content', (
        select count(*) from public.community_content
        where created_by = p_profile_id
          and status = 'published'
          and community_id in (select community_id from allowed)
      ),
      'events', (
        select count(*) from public.event_participants ep
        join public.community_events e on e.id = ep.event_id
        where ep.profile_id = p_profile_id
          and e.community_id in (select community_id from allowed)
      )
    )
  end;
$function$;

-- ---- 3) platform_overview() --------------------------------------------
create or replace function public.platform_overview()
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_30d   timestamptz := now() - interval '30 days';
  v_7d    timestamptz := now() - interval '7 days';
  r jsonb;
begin
  if not public.is_master() then
    raise exception 'not_authorized' using errcode = 'insufficient_privilege';
  end if;

  select jsonb_build_object(
    'communities_total',        (select count(*) from public.communities),
    'communities_active',       (select count(*) from public.communities c
                                  where exists (
                                    select 1 from public.subscriptions s
                                    where s.subject = 'community' and s.community_id = c.id
                                      and s.status not in ('canceled', 'blocked')
                                  )),
    'communities_new_30d',      (select count(*) from public.communities where created_at >= v_30d),

    'professionals_total',      (select count(*) from public.profiles where role = 'professional'),
    'professionals_active',     (select count(*) from public.profiles p
                                  where p.role = 'professional' and public.professional_platform_active(p.id)),
    'professionals_new_30d',    (select count(*) from public.profiles
                                  where role = 'professional' and created_at >= v_30d),

    'members_total',            (select count(distinct profile_id) from public.community_members where status = 'active'),
    'members_new_30d',          (select count(distinct profile_id) from public.community_members
                                  where status = 'active' and joined_at >= v_30d),

    'users_total',              (select count(*) from public.profiles),
    'users_new_7d',             (select count(*) from public.profiles where created_at >= v_7d),
    'users_new_30d',            (select count(*) from public.profiles where created_at >= v_30d),
    'users_by_role',            (select coalesce(jsonb_object_agg(role, n), '{}'::jsonb)
                                  from (select role, count(*) as n from public.profiles group by role) t),

    'posts_total',              (select count(*) from public.posts),
    'posts_30d',                (select count(*) from public.posts where created_at >= v_30d),

    'recipes_published',        (select count(*) from public.community_content
                                  where type = 'recipe' and status = 'published'),
    'communities_with_recipes', (select count(distinct community_id) from public.community_content
                                  where type = 'recipe' and status = 'published'),
    'content_published',        (select count(*) from public.community_content
                                  where type <> 'recipe' and status = 'published'),

    'events_total',             (select count(*) from public.community_events),
    'events_upcoming',          (select count(*) from public.community_events
                                  where status <> 'draft' and starts_at >= now()),

    'help_open',                (select count(*) from public.help_requests where status = 'open'),
    'help_in_progress',         (select count(*) from public.help_requests where status = 'in_progress'),
    'help_resolved',            (select count(*) from public.help_requests where status = 'resolved'),
    'help_total',               (select count(*) from public.help_requests),

    'joy_moments_total',        (select count(*) from public.joy_moments),
    'joy_moments_30d',          (select count(*) from public.joy_moments where created_at >= v_30d),

    'checkin_responses_total',  (select count(*) from public.checkin_responses),

    -- ---- plataforma / billing (agregado, sem PII) ----
    'platform_subs_by_status',  (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                                  from (select status::text as status, count(*) as n
                                          from public.subscriptions where subject = 'platform'
                                         group by status) t),
    'community_subs_by_status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                                  from (select status::text as status, count(*) as n
                                          from public.subscriptions where subject = 'community'
                                         group by status) t),
    'trials_ending_7d',         (select count(*) from public.subscriptions
                                  where status = 'trial' and trial_ends_at is not null
                                    and trial_ends_at <= now() + interval '7 days'),
    'plans',                    (select coalesce(jsonb_agg(jsonb_build_object(
                                    'id', id, 'subject', subject, 'code', code, 'name', name,
                                    'price_cents', price_cents, 'billing_cycle', billing_cycle,
                                    'is_active', is_active
                                  ) order by subject, price_cents), '[]'::jsonb)
                                  from public.billing_plans),
    'split_professional_percent', (select professional_percent from public.platform_split_settings
                                    order by effective_from desc limit 1),
    'split_circula_percent',      (select circula_percent from public.platform_split_settings
                                    order by effective_from desc limit 1),

    'generated_at',             now()
  ) into r;

  return r;
end;
$function$;

-- ---- 4) platform_communities() -----------------------------------------
create or replace function public.platform_communities()
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_30d timestamptz := now() - interval '30 days';
  r jsonb;
begin
  if not public.is_master() then
    raise exception 'not_authorized' using errcode = 'insufficient_privilege';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.members_active desc, x.name asc), '[]'::jsonb)
  into r
  from (
    select
      c.id,
      c.name,
      c.slug,
      c.cover_image_url,
      c.is_discoverable,
      c.created_at,
      owner.id         as owner_id,
      owner.full_name  as owner_name,
      owner.avatar_url as owner_avatar,
      (select s.status::text
         from public.subscriptions s
        where s.subject = 'community' and s.community_id = c.id
        order by s.created_at desc
        limit 1)                                                        as subscription_status,
      (select count(*)::int from public.community_members m
        where m.community_id = c.id and m.status = 'active')            as members_active,
      (select count(*)::int from public.community_members m
        where m.community_id = c.id and m.status = 'active' and m.joined_at >= v_30d) as members_new_30d,
      (select count(*)::int from public.posts p
        where p.community_id = c.id and p.created_at >= v_30d)          as posts_30d,
      (select count(*)::int from public.help_requests h
        where h.community_id = c.id and h.status in ('open', 'in_progress')) as help_pending,
      nullif(greatest(
        coalesce((select max(p.created_at) from public.posts p
                   where p.community_id = c.id), 'epoch'::timestamptz),
        coalesce((select max(cm.created_at) from public.post_comments cm
                   join public.posts p on p.id = cm.post_id
                  where p.community_id = c.id), 'epoch'::timestamptz),
        coalesce((select max(cr.created_at) from public.checkin_responses cr
                   join public.checkin_instances ci on ci.id = cr.checkin_instance_id
                  where ci.community_id = c.id), 'epoch'::timestamptz)
      ), 'epoch'::timestamptz)                                          as last_activity_at
    from public.communities c
    join public.profiles owner on owner.id = c.owner_id
  ) x;

  return r;
end;
$function$;

-- ---- 5) platform_professionals() ---------------------------------------
create or replace function public.platform_professionals()
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_30d timestamptz := now() - interval '30 days';
  r jsonb;
begin
  if not public.is_master() then
    raise exception 'not_authorized' using errcode = 'insufficient_privilege';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.communities_count desc, x.full_name asc nulls last), '[]'::jsonb)
  into r
  from (
    select
      p.id,
      p.full_name,
      p.avatar_url,
      p.created_at,
      public.professional_platform_active(p.id)                         as platform_active,
      (select s.status::text
         from public.subscriptions s
        where s.subject = 'platform' and s.profile_id = p.id
        order by s.created_at desc
        limit 1)                                                        as platform_subscription_status,
      (select count(*)::int from public.communities c where c.owner_id = p.id) as communities_count,
      (select count(distinct m.profile_id)::int
         from public.community_members m
         join public.communities c on c.id = m.community_id
        where c.owner_id = p.id and m.status = 'active')                as members_total,
      (select count(*)::int
         from public.posts po
         join public.communities c on c.id = po.community_id
        where c.owner_id = p.id and po.created_at >= v_30d)            as posts_30d,
      nullif(greatest(
        coalesce((select max(po.created_at) from public.posts po
                   join public.communities c on c.id = po.community_id
                  where c.owner_id = p.id), 'epoch'::timestamptz),
        coalesce((select max(ev.created_at) from public.community_events ev
                   join public.communities c on c.id = ev.community_id
                  where c.owner_id = p.id), 'epoch'::timestamptz)
      ), 'epoch'::timestamptz)                                          as last_activity_at
    from public.profiles p
    where p.role = 'professional'
  ) x;

  return r;
end;
$function$;

commit;

-- =====================================================================
-- Reversão (referência — reaplica os 5 corpos de função anteriores, com
-- os campos de Desafios/Pontos de volta): ver
-- supabase/migrations/20260827000000_baseline_remote_schema.sql
-- (community_metrics, profile_overview) e
-- supabase/migrations/20260906120000_master_panel.sql
-- (platform_overview, platform_communities, platform_professionals).
-- =====================================================================
