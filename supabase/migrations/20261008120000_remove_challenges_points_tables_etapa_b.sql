-- =====================================================================
-- Remoção definitiva de Desafios, Pontos e Conquistas — Etapa B
-- =====================================================================
-- Contexto: Etapa A (commit 69dc2bd0, migration 20261007120000) já
-- removeu código, interface e os campos de Desafios/Pontos das 5
-- funções compartilhadas (community_metrics, profile_overview,
-- platform_overview, platform_communities, platform_professionals).
-- Esta migration é a Etapa B: remove definitivamente as estruturas de
-- banco que sobraram — autorizada após auditoria completa (ver relatório
-- em conversa), que confirmou:
--   • point_accounts e point_ledger: 0 linhas;
--   • nenhuma comunidade com recurring_points_per_day > 0;
--   • nenhuma notificação histórica com type='challenge_comment' nem
--     related_challenge_id preenchido;
--   • nenhuma Edge Function e nenhuma view dependem destas estruturas;
--   • o trigger de pontos em daily_mood_entries é um no-op real em
--     produção hoje e não faz parte da lógica de Check-in.
--
-- Regras seguidas à risca:
--   • Sem CASCADE em nenhum DROP TABLE — ordem explícita e auditável.
--   • community_participants_overview() via CREATE OR REPLACE (nunca
--     DROP) — mesma assinatura/retorno, só perde os 3 campos de
--     pontos/desafios; grants preservados automaticamente pelo Postgres
--     (REPLACE não reseta GRANT quando assinatura não muda).
--   • set_daily_mood_entries_updated_at — NÃO TOCADO.
--   • Nenhuma policy/RLS de tabela que permanece é alterada, exceto a
--     ALTER TABLE/CONSTRAINT explicitamente necessária em
--     social_notifications (coluna + FK + CHECK).
--
-- Idempotente onde fizer sentido (CREATE OR REPLACE); os DROP são
-- definitivos por natureza — é o objetivo desta etapa.
-- =====================================================================

begin;

-- ---- 1) Triggers (removidos ANTES das tabelas/funções que usam) -----
drop trigger if exists trg_notify_on_challenge_comment on public.challenge_comments;
drop trigger if exists trg_points_on_challenge_completion on public.challenge_completions;
drop trigger if exists trg_points_on_challenge_day on public.challenge_progress;
drop trigger if exists trg_points_apply_balance on public.point_ledger;
drop trigger if exists trg_points_on_recurring_participation on public.daily_mood_entries;
-- NÃO TOCADO: set_daily_mood_entries_updated_at (genérico, outras tabelas o usam)

-- ---- 2) community_participants_overview() — CREATE OR REPLACE -------
-- Mesma assinatura (p_community_id uuid) e retorno (jsonb) do corpo
-- atual (confirmado via pg_get_functiondef antes desta migration).
-- Preserva profile_id/full_name/avatar_url/status/joined_at/
-- last_activity_at. Remove balance, challenges_completed,
-- challenge_days_done e o LEFT JOIN point_accounts. O ORDER BY, que
-- usava "balance desc" (campo removido), passa a usar
-- "last_activity_at desc nulls last" — participante mais recentemente
-- ativa primeiro, mesma intenção editorial do critério anterior, sem
-- depender de um dado que deixou de existir.
create or replace function public.community_participants_overview(p_community_id uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_result jsonb;
begin
  -- A1: SO a dona da comunidade. Master nao ve saldo individual.
  if not public.owns_community(p_community_id) then
    raise exception 'not_authorized' using errcode = 'insufficient_privilege';
  end if;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.last_activity_at desc nulls last, t.full_name asc nulls last), '[]'::jsonb)
  into v_result
  from (
    select
      m.profile_id,
      pr.full_name,
      pr.avatar_url,
      m.status,
      m.joined_at,
      nullif(
        greatest(
          coalesce((select max(p.created_at)
                      from public.posts p
                     where p.community_id = p_community_id and p.author_id = m.profile_id), 'epoch'::timestamptz),
          coalesce((select max(c.created_at)
                      from public.post_comments c
                      join public.posts p on p.id = c.post_id
                     where p.community_id = p_community_id and c.author_id = m.profile_id), 'epoch'::timestamptz),
          coalesce((select max(cr.created_at)
                      from public.checkin_responses cr
                      join public.checkin_instances ci on ci.id = cr.checkin_instance_id
                     where ci.community_id = p_community_id and cr.profile_id = m.profile_id), 'epoch'::timestamptz)
        ),
        'epoch'::timestamptz
      ) as last_activity_at
    from public.community_members m
    join public.profiles pr on pr.id = m.profile_id
    where m.community_id = p_community_id and m.status = 'active'
  ) t;

  return v_result;
end;
$function$;

-- ---- 3) social_notifications: coluna + FK + CHECK --------------------
-- Confirmado ao vivo antes desta migration: 0 linhas com
-- type='challenge_comment', 0 linhas com related_challenge_id
-- preenchido. CHECK recriado com os 9 valores reais restantes
-- (confirmados no banco agora, nenhum inventado).
alter table public.social_notifications
  drop constraint if exists social_notifications_related_challenge_id_fkey;

alter table public.social_notifications
  drop column if exists related_challenge_id;

alter table public.social_notifications
  drop constraint if exists social_notifications_type_check;

alter table public.social_notifications
  add constraint social_notifications_type_check
  check (type = any (array[
    'post_comment'::text,
    'post_reaction'::text,
    'circle_join'::text,
    'event_rsvp'::text,
    'direct_message'::text,
    'help_request'::text,
    'membership_requested'::text,
    'membership_approved'::text,
    'membership_rejected'::text
  ]));

-- ---- 4) communities: coluna de pontos recorrentes ---------------------
-- 0 comunidades com valor > 0 (confirmado). A constraint própria
-- (communities_recurring_points_per_day_check) some junto com a coluna.
alter table public.communities
  drop column if exists recurring_points_per_day;

-- ---- 5) Tabelas de Desafios (ordem explícita, SEM CASCADE) -----------
drop table public.challenge_activities;
drop table public.challenge_comments;
drop table public.challenge_completions;
drop table public.challenge_participants;
drop table public.challenge_progress;
drop table public.community_challenges;

-- ---- 6) Tabelas de Pontos (SEM CASCADE) -------------------------------
drop table public.point_ledger;
drop table public.point_accounts;

-- ---- 7) Funções exclusivas (só depois das tabelas/policies acima) ----
drop function if exists public.can_participate_in_challenge(uuid);
drop function if exists public.can_view_challenge(uuid);
drop function if exists public.challenge_current_day(uuid);
drop function if exists public.challenge_participant_count(uuid);
drop function if exists public.challenge_today_completed_count(uuid);
drop function if exists public.notify_on_challenge_comment();
drop function if exists public._award_points(uuid,uuid,integer,text,text,uuid,text,text,uuid);
drop function if exists public._points_apply_balance();
drop function if exists public._points_on_challenge_completion();
drop function if exists public._points_on_challenge_day();
drop function if exists public._points_on_recurring_participation();
drop function if exists public.award_points_manual(uuid,uuid,integer,text);
drop function if exists public.points_community_summary(uuid,integer);

commit;

-- =====================================================================
-- Reversão: NÃO é trivial (DROP TABLE perde dados/schema). Se
-- necessário reverter, restaurar a partir de um snapshot anterior a
-- esta migration, ou recriar manualmente as 8 tabelas a partir de
-- 20260827000000_baseline_remote_schema.sql +
-- 20260903120000_challenge_rich.sql + 20260904120000_points_system.sql,
-- e reverter community_participants_overview()/social_notifications
-- a partir de 20260905140000_participants_overview_owner_only.sql e
-- 20260831150000_social_notifications.sql.
-- =====================================================================
