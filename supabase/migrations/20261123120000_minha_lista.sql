-- =====================================================================
-- Minha Lista (listas de compras), plano avulso de R$ 4,90/mês, incluído no
-- Círcula Premium.
--  • Acesso de criar lista: pacote 'minha_lista' ou 'premium' na comunidade
--    (member_package_access, o mesmo sistema dos demais planos) ou ser a
--    dona da comunidade. Quem já tem listas e deixa de assinar continua
--    vendo e baixando o que criou; só não cria novas.
--  • Cada lista é da dona (owner_id). Compartilhar dá a outra participante
--    da mesma comunidade o direito de ver ('view') ou editar ('edit').
--  • Nenhum dado clínico entra aqui: a nutricionista cria a lista dela e a
--    compartilha com a paciente (que já é participante), sem copiar cadastro.
-- Não mexe em assinaturas já contratadas: só amplia as listas de chaves
-- permitidas (package e plan_key).
-- =====================================================================
begin;

-- Novos valores permitidos ------------------------------------------------
alter table public.member_package_access
  drop constraint if exists member_package_access_package_check;
alter table public.member_package_access
  add constraint member_package_access_package_check check (
    package in ('help_nutri', 'ebooks', 'total', 'respiracao', 'playlist', 'wellness', 'leitura', 'premium', 'magazine', 'receitas', 'minha_lista')
  );

alter table public.addon_subscriptions
  drop constraint if exists addon_subscriptions_plan_key_check;
alter table public.addon_subscriptions
  add constraint addon_subscriptions_plan_key_check check (plan_key in (
    'magazine', 'receitas', 'ebooks', 'help_nutri', 'respiracao', 'playlist', 'wellness', 'leitura', 'minha_lista', 'premium'
  ));

-- Tabelas -------------------------------------------------------------------
create table if not exists public.shopping_lists (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  owner_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 120),
  description   text check (description is null or char_length(description) <= 600),
  planned_for   date,
  notes         text check (notes is null or char_length(notes) <= 2000),
  status        text not null default 'em_andamento' check (status in ('em_andamento', 'concluida', 'arquivada')),
  source        text not null default 'manual' check (source in ('manual', 'receitas', 'nutricionista', 'duplicada')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  completed_at  timestamptz
);
create index if not exists shopping_lists_owner_idx on public.shopping_lists (owner_id, status, created_at desc);
create index if not exists shopping_lists_community_idx on public.shopping_lists (community_id);

create table if not exists public.shopping_list_items (
  id                 uuid primary key default gen_random_uuid(),
  list_id            uuid not null references public.shopping_lists (id) on delete cascade,
  name               text not null check (char_length(name) between 1 and 160),
  category           text not null default 'outros' check (category in (
    'frutas', 'verduras_legumes', 'carnes_aves', 'peixes', 'ovos_laticinios', 'graos_cereais', 'massas_farinhas',
    'temperos', 'oleaginosas_sementes', 'bebidas', 'naturais', 'congelados', 'despensa', 'outros'
  )),
  quantity           numeric(10, 3) not null default 1 check (quantity >= 0 and quantity <= 100000),
  unit               text not null default 'un' check (unit in ('un', 'kg', 'g', 'l', 'ml', 'pacote', 'caixa', 'bandeja', 'duzia', 'pote')),
  est_price_cents    integer check (est_price_cents is null or (est_price_cents >= 0 and est_price_cents <= 100000000)),
  paid_price_cents   integer check (paid_price_cents is null or (paid_price_cents >= 0 and paid_price_cents <= 100000000)),
  notes              text check (notes is null or char_length(notes) <= 400),
  bought             boolean not null default false,
  bought_at          timestamptz,
  position           integer not null default 0,
  source_recipe_id   uuid references public.community_content (id) on delete set null,
  source_recipe_title text check (source_recipe_title is null or char_length(source_recipe_title) <= 200),
  created_at         timestamptz not null default now()
);
create index if not exists shopping_list_items_list_idx on public.shopping_list_items (list_id, category, position);

create table if not exists public.shopping_list_recipes (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references public.shopping_lists (id) on delete cascade,
  recipe_id   uuid not null references public.community_content (id) on delete cascade,
  portions    numeric(6, 2) not null default 1 check (portions > 0 and portions <= 1000),
  added_at    timestamptz not null default now(),
  unique (list_id, recipe_id)
);

create table if not exists public.shopping_list_shares (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references public.shopping_lists (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  permission  text not null default 'view' check (permission in ('view', 'edit')),
  created_by  uuid default auth.uid() references public.profiles (id),
  created_at  timestamptz not null default now(),
  unique (list_id, profile_id)
);
create index if not exists shopping_list_shares_profile_idx on public.shopping_list_shares (profile_id);

-- Funções de apoio (security definer: evitam recursão entre as políticas) ---
create or replace function public.has_minha_lista(p_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select auth.uid() is not null and (
    public.owns_community(p_community_id)
    or exists (
      select 1 from public.member_package_access a
      where a.community_id = p_community_id
        and a.profile_id = auth.uid()
        and a.package in ('minha_lista', 'premium')
    )
  );
$$;

create or replace function public.shopping_is_owner(p_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (select 1 from public.shopping_lists l where l.id = p_list_id and l.owner_id = auth.uid());
$$;

create or replace function public.shopping_can_access(p_list_id uuid, p_need_edit boolean)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select auth.uid() is not null and (
    exists (select 1 from public.shopping_lists l where l.id = p_list_id and l.owner_id = auth.uid())
    or exists (
      select 1 from public.shopping_list_shares s
      where s.list_id = p_list_id
        and s.profile_id = auth.uid()
        and (not p_need_edit or s.permission = 'edit')
    )
  );
$$;

revoke all on function public.has_minha_lista(uuid) from public, anon;
revoke all on function public.shopping_is_owner(uuid) from public, anon;
revoke all on function public.shopping_can_access(uuid, boolean) from public, anon;
grant execute on function public.has_minha_lista(uuid) to authenticated;
grant execute on function public.shopping_is_owner(uuid) to authenticated;
grant execute on function public.shopping_can_access(uuid, boolean) to authenticated;

-- Só se compartilha com participante ativa da mesma comunidade (ou a dona).
create or replace function public.shopping_share_check()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_community uuid;
begin
  select community_id into v_community from public.shopping_lists where id = new.list_id;
  if v_community is null then
    raise exception 'lista inexistente' using errcode = '23514';
  end if;
  if not (
    exists (select 1 from public.community_members m where m.community_id = v_community and m.profile_id = new.profile_id and m.status = 'active')
    or exists (select 1 from public.communities c where c.id = v_community and c.owner_id = new.profile_id)
  ) then
    raise exception 'só dá para compartilhar com participantes da comunidade' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists shopping_list_shares_check on public.shopping_list_shares;
create trigger shopping_list_shares_check before insert or update on public.shopping_list_shares
  for each row execute function public.shopping_share_check();

-- RLS ---------------------------------------------------------------------------
alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;
alter table public.shopping_list_recipes enable row level security;
alter table public.shopping_list_shares enable row level security;

drop policy if exists "shopping_lists_select" on public.shopping_lists;
create policy "shopping_lists_select" on public.shopping_lists for select to authenticated
  using (public.shopping_can_access(id, false));

drop policy if exists "shopping_lists_insert" on public.shopping_lists;
create policy "shopping_lists_insert" on public.shopping_lists for insert to authenticated
  with check (owner_id = auth.uid() and public.has_minha_lista(community_id));

drop policy if exists "shopping_lists_update" on public.shopping_lists;
create policy "shopping_lists_update" on public.shopping_lists for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "shopping_lists_delete" on public.shopping_lists;
create policy "shopping_lists_delete" on public.shopping_lists for delete to authenticated
  using (owner_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['shopping_list_items', 'shopping_list_recipes'] loop
    execute format('drop policy if exists "%1$s_select" on public.%1$I', t);
    execute format('create policy "%1$s_select" on public.%1$I for select to authenticated using (public.shopping_can_access(list_id, false))', t);
    execute format('drop policy if exists "%1$s_insert" on public.%1$I', t);
    execute format('create policy "%1$s_insert" on public.%1$I for insert to authenticated with check (public.shopping_can_access(list_id, true))', t);
    execute format('drop policy if exists "%1$s_update" on public.%1$I', t);
    execute format('create policy "%1$s_update" on public.%1$I for update to authenticated using (public.shopping_can_access(list_id, true)) with check (public.shopping_can_access(list_id, true))', t);
    execute format('drop policy if exists "%1$s_delete" on public.%1$I', t);
    execute format('create policy "%1$s_delete" on public.%1$I for delete to authenticated using (public.shopping_can_access(list_id, true))', t);
  end loop;
end $$;

drop policy if exists "shopping_list_shares_select" on public.shopping_list_shares;
create policy "shopping_list_shares_select" on public.shopping_list_shares for select to authenticated
  using (profile_id = auth.uid() or public.shopping_is_owner(list_id));

drop policy if exists "shopping_list_shares_insert" on public.shopping_list_shares;
create policy "shopping_list_shares_insert" on public.shopping_list_shares for insert to authenticated
  with check (public.shopping_is_owner(list_id));

drop policy if exists "shopping_list_shares_update" on public.shopping_list_shares;
create policy "shopping_list_shares_update" on public.shopping_list_shares for update to authenticated
  using (public.shopping_is_owner(list_id)) with check (public.shopping_is_owner(list_id));

drop policy if exists "shopping_list_shares_delete" on public.shopping_list_shares;
create policy "shopping_list_shares_delete" on public.shopping_list_shares for delete to authenticated
  using (public.shopping_is_owner(list_id) or profile_id = auth.uid());

revoke all on table public.shopping_lists, public.shopping_list_items, public.shopping_list_recipes, public.shopping_list_shares from public, anon;
grant select, insert, update, delete on table public.shopping_lists, public.shopping_list_items, public.shopping_list_recipes, public.shopping_list_shares to authenticated;

commit;

-- Para desfazer (não mexe em assinaturas):
-- begin;
-- drop table if exists public.shopping_list_shares, public.shopping_list_recipes, public.shopping_list_items, public.shopping_lists;
-- drop function if exists public.shopping_share_check(), public.shopping_can_access(uuid, boolean), public.shopping_is_owner(uuid), public.has_minha_lista(uuid);
-- commit;
