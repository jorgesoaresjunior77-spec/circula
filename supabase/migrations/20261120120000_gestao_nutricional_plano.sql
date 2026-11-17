-- =====================================================================
-- Gestão Nutricional (fase 2): banco de alimentos, receitas e planos
-- alimentares. Só a dona da comunidade lê e grava (owns_community).
-- O plano é um documento: refeições, alimentos e substituições ficam em
-- jsonb, cada alimento com os nutrientes já calculados na hora de salvar
-- (se o alimento mudar depois, planos antigos não mudam sozinhos).
-- =====================================================================
begin;

create table if not exists public.nutri_foods (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 200),
  category      text check (category is null or char_length(category) <= 80),
  portion_label text check (portion_label is null or char_length(portion_label) <= 80),
  portion_g     numeric(8, 2) not null default 100 check (portion_g > 0 and portion_g <= 5000),
  kcal          numeric(8, 2) check (kcal is null or kcal between 0 and 2000),
  protein_g     numeric(8, 2) check (protein_g is null or protein_g between 0 and 1000),
  carb_g        numeric(8, 2) check (carb_g is null or carb_g between 0 and 1000),
  fat_g         numeric(8, 2) check (fat_g is null or fat_g between 0 and 1000),
  sat_fat_g     numeric(8, 2) check (sat_fat_g is null or sat_fat_g between 0 and 1000),
  fiber_g       numeric(8, 2) check (fiber_g is null or fiber_g between 0 and 1000),
  sodium_mg     numeric(9, 2) check (sodium_mg is null or sodium_mg between 0 and 100000),
  source        text not null default 'propria' check (source in ('propria', 'importada')),
  created_at    timestamptz not null default now()
);
create index if not exists nutri_foods_community_idx on public.nutri_foods (community_id, name);

create table if not exists public.nutri_recipes (
  id              uuid primary key default gen_random_uuid(),
  community_id    uuid not null references public.communities (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 200),
  yield_portions  numeric(6, 2) not null default 1 check (yield_portions > 0 and yield_portions <= 1000),
  portion_g       numeric(8, 2) check (portion_g is null or portion_g > 0),
  ingredients     jsonb not null default '[]'::jsonb,
  preparation     text check (preparation is null or char_length(preparation) <= 6000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists nutri_recipes_community_idx on public.nutri_recipes (community_id, name);

create table if not exists public.nutri_plans (
  id                   uuid primary key default gen_random_uuid(),
  patient_id           uuid not null references public.nutri_patients (id) on delete cascade,
  community_id         uuid not null references public.communities (id) on delete cascade,
  name                 text not null check (char_length(name) between 1 and 160),
  objective            text check (objective is null or char_length(objective) <= 400),
  start_date           date,
  review_date          date,
  kcal_target          numeric(7, 1) check (kcal_target is null or kcal_target between 0 and 20000),
  protein_g_target     numeric(7, 1) check (protein_g_target is null or protein_g_target >= 0),
  carb_g_target        numeric(7, 1) check (carb_g_target is null or carb_g_target >= 0),
  fat_g_target         numeric(7, 1) check (fat_g_target is null or fat_g_target >= 0),
  fiber_g_target       numeric(7, 1) check (fiber_g_target is null or fiber_g_target >= 0),
  water_ml_target      numeric(7, 0) check (water_ml_target is null or water_ml_target >= 0),
  goals                text check (goals is null or char_length(goals) <= 2000),
  energy_estimate      jsonb,
  notes                text check (notes is null or char_length(notes) <= 4000),
  guidance             text check (guidance is null or char_length(guidance) <= 6000),
  meals                jsonb not null default '[]'::jsonb,
  status               text not null default 'rascunho' check (status in ('rascunho', 'ativo', 'arquivado')),
  shared_with_patient  boolean not null default false,
  created_by           uuid default auth.uid() references public.profiles (id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists nutri_plans_patient_idx on public.nutri_plans (patient_id, created_at desc);

do $$
declare t text;
begin
  foreach t in array array['nutri_foods', 'nutri_recipes', 'nutri_plans'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%1$s_owner_all" on public.%1$I', t);
    execute format(
      'create policy "%1$s_owner_all" on public.%1$I for all to authenticated using (public.owns_community(community_id)) with check (public.owns_community(community_id))',
      t
    );
    execute format('revoke all on table public.%I from public, anon', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
  end loop;
end $$;

drop trigger if exists nutri_plans_same_community on public.nutri_plans;
create trigger nutri_plans_same_community before insert or update on public.nutri_plans
  for each row execute function public.nutri_same_community();

commit;

-- Para desfazer:
-- begin;
-- drop table if exists public.nutri_plans, public.nutri_recipes, public.nutri_foods;
-- commit;
