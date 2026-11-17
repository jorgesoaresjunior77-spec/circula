-- Todos os planos avulsos passam a ter pacote próprio (revista e receitas
-- também), para a cobrança do Asaas poder liberar e mostrar o que a membro tem.
begin;

alter table public.member_package_access
  drop constraint if exists member_package_access_package_check;
alter table public.member_package_access
  add constraint member_package_access_package_check check (
    package in ('help_nutri', 'ebooks', 'total', 'respiracao', 'playlist', 'wellness', 'leitura', 'premium', 'magazine', 'receitas')
  );

commit;

-- ---------------------------------------------------------------------
-- Convidar amigas: a membro ativa lê o link de convite vigente da comunidade
-- (o mesmo que a dona usa). Não cria um novo se a dona o desativou de
-- propósito; só cria o primeiro se a comunidade nunca teve link.
-- ---------------------------------------------------------------------
begin;

create or replace function public.get_member_invite_link(p_community_id uuid)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_token text;
begin
  if auth.uid() is null or not public.is_community_member(p_community_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select token into v_token
  from public.community_invite_links
  where community_id = p_community_id and revoked_at is null;

  if v_token is not null then
    return v_token;
  end if;

  if exists (select 1 from public.community_invite_links where community_id = p_community_id) then
    return null; -- a dona desativou o link: a membro não gera outro
  end if;

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
  return v_token;
end;
$function$;

revoke all on function public.get_member_invite_link(uuid) from public, anon;
grant execute on function public.get_member_invite_link(uuid) to authenticated;

commit;
