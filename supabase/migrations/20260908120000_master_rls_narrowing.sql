-- =====================================================================
-- FASE 12.4 — Endurecimento do acesso do Master (RLS narrowing)
-- =====================================================================
-- Contexto: a auditoria da Fase 12 apontou que o Master ainda lê, via
-- RLS direta, dados individuais de comunidade que deveriam ser vistos
-- apenas por agregado (RPC `platform_*`, SECURITY DEFINER, Fase 9).
--
-- Esta migration remove o ramo `is_master()` do SELECT de 7 tabelas
-- (as nomeadas no escopo da Fase 12) + da função `can_view_post`
-- (dependência direta de `posts`: sem ela o Master continuaria lendo
-- TODOS os comentários e reações da plataforma via `post_comments_select`
-- / `post_reactions_select`, esvaziando o ganho).
--
-- IMPACTO — por construção, NÃO afeta Member nem Professional:
--   o ramo `is_master()` só resolvia `true` numa sessão Master; para
--   qualquer outra usuária ele já era `false`. Remover o OR-ramo não
--   muda o resultado para ninguém além do Master.
--
--   O MasterPanel é 100% RPC (`platform_overview` / `platform_communities`
--   / `platform_professionals`), todas SECURITY DEFINER com guard
--   `is_master()` + `raise` e que leem as tabelas como owner (ignoram
--   RLS). `ProfileCard` (único ponto que lê `profiles` direto no
--   frontend) é inalcançável numa sessão Master (o Dashboard do Master
--   renderiza só `<MasterPanel />`, sem lista de membros, sem
--   NotificationBell). Logo: nenhuma tela do Master quebra.
--
-- NÃO tocado nesta subfase (Billing/Storage/Discovery ficam para
-- 12.2/12.3/12.5):
--   • tabelas de billing e loja (asaas_*, billing_*, payment_charges,
--     product_*, subscriptions, revenue_split_rules,
--     platform_split_settings, professional_billing_accounts,
--     subscription_status_history, notifications) — Master é o admin
--     de billing; mantêm `is_master()`.
--   • `communities_select` — território de descoberta (12.3).
--   • tabelas de CONFIG da comunidade (community_challenges/circles/
--     events/questions/mood_messages/engagement_commands/checkins,
--     checkin_instances, engagement_command_instances) e os helpers
--     `can_view_challenge/event/circle/content` — mesma classe, mas
--     não nomeados; ficam para uma revisão de consistência posterior.
--
-- `can_view_post` volta a ser exatamente o par de `can_participate_in_post`
-- (o carve-out `is_master()` fora adicionado em 20260905130000 "para a
-- futura Fase 9" — a Fase 9 shippou e não depende mais dele).
--
-- Aditivo? Não — altera policies/função existentes. Mas TOTALMENTE
-- reversível (script de reversão no rodapé), idempotente
-- (drop if exists + create / create or replace) e transacional.
-- Sem migration de dados. Sem RPC nova.
-- =====================================================================

begin;

-- ---- 1) posts ---------------------------------------------------
drop policy if exists "posts_select" on public.posts;
create policy "posts_select" on public.posts for select to public
  using (
    (hidden_at is null)
    and (owns_community(community_id) or is_community_member(community_id))
  );

-- ---- 2) can_view_post (dependência de post_comments/post_reactions) --
create or replace function public.can_view_post(p_post_id uuid)
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.posts p
    where p.id = p_post_id
      and p.hidden_at is null
      and (owns_community(p.community_id) or is_community_member(p.community_id))
  );
$function$;

-- ---- 3) joy_moments ------------------------------------------------
drop policy if exists "joy_moments_select" on public.joy_moments;
create policy "joy_moments_select" on public.joy_moments for select to authenticated
  using (
    owns_community(community_id) or is_community_member(community_id)
  );

-- ---- 4) challenge_progress --------------------------------------
drop policy if exists "challenge_progress_select" on public.challenge_progress;
create policy "challenge_progress_select" on public.challenge_progress for select to public
  using (
    (profile_id = auth.uid())
    or exists (
      select 1 from public.community_challenges c
      where c.id = challenge_progress.challenge_id
        and owns_community(c.community_id)
    )
  );

-- ---- 5) challenge_completions ---------------------------------
drop policy if exists "challenge_completions_select" on public.challenge_completions;
create policy "challenge_completions_select" on public.challenge_completions for select to public
  using (
    (profile_id = auth.uid())
    or exists (
      select 1 from public.community_challenges c
      where c.id = challenge_completions.challenge_id
        and owns_community(c.community_id)
    )
  );

-- ---- 6) community_members ------------------------------------
drop policy if exists "community_members_select" on public.community_members;
create policy "community_members_select" on public.community_members for select to public
  using (
    (profile_id = auth.uid()) or owns_community(community_id)
  );

-- ---- 7) profiles --------------------------------------------
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select to public
  using (
    (id = auth.uid())
    or community_owner_of_profile(id)
    or shares_active_community(id)
  );

-- ---- 8) community_content ----------------------------------
drop policy if exists "community_content_select" on public.community_content;
create policy "community_content_select" on public.community_content for select to public
  using (
    owns_community(community_id)
    or (is_community_member(community_id) and (status = 'published'::text))
  );

commit;

-- =====================================================================
-- Reversão (referência — recoloca o ramo is_master()):
--
-- begin;
-- drop policy if exists "posts_select" on public.posts;
-- create policy "posts_select" on public.posts for select to public
--   using (is_master() or ((hidden_at is null) and (owns_community(community_id) or is_community_member(community_id))));
--
-- create or replace function public.can_view_post(p_post_id uuid)
--  returns boolean language sql stable security definer set search_path to 'public'
-- as $function$
--   select exists (select 1 from public.posts p where p.id = p_post_id
--     and (is_master() or (p.hidden_at is null and (owns_community(p.community_id) or is_community_member(p.community_id)))));
-- $function$;
--
-- drop policy if exists "joy_moments_select" on public.joy_moments;
-- create policy "joy_moments_select" on public.joy_moments for select to authenticated
--   using (is_master() or owns_community(community_id) or is_community_member(community_id));
--
-- drop policy if exists "challenge_progress_select" on public.challenge_progress;
-- create policy "challenge_progress_select" on public.challenge_progress for select to public
--   using ((profile_id = auth.uid()) or exists (select 1 from public.community_challenges c
--     where c.id = challenge_progress.challenge_id and (owns_community(c.community_id) or is_master())));
--
-- drop policy if exists "challenge_completions_select" on public.challenge_completions;
-- create policy "challenge_completions_select" on public.challenge_completions for select to public
--   using ((profile_id = auth.uid()) or exists (select 1 from public.community_challenges c
--     where c.id = challenge_completions.challenge_id and (owns_community(c.community_id) or is_master())));
--
-- drop policy if exists "community_members_select" on public.community_members;
-- create policy "community_members_select" on public.community_members for select to public
--   using (is_master() or (profile_id = auth.uid()) or owns_community(community_id));
--
-- drop policy if exists "profiles_select" on public.profiles;
-- create policy "profiles_select" on public.profiles for select to public
--   using ((id = auth.uid()) or is_master() or community_owner_of_profile(id) or shares_active_community(id));
--
-- drop policy if exists "community_content_select" on public.community_content;
-- create policy "community_content_select" on public.community_content for select to public
--   using (is_master() or owns_community(community_id) or (is_community_member(community_id) and (status = 'published'::text)));
-- commit;
-- =====================================================================
