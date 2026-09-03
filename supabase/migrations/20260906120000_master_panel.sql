-- =====================================================================
-- Fase 9 — PAINEL MASTER (visao de plataforma)
-- =====================================================================
-- Master = visao administrativa/tecnica da plataforma Circula.
-- Professional = administracao da propria comunidade.
-- Member = experiencia individual.
--
-- Esta migration NAO cria tabelas nem views. Ela:
--
--  (1) RLS Tier 1 — remove `is_master()` do SELECT de:
--        help_requests, help_request_replies
--      -> o Master deixa de ler texto/historico privado de pedido de
--         ajuda. Member e a dona da comunidade NAO mudam (o ramo
--         is_master() so servia ao Master). Nenhum outro grant de RLS e
--         tocado nesta fase (Tier 2 fica para uma fase posterior, se
--         houver necessidade concreta).
--
--  (2) 3 RPCs agregadoras, read-only, SECURITY DEFINER, search_path fixo
--      em 'public', guard `is_master()` na 1a linha, GRANT EXECUTE so
--      para `authenticated`. Nao recebem parametro do cliente. Retornam
--      APENAS agregados (contagens, somas, timestamps de atividade) e o
--      profissional responsavel por cada comunidade. NUNCA:
--        - texto de post/comentario/pedido de ajuda/momento de alegria
--        - profile_id de membro / saldo individual / point_ledger
--        - daily_mood_entries (a RPC nem consulta essa tabela)
--        - conversas privadas
--
--        platform_overview()       -> KPIs da plataforma inteira
--        platform_communities()    -> 1 objeto agregado por comunidade
--        platform_professionals()  -> 1 objeto agregado por profissional
--
--  (3) 5 indices aditivos (`if not exists`), btree, cada um diretamente
--      sob um filtro de range/igualdade que essas RPCs varrem SEM filtro
--      de comunidade (as agregacoes da plataforma). Baratos e
--      justificados; nada de indice especulativo.
--
-- Nada de resgate. Nada de escrita. Nenhuma tabela de conteudo alterada.
-- Fases 1-8 preservadas. Transacional, idempotente, aditivo, reversivel.
-- =====================================================================

begin;

-- ---- (1) RLS Tier 1: Master fora dos pedidos de ajuda ----------
drop policy if exists "help_requests_select" on public.help_requests;
create policy "help_requests_select"
  on public.help_requests for select to authenticated
  using (
    public.owns_community(community_id)
    or (
      public.is_community_member(community_id)
      and (audience = 'community' or profile_id = auth.uid())
    )
  );

drop policy if exists "help_request_replies_select" on public.help_request_replies;
create policy "help_request_replies_select"
  on public.help_request_replies for select to authenticated
  using (
    exists (
      select 1 from public.help_requests hr
      where hr.id = help_request_replies.help_request_id
        and (
          public.owns_community(hr.community_id)
          or (
            public.is_community_member(hr.community_id)
            and (hr.audience = 'community' or hr.profile_id = auth.uid())
          )
        )
    )
  );

-- ---- (2) indices aditivos p/ as agregacoes de plataforma -------
create index if not exists posts_created_at_idx
  on public.posts using btree (created_at);
create index if not exists challenge_completions_completed_at_idx
  on public.challenge_completions using btree (completed_at);
create index if not exists point_ledger_created_at_idx
  on public.point_ledger using btree (created_at);
create index if not exists community_members_status_joined_at_idx
  on public.community_members using btree (status, joined_at);
create index if not exists profiles_role_created_at_idx
  on public.profiles using btree (role, created_at);

-- ---- (3a) platform_overview() ---------------------------------
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
  v_today date        := current_date;
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

    'challenges_total',         (select count(*) from public.community_challenges),
    'challenges_active',        (select count(*) from public.community_challenges
                                  where is_active and (ends_on is null or ends_on >= v_today)),
    'challenge_completions_total', (select count(*) from public.challenge_completions),
    'challenge_completions_30d',   (select count(*) from public.challenge_completions
                                    where completed_at >= v_30d),
    'challenge_days_done_total',   (select count(*) from public.challenge_progress),

    'help_open',                (select count(*) from public.help_requests where status = 'open'),
    'help_in_progress',         (select count(*) from public.help_requests where status = 'in_progress'),
    'help_resolved',            (select count(*) from public.help_requests where status = 'resolved'),
    'help_total',               (select count(*) from public.help_requests),

    'joy_moments_total',        (select count(*) from public.joy_moments),
    'joy_moments_30d',          (select count(*) from public.joy_moments where created_at >= v_30d),

    'checkin_responses_total',  (select count(*) from public.checkin_responses),

    'points_distributed_total', (select coalesce(sum(amount), 0) from public.point_ledger),
    'points_distributed_30d',   (select coalesce(sum(amount), 0) from public.point_ledger
                                  where created_at >= v_30d),

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

grant execute on function public.platform_overview() to authenticated;

-- ---- (3b) platform_communities() -----------------------------
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
      (select count(*)::int
         from public.challenge_completions cc
         join public.community_challenges ch on ch.id = cc.challenge_id
        where ch.community_id = c.id and cc.completed_at >= v_30d)      as challenge_completions_30d,
      (select coalesce(sum(pl.amount), 0)::int from public.point_ledger pl
        where pl.community_id = c.id and pl.created_at >= v_30d)        as points_30d,
      (select coalesce(sum(pl.amount), 0)::int from public.point_ledger pl
        where pl.community_id = c.id)                                   as points_total,
      (select count(*)::int from public.help_requests h
        where h.community_id = c.id and h.status in ('open', 'in_progress')) as help_pending,
      nullif(greatest(
        coalesce((select max(p.created_at) from public.posts p
                   where p.community_id = c.id), 'epoch'::timestamptz),
        coalesce((select max(cm.created_at) from public.post_comments cm
                   join public.posts p on p.id = cm.post_id
                  where p.community_id = c.id), 'epoch'::timestamptz),
        coalesce((select max(cp.completed_at) from public.challenge_progress cp
                   join public.community_challenges ch on ch.id = cp.challenge_id
                  where ch.community_id = c.id), 'epoch'::timestamptz),
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

grant execute on function public.platform_communities() to authenticated;

-- ---- (3c) platform_professionals() --------------------------
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
                  where c.owner_id = p.id), 'epoch'::timestamptz),
        coalesce((select max(ch.created_at) from public.community_challenges ch
                   join public.communities c on c.id = ch.community_id
                  where c.owner_id = p.id), 'epoch'::timestamptz)
      ), 'epoch'::timestamptz)                                          as last_activity_at
    from public.profiles p
    where p.role = 'professional'
  ) x;

  return r;
end;
$function$;

grant execute on function public.platform_professionals() to authenticated;

commit;
