-- Quem se cadastra tem 21 dias para usar todas as ferramentas.
-- O teste de 21 dias já existe (create_community_trial); aqui ele passa a LIBERAR os conteúdos pagos
-- enquanto durar: has_package, has_minha_lista e car_has_access aceitam "em teste" como acesso.
-- Aditiva e reversível (rollback no fim).
begin;

-- A usuária autenticada está no teste grátis desta comunidade?
create or replace function public.in_community_trial(p_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.subject = 'community'
      and s.profile_id = auth.uid()
      and s.community_id = p_community_id
      and s.status = 'trial'
      and s.trial_ends_at > now()
  );
$$;
revoke all on function public.in_community_trial(uuid) from public, anon;
grant execute on function public.in_community_trial(uuid) to authenticated;

create or replace function public.has_package(p_community_id uuid, p_packages text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.in_community_trial(p_community_id)
      or exists (
        select 1
        from public.member_package_access a
        where a.community_id = p_community_id
          and a.profile_id = auth.uid()
          and a.package = any (p_packages)
      );
$$;
revoke all on function public.has_package(uuid, text[]) from public, anon;
grant execute on function public.has_package(uuid, text[]) to authenticated;

create or replace function public.has_minha_lista(p_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select auth.uid() is not null and (
    public.owns_community(p_community_id)
    or public.in_community_trial(p_community_id)
    or exists (
      select 1 from public.member_package_access a
      where a.community_id = p_community_id
        and a.profile_id = auth.uid()
        and a.package in ('minha_lista', 'premium')
    )
  );
$$;

create or replace function public.car_has_access()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.is_city_admin()
      or public.car_can_answer()
      or exists (select 1 from public.subscriptions s
                 where s.subject = 'community' and s.profile_id = auth.uid()
                   and s.status = 'trial' and s.trial_ends_at > now())
      or exists (select 1 from public.member_package_access where profile_id = auth.uid() and package in ('carro','premium'));
$$;
revoke all on function public.car_has_access() from public, anon;
grant execute on function public.car_has_access() to authenticated;

commit;
-- rollback: recriar has_package/has_minha_lista/car_has_access sem as linhas de teste e apagar in_community_trial.
