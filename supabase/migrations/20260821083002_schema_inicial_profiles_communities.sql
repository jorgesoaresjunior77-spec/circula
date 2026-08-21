-- Etapa 2: schema inicial (profiles, communities, community_members)
-- MVP: Marluce (professional) administra somente "Fluir & Florescer".
-- Preparado para múltiplas profissionais/comunidades no futuro.

-- ============================================================
-- Extensões
-- ============================================================
create extension if not exists "pgcrypto";

-- ============================================================
-- Enums
-- ============================================================
create type public.user_role as enum ('master', 'professional', 'member');
create type public.membership_status as enum ('active', 'pending', 'blocked');

-- ============================================================
-- Tabelas
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'member',
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  -- UNIQUE em owner_id: trava "1 comunidade por profissional" no MVP.
  -- Para liberar múltiplas comunidades no futuro, basta remover esta constraint.
  owner_id uuid not null unique references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.community_members (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status public.membership_status not null default 'active',
  joined_at timestamptz not null default now(),
  unique (community_id, profile_id)
);

create index communities_owner_id_idx on public.communities (owner_id);
create index community_members_community_id_idx on public.community_members (community_id);
create index community_members_profile_id_idx on public.community_members (profile_id);

-- ============================================================
-- updated_at automático
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_communities_updated_at
before update on public.communities
for each row execute function public.set_updated_at();

-- ============================================================
-- Cria profile automaticamente ao registrar em auth.users
-- (não guardamos senha; profiles só espelha metadados)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============================================================
-- Funções auxiliares para RLS (security definer evita
-- recursão de policies entre tabelas)
-- ============================================================
create or replace function public.is_master()
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'master'
  );
$$;

create or replace function public.is_professional()
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'professional'
  );
$$;

create or replace function public.owns_community(p_community_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.communities
    where id = p_community_id and owner_id = auth.uid()
  );
$$;

create or replace function public.is_community_member(p_community_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.community_members
    where community_id = p_community_id
      and profile_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.community_owner_of_profile(p_profile_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  -- true se o chamador (professional) é dono de uma comunidade
  -- da qual p_profile_id é membro
  select exists (
    select 1
    from public.community_members cm
    join public.communities c on c.id = cm.community_id
    where cm.profile_id = p_profile_id and c.owner_id = auth.uid()
  );
$$;

-- ============================================================
-- Impede que role seja alterado por quem não é master
-- ============================================================
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role <> old.role and not public.is_master() then
    new.role = old.role;
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_escalation
before update on public.profiles
for each row execute function public.prevent_role_escalation();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;

-- profiles ----------------------------------------------------
create policy "profiles_select"
on public.profiles for select
using (
  id = auth.uid()
  or public.is_master()
  or public.community_owner_of_profile(id)
);

create policy "profiles_update"
on public.profiles for update
using (id = auth.uid() or public.is_master())
with check (id = auth.uid() or public.is_master());

-- sem policy de insert: profiles é criado só pela trigger
-- handle_new_user (security definer), nunca direto pelo cliente.

-- communities ---------------------------------------------------
create policy "communities_select"
on public.communities for select
using (
  public.is_master()
  or owner_id = auth.uid()
  or public.is_community_member(id)
);

create policy "communities_insert"
on public.communities for insert
with check (owner_id = auth.uid() and public.is_professional());

create policy "communities_update"
on public.communities for update
using (public.is_master() or owner_id = auth.uid())
with check (public.is_master() or owner_id = auth.uid());

create policy "communities_delete"
on public.communities for delete
using (public.is_master());

-- community_members ----------------------------------------------
create policy "community_members_select"
on public.community_members for select
using (
  public.is_master()
  or profile_id = auth.uid()
  or public.owns_community(community_id)
);

create policy "community_members_insert"
on public.community_members for insert
with check (public.is_master() or public.owns_community(community_id));

create policy "community_members_update"
on public.community_members for update
using (public.is_master() or public.owns_community(community_id))
with check (public.is_master() or public.owns_community(community_id));

create policy "community_members_delete"
on public.community_members for delete
using (public.is_master() or public.owns_community(community_id));
