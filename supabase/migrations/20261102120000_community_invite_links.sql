-- =====================================================================
-- Convite da comunidade por link (WhatsApp) — cadastro de participante
-- =====================================================================
-- NÃO APLICADA — preparada nesta etapa, aguardando autorização explícita
-- do usuário antes de rodar contra o banco remoto.
--
-- Contexto: o convite por WhatsApp (CommunityInviteWhatsApp) hoje só
-- compartilha a URL pública do app, e a única tela de cadastro público é
-- a de Profissional — uma mulher convidada não conseguia criar conta. O
-- fluxo novo: a Profissional gera UM link por comunidade (revogável); a
-- convidada abre o link, vê o nome da comunidade, cria e-mail + senha e
-- já entra como membra ATIVA (decisão do usuário), passando então pelo
-- onboarding e pelo tour.
--
-- Segurança:
--   • token = 2 UUIDs v4 concatenados (≈244 bits, não adivinhável);
--   • a tabela NÃO tem policy nem GRANT para anon/authenticated — tudo
--     passa por 6 RPCs SECURITY DEFINER (search_path VAZIO: todo objeto vai
--     qualificado com public., só o pg_catalog é resolvido sozinho) que
--     validam quem chama;
--   • só a DONA da comunidade lê/gera/regenera/desativa o link
--     (owns_community) — Master e demais ficam de fora;
--   • get_invite_preview é pública (anon) e devolve SÓ o nome da
--     comunidade, e só para link ativo;
--   • join_community_by_invite só aceita role 'member' (nunca vira
--     Profissional/Master por link), nunca reativa quem foi BLOQUEADA e
--     transforma um pedido 'pending' em 'active' (a dona já convidou);
--   • a entrada passa pelos mesmos gatilhos de community_members que o
--     convite por e-mail (trial da comunidade etc.), pois o INSERT é o
--     mesmo.
--
-- 100% aditivo, idempotente, transacional, reversível.
-- =====================================================================

begin;

-- ---- 1) tabela -----------------------------------------------------
create table if not exists public.community_invite_links (
  id           uuid not null default gen_random_uuid(),
  community_id uuid not null,
  token        text not null,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  revoked_at   timestamptz,
  constraint community_invite_links_pkey primary key (id),
  constraint community_invite_links_token_key unique (token),
  constraint community_invite_links_community_id_fkey foreign key (community_id)
    references public.communities (id) on delete cascade,
  constraint community_invite_links_created_by_fkey foreign key (created_by)
    references public.profiles (id) on delete set null
);

-- No máximo 1 link ATIVO por comunidade (revogados ficam de histórico).
create unique index if not exists community_invite_links_one_active_per_community
  on public.community_invite_links (community_id)
  where (revoked_at is null);

alter table public.community_invite_links enable row level security;

-- Sem policies e sem GRANT para anon/authenticated: acesso só pelas RPCs.
revoke all on table public.community_invite_links from anon, authenticated;
grant select, insert, update, delete on table public.community_invite_links to service_role;

-- ---- 2) RPCs da dona -------------------------------------------------
-- Leitura pura (não cria): o link ATIVO da comunidade, ou NULL. É o que o
-- Painel chama ao abrir — se a dona desativou o link, ele continua
-- desativado depois de recarregar a página.
create or replace function public.get_invite_link(p_community_id uuid)
 returns text
 language plpgsql
 stable
 security definer
 set search_path to ''
as $function$
declare
  v_token text;
begin
  if auth.uid() is null or not public.owns_community(p_community_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select token into v_token
  from public.community_invite_links
  where community_id = p_community_id and revoked_at is null;

  return v_token;
end;
$function$;

create or replace function public.get_or_create_invite_link(p_community_id uuid)
 returns text
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_token text;
begin
  if auth.uid() is null or not public.owns_community(p_community_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select token into v_token
  from public.community_invite_links
  where community_id = p_community_id and revoked_at is null;

  if v_token is null then
    insert into public.community_invite_links (community_id, token, created_by)
    values (
      p_community_id,
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      auth.uid()
    )
    on conflict do nothing;

    select token into v_token
    from public.community_invite_links
    where community_id = p_community_id and revoked_at is null;
  end if;

  return v_token;
end;
$function$;

create or replace function public.regenerate_invite_link(p_community_id uuid)
 returns text
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  if auth.uid() is null or not public.owns_community(p_community_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  update public.community_invite_links
     set revoked_at = now()
   where community_id = p_community_id and revoked_at is null;

  insert into public.community_invite_links (community_id, token, created_by)
  values (p_community_id, v_token, auth.uid());

  return v_token;
end;
$function$;

create or replace function public.revoke_invite_link(p_community_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if auth.uid() is null or not public.owns_community(p_community_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  update public.community_invite_links
     set revoked_at = now()
   where community_id = p_community_id and revoked_at is null;
end;
$function$;

-- ---- 3) RPC pública: pré-visualização do convite -----------------------
create or replace function public.get_invite_preview(p_token text)
 returns table (community_name text)
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select c.name
  from public.community_invite_links l
  join public.communities c on c.id = l.community_id
  where l.token = p_token and l.revoked_at is null
$function$;

-- ---- 4) RPC da convidada: entrar na comunidade -------------------------
create or replace function public.join_community_by_invite(p_token text)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_uid       uuid := auth.uid();
  v_community uuid;
  v_role      public.user_role;
  v_status    public.membership_status;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select community_id into v_community
  from public.community_invite_links
  where token = p_token and revoked_at is null;

  if v_community is null then
    raise exception 'invalid_invite' using errcode = 'P0002';
  end if;

  select role into v_role from public.profiles where id = v_uid;
  if v_role is distinct from 'member'::public.user_role then
    raise exception 'not_member' using errcode = '42501';
  end if;

  insert into public.community_members (community_id, profile_id, status)
  values (v_community, v_uid, 'active')
  on conflict (community_id, profile_id)
  do update set status = 'active' where public.community_members.status = 'pending';

  select status into v_status
  from public.community_members
  where community_id = v_community and profile_id = v_uid;

  if v_status is distinct from 'active'::public.membership_status then
    raise exception 'not_active' using errcode = '42501';
  end if;

  return v_community;
end;
$function$;

-- ---- 5) permissões de execução -----------------------------------------
revoke all on function public.get_invite_link(uuid)           from public, anon;
revoke all on function public.get_or_create_invite_link(uuid) from public, anon;
revoke all on function public.regenerate_invite_link(uuid)    from public, anon;
revoke all on function public.revoke_invite_link(uuid)        from public, anon;
revoke all on function public.get_invite_preview(text)        from public;
revoke all on function public.join_community_by_invite(text)  from public, anon;

grant execute on function public.get_invite_link(uuid)           to authenticated;
grant execute on function public.get_or_create_invite_link(uuid) to authenticated;
grant execute on function public.regenerate_invite_link(uuid)    to authenticated;
grant execute on function public.revoke_invite_link(uuid)        to authenticated;
grant execute on function public.get_invite_preview(text)        to anon, authenticated;
grant execute on function public.join_community_by_invite(text)  to authenticated;

commit;

-- ---- Rollback (manual) ------------------------------------------
-- begin;
-- drop function if exists public.join_community_by_invite(text);
-- drop function if exists public.get_invite_preview(text);
-- drop function if exists public.revoke_invite_link(uuid);
-- drop function if exists public.regenerate_invite_link(uuid);
-- drop function if exists public.get_or_create_invite_link(uuid);
-- drop function if exists public.get_invite_link(uuid);
-- drop table if exists public.community_invite_links;
-- commit;
