-- =====================================================================
-- Rodada 2026-11-14 — pedidos do usuário (conversa de 14/11)
-- =====================================================================
--  1. product_categories + products.category_id — Loja por categorias.
--  2. wellness_sessions.cover_image_url + wellness_session_pages —
--     banner e páginas (imagens) de cada respiração.
--  3. community_playlists — um cartão por playlist, com botão do Spotify.
--  4. profile_testimonials — depoimento de uma membro para outra.
--  5. profiles.birth_city / birth_date — cadastro (cidade atual já é `city`).
--  6. weight_entries — histórico de peso (só a própria pessoa lê/escreve).
--  7. item_views — visualizações de revista, e-book, receita e cliques
--     em parceiros; a dona lê os números.
--  8. community_engagement_ranking() — top 10 de quem mais interage.
--
-- Aditiva, idempotente e transacional. Não toca em cobrança nem em auth.
-- Rollback no rodapé.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Categorias da Loja
-- ---------------------------------------------------------------------
create table if not exists public.product_categories (
  id              uuid primary key default gen_random_uuid(),
  community_id    uuid not null references public.communities (id) on delete cascade,
  title           text not null check (char_length(btrim(title)) between 1 and 80),
  cover_image_url text,
  position        integer not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists product_categories_community_idx
  on public.product_categories (community_id, position);

alter table public.product_categories enable row level security;

drop policy if exists "product_categories_select" on public.product_categories;
create policy "product_categories_select" on public.product_categories for select to authenticated
  using (public.is_master() or public.owns_community(community_id) or public.is_community_member(community_id));

drop policy if exists "product_categories_write" on public.product_categories;
create policy "product_categories_write" on public.product_categories for all to authenticated
  using (public.owns_community(community_id))
  with check (public.owns_community(community_id));

revoke all on table public.product_categories from public, anon;
grant select, insert, update, delete on table public.product_categories to authenticated;

alter table public.products
  add column if not exists category_id uuid references public.product_categories (id) on delete set null;
create index if not exists products_category_idx on public.products (category_id);

-- ---------------------------------------------------------------------
-- 2. Respiração: banner e páginas
-- ---------------------------------------------------------------------
alter table public.wellness_sessions add column if not exists cover_image_url text;

create table if not exists public.wellness_session_pages (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.wellness_sessions (id) on delete cascade,
  community_id  uuid not null references public.communities (id) on delete cascade,
  position      integer not null default 0,
  image_path    text not null check (length(btrim(image_path)) > 0),
  created_at    timestamptz not null default now()
);
create index if not exists wellness_session_pages_idx
  on public.wellness_session_pages (session_id, position);

alter table public.wellness_session_pages enable row level security;

drop policy if exists "wellness_session_pages_select" on public.wellness_session_pages;
create policy "wellness_session_pages_select" on public.wellness_session_pages for select to authenticated
  using (
    public.is_master()
    or public.owns_community(community_id)
    or (
      public.is_community_member(community_id)
      and exists (
        select 1 from public.wellness_sessions s
        where s.id = wellness_session_pages.session_id and s.status = 'published'
      )
    )
  );

drop policy if exists "wellness_session_pages_write" on public.wellness_session_pages;
create policy "wellness_session_pages_write" on public.wellness_session_pages for all to authenticated
  using (public.owns_community(community_id))
  with check (
    public.owns_community(community_id)
    and exists (
      select 1 from public.wellness_sessions s
      where s.id = wellness_session_pages.session_id and s.community_id = wellness_session_pages.community_id
    )
  );

revoke all on table public.wellness_session_pages from public, anon;
grant select, insert, update, delete on table public.wellness_session_pages to authenticated;

-- ---------------------------------------------------------------------
-- 3. Playlists
-- ---------------------------------------------------------------------
create table if not exists public.community_playlists (
  id              uuid primary key default gen_random_uuid(),
  community_id    uuid not null references public.communities (id) on delete cascade,
  title           text not null check (char_length(btrim(title)) between 1 and 120),
  description     text check (description is null or char_length(description) <= 600),
  cover_image_url text,
  spotify_url     text not null check (spotify_url ~ '^https://'),
  position        integer not null default 0,
  status          text not null default 'published' check (status in ('draft', 'published')),
  created_by      uuid not null default auth.uid() references public.profiles (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists community_playlists_idx on public.community_playlists (community_id, position);

alter table public.community_playlists enable row level security;

drop policy if exists "community_playlists_select" on public.community_playlists;
create policy "community_playlists_select" on public.community_playlists for select to authenticated
  using (
    public.is_master()
    or public.owns_community(community_id)
    or (status = 'published' and public.is_community_member(community_id))
  );

drop policy if exists "community_playlists_write" on public.community_playlists;
create policy "community_playlists_write" on public.community_playlists for all to authenticated
  using (public.owns_community(community_id))
  with check (public.owns_community(community_id));

revoke all on table public.community_playlists from public, anon;
grant select, insert, update, delete on table public.community_playlists to authenticated;

-- ---------------------------------------------------------------------
-- 4. Depoimentos entre membros
-- ---------------------------------------------------------------------
create table if not exists public.profile_testimonials (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  author_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  content       text not null check (char_length(btrim(content)) between 1 and 600),
  created_at    timestamptz not null default now(),
  constraint profile_testimonials_not_self check (profile_id <> author_id),
  constraint profile_testimonials_unique unique (community_id, profile_id, author_id)
);
create index if not exists profile_testimonials_profile_idx
  on public.profile_testimonials (profile_id, created_at desc);

alter table public.profile_testimonials enable row level security;

drop policy if exists "profile_testimonials_select" on public.profile_testimonials;
create policy "profile_testimonials_select" on public.profile_testimonials for select to authenticated
  using (public.is_master() or public.owns_community(community_id) or public.is_community_member(community_id));

-- Quem escreve precisa ser da comunidade (membro ou dona), e quem recebe também.
drop policy if exists "profile_testimonials_insert" on public.profile_testimonials;
create policy "profile_testimonials_insert" on public.profile_testimonials for insert to authenticated
  with check (
    author_id = auth.uid()
    and (public.is_community_member(community_id) or public.owns_community(community_id))
    and (
      exists (
        select 1 from public.community_members cm
        where cm.community_id = profile_testimonials.community_id
          and cm.profile_id = profile_testimonials.profile_id
          and cm.status = 'active'
      )
      or exists (
        select 1 from public.communities c
        where c.id = profile_testimonials.community_id and c.owner_id = profile_testimonials.profile_id
      )
    )
  );

-- Apaga: quem escreveu, quem recebeu (pode tirar da própria capa) ou a dona.
drop policy if exists "profile_testimonials_delete" on public.profile_testimonials;
create policy "profile_testimonials_delete" on public.profile_testimonials for delete to authenticated
  using (author_id = auth.uid() or profile_id = auth.uid() or public.owns_community(community_id));

revoke all on table public.profile_testimonials from public, anon;
grant select, insert, delete on table public.profile_testimonials to authenticated;

-- ---------------------------------------------------------------------
-- 5. Cadastro: cidade onde nasceu e aniversário
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists birth_city text
  check (birth_city is null or char_length(birth_city) <= 120);
alter table public.profiles add column if not exists birth_date date;

-- ---------------------------------------------------------------------
-- 6. Histórico de peso (dado de saúde: só a própria pessoa)
-- ---------------------------------------------------------------------
create table if not exists public.weight_entries (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  weight_kg    numeric(5, 2) not null check (weight_kg between 20 and 400),
  measured_on  date not null default current_date,
  created_at   timestamptz not null default now(),
  constraint weight_entries_one_per_day unique (profile_id, measured_on)
);

alter table public.weight_entries enable row level security;

drop policy if exists "weight_entries_own" on public.weight_entries;
create policy "weight_entries_own" on public.weight_entries for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

revoke all on table public.weight_entries from public, anon;
grant select, insert, update, delete on table public.weight_entries to authenticated;

-- ---------------------------------------------------------------------
-- 7. Visualizações e cliques
-- ---------------------------------------------------------------------
create table if not exists public.item_views (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  profile_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind          text not null check (kind in ('magazine', 'ebook', 'recipe', 'partner_click')),
  item_id       uuid not null,
  created_at    timestamptz not null default now()
);
create index if not exists item_views_item_idx on public.item_views (community_id, kind, item_id);
create index if not exists item_views_created_idx on public.item_views (community_id, created_at desc);

alter table public.item_views enable row level security;

drop policy if exists "item_views_insert" on public.item_views;
create policy "item_views_insert" on public.item_views for insert to authenticated
  with check (profile_id = auth.uid() and public.is_community_member(community_id));

drop policy if exists "item_views_select" on public.item_views;
create policy "item_views_select" on public.item_views for select to authenticated
  using (public.is_master() or public.owns_community(community_id));

revoke all on table public.item_views from public, anon;
grant select, insert on table public.item_views to authenticated;

-- Totais por item (a dona lê; a agregação fica no banco, não no navegador).
create or replace function public.item_view_totals(p_community_id uuid)
returns table (kind text, item_id uuid, views bigint, viewers bigint)
language sql
stable
security definer
set search_path = public
as $$
  select v.kind, v.item_id, count(*)::bigint, count(distinct v.profile_id)::bigint
  from public.item_views v
  where v.community_id = p_community_id
    and (public.owns_community(p_community_id) or public.is_master())
  group by v.kind, v.item_id;
$$;

revoke all on function public.item_view_totals(uuid) from public, anon;
grant execute on function public.item_view_totals(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 8. Ranking: quem mais interage (últimos 30 dias)
-- ---------------------------------------------------------------------
create or replace function public.community_engagement_ranking(p_community_id uuid, p_days integer default 30)
returns table (
  profile_id uuid,
  full_name text,
  avatar_url text,
  posts bigint,
  comments bigint,
  reactions bigint,
  garden_checks bigint,
  score bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with allowed as (
    select (public.owns_community(p_community_id) or public.is_master()) as ok
  ),
  since as (
    select now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365))) as t
  ),
  members as (
    select cm.profile_id
    from public.community_members cm
    where cm.community_id = p_community_id and cm.status = 'active'
  ),
  p as (
    select author_id as pid, count(*) as n
    from public.posts, since
    where community_id = p_community_id and created_at >= since.t and hidden_at is null
      and post_type not in ('daily_question', 'engagement_command', 'garden_daily')
    group by author_id
  ),
  c as (
    select pc.author_id as pid, count(*) as n
    from public.post_comments pc
    join public.posts po on po.id = pc.post_id, since
    where po.community_id = p_community_id and pc.created_at >= since.t
    group by pc.author_id
  ),
  r as (
    select pr.profile_id as pid, count(*) as n
    from public.post_reactions pr
    join public.posts po on po.id = pr.post_id, since
    where po.community_id = p_community_id and pr.created_at >= since.t
    group by pr.profile_id
  ),
  g as (
    select gc.profile_id as pid, count(*) as n
    from public.garden_checks gc, since
    where gc.community_id = p_community_id and gc.checked_at >= since.t
    group by gc.profile_id
  )
  select
    m.profile_id,
    pf.full_name,
    pf.avatar_url,
    coalesce(p.n, 0)::bigint,
    coalesce(c.n, 0)::bigint,
    coalesce(r.n, 0)::bigint,
    coalesce(g.n, 0)::bigint,
    (coalesce(p.n, 0) * 3 + coalesce(c.n, 0) * 2 + coalesce(r.n, 0) + coalesce(g.n, 0) * 2)::bigint as score
  from members m
  join public.profiles pf on pf.id = m.profile_id
  left join p on p.pid = m.profile_id
  left join c on c.pid = m.profile_id
  left join r on r.pid = m.profile_id
  left join g on g.pid = m.profile_id
  cross join allowed
  where allowed.ok
    and (coalesce(p.n, 0) + coalesce(c.n, 0) + coalesce(r.n, 0) + coalesce(g.n, 0)) > 0
  order by score desc, pf.full_name asc
  limit 10;
$$;

revoke all on function public.community_engagement_ranking(uuid, integer) from public, anon;
grant execute on function public.community_engagement_ranking(uuid, integer) to authenticated;

commit;

-- ---- Rollback (manual) ------------------------------------------------
-- begin;
-- drop function if exists public.community_engagement_ranking(uuid, integer);
-- drop function if exists public.item_view_totals(uuid);
-- drop table if exists public.item_views;
-- drop table if exists public.weight_entries;
-- alter table public.profiles drop column if exists birth_date, drop column if exists birth_city;
-- drop table if exists public.profile_testimonials;
-- drop table if exists public.community_playlists;
-- drop table if exists public.wellness_session_pages;
-- alter table public.wellness_sessions drop column if exists cover_image_url;
-- alter table public.products drop column if exists category_id;
-- drop table if exists public.product_categories;
-- commit;
