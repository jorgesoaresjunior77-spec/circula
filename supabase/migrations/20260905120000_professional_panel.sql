-- =====================================================================
-- Fase 8 — PAINEL PROFESSIONAL COMPLETO
-- =====================================================================
-- Unica parte de banco desta fase: MODERACAO DE PUBLICACOES + duas RPCs
-- de leitura agregada para o painel da Nutri. Todo o resto da Fase 8 e
-- reorganizacao de componentes React que ja existem.
--
--   posts.hidden_at            — coluna nova (aditiva). NULL = visivel.
--   posts_select               — reescrita: post oculto some para todos,
--                                EXCETO Master (dependencia da Fase 9).
--   moderate_post(uuid,text)   — RPC administrativa: 'hide' | 'unhide' |
--                                'remove'. So a DONA da comunidade. Hard
--                                DELETE apenas por aqui — sem policy de
--                                UPDATE/DELETE em `posts` para o cliente.
--   community_posts_moderation(uuid) — lista TODOS os posts (inclusive
--                                ocultos) + autor + contagens, para a
--                                aba de moderacao (owns_community/master).
--   community_participants_overview(uuid) — visao consolidada de
--                                participantes: pontos, desafios,
--                                atividade recente. SEM humor individual.
--
-- Nenhuma tabela existente e alterada alem do `add column` em posts.
-- Nenhuma policy de UPDATE/DELETE nova em `posts`. Nenhuma RPC de
-- resgate. Checkout/produtos/billing intocados. Fases 5/6/7 intocadas.
-- Todas as funcoes: SECURITY DEFINER, search_path fixo em 'public', sem
-- SQL dinamico, GRANT EXECUTE explicito, guardas de autorizacao a cada
-- chamada. Transacional, idempotente, aditivo, reversivel.
-- =====================================================================

begin;

-- ---- 1) posts.hidden_at (aditivo) ------------------------------
alter table public.posts
  add column if not exists hidden_at timestamptz;

create index if not exists posts_community_hidden_created_idx
  on public.posts using btree (community_id, hidden_at, created_at desc);

-- ---- 2) posts_select: oculto some para todos, exceto Master ---
-- Antes: is_master() OR owns_community(community_id) OR is_community_member(community_id)
-- Agora: Master ve tudo (inclusive oculto, para a futura Fase 9); dona e
-- membros so veem o que NAO esta oculto. Feed.tsx e usePosts.ts nao
-- mudam — simplesmente deixam de receber posts ocultos.
drop policy if exists "posts_select" on public.posts;
create policy "posts_select" on public.posts for select to public
  using (
    public.is_master()
    or (
      (hidden_at is null)
      and (public.owns_community(community_id) or public.is_community_member(community_id))
    )
  );

-- ---- 3) moderate_post: acao administrativa controlada --------
-- Valida: p_action valido; post existe; community_id derivado do PROPRIO
-- post (nunca do cliente); auth.uid() e dona dessa comunidade. Hard
-- DELETE so aqui. Cascade ja existente limpa post_comments /
-- post_reactions / social_notifications.
create or replace function public.moderate_post(p_post_id uuid, p_action text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_community_id uuid;
begin
  if p_post_id is null then
    raise exception 'moderate_post: p_post_id ausente' using errcode = 'null_value_not_allowed';
  end if;
  if p_action is null or p_action not in ('hide', 'unhide', 'remove') then
    raise exception 'moderate_post: acao invalida (%)', p_action using errcode = 'check_violation';
  end if;

  select community_id into v_community_id from public.posts where id = p_post_id;
  if v_community_id is null then
    raise exception 'post_not_found' using errcode = 'no_data_found';
  end if;

  if not public.owns_community(v_community_id) then
    raise exception 'not_authorized' using errcode = 'insufficient_privilege';
  end if;

  if p_action = 'hide' then
    update public.posts set hidden_at = now(), updated_at = now()
      where id = p_post_id and hidden_at is null;
  elsif p_action = 'unhide' then
    update public.posts set hidden_at = null, updated_at = now()
      where id = p_post_id and hidden_at is not null;
  else -- 'remove'
    delete from public.posts where id = p_post_id;
  end if;
end;
$function$;

grant execute on function public.moderate_post(uuid, text) to authenticated;

-- ---- 4) community_posts_moderation: lista para a aba ---------
-- Retorna TODOS os posts da comunidade (inclusive ocultos) com autor e
-- contagens. So para a dona ou o Master.
create or replace function public.community_posts_moderation(p_community_id uuid)
 returns table (
   id             uuid,
   author_id      uuid,
   author_name    text,
   author_avatar  text,
   content        text,
   title          text,
   post_type      text,
   image_url      text,
   circle_id      uuid,
   created_at     timestamptz,
   hidden_at      timestamptz,
   reaction_count integer,
   comment_count  integer
 )
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
begin
  if not (public.is_master() or public.owns_community(p_community_id)) then
    raise exception 'not_authorized' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    p.id,
    p.author_id,
    pr.full_name,
    pr.avatar_url,
    p.content,
    p.title,
    p.post_type,
    p.image_url,
    p.circle_id,
    p.created_at,
    p.hidden_at,
    (select count(*)::int from public.post_reactions r where r.post_id = p.id),
    (select count(*)::int from public.post_comments  c where c.post_id = p.id)
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  where p.community_id = p_community_id
  order by p.created_at desc;
end;
$function$;

grant execute on function public.community_posts_moderation(uuid) to authenticated;

-- ---- 5) community_participants_overview: visao consolidada ---
-- Pontos (point_accounts), desafios (challenge_completions /
-- challenge_progress) e atividade recente por participante ATIVA da
-- comunidade. NUNCA toca daily_mood_entries — humor individual continua
-- invisivel para a Nutri. So para a dona ou o Master.
create or replace function public.community_participants_overview(p_community_id uuid)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_result jsonb;
begin
  if not (public.is_master() or public.owns_community(p_community_id)) then
    raise exception 'not_authorized' using errcode = 'insufficient_privilege';
  end if;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.balance desc, t.full_name asc nulls last), '[]'::jsonb)
  into v_result
  from (
    select
      m.profile_id,
      pr.full_name,
      pr.avatar_url,
      m.status,
      m.joined_at,
      coalesce(pa.balance, 0) as balance,
      (select count(*)::int
         from public.challenge_completions cc
         join public.community_challenges ch on ch.id = cc.challenge_id
        where ch.community_id = p_community_id and cc.profile_id = m.profile_id) as challenges_completed,
      (select count(*)::int
         from public.challenge_progress cp
         join public.community_challenges ch on ch.id = cp.challenge_id
        where ch.community_id = p_community_id and cp.profile_id = m.profile_id) as challenge_days_done,
      nullif(
        greatest(
          coalesce((select max(p.created_at)
                      from public.posts p
                     where p.community_id = p_community_id and p.author_id = m.profile_id), 'epoch'::timestamptz),
          coalesce((select max(c.created_at)
                      from public.post_comments c
                      join public.posts p on p.id = c.post_id
                     where p.community_id = p_community_id and c.author_id = m.profile_id), 'epoch'::timestamptz),
          coalesce((select max(cp.completed_at)
                      from public.challenge_progress cp
                      join public.community_challenges ch on ch.id = cp.challenge_id
                     where ch.community_id = p_community_id and cp.profile_id = m.profile_id), 'epoch'::timestamptz),
          coalesce((select max(cr.created_at)
                      from public.checkin_responses cr
                      join public.checkin_instances ci on ci.id = cr.checkin_instance_id
                     where ci.community_id = p_community_id and cr.profile_id = m.profile_id), 'epoch'::timestamptz)
        ),
        'epoch'::timestamptz
      ) as last_activity_at
    from public.community_members m
    join public.profiles pr on pr.id = m.profile_id
    left join public.point_accounts pa
      on pa.community_id = p_community_id and pa.profile_id = m.profile_id
    where m.community_id = p_community_id and m.status = 'active'
  ) t;

  return v_result;
end;
$function$;

grant execute on function public.community_participants_overview(uuid) to authenticated;

commit;
