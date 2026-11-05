-- Receitas em biblioteca por categorias (Sem Gluten, Sem Lactose, Saladas...)
-- + visualizacoes por receita (cada participante conta uma vez).
-- Rollback manual:
--   alter table public.community_content drop column if exists category_id;
--   drop table if exists public.content_views; drop table if exists public.recipe_categories;

create table if not exists public.recipe_categories (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  description text,
  cover_path text,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists recipe_categories_community_idx on public.recipe_categories(community_id, position);

alter table public.community_content
  add column if not exists category_id uuid references public.recipe_categories(id) on delete set null;

create table if not exists public.content_views (
  content_id uuid not null references public.community_content(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (content_id, profile_id)
);
create index if not exists content_views_content_idx on public.content_views(content_id);

alter table public.recipe_categories enable row level security;
alter table public.content_views enable row level security;

drop policy if exists "recipe_categories_select" on public.recipe_categories;
create policy "recipe_categories_select" on public.recipe_categories for select to public
  using (public.is_master() or public.owns_community(community_id) or public.is_community_member(community_id));

drop policy if exists "recipe_categories_write" on public.recipe_categories;
create policy "recipe_categories_write" on public.recipe_categories for all to public
  using (public.owns_community(community_id))
  with check (public.owns_community(community_id));

drop policy if exists "content_views_select" on public.content_views;
create policy "content_views_select" on public.content_views for select to public
  using (public.is_master() or public.owns_community(community_id) or profile_id = auth.uid());

drop policy if exists "content_views_insert" on public.content_views;
create policy "content_views_insert" on public.content_views for insert to public
  with check (profile_id = auth.uid() and public.is_community_member(community_id));

grant select, insert, update, delete on table public.recipe_categories to authenticated;
grant select, insert on table public.content_views to authenticated;
