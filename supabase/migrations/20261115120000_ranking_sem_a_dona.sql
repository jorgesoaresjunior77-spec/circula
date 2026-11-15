-- Ranking de interação: a dona da comunidade (a profissional) não entra na
-- lista — o ranking é das participantes (base dos sorteios mensais).
-- Só recria a função; nenhuma tabela muda.

begin;

create or replace function public.community_engagement_ranking(p_community_id uuid, p_days integer default 30)
returns table (
  profile_id uuid,
  full_name text,
  avatar_url text,
  posts bigint,
  comments bigint,
  reactions bigint,
  garden_checks bigint,
  score bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with allowed as (
    select (public.owns_community(p_community_id) or public.is_master()) as ok
  ),
  since as (
    select now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365))) as t
  ),
  members as (
    select cm.profile_id
    from public.community_members cm
    where cm.community_id = p_community_id and cm.status = 'active'
      and cm.profile_id <> (select c.owner_id from public.communities c where c.id = p_community_id)
  ),
  p as (
    select author_id as pid, count(*) as n
    from public.posts, since
    where community_id = p_community_id and created_at >= since.t and hidden_at is null
      and post_type not in ('daily_question', 'engagement_command', 'garden_daily')
    group by author_id
  ),
  c as (
    select pc.author_id as pid, count(*) as n
    from public.post_comments pc
    join public.posts po on po.id = pc.post_id, since
    where po.community_id = p_community_id and pc.created_at >= since.t
    group by pc.author_id
  ),
  r as (
    select pr.profile_id as pid, count(*) as n
    from public.post_reactions pr
    join public.posts po on po.id = pr.post_id, since
    where po.community_id = p_community_id and pr.created_at >= since.t
    group by pr.profile_id
  ),
  g as (
    select gc.profile_id as pid, count(*) as n
    from public.garden_checks gc, since
    where gc.community_id = p_community_id and gc.checked_at >= since.t
    group by gc.profile_id
  )
  select
    m.profile_id,
    pf.full_name,
    pf.avatar_url,
    coalesce(p.n, 0)::bigint,
    coalesce(c.n, 0)::bigint,
    coalesce(r.n, 0)::bigint,
    coalesce(g.n, 0)::bigint,
    (coalesce(p.n, 0) * 3 + coalesce(c.n, 0) * 2 + coalesce(r.n, 0) + coalesce(g.n, 0) * 2)::bigint as score
  from members m
  join public.profiles pf on pf.id = m.profile_id
  left join p on p.pid = m.profile_id
  left join c on c.pid = m.profile_id
  left join r on r.pid = m.profile_id
  left join g on g.pid = m.profile_id
  cross join allowed
  where allowed.ok
    and (coalesce(p.n, 0) + coalesce(c.n, 0) + coalesce(r.n, 0) + coalesce(g.n, 0)) > 0
  order by score desc, pf.full_name asc
  limit 10;
$$;

revoke all on function public.community_engagement_ranking(uuid, integer) from public, anon;
grant execute on function public.community_engagement_ranking(uuid, integer) to authenticated;

commit;
