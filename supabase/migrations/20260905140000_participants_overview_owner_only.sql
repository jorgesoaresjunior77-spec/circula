-- =====================================================================
-- Fase 8 — correcao A1: Master sem saldo individual de pontos
-- =====================================================================
-- Contexto: a migration 20260905120000 criou
-- `community_participants_overview(uuid)` com guard
-- `is_master() OR owns_community(p_community_id)`. Esse retorno inclui
-- `balance` (saldo de pontos INDIVIDUAL, de point_accounts) por
-- participante — logo o Master conseguia ver saldo individual, o que
-- contraria as decisoes da Fase 7 (Master so ve agregado de pontos).
--
-- Correcao MINIMA: o guard passa a ser `owns_community(p_community_id)`
-- APENAS. So a DONA da comunidade consulta a visao consolidada de
-- participantes (que e uma tela exclusiva do painel Professional). O
-- Master chamando -> `not_authorized`.
--
-- O Master continua com os agregados por comunidade / plataforma via
-- `points_community_summary` (Fase 7), que ja devolve `top_earners: null`
-- para o Master — nada individual. Nenhuma outra funcao/policy/tabela e
-- alterada. Corpo da funcao identico exceto a linha do guard.
--
-- Assinatura, retorno, volatilidade (STABLE), SECURITY DEFINER,
-- search_path='public' e GRANT inalterados. Aditivo (CREATE OR REPLACE),
-- idempotente, transacional, reversivel.
-- =====================================================================

begin;

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
  -- A1: SO a dona da comunidade. Master nao ve saldo individual.
  if not public.owns_community(p_community_id) then
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
