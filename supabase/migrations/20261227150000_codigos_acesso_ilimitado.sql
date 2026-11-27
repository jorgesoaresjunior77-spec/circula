-- Códigos de acesso ilimitado (pedido de 2026-11-27): no Painel, a nutricionista gera um código para uma pessoa;
-- o código vai junto com o convite e a pessoa digita no primeiro acesso (ou depois, em Planos). Ao usar:
--   - ganha o Círcula Premium para sempre (member_package_access 'premium' com granted_by = quem gerou: o webhook,
--     a varredura e os cancelamentos nunca tiram acesso liberado pela equipe);
--   - a assinatura do Círcula dela fica ativa até 2099, sem cobrança (só se ainda não houver cobrança no Asaas);
--   - se a entrada estava esperando aprovação, fica aprovada (a nutri é quem mandou o código).
-- Cada código vale para UMA pessoa. Aditiva e reversível (rollback no fim).
begin;

create table if not exists public.access_codes (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z2-9]{8}$'),
  note text check (note is null or char_length(note) <= 80),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  used_by uuid references public.profiles(id) on delete set null,
  used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists access_codes_community_idx on public.access_codes (community_id, created_at desc);

alter table public.access_codes enable row level security;
drop policy if exists access_codes_select on public.access_codes;
create policy access_codes_select on public.access_codes
  for select to authenticated
  using (public.owns_community(community_id) or public.is_master());
grant select on public.access_codes to authenticated;
-- escrita só pelas funções abaixo (security definer)

create or replace function public.create_access_code(p_community_id uuid, p_note text default null)
returns text
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_uid uuid := auth.uid();
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  i int;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not (public.owns_community(p_community_id) or public.is_master()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.access_codes where code = v_code);
  end loop;
  insert into public.access_codes (community_id, code, note, created_by)
  values (p_community_id, v_code, nullif(trim(coalesce(p_note, '')), ''), v_uid);
  return v_code;
end;
$fn$;

create or replace function public.revoke_access_code(p_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_community uuid;
begin
  select community_id into v_community from public.access_codes where id = p_id;
  if v_community is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not (public.owns_community(v_community) or public.is_master()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.access_codes set revoked_at = now() where id = p_id and used_at is null and revoked_at is null;
end;
$fn$;

create or replace function public.redeem_access_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_uid  uuid := auth.uid();
  v_role public.user_role;
  v_row  public.access_codes%rowtype;
  v_norm text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select role into v_role from public.profiles where id = v_uid;
  if v_role is distinct from 'member'::public.user_role then
    raise exception 'not_member' using errcode = '42501';
  end if;

  select * into v_row from public.access_codes where code = v_norm for update;
  if v_row.id is null or v_row.revoked_at is not null then
    raise exception 'invalid_code' using errcode = 'P0002';
  end if;
  if v_row.used_at is not null then
    if v_row.used_by = v_uid then
      return v_row.community_id; -- já usado por ela mesma: nada a fazer
    end if;
    raise exception 'code_used' using errcode = 'P0001';
  end if;

  -- precisa já ter entrado (ou pedido para entrar) na comunidade do código
  if not exists (
    select 1 from public.community_members where community_id = v_row.community_id and profile_id = v_uid
  ) then
    raise exception 'not_in_community' using errcode = '42501';
  end if;

  update public.community_members set status = 'active'
  where community_id = v_row.community_id and profile_id = v_uid and status = 'pending';

  insert into public.member_package_access (community_id, profile_id, package, granted_by)
  values (v_row.community_id, v_uid, 'premium', v_row.created_by)
  on conflict (community_id, profile_id, package) do update set granted_by = excluded.granted_by;

  update public.subscriptions
  set status = 'active', current_period_end = '2099-12-31 23:59:59+00'
  where subject = 'community' and profile_id = v_uid and community_id = v_row.community_id
    and status <> 'canceled' and asaas_subscription_id is null;

  update public.access_codes set used_by = v_uid, used_at = now() where id = v_row.id;
  return v_row.community_id;
end;
$fn$;

revoke all on function public.create_access_code(uuid, text) from public;
revoke all on function public.revoke_access_code(uuid) from public;
revoke all on function public.redeem_access_code(text) from public;
grant execute on function public.create_access_code(uuid, text) to authenticated;
grant execute on function public.revoke_access_code(uuid) to authenticated;
grant execute on function public.redeem_access_code(text) to authenticated;

commit;

-- rollback:
--   drop function public.redeem_access_code(text); drop function public.revoke_access_code(uuid);
--   drop function public.create_access_code(uuid, text); drop table public.access_codes;
--   (acessos já liberados por código ficam: apagar à mão em member_package_access se for o caso)
