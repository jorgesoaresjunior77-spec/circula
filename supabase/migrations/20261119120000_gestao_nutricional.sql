-- =====================================================================
-- Gestão Nutricional (fase 1): pacientes, anamnese, avaliações, consultas
-- e registro de alterações. Dados de saúde: SÓ a dona da comunidade lê e
-- grava (owns_community). Nem as participantes, nem a master enxergam.
-- =====================================================================
begin;

create table if not exists public.nutri_patients (
  id                uuid primary key default gen_random_uuid(),
  community_id      uuid not null references public.communities (id) on delete cascade,
  created_by        uuid not null default auth.uid() references public.profiles (id),
  full_name         text not null check (char_length(full_name) between 1 and 160),
  photo_path        text,
  birth_date        date,
  sex               text check (sex is null or sex in ('F', 'M')),
  phone             text check (phone is null or char_length(phone) <= 40),
  whatsapp          text check (whatsapp is null or char_length(whatsapp) <= 40),
  email             text check (email is null or char_length(email) <= 200),
  cpf               text check (cpf is null or char_length(cpf) <= 20),
  profession        text check (profession is null or char_length(profession) <= 120),
  marital_status    text check (marital_status is null or char_length(marital_status) <= 60),
  address           text check (address is null or char_length(address) <= 400),
  notes             text check (notes is null or char_length(notes) <= 4000),
  main_goal         text check (main_goal is null or char_length(main_goal) <= 400),
  secondary_goals   text check (secondary_goals is null or char_length(secondary_goals) <= 1000),
  follow_up_history text check (follow_up_history is null or char_length(follow_up_history) <= 4000),
  food_preferences  text check (food_preferences is null or char_length(food_preferences) <= 2000),
  food_restrictions text check (food_restrictions is null or char_length(food_restrictions) <= 2000),
  allergies         text check (allergies is null or char_length(allergies) <= 2000),
  intolerances      text check (intolerances is null or char_length(intolerances) <= 2000),
  status            text not null default 'ativo' check (status in ('ativo', 'inativo')),
  linked_profile_id uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists nutri_patients_community_idx on public.nutri_patients (community_id, full_name);

create table if not exists public.nutri_anamneses (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references public.nutri_patients (id) on delete cascade,
  community_id  uuid not null references public.communities (id) on delete cascade,
  data          jsonb not null default '{}'::jsonb,
  status        text not null default 'rascunho' check (status in ('rascunho', 'concluida')),
  updated_by    uuid default auth.uid() references public.profiles (id),
  updated_at    timestamptz not null default now(),
  unique (patient_id)
);

create table if not exists public.nutri_assessments (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references public.nutri_patients (id) on delete cascade,
  community_id    uuid not null references public.communities (id) on delete cascade,
  assessed_on     date not null default current_date,
  weight_kg       numeric(6, 2) check (weight_kg is null or weight_kg between 1 and 500),
  height_cm       numeric(5, 1) check (height_cm is null or height_cm between 30 and 260),
  abdomen_cm      numeric(5, 1) check (abdomen_cm is null or abdomen_cm between 10 and 400),
  waist_cm        numeric(5, 1) check (waist_cm is null or waist_cm between 10 and 400),
  hip_cm          numeric(5, 1) check (hip_cm is null or hip_cm between 10 and 400),
  arm_cm          numeric(5, 1) check (arm_cm is null or arm_cm between 5 and 200),
  thigh_cm        numeric(5, 1) check (thigh_cm is null or thigh_cm between 5 and 300),
  calf_cm         numeric(5, 1) check (calf_cm is null or calf_cm between 5 and 200),
  body_fat_pct    numeric(5, 2) check (body_fat_pct is null or body_fat_pct between 0 and 100),
  muscle_mass_kg  numeric(6, 2) check (muscle_mass_kg is null or muscle_mass_kg between 0 and 300),
  fat_mass_kg     numeric(6, 2) check (fat_mass_kg is null or fat_mass_kg between 0 and 400),
  body_water_pct  numeric(5, 2) check (body_water_pct is null or body_water_pct between 0 and 100),
  bone_mass_kg    numeric(5, 2) check (bone_mass_kg is null or bone_mass_kg between 0 and 30),
  skinfolds       jsonb not null default '{}'::jsonb,
  custom          jsonb not null default '[]'::jsonb,
  source          text check (source is null or char_length(source) <= 120),
  notes           text check (notes is null or char_length(notes) <= 4000),
  created_by      uuid default auth.uid() references public.profiles (id),
  created_at      timestamptz not null default now()
);
create index if not exists nutri_assessments_patient_idx on public.nutri_assessments (patient_id, assessed_on desc);

create table if not exists public.nutri_consultations (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid not null references public.nutri_patients (id) on delete cascade,
  community_id     uuid not null references public.communities (id) on delete cascade,
  kind             text not null default 'consulta' check (kind in ('consulta', 'retorno')),
  status           text not null default 'agendada' check (status in ('agendada', 'realizada', 'cancelada')),
  scheduled_on     date not null default current_date,
  scheduled_time   text check (scheduled_time is null or char_length(scheduled_time) <= 8),
  evolution        text check (evolution is null or char_length(evolution) <= 6000),
  next_return_on   date,
  created_by       uuid default auth.uid() references public.profiles (id),
  created_at       timestamptz not null default now()
);
create index if not exists nutri_consultations_patient_idx on public.nutri_consultations (patient_id, scheduled_on desc);
create index if not exists nutri_consultations_community_idx on public.nutri_consultations (community_id, scheduled_on);

-- Quem mexeu em quê e quando (autoria e histórico de alterações).
create table if not exists public.nutri_record_log (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references public.nutri_patients (id) on delete cascade,
  community_id  uuid not null references public.communities (id) on delete cascade,
  section       text not null check (char_length(section) <= 60),
  action        text not null check (action in ('criou', 'editou', 'excluiu')),
  summary       text check (summary is null or char_length(summary) <= 300),
  by_profile    uuid default auth.uid() references public.profiles (id),
  at            timestamptz not null default now()
);
create index if not exists nutri_record_log_patient_idx on public.nutri_record_log (patient_id, at desc);

-- RLS: só a dona da comunidade.
do $$
declare t text;
begin
  foreach t in array array['nutri_patients', 'nutri_anamneses', 'nutri_assessments', 'nutri_consultations', 'nutri_record_log'] loop
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

-- O registro precisa ser da mesma comunidade do paciente.
create or replace function public.nutri_same_community()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.nutri_patients p
    where p.id = new.patient_id and p.community_id = new.community_id
  ) then
    raise exception 'paciente de outra comunidade' using errcode = '23514';
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['nutri_anamneses', 'nutri_assessments', 'nutri_consultations', 'nutri_record_log'] loop
    execute format('drop trigger if exists %1$s_same_community on public.%1$I', t);
    execute format(
      'create trigger %1$s_same_community before insert or update on public.%1$I for each row execute function public.nutri_same_community()',
      t
    );
  end loop;
end $$;

commit;

-- Para desfazer:
-- begin;
-- drop table if exists public.nutri_record_log, public.nutri_consultations,
--   public.nutri_assessments, public.nutri_anamneses, public.nutri_patients;
-- drop function if exists public.nutri_same_community();
-- commit;
