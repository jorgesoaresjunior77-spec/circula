-- =====================================================================
-- FASE 12.4b — Endurecimento do Master (caminhos de ESCRITA/RPC)
-- =====================================================================
-- Contexto: a auditoria da Fase 12.4b (read-only, sem alterar nada)
-- levantou todas as policies/RPCs que ainda citam `is_master()` depois
-- da 12.4 (que já havia fechado 7 tabelas + `can_view_post`). Desses,
-- 4 ramos foram confirmados como "acesso individual sem uso funcional
-- comprovado" — nenhuma tela do MasterPanel (nem qualquer outra tela)
-- depende deles, verificado por grep no frontend antes desta migration:
--
--   1) profiles_update            — Master podia dar UPDATE em QUALQUER
--      coluna de QUALQUER perfil (não só `role`). Único UPDATE real no
--      frontend (`useAuth.ts`) já é sempre na própria conta
--      (`id = auth.uid()`) — o ramo is_master() nunca foi chamado por
--      nenhuma tela.
--
--   2) community_members_insert   — o ramo is_master() permitia inserir
--      uma linha de community_members para QUALQUER perfil, em
--      QUALQUER comunidade, com QUALQUER status (inclusive 'active'
--      direto) — um bypass do fluxo oficial da Fase 12.3
--      (pending -> aprovação -> active) exclusivo do Master. O caminho
--      do Member (auto-solicitação) já exige status='pending' desde a
--      12.3 e não é tocado aqui.
--
--   3) help_requests_update       — Master conseguia mudar o status de
--      QUALQUER pedido de ajuda, mas `help_requests_select` (não
--      alterada aqui, já não tem is_master() desde antes) NÃO permite
--      a Master ler o conteúdo (`body`) desses mesmos registros —
--      escrita às cegas, sem nenhuma tela usando isso (`canManageStatus`
--      só é true dentro de `ProfessionalPanel`/`HelpQueue`, nunca no
--      MasterPanel).
--
--   4) find_member_by_email()     — o guard aceitava is_master() além
--      da dona da comunidade; nenhuma tela do MasterPanel chama essa
--      RPC (é usada só por `AddMemberForm`, dentro da aba "Comunidades"
--      da Professional).
--
-- NÃO TOCADO NESTA MIGRATION (mantidos por decisão explícita):
--   • approve_membership_request / reject_membership_request — o ramo
--     is_master() é uma capacidade administrativa retida
--     conscientemente; owns_community() já é a proteção efetiva contra
--     aprovação cruzada entre comunidades (confirmado pelos testes da
--     suíte 12.3).
--   • platform_overview / platform_communities / platform_professionals
--     / community_metrics / points_community_summary — inalterados.
--   • Todas as tabelas de billing/commerce (subscriptions, asaas_*,
--     billing_*, payment_charges, product_*, revenue_split_rules,
--     platform_split_settings, professional_billing_accounts,
--     subscription_status_history) — fora de escopo, decisão já
--     registrada na própria 12.4 ("Master é o admin de billing").
--   • As 13 policies de config/conteúdo de comunidade e as 4 funções
--     can_view_challenge/circle/content/event levantadas na auditoria
--     (candidatos a uma FUTURA 12.4c) — não fazem parte desta migration.
--   • `UNIQUE(owner_id)`, modelo 1 Professional = 1 comunidade,
--     arquitetura `communities[0]`, Discovery/Pending da 12.3.
--
-- SEGURANÇA — cada mudança abaixo é a remoção de um ramo `OR` de uma
-- condição de autorização já existente. Remover um disjuntor de um OR
-- só pode ESTREITAR o conjunto de acessos permitidos, nunca abrir um
-- caminho novo — não há como esta migration introduzir um bypass
-- alternativo por construção.
--
-- Aditivo na prática (substitui 3 policies + 1 função por versões
-- estritamente mais restritas). Totalmente reversível (rodapé).
-- Transacional. Sem migração de dados.
-- =====================================================================

begin;

-- ---- 1) profiles_update: só a própria conta -------------------------
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles for update to public
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---- 2) community_members_insert: remove o ramo is_master() --------
drop policy if exists "community_members_insert" on public.community_members;
create policy "community_members_insert" on public.community_members for insert to public
  with check (
    owns_community(community_id)
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

-- ---- 3) help_requests_update: remove o ramo is_master() ------------
drop policy if exists "help_requests_update" on public.help_requests;
create policy "help_requests_update" on public.help_requests for update to public
  using (
    (profile_id = auth.uid()) or owns_community(community_id)
  )
  with check (
    (profile_id = auth.uid()) or owns_community(community_id)
  );

-- ---- 4) find_member_by_email: remove o ramo is_master() do guard ---
create or replace function public.find_member_by_email(p_community_id uuid, p_email text)
returns table(id uuid, full_name text)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.communities c
    where c.id = p_community_id
      and c.owner_id = auth.uid()
  ) then
    raise exception 'not authorized';
  end if;

  return query
    select p.id, p.full_name
    from public.profiles p
    join auth.users u on u.id = p.id
    where lower(u.email) = lower(p_email)
      and p.role = 'member'
    limit 1;
end;
$function$;

commit;

-- =====================================================================
-- Reversão (referência — recoloca o ramo is_master() em cada um):
--
-- begin;
-- drop policy if exists "profiles_update" on public.profiles;
-- create policy "profiles_update" on public.profiles for update to public
--   using ((id = auth.uid()) or is_master())
--   with check ((id = auth.uid()) or is_master());
--
-- drop policy if exists "community_members_insert" on public.community_members;
-- create policy "community_members_insert" on public.community_members for insert to public
--   with check (
--     is_master()
--     or owns_community(community_id)
--     or (
--       profile_id = auth.uid()
--       and status = 'pending'
--       and exists (select 1 from public.communities c
--         where c.id = community_members.community_id and c.is_discoverable = true)
--     )
--   );
--
-- drop policy if exists "help_requests_update" on public.help_requests;
-- create policy "help_requests_update" on public.help_requests for update to public
--   using ((profile_id = auth.uid()) or owns_community(community_id) or is_master())
--   with check ((profile_id = auth.uid()) or owns_community(community_id) or is_master());
--
-- create or replace function public.find_member_by_email(p_community_id uuid, p_email text)
-- returns table(id uuid, full_name text) language plpgsql security definer
-- set search_path to 'public' as $function$
-- begin
--   if auth.uid() is null then raise exception 'not authenticated'; end if;
--   if not (
--     public.is_master()
--     or exists (select 1 from public.communities c
--       where c.id = p_community_id and c.owner_id = auth.uid())
--   ) then raise exception 'not authorized'; end if;
--   return query select p.id, p.full_name from public.profiles p
--     join auth.users u on u.id = p.id
--     where lower(u.email) = lower(p_email) and p.role = 'member' limit 1;
-- end;
-- $function$;
-- commit;
-- =====================================================================
