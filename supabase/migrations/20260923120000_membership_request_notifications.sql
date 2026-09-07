-- =====================================================================
-- FASE 16.2.4-A — Notificações do ciclo de entrada de membros
-- =====================================================================
-- Fecha o loop humano do fluxo descoberta -> solicitação -> aprovação
-- construído nas Fases 12.3 e 16.2.3-C/D/G: hoje a aprovação/rejeição é
-- silenciosa e a dona da comunidade só sabe de uma nova solicitação se
-- abrir o painel.
--
-- Três eventos, todos escritos em `public.social_notifications` (Módulo
-- 4), no mesmo molde já usado para 'direct_message' e 'help_request':
--
--   membership_requested  -> notifica a DONA quando alguém solicita
--                            entrada (INSERT status='pending' feito pelo
--                            próprio cliente; sem RPC -> gatilho).
--   membership_approved   -> notifica a Member quando a dona/master
--                            aprova (dentro de approve_membership_request).
--   membership_rejected   -> notifica a Member quando a dona/master
--                            rejeita (dentro de reject_membership_request,
--                            após confirmar o DELETE via RETURNING).
--
-- ADITIVO:
--   • +1 coluna NULLABLE `related_community_id` em social_notifications
--     (FK -> communities, ON DELETE CASCADE) + índice.
--   • CHECK de `type` ampliado de 7 -> 10 valores (os 7 existentes são
--     preservados integralmente).
--   • +1 função de gatilho SECURITY DEFINER + 1 gatilho AFTER INSERT em
--     community_members (à prova de exceção).
--   • CREATE OR REPLACE de approve_/reject_membership_request: MESMA
--     assinatura/retorno/guards/errcodes/efeito — só ganham um bloco de
--     notificação isolado por BEGIN...EXCEPTION WHEN OTHERS THEN NULL.
--
-- NÃO altera: RLS/policies/grants de social_notifications ou de
-- community_members; schema de community_members ou communities; os 8
-- gatilhos de notificação existentes; publicação supabase_realtime;
-- Asaas/billing/Split/assinaturas. Nenhum gatilho AFTER UPDATE/DELETE
-- para membership. Nenhum RPC novo. Nenhum grant/revoke.
--
-- Idempotente (add column if not exists / drop constraint if exists +
-- add / create or replace / create index if not exists). Transacional.
-- Reversível (rodapé).
-- =====================================================================

begin;

-- ---- 1) social_notifications: coluna + FK + índice (ADITIVO) -------
alter table public.social_notifications
  add column if not exists related_community_id uuid;

alter table public.social_notifications
  drop constraint if exists social_notifications_related_community_id_fkey;
alter table public.social_notifications
  add constraint social_notifications_related_community_id_fkey
  foreign key (related_community_id)
  references public.communities (id) on delete cascade;

create index if not exists social_notifications_related_community_idx
  on public.social_notifications using btree (related_community_id);

-- ---- 2) social_notifications.type: 7 -> 10 valores ----------------
alter table public.social_notifications
  drop constraint if exists social_notifications_type_check;
alter table public.social_notifications
  add constraint social_notifications_type_check check (
    type = any (array[
      'post_comment'::text,
      'post_reaction'::text,
      'circle_join'::text,
      'event_rsvp'::text,
      'challenge_comment'::text,
      'direct_message'::text,
      'help_request'::text,
      'membership_requested'::text,
      'membership_approved'::text,
      'membership_rejected'::text
    ])
  );

-- ---- 3) gatilho: nova solicitação de entrada -> notifica a dona ----
-- AFTER INSERT em community_members. Só age quando a linha nasce
-- 'pending' (auto-solicitação da Fase 12.3) — adições diretas de
-- dona/master ('active') e o convite via invite-member ('active') não
-- disparam. À prova de exceção: nunca bloqueia a solicitação.
create or replace function public.notify_on_membership_request()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_owner      uuid;
  v_cname      text;
  v_actor_name text;
begin
  begin
    if new.status = 'pending' then
      select owner_id, name into v_owner, v_cname
      from public.communities where id = new.community_id;

      if v_owner is not null and v_owner <> new.profile_id then
        select full_name into v_actor_name
        from public.profiles where id = new.profile_id;

        insert into public.social_notifications
          (profile_id, actor_profile_id, type, title, body, related_community_id)
        values
          (v_owner, new.profile_id, 'membership_requested',
           coalesce(v_actor_name, 'Uma mulher do Círcula') || ' pediu para entrar na comunidade',
           v_cname,
           new.community_id);
      end if;
    end if;
  exception when others then
    null; -- nunca bloquear a solicitação de entrada
  end;

  return new;
end;
$function$;

comment on function public.notify_on_membership_request() is
  'Fase 16.2.4-A: AFTER INSERT em community_members. Quando a linha nasce status=pending, notifica a dona da comunidade (type=membership_requested). SECURITY DEFINER + à prova de exceção — nunca bloqueia a solicitação.';

create or replace trigger trg_notify_on_membership_request
  after insert on public.community_members
  for each row execute function public.notify_on_membership_request();

-- ---- 4) approve_membership_request: + notificação de aprovação -----
-- Lógica/guards/errcodes/efeito INALTERADOS (Fase 12.3). Acrescenta,
-- após o UPDATE bem-sucedido, uma notificação para a Member, isolada
-- por BEGIN...EXCEPTION: falha na notificação NÃO desfaz a aprovação.
create or replace function public.approve_membership_request(
  p_community_id uuid,
  p_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_owner uuid;
  v_cname text;
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

  -- 16.2.4-A — notifica a Member de que a entrada foi aprovada.
  begin
    select owner_id, name into v_owner, v_cname
    from public.communities where id = p_community_id;

    if v_owner is not null then
      insert into public.social_notifications
        (profile_id, actor_profile_id, type, title, body, related_community_id)
      values
        (p_profile_id, v_owner, 'membership_approved',
         'Sua entrada foi aprovada 🌿',
         coalesce(v_cname, 'a comunidade'),
         p_community_id);
    end if;
  exception when others then
    null; -- falha na notificação nunca desfaz a aprovação
  end;
end;
$function$;

comment on function public.approve_membership_request(uuid, uuid) is
  'Fase 12.3: aprova uma solicitação de entrada (pending -> active). Só a dona da comunidade ou o Master podem chamar. Não mexe em linhas que não estejam pending (não serve para reativar bloqueada). Fase 16.2.4-A: após o UPDATE, notifica a Member (type=membership_approved) em bloco à prova de exceção.';

-- ---- 5) reject_membership_request: + notificação de rejeição -------
-- Lógica/guards/errcodes INALTERADOS (Fase 12.3). O DELETE agora usa
-- RETURNING para capturar os ids da linha realmente apagada; só depois
-- disso (e só se uma linha foi apagada) a notificação é criada, isolada
-- por BEGIN...EXCEPTION: falha na notificação NÃO desfaz a rejeição.
-- Sem gatilho AFTER DELETE.
create or replace function public.reject_membership_request(
  p_community_id uuid,
  p_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_cid   uuid;
  v_pid   uuid;
  v_owner uuid;
  v_cname text;
begin
  if not (public.owns_community(p_community_id) or public.is_master()) then
    raise exception 'not_authorized' using errcode = 'insufficient_privilege';
  end if;

  delete from public.community_members
   where community_id = p_community_id
     and profile_id = p_profile_id
     and status = 'pending'
  returning community_id, profile_id into v_cid, v_pid;

  if not found then
    raise exception 'no_pending_request_found' using errcode = 'no_data_found';
  end if;

  -- 16.2.4-A — notifica a Member de que a solicitação não foi aprovada.
  -- Só executa após confirmação de que uma linha pendente foi apagada.
  begin
    select owner_id, name into v_owner, v_cname
    from public.communities where id = v_cid;

    if v_owner is not null then
      insert into public.social_notifications
        (profile_id, actor_profile_id, type, title, body, related_community_id)
      values
        (v_pid, v_owner, 'membership_rejected',
         'Sua solicitação não foi aprovada desta vez',
         coalesce(v_cname, 'a comunidade'),
         v_cid);
    end if;
  exception when others then
    null; -- falha na notificação nunca desfaz a rejeição
  end;
end;
$function$;

comment on function public.reject_membership_request(uuid, uuid) is
  'Fase 12.3: rejeita uma solicitação de entrada (deleta a linha pending — nenhum acesso é concedido). Só a dona da comunidade ou o Master podem chamar. A pessoa pode solicitar de novo depois. Fase 16.2.4-A: o DELETE usa RETURNING; após confirmado, notifica a Member (type=membership_rejected) em bloco à prova de exceção.';

commit;

-- =====================================================================
-- Reversão (referência):
--
-- begin;
-- drop trigger if exists trg_notify_on_membership_request on public.community_members;
-- drop function if exists public.notify_on_membership_request();
--
-- -- restaurar os corpos da Fase 12.3 (sem o bloco de notificação):
-- create or replace function public.approve_membership_request(p_community_id uuid, p_profile_id uuid)
-- returns void language plpgsql security definer set search_path to 'public' as $fn$
-- begin
--   if not (public.owns_community(p_community_id) or public.is_master()) then
--     raise exception 'not_authorized' using errcode = 'insufficient_privilege';
--   end if;
--   update public.community_members set status = 'active'
--    where community_id = p_community_id and profile_id = p_profile_id and status = 'pending';
--   if not found then
--     raise exception 'no_pending_request_found' using errcode = 'no_data_found';
--   end if;
-- end;
-- $fn$;
-- create or replace function public.reject_membership_request(p_community_id uuid, p_profile_id uuid)
-- returns void language plpgsql security definer set search_path to 'public' as $fn$
-- begin
--   if not (public.owns_community(p_community_id) or public.is_master()) then
--     raise exception 'not_authorized' using errcode = 'insufficient_privilege';
--   end if;
--   delete from public.community_members
--    where community_id = p_community_id and profile_id = p_profile_id and status = 'pending';
--   if not found then
--     raise exception 'no_pending_request_found' using errcode = 'no_data_found';
--   end if;
-- end;
-- $fn$;
--
-- alter table public.social_notifications drop constraint if exists social_notifications_type_check;
-- alter table public.social_notifications add constraint social_notifications_type_check check (
--   type = any (array['post_comment'::text,'post_reaction'::text,'circle_join'::text,
--     'event_rsvp'::text,'challenge_comment'::text,'direct_message'::text,'help_request'::text]));
--
-- drop index if exists public.social_notifications_related_community_idx;
-- alter table public.social_notifications drop constraint if exists social_notifications_related_community_id_fkey;
-- alter table public.social_notifications drop column if exists related_community_id;
-- commit;
-- =====================================================================
