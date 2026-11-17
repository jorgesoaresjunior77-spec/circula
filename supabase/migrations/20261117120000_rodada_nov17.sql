-- =====================================================================
-- Rodada 2026-11-17
-- =====================================================================
--  1. content_schedule — agenda de conteúdos da profissional (quando
--     publicar evento, loja, receitas, revista, respiração, playlist,
--     dicas de leitura, wellness...).
--  2. profile_follows — seguir outra membro.
--  3. profile_visits + RPC my_profile_visit_totals — quantas visitas o
--     próprio perfil teve no dia, na semana e no mês.
--  4. member_package_access aceita os pacotes novos (respiração,
--     playlist, wellness e premium) e addon_subscriptions guarda as
--     assinaturas avulsas criadas no Asaas.
--
-- Aditiva, idempotente e transacional. Não mexe em auth nem nas
-- assinaturas existentes. Rollback no rodapé.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Agenda de conteúdos
-- ---------------------------------------------------------------------
create table if not exists public.content_schedule (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  content_type  text not null check (content_type in (
    'evento', 'loja', 'receitas', 'revista', 'respiracao', 'playlist', 'leitura', 'wellness', 'outro'
  )),
  title         text not null check (char_length(btrim(title)) between 1 and 160),
  notes         text check (notes is null or char_length(notes) <= 600),
  scheduled_on  date not null,
  done          boolean not null default false,
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists content_schedule_community_date_idx
  on public.content_schedule (community_id, scheduled_on);

alter table public.content_schedule enable row level security;

drop policy if exists "content_schedule_select" on public.content_schedule;
create policy "content_schedule_select" on public.content_schedule for select to authenticated
  using (public.owns_community(community_id));

drop policy if exists "content_schedule_insert" on public.content_schedule;
create policy "content_schedule_insert" on public.content_schedule for insert to authenticated
  with check (public.owns_community(community_id));

drop policy if exists "content_schedule_update" on public.content_schedule;
create policy "content_schedule_update" on public.content_schedule for update to authenticated
  using (public.owns_community(community_id))
  with check (public.owns_community(community_id));

drop policy if exists "content_schedule_delete" on public.content_schedule;
create policy "content_schedule_delete" on public.content_schedule for delete to authenticated
  using (public.owns_community(community_id));

revoke all on table public.content_schedule from public, anon;
grant select, insert, update, delete on table public.content_schedule to authenticated;

-- ---------------------------------------------------------------------
-- 2. Seguir membro
-- ---------------------------------------------------------------------
create table if not exists public.profile_follows (
  follower_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  followed_id  uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

create index if not exists profile_follows_followed_idx on public.profile_follows (followed_id);

alter table public.profile_follows enable row level security;

drop policy if exists "profile_follows_select" on public.profile_follows;
create policy "profile_follows_select" on public.profile_follows for select to authenticated
  using (
    follower_id = auth.uid()
    or followed_id = auth.uid()
    or public.shares_active_community(followed_id)
    or public.community_owner_of_profile(followed_id)
  );

drop policy if exists "profile_follows_insert" on public.profile_follows;
create policy "profile_follows_insert" on public.profile_follows for insert to authenticated
  with check (
    follower_id = auth.uid()
    and (public.shares_active_community(followed_id) or public.community_owner_of_profile(followed_id))
  );

drop policy if exists "profile_follows_delete" on public.profile_follows;
create policy "profile_follows_delete" on public.profile_follows for delete to authenticated
  using (follower_id = auth.uid());

revoke all on table public.profile_follows from public, anon;
grant select, insert, delete on table public.profile_follows to authenticated;

-- ---------------------------------------------------------------------
-- 3. Visitas ao perfil
-- ---------------------------------------------------------------------
-- Uma linha por visitante por dia (a mesma pessoa voltando no mesmo dia
-- conta uma vez). Só a dona do perfil lê os próprios números, pela RPC.
create table if not exists public.profile_visits (
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  visitor_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  visited_on  date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  created_at  timestamptz not null default now(),
  primary key (profile_id, visitor_id, visited_on),
  check (profile_id <> visitor_id)
);

alter table public.profile_visits enable row level security;

drop policy if exists "profile_visits_insert" on public.profile_visits;
create policy "profile_visits_insert" on public.profile_visits for insert to authenticated
  with check (
    visitor_id = auth.uid()
    and profile_id <> auth.uid()
    and (public.shares_active_community(profile_id) or public.community_owner_of_profile(profile_id))
  );

revoke all on table public.profile_visits from public, anon;
grant insert on table public.profile_visits to authenticated;

create or replace function public.my_profile_visit_totals()
returns table (today bigint, week bigint, month bigint)
language sql
stable
security definer
set search_path = public
as $$
  with d as (select (now() at time zone 'America/Sao_Paulo')::date as t)
  select
    count(*) filter (where v.visited_on = d.t),
    count(*) filter (where v.visited_on > d.t - 7),
    count(*) filter (where v.visited_on > d.t - 30)
  from d
  left join public.profile_visits v on v.profile_id = auth.uid()
$$;

revoke all on function public.my_profile_visit_totals() from public, anon;
grant execute on function public.my_profile_visit_totals() to authenticated;

-- ---------------------------------------------------------------------
-- 4. Pacotes avulsos novos + assinaturas avulsas (Asaas)
-- ---------------------------------------------------------------------
alter table public.member_package_access
  drop constraint if exists member_package_access_package_check;
alter table public.member_package_access
  add constraint member_package_access_package_check check (
    package in ('help_nutri', 'ebooks', 'total', 'respiracao', 'playlist', 'wellness', 'premium')
  );

create table if not exists public.addon_subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  profile_id             uuid not null references public.profiles (id) on delete cascade,
  community_id           uuid not null references public.communities (id) on delete cascade,
  plan_key               text not null check (plan_key in (
    'magazine', 'receitas', 'ebooks', 'help_nutri', 'respiracao', 'playlist', 'wellness', 'premium'
  )),
  billing_cycle          text not null check (billing_cycle in ('MONTHLY', 'SEMIANNUALLY', 'YEARLY')),
  price_cents            integer not null check (price_cents > 0),
  status                 text not null default 'pending' check (status in ('pending', 'active', 'past_due', 'canceled')),
  asaas_customer_id      text,
  asaas_subscription_id  text unique,
  current_period_end     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists addon_subscriptions_profile_idx
  on public.addon_subscriptions (profile_id, community_id);

alter table public.addon_subscriptions enable row level security;

-- Só leitura para a própria membro e para a dona; quem escreve é a Edge
-- Function (service role), nunca o navegador.
drop policy if exists "addon_subscriptions_select" on public.addon_subscriptions;
create policy "addon_subscriptions_select" on public.addon_subscriptions for select to authenticated
  using (profile_id = auth.uid() or public.owns_community(community_id) or public.is_master());

revoke all on table public.addon_subscriptions from public, anon;
grant select on table public.addon_subscriptions to authenticated;

commit;

-- ---- Rollback (manual) ------------------------------------------------
-- begin;
-- drop table if exists public.addon_subscriptions;
-- (recriar member_package_access_package_check só com help_nutri/ebooks/total)
-- drop function if exists public.my_profile_visit_totals();
-- drop table if exists public.profile_visits;
-- drop table if exists public.profile_follows;
-- drop table if exists public.content_schedule;
-- commit;
