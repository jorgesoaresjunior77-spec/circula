-- =====================================================================
-- Exercícios (assinatura avulsa) + base para Dicas de Séries/Filmes.
--  1) Pacotes novos: 'exercicios' e 'series_filmes' (member_package_access e
--     addon_subscriptions). O Círcula Premium continua valendo por todos.
--  2) product_price_overrides: preço mensal editável pelo Master (o servidor
--     lê aqui antes do valor do catálogo; sem linha, vale o catálogo).
--  3) exercise_articles (matérias) e exercise_items (biblioteca): a LEITURA da
--     participante exige o pacote no banco (RLS + has_package), não só na tela.
--     Conteúdo novo nasce como rascunho; só a dona publica.
--  4) exercise_preview(): apresentação antes da compra (sem o conteúdo).
--  5) Dados pessoais da usuária: favoritos, histórico, treinos montados,
--     execuções e programa semanal (só ela lê e grava).
--  6) Chaves de imagem dos banners: banner_exercicios, banner_series, banner_diario.
-- Aditiva, transacional e reversível (rollback no fim).
-- =====================================================================
begin;

-- ---- 1) pacotes --------------------------------------------------------
alter table public.member_package_access drop constraint if exists member_package_access_package_check;
alter table public.member_package_access add constraint member_package_access_package_check check (
  package in ('help_nutri','ebooks','total','respiracao','playlist','wellness','leitura','premium','magazine','receitas','minha_lista','meu_chef','lista_inteligente','exercicios','series_filmes')
);
alter table public.addon_subscriptions drop constraint if exists addon_subscriptions_plan_key_check;
alter table public.addon_subscriptions add constraint addon_subscriptions_plan_key_check check (plan_key in (
  'magazine','receitas','ebooks','help_nutri','respiracao','playlist','wellness','leitura','minha_lista','meu_chef','lista_inteligente','exercicios','series_filmes','premium'
));

-- ---- 2) preço editável --------------------------------------------------
create table if not exists public.product_price_overrides (
  plan_key text primary key check (plan_key in ('exercicios','series_filmes')),
  monthly_cents integer not null check (monthly_cents between 100 and 99900),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.product_price_overrides enable row level security;
drop policy if exists "price_overrides_read" on public.product_price_overrides;
create policy "price_overrides_read" on public.product_price_overrides for select to authenticated using (true);
drop policy if exists "price_overrides_master" on public.product_price_overrides;
create policy "price_overrides_master" on public.product_price_overrides for all to authenticated
  using (public.is_master()) with check (public.is_master());

-- ---- imagens dos banners ------------------------------------------------
alter table public.community_card_images drop constraint if exists community_card_images_card_key_check;
alter table public.community_card_images add constraint community_card_images_card_key_check check (
  card_key = any (array['hoje','desafios','eventos','comunidade','jornada','instagram','eventos_grande','jornada_grande','comunidade_grande','jardim','novo_circulo','revista_escritorio','ferramenta_calendario','ferramenta_agua','ferramenta_imc','menu_leitura','menu_respiracao','menu_planos','menu_playlist','loja_fundo','menu_wellness','menu_lista','banner_cardapio','banner_exercicios','banner_series','banner_diario']::text[])
);

-- ---- 3) conteúdo --------------------------------------------------------
create table if not exists public.exercise_articles (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text check (description is null or char_length(description) <= 400),
  category text check (category is null or char_length(category) <= 60),
  body text check (body is null or char_length(body) <= 20000),
  guidance text check (guidance is null or char_length(guidance) <= 4000),
  cover_path text,
  image_paths text[] not null default '{}' check (coalesce(array_length(image_paths, 1), 0) <= 12),
  status text not null default 'draft' check (status in ('draft','published')),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists exercise_articles_community_idx on public.exercise_articles (community_id, status, created_at desc);

create table if not exists public.exercise_items (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  slug text not null check (char_length(slug) between 1 and 80),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  categories text[] not null default '{}',
  goals text[] not null default '{}',
  level text not null default 'Iniciante' check (level in ('Iniciante','Intermediário')),
  mode text not null default 'reps' check (mode in ('reps','time')),
  target integer not null default 10 check (target between 1 and 600),
  sets integer not null default 3 check (sets between 1 and 10),
  rest_sec integer not null default 40 check (rest_sec between 0 and 300),
  pose_start text,
  pose_end text,
  description text check (description is null or char_length(description) <= 1500),
  steps text[] not null default '{}',
  muscles text[] not null default '{}',
  cautions text check (cautions is null or char_length(cautions) <= 1500),
  mistakes text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','published')),
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, slug)
);
create index if not exists exercise_items_community_idx on public.exercise_items (community_id, status);

create or replace function public.exercise_touch()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  new.updated_at := now();
  if tg_table_name = 'exercise_items' and new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.approved_by := auth.uid();
    new.approved_at := now();
  end if;
  return new;
end $$;
drop trigger if exists exercise_articles_touch on public.exercise_articles;
create trigger exercise_articles_touch before update on public.exercise_articles for each row execute function public.exercise_touch();
drop trigger if exists exercise_items_touch on public.exercise_items;
create trigger exercise_items_touch before insert or update on public.exercise_items for each row execute function public.exercise_touch();

do $$
declare t text;
begin
  foreach t in array array['exercise_articles','exercise_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_select" on public.%I', t, t);
    execute format($p$create policy "%s_select" on public.%I for select to authenticated using (
      public.is_master()
      or public.owns_community(community_id)
      or (status = 'published' and public.is_community_member(community_id)
          and public.has_package(community_id, array['exercicios','premium']))
    )$p$, t, t);
    execute format('drop policy if exists "%s_write" on public.%I', t, t);
    execute format('create policy "%s_write" on public.%I for all to authenticated using (public.owns_community(community_id)) with check (public.owns_community(community_id))', t, t);
    execute format('revoke all on table public.%I from public, anon', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
  end loop;
end $$;

-- ---- 4) apresentação antes da compra -------------------------------------
create or replace function public.exercise_preview(p_community uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not (public.is_community_member(p_community) or public.owns_community(p_community) or public.is_master()) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'exercise_count', (select count(*) from public.exercise_items where community_id = p_community and status = 'published'),
    'categories', (select coalesce(jsonb_agg(distinct c), '[]'::jsonb) from public.exercise_items i, unnest(i.categories) c where i.community_id = p_community and i.status = 'published'),
    'samples', (select coalesce(jsonb_agg(n), '[]'::jsonb) from (select name n from public.exercise_items where community_id = p_community and status = 'published' order by name limit 6) s),
    'articles', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'description', a.description, 'category', a.category, 'cover_path', a.cover_path) order by a.created_at desc), '[]'::jsonb)
                   from public.exercise_articles a where a.community_id = p_community and a.status = 'published')
  );
end $$;
revoke all on function public.exercise_preview(uuid) from public, anon;
grant execute on function public.exercise_preview(uuid) to authenticated;

-- ---- 5) dados da usuária ---------------------------------------------------
create table if not exists public.exercise_favorites (
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  item_id uuid not null references public.exercise_items (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, item_id)
);
create table if not exists public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  item_id uuid not null references public.exercise_items (id) on delete cascade,
  done_on date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists exercise_logs_profile_idx on public.exercise_logs (profile_id, done_on desc);
create table if not exists public.exercise_workouts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  item_ids uuid[] not null default '{}' check (coalesce(array_length(item_ids, 1), 0) between 1 and 40),
  created_at timestamptz not null default now()
);
create table if not exists public.exercise_workout_runs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) <= 80),
  total_items integer not null check (total_items >= 0),
  done_items integer not null check (done_items >= 0),
  duration_sec integer not null check (duration_sec >= 0),
  finished_at timestamptz not null default now()
);
create index if not exists exercise_workout_runs_idx on public.exercise_workout_runs (profile_id, finished_at desc);
create table if not exists public.exercise_week_plan (
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  workout_id uuid references public.exercise_workouts (id) on delete set null,
  quick_minutes smallint check (quick_minutes is null or quick_minutes in (5,10,15,20,30)),
  primary key (profile_id, weekday)
);

do $$
declare t text;
begin
  foreach t in array array['exercise_favorites','exercise_logs','exercise_workouts','exercise_workout_runs','exercise_week_plan'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_own" on public.%I', t, t);
    execute format('create policy "%s_own" on public.%I for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid())', t, t);
    execute format('revoke all on table public.%I from public, anon', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
  end loop;
end $$;

commit;

-- ROLLBACK (manual):
--   drop table exercise_week_plan, exercise_workout_runs, exercise_workouts, exercise_logs, exercise_favorites,
--     exercise_items, exercise_articles, product_price_overrides;
--   drop function exercise_preview(uuid), exercise_touch();
--   (recriar as três constraints sem 'exercicios'/'series_filmes'/banners novos)
