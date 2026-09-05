-- =====================================================================
-- FASE 12.3 — Discovery + Solicitação de Entrada (PENDING)
-- =====================================================================
-- Contexto (auditoria feita antes desta migration — nada abaixo foi
-- inventado, é o que a auditoria do schema real confirmou):
--
--  1) `community_members.status` já é o enum `membership_status`
--     ('active' | 'pending' | 'blocked') — 'pending' já existe desde a
--     Fase 8/9, só não era usado por nenhum fluxo de entrada.
--
--  2) O "auto-join" que a Fase 12 queria fechar está em
--     `community_members_insert`: o ramo de auto-solicitação
--     (`profile_id = auth.uid() AND comunidade is_discoverable`) permite
--     o INSERT mas não trava o `status` — e a coluna tem
--     `DEFAULT 'active'`. Resultado: `joinCommunity()` (useCommunity.ts)
--     insere SEM `status`, e a linha nasce `active` na hora. Esta
--     migration fecha isso tornando `status = 'pending'` OBRIGATÓRIO
--     nesse ramo específico da policy — não dá pra contornar pelo
--     cliente nem por um INSERT direto com `status='active'`.
--
--  3) TODAS as policies/funções de conteúdo já usam
--     `is_community_member(cid)` (variante de 1 argumento, que exige
--     `status = 'active'`) — confirmado em: posts_select/insert,
--     can_participate_in_post (-> post_comments/post_reactions),
--     community_content_select (via can_view_content),
--     can_view_challenge/can_participate_in_challenge (->
--     challenge_progress/challenge_completions/community_challenges),
--     can_view_event/can_participate_in_event, can_view_circle,
--     joy_moments_insert, daily_mood_entries_insert, help_requests_insert.
--     Ou seja: um membro `pending` JÁ é barrado de tudo isso, hoje, sem
--     precisar mudar nenhuma dessas policies/funções. O único buraco
--     real era a origem do `status` no INSERT (item 2).
--
--  4) `community_members_select` (`profile_id=auth.uid() OR
--     owns_community(cid)`) e `community_owner_of_profile()` já não
--     filtram por status — a dona já enxerga solicitações `pending` da
--     própria comunidade (para poder revisar) e a própria Member já
--     enxerga a própria linha `pending` (para ver que está aguardando).
--     Nada a mudar aqui.
--
--  5) Duplicação de solicitação (regra 11/12) já é impedida pela UNIQUE
--     existente `community_members_community_id_profile_id_key` em
--     (community_id, profile_id) — SEM olhar o status. Uma segunda
--     tentativa de INSERT para o mesmo par, com a linha já existindo em
--     'active', 'pending' OU 'blocked', sempre bate em 23505 (duplicate
--     key). `joinCommunity()` já trata esse erro como `already_member`.
--     Nada a mudar aqui também.
--
--  6) `community_members` NÃO tem GRANT UPDATE/DELETE para
--     `authenticated` (confirmado na 12.1) — então a aprovação/rejeição
--     não pode ser um UPDATE/DELETE direto do cliente, mesmo pela dona.
--     Precisa de RPC `SECURITY DEFINER` (mesmo padrão já usado por
--     `create_community_trial`, `moderate_post` etc.).
--
-- O QUE ESTA MIGRATION FAZ:
--   a) `communities.is_discoverable` passa a ter `DEFAULT false` (regra
--      1). NÃO mexe no valor das comunidades já existentes — só no
--      default de linhas novas.
--   b) Aperta `community_members_insert`: o ramo de auto-solicitação
--      exige `status = 'pending'`.
--   c) Cria `approve_membership_request(p_community_id, p_profile_id)`
--      — só a dona da comunidade (ou Master) aprova; só transiciona
--      pending -> active; não mexe em linhas active/blocked.
--   d) Cria `reject_membership_request(p_community_id, p_profile_id)`
--      — só a dona (ou Master) rejeita; DELETA a linha pending (sem
--      criar um estado novo no enum — a rejeição = "nunca chegou a
--      entrar", podendo solicitar de novo depois).
--
-- NÃO TOCADO (não era necessário — ver item 3/4/5 acima):
--   policies de conteúdo, `is_community_member`, `can_view_*`,
--   `can_participate_in_*`, `community_metrics`/`community_member_count`
--   (já filtram status='active'), UNIQUE constraint, RLS de profiles,
--   Billing/12.2, Master/RLS narrowing da 12.4.
--
-- Aditivo na prática (1 função nova + 1 função nova + 1 policy
-- substituída + 1 ALTER DEFAULT). Reversível (rodapé). Transacional.
-- Sem migração de dados (nenhuma linha existente é tocada: todas as
-- community_members reais hoje estão 'active', então o ALTER DEFAULT e
-- a policy nova não afetam nenhuma linha já gravada).
-- =====================================================================

begin;

-- ---- a) is_discoverable: default passa a ser false ------------------
alter table public.communities
  alter column is_discoverable set default false;

-- ---- b) community_members_insert: auto-solicitação exige 'pending' --
drop policy if exists "community_members_insert" on public.community_members;
create policy "community_members_insert" on public.community_members for insert to public
  with check (
    is_master()
    or owns_community(community_id)
    or (
      profile_id = auth.uid()
      and status = 'pending'
      and exists (
        select 1 from public.communities c
        where c.id = community_members.community_id
          and c.is_discoverable = true
      )
    )
  );

comment on policy "community_members_insert" on public.community_members is
  'Fase 12.3: dona/master podem inserir com qualquer status (ex.: adicionar membro já ativo). Auto-solicitação (a própria pessoa) só é aceita com status=pending, e só em comunidade discoverable.';

-- ---- c) aprovação: pending -> active, só dona/master -----------------
create or replace function public.approve_membership_request(
  p_community_id uuid,
  p_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not (public.owns_community(p_community_id) or public.is_master()) then
    raise exception 'not_authorized' using errcode = 'insufficient_privilege';
  end if;

  update public.community_members
     set status = 'active'
   where community_id = p_community_id
     and profile_id = p_profile_id
     and status = 'pending';

  if not found then
    raise exception 'no_pending_request_found' using errcode = 'no_data_found';
  end if;
end;
$function$;

comment on function public.approve_membership_request(uuid, uuid) is
  'Fase 12.3: aprova uma solicitação de entrada (pending -> active). Só a dona da comunidade ou o Master podem chamar. Não mexe em linhas que não estejam pending (não serve para reativar bloqueada).';

-- ---- d) rejeição: remove a solicitação pending, só dona/master ------
create or replace function public.reject_membership_request(
  p_community_id uuid,
  p_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not (public.owns_community(p_community_id) or public.is_master()) then
    raise exception 'not_authorized' using errcode = 'insufficient_privilege';
  end if;

  delete from public.community_members
   where community_id = p_community_id
     and profile_id = p_profile_id
     and status = 'pending';

  if not found then
    raise exception 'no_pending_request_found' using errcode = 'no_data_found';
  end if;
end;
$function$;

comment on function public.reject_membership_request(uuid, uuid) is
  'Fase 12.3: rejeita uma solicitação de entrada (deleta a linha pending — nenhum acesso é concedido). Só a dona da comunidade ou o Master podem chamar. A pessoa pode solicitar de novo depois.';

commit;

-- =====================================================================
-- Reversão (referência):
--
-- begin;
-- drop function if exists public.reject_membership_request(uuid, uuid);
-- drop function if exists public.approve_membership_request(uuid, uuid);
--
-- drop policy if exists "community_members_insert" on public.community_members;
-- create policy "community_members_insert" on public.community_members for insert to public
--   with check (
--     is_master() or owns_community(community_id)
--     or (
--       profile_id = auth.uid()
--       and exists (select 1 from public.communities c
--         where c.id = community_members.community_id and c.is_discoverable = true)
--     )
--   );
--
-- alter table public.communities alter column is_discoverable set default true;
-- commit;
-- =====================================================================
