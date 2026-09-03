-- =====================================================================
-- Etapa "plataforma completa" — Módulo 1: EVENTOS
-- =====================================================================
-- Sistema de eventos comunitários. Duas tabelas novas, nenhuma tabela
-- existente alterada.
--
--   public.community_events     — o evento (dono = anfitriã da comunidade)
--   public.event_participants   — RSVP (1 linha por confirmação, igual
--                                 ao padrão de circle_members)
--
-- Funções de apoio (SECURITY DEFINER, search_path fixo), no mesmo
-- molde de can_view_challenge / can_participate_in_challenge /
-- circle_member_count:
--   can_view_event(uuid)          — master OU dona OU membro da comunidade
--   can_participate_in_event(uuid)— dona OU membro (não master)
--   event_participant_count(uuid) — contagem confiável de confirmados
--
-- Idempotente: create table if not exists / create index if not exists /
-- create or replace / drop policy if exists + create policy.
-- GRANT DML explícito para authenticated (tabela criada fora do Studio
-- não recebe GRANT automático — mesmo "infra gotcha" já registrado).
-- =====================================================================

begin;

-- ---- tabela: community_events ------------------------------------
create table if not exists public.community_events (
  id              uuid not null default gen_random_uuid(),
  community_id    uuid not null,
  circle_id       uuid,
  created_by      uuid not null,
  title           text not null,
  description     text,
  cover_image_url text,
  starts_at       timestamptz not null,
  ends_at         timestamptz,
  is_online       boolean not null default false,
  location        text,
  online_url      text,
  capacity        integer,
  status          text not null default 'published',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint community_events_pkey primary key (id),
  constraint community_events_status_check check (
    status = any (array['draft'::text, 'published'::text, 'cancelled'::text])
  ),
  constraint community_events_capacity_check check (capacity is null or capacity > 0),
  constraint community_events_ends_after_starts check (ends_at is null or ends_at >= starts_at),
  constraint community_events_community_id_fkey foreign key (community_id)
    references public.communities (id) on delete cascade,
  constraint community_events_circle_id_fkey foreign key (circle_id)
    references public.community_circles (id) on delete set null,
  constraint community_events_created_by_fkey foreign key (created_by)
    references public.profiles (id) on delete cascade
);

create index if not exists community_events_community_id_starts_at_idx
  on public.community_events using btree (community_id, starts_at);
create index if not exists community_events_circle_id_idx
  on public.community_events using btree (circle_id);

create or replace trigger set_community_events_updated_at
  before update on public.community_events
  for each row execute function public.set_updated_at();

-- ---- tabela: event_participants --------------------------------
create table if not exists public.event_participants (
  id         uuid not null default gen_random_uuid(),
  event_id   uuid not null,
  profile_id uuid not null,
  joined_at  timestamptz not null default now(),
  constraint event_participants_pkey primary key (id),
  constraint event_participants_event_id_profile_id_key unique (event_id, profile_id),
  constraint event_participants_event_id_fkey foreign key (event_id)
    references public.community_events (id) on delete cascade,
  constraint event_participants_profile_id_fkey foreign key (profile_id)
    references public.profiles (id) on delete cascade
);

create index if not exists event_participants_event_id_idx
  on public.event_participants using btree (event_id);
create index if not exists event_participants_profile_id_idx
  on public.event_participants using btree (profile_id);

-- ---- funções de apoio ----------------------------------------
create or replace function public.can_view_event(p_event_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.community_events e
    where e.id = p_event_id
      and (
        public.is_master()
        or public.owns_community(e.community_id)
        or public.is_community_member(e.community_id)
      )
  );
$function$;

create or replace function public.can_participate_in_event(p_event_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.community_events e
    where e.id = p_event_id
      and e.status = 'published'
      and (public.owns_community(e.community_id) or public.is_community_member(e.community_id))
  );
$function$;

create or replace function public.event_participant_count(p_event_id uuid)
 returns integer
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select count(*)::int from public.event_participants where event_id = p_event_id;
$function$;

-- ---- RLS: community_events ----------------------------------
alter table public.community_events enable row level security;

drop policy if exists "community_events_select" on public.community_events;
create policy "community_events_select"
  on public.community_events for select to public
  using (
    public.is_master()
    or public.owns_community(community_id)
    or (public.is_community_member(community_id) and status <> 'draft')
  );

drop policy if exists "community_events_insert" on public.community_events;
create policy "community_events_insert"
  on public.community_events for insert to public
  with check (
    public.owns_community(community_id)
    and created_by = auth.uid()
  );

drop policy if exists "community_events_update" on public.community_events;
create policy "community_events_update"
  on public.community_events for update to public
  using (public.owns_community(community_id))
  with check (public.owns_community(community_id));

drop policy if exists "community_events_delete" on public.community_events;
create policy "community_events_delete"
  on public.community_events for delete to public
  using (public.owns_community(community_id));

-- ---- RLS: event_participants ------------------------------
alter table public.event_participants enable row level security;

drop policy if exists "event_participants_select" on public.event_participants;
create policy "event_participants_select"
  on public.event_participants for select to public
  using (public.can_view_event(event_id));

-- Confirmar presença: só a própria pessoa, só em evento que ela pode
-- participar, respeitando o limite de vagas quando houver.
drop policy if exists "event_participants_insert" on public.event_participants;
create policy "event_participants_insert"
  on public.event_participants for insert to public
  with check (
    profile_id = auth.uid()
    and public.can_participate_in_event(event_id)
    and (
      (select capacity from public.community_events where id = event_id) is null
      or public.event_participant_count(event_id)
         < (select capacity from public.community_events where id = event_id)
    )
  );

-- Cancelar presença: a própria pessoa, ou a anfitriã da comunidade.
drop policy if exists "event_participants_delete" on public.event_participants;
create policy "event_participants_delete"
  on public.event_participants for delete to public
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.community_events e
      where e.id = event_id and public.owns_community(e.community_id)
    )
  );

-- ---- GRANT (DML explícito para authenticated) --------------
grant select, insert, update, delete on table public.community_events to authenticated;
grant select, insert, delete on table public.event_participants to authenticated;

commit;
