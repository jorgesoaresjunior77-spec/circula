-- =====================================================================
-- FASE 12.2 — Sincronização Assinatura -> Membership (fecha o paywall)
-- =====================================================================
-- Contexto: a suíte de RLS da Fase 12.1 confirmou uma brecha real: as
-- policies de conteúdo (posts_select, post_comments_select via
-- can_view_post, joy_moments_select, community_content_select, etc.)
-- checam `is_community_member(community_id)` — a variante de 1 argumento,
-- que só olha `community_members.status = 'active'`. Elas NÃO consultam
-- `subscriptions`. Então quando `subscriptions.status` vira `blocked`
-- mas ninguém atualiza `community_members.status`, o acesso ao conteúdo
-- pago continua liberado. Hoje NADA atualiza `community_members.status`
-- a partir da assinatura — por isso a brecha.
--
-- Esta migration NÃO toca nenhuma policy de RLS (elas já fazem a coisa
-- certa a partir de `community_members.status`). Ela fecha a lacuna na
-- origem: um trigger em `subscriptions` mantém `community_members.status`
-- sincronizado, seguindo a Opção C já decidida no plano da Fase 12
-- (trigger de sincronização como mecanismo primário).
--
-- REGRA (mesma convenção já usada por `community_subscription_active()`
-- e por `has_active_access()`/`is_community_member(cid, true)` — não é
-- uma distinção nova, é a que a base já usa para "acesso pago ativo"):
--   status = 'blocked'                         -> membership 'blocked'
--   status IN ('trial','active','past_due',
--              'canceled')                     -> membership 'active'
-- `community_members.status = 'pending'` NUNCA é tocado por este
-- trigger — é o estado de "solicitação aguardando aprovação" (modelo
-- decidido na Fase 12: discoverable -> pending -> aprovação -> active),
-- e billing não deve conceder acesso a quem ainda não foi aprovado.
--
-- ESCOPO — só a assinatura de COMUNIDADE do próprio membro
-- (`subject = 'community'`). NÃO mexe em:
--   • `subscriptions.subject = 'platform'` (assinatura da profissional
--     dona da comunidade) — se ela for bloqueada, a Professional
--     continua com acesso à própria comunidade porque as policies usam
--     `owns_community(community_id)` (sem checar billing), e isso não
--     muda nesta subfase. Cascatear o bloqueio da Professional para os
--     Members dela é uma sincronização DIFERENTE, fora do escopo desta
--     subfase (ver rodapé / relatório).
--   • Master: não é membro de comunidade nenhuma; nada aqui o afeta.
--   • RLS/policies: nenhuma foi alterada.
--   • Discovery/auto-join/Storage/Feed Rico/Home: não tocados.
--
-- SEGURANÇA — a função é SECURITY DEFINER (mesmo padrão de
-- `create_community_trial()`, já existente): o UPDATE em
-- `community_members` precisa rodar mesmo quando quem mudou a
-- assinatura foi o Master (via `subscriptions_update_master`, papel
-- `authenticated`) ou o service_role do webhook — nenhum dos dois tem
-- GRANT UPDATE em `community_members` (confirmado na auditoria da
-- 12.1). O Member CONTINUA sem qualquer caminho para alterar o próprio
-- `community_members.status`: não há GRANT UPDATE/DELETE nessa tabela
-- para `authenticated`, e a policy de UPDATE em `subscriptions` exige
-- `is_master()` — então mesmo tendo GRANT UPDATE em `subscriptions`,
-- o Member não consegue mudar o `status` da própria assinatura (a RLS
-- barra antes do trigger sequer rodar).
--
-- IDEMPOTENTE — `create or replace function`, `drop trigger if exists`
-- + `create trigger`, e o UPDATE dentro da função só escreve quando o
-- status-alvo é diferente do atual (`is distinct from`). Rodar a
-- migration de novo, ou disparar o trigger de novo com o mesmo valor,
-- não produz efeito colateral.
--
-- BACKFILL — aplica a mesma regra às linhas já existentes, para a
-- invariante valer imediatamente após a migration (não só para
-- mudanças futuras). Nos dados reais de hoje as 3 subscriptions
-- existentes estão todas em 'trial' e as 2 community_members em
-- 'active' — o backfill não deve alterar nenhuma linha (validado por
-- teste transacional antes desta migration ser proposta).
--
-- Aditivo na prática (cria função + trigger; o backfill é um UPDATE
-- condicional que hoje não casa com nenhuma linha). Totalmente
-- reversível (script no rodapé). Transacional.
-- =====================================================================

begin;

-- ---- 1) função de sincronização --------------------------------------
create or replace function public.sync_membership_from_subscription()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_target public.membership_status;
begin
  -- só assinatura de comunidade (subject='platform' tem community_id
  -- null e não corresponde a nenhuma linha de community_members).
  if new.subject <> 'community' or new.community_id is null then
    return new;
  end if;

  v_target := case when new.status = 'blocked'
                   then 'blocked'::public.membership_status
                   else 'active'::public.membership_status
              end;

  update public.community_members
     set status = v_target
   where community_id = new.community_id
     and profile_id = new.profile_id
     and status <> 'pending'                 -- nunca mexe em pending
     and status is distinct from v_target;    -- idempotente / sem no-op write

  return new;
end;
$function$;

comment on function public.sync_membership_from_subscription() is
  'Fase 12.2: mantém community_members.status sincronizado com subscriptions.status (subject=community). blocked->blocked, qualquer outro->active. Nunca altera status=pending.';

-- ---- 2) trigger em subscriptions --------------------------------------
drop trigger if exists subscriptions_sync_membership on public.subscriptions;

create trigger subscriptions_sync_membership
  after insert or update of status on public.subscriptions
  for each row
  when (new.subject = 'community')
  execute function public.sync_membership_from_subscription();

-- ---- 3) backfill — aplica a regra aos dados já existentes -------------
-- bloqueia quem tem assinatura de comunidade 'blocked' mas membership 'active'
update public.community_members cm
   set status = 'blocked'
  from public.subscriptions s
 where s.subject = 'community'
   and s.status = 'blocked'
   and s.community_id = cm.community_id
   and s.profile_id = cm.profile_id
   and cm.status = 'active';

-- restaura quem tem assinatura de comunidade não-blocked mas membership 'blocked'
update public.community_members cm
   set status = 'active'
  from public.subscriptions s
 where s.subject = 'community'
   and s.status <> 'blocked'
   and s.community_id = cm.community_id
   and s.profile_id = cm.profile_id
   and cm.status = 'blocked';

commit;

-- =====================================================================
-- Reversão (referência):
--
-- begin;
-- drop trigger if exists subscriptions_sync_membership on public.subscriptions;
-- drop function if exists public.sync_membership_from_subscription();
-- commit;
--
-- (O backfill não precisa de reversão: ele só move community_members.status
--  para o valor que a assinatura já dizia. Remover o trigger apenas para
--  de manter a sincronização daqui para frente; não há dado "inventado"
--  para desfazer.)
-- =====================================================================
