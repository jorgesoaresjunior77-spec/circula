-- Indicação Premium: quem tem o Círcula Premium convida e a convidada ganha 10%
-- a mais de desconto na PRIMEIRA assinatura do Premium dela.
--  • o convite leva o id de quem indicou (?ref=); join_community_by_invite grava
--    a indicação em `referrals` (só se quem indicou é membro ativa da comunidade);
--  • o desconto só vale se, NA HORA de assinar, quem indicou ainda tem o Premium;
--  • o servidor aplica o desconto e marca como usado (uma vez por convidada).
begin;

create table if not exists public.referrals (
  invitee_id       uuid primary key references public.profiles (id) on delete cascade,
  inviter_id       uuid not null references public.profiles (id) on delete cascade,
  community_id     uuid not null references public.communities (id) on delete cascade,
  created_at       timestamptz not null default now(),
  discount_used_at timestamptz,
  check (invitee_id <> inviter_id)
);
alter table public.referrals enable row level security;
drop policy if exists "referrals_select_own" on public.referrals;
create policy "referrals_select_own" on public.referrals for select to authenticated
  using (invitee_id = auth.uid() or inviter_id = auth.uid() or public.is_master());
revoke all on table public.referrals from public, anon, authenticated;
grant select on table public.referrals to authenticated;
grant select, insert, update, delete on table public.referrals to service_role;

drop function if exists public.join_community_by_invite(text);
create or replace function public.join_community_by_invite(p_token text, p_ref uuid default null)
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

  -- indicação: só vale se quem indicou é membro ativa desta comunidade
  if p_ref is not null and p_ref <> v_uid and exists (
    select 1 from public.community_members
    where community_id = v_community and profile_id = p_ref and status = 'active'
  ) then
    insert into public.referrals (invitee_id, inviter_id, community_id)
    values (v_uid, p_ref, v_community)
    on conflict (invitee_id) do nothing;
  end if;

  return v_community;
end;
$function$;
revoke all on function public.join_community_by_invite(text, uuid) from public, anon;
grant execute on function public.join_community_by_invite(text, uuid) to authenticated;

-- A convidada tem direito ao desconto agora? (para mostrar o preço na tela)
create or replace function public.my_referral_discount(p_community_id uuid)
 returns boolean
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select exists (
    select 1
    from public.referrals r
    join public.member_package_access a
      on a.profile_id = r.inviter_id and a.community_id = r.community_id and a.package = 'premium'
    where r.invitee_id = auth.uid()
      and r.community_id = p_community_id
      and r.discount_used_at is null
  );
$function$;
revoke all on function public.my_referral_discount(uuid) from public, anon;
grant execute on function public.my_referral_discount(uuid) to authenticated;

commit;
-- rollback: drop function my_referral_discount(uuid); drop table referrals;
--   e recriar join_community_by_invite(text) da migration 20261102120000.
