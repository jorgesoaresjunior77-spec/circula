-- =====================================================================
-- Etapa "plataforma completa" — Módulo 3: PERFIL RICO
-- =====================================================================
-- Evolui `profiles` com dois campos opcionais e adiciona uma RPC de
-- agregação de atividade pública da participante.
--
-- SEGURANÇA / RISCO AVALIADO:
--   - `profiles` é tabela core e tem a trigger
--     `profiles_prevent_role_escalation`. Essa trigger só reverte
--     alterações da COLUNA `role` — adicionar colunas nullable novas
--     (`bio`, `city`) não a aciona e não altera nenhuma linha
--     existente (ADD COLUMN sem default = todas ficam NULL).
--   - `profiles` já tem `grant select, update to authenticated` e a
--     policy `profiles_update` (id = auth.uid() OR is_master()) — o
--     `updateProfile` do app já faz `.update(input)` genérico, então
--     os campos novos entram sem policy/grant novo.
--   - A RPC `profile_overview` é SECURITY DEFINER e só retorna algo se
--     quem chama já poderia ver o perfil pela policy `profiles_select`
--     (mesma predicada). As contagens são restritas às comunidades que
--     quem chama também pode ver (is_master / owns_community /
--     is_community_member) — nunca vaza atividade de comunidade que o
--     chamador não integra.
--
-- Idempotente.
-- =====================================================================

begin;

alter table public.profiles add column if not exists bio  text;
alter table public.profiles add column if not exists city text;

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
      'challenges', (
        select count(*) from public.challenge_participants chp
        join public.community_challenges ch on ch.id = chp.challenge_id
        where chp.profile_id = p_profile_id
          and ch.community_id in (select community_id from allowed)
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

grant execute on function public.profile_overview(uuid) to authenticated;

commit;
