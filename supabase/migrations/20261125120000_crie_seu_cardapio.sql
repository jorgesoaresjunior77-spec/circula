-- =====================================================================
-- CRIE SEU CARDÁPIO — ficha da receita para o montador de cardápios
-- =====================================================================
-- A biblioteca de receitas continua sendo community_content (type='recipe').
-- Esta tabela só ACRESCENTA, por receita, os dados que o montador precisa e
-- que o texto livre não traz: tipo de prato, estilo, restrições verificadas,
-- alergênicos, tempo, dificuldade, rendimento e custo aproximado.
-- Aditiva: não altera nenhuma tabela existente. Receita sem ficha simplesmente
-- não entra nos cardápios.
-- Rollback manual: drop table if exists public.recipe_menu_meta;

create table if not exists public.recipe_menu_meta (
  content_id uuid primary key references public.community_content(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  course text not null check (course in (
    'bebida_boas_vindas', 'entrada', 'prato_principal', 'acompanhamento',
    'sobremesa', 'bebida_acompanhar', 'cafe_finalizacao'
  )),
  cuisines text[] not null default '{}',
  diets text[] not null default '{}',
  allergens text[] not null default '{}',
  allergens_verified boolean not null default false,
  prep_minutes int check (prep_minutes is null or prep_minutes > 0),
  difficulty text check (difficulty is null or difficulty in ('facil', 'intermediario', 'elaborado')),
  servings int check (servings is null or servings > 0),
  est_cost_cents int check (est_cost_cents is null or est_cost_cents >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists recipe_menu_meta_community_idx on public.recipe_menu_meta(community_id, course);

alter table public.recipe_menu_meta enable row level security;

drop policy if exists "recipe_menu_meta_select" on public.recipe_menu_meta;
create policy "recipe_menu_meta_select" on public.recipe_menu_meta for select to authenticated
  using (public.is_master() or public.owns_community(community_id) or public.is_community_member(community_id));

drop policy if exists "recipe_menu_meta_write" on public.recipe_menu_meta;
create policy "recipe_menu_meta_write" on public.recipe_menu_meta for all to authenticated
  using (public.owns_community(community_id))
  with check (public.owns_community(community_id));

revoke all on table public.recipe_menu_meta from anon, authenticated;
grant select, insert, update, delete on table public.recipe_menu_meta to authenticated;
grant select on table public.recipe_menu_meta to service_role;
