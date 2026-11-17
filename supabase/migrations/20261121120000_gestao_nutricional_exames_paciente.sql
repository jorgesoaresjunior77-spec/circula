-- =====================================================================
-- Gestão Nutricional (fase 3): exames, documentos, arquivos privados e a
-- área da paciente.
--  • Arquivos ficam num bucket PRIVADO (nutri-files), só a dona da
--    comunidade lê e grava (a primeira pasta do caminho é a comunidade).
--  • A paciente NUNCA lê as tabelas internas: ela chama get_my_nutri_plan(),
--    que devolve só o que a nutricionista compartilhou (sem observações
--    internas, sem anamnese, sem exames).
-- =====================================================================
begin;

insert into storage.buckets (id, name, public, file_size_limit)
values ('nutri-files', 'nutri-files', false, 15728640)
on conflict (id) do nothing;

drop policy if exists "nutri_files_owner_select" on storage.objects;
create policy "nutri_files_owner_select" on storage.objects for select to authenticated
  using (bucket_id = 'nutri-files' and public.owns_community(((storage.foldername(name))[1])::uuid));

drop policy if exists "nutri_files_owner_insert" on storage.objects;
create policy "nutri_files_owner_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'nutri-files' and public.owns_community(((storage.foldername(name))[1])::uuid));

drop policy if exists "nutri_files_owner_delete" on storage.objects;
create policy "nutri_files_owner_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'nutri-files' and public.owns_community(((storage.foldername(name))[1])::uuid));

create table if not exists public.nutri_exams (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid not null references public.nutri_patients (id) on delete cascade,
  community_id     uuid not null references public.communities (id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 160),
  collected_on     date not null default current_date,
  result           text check (result is null or char_length(result) <= 200),
  unit             text check (unit is null or char_length(unit) <= 40),
  reference_range  text check (reference_range is null or char_length(reference_range) <= 200),
  notes            text check (notes is null or char_length(notes) <= 2000),
  file_path        text check (file_path is null or char_length(file_path) <= 400),
  created_by       uuid default auth.uid() references public.profiles (id),
  created_at       timestamptz not null default now()
);
create index if not exists nutri_exams_patient_idx on public.nutri_exams (patient_id, collected_on desc);

create table if not exists public.nutri_documents (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references public.nutri_patients (id) on delete cascade,
  community_id  uuid not null references public.communities (id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 160),
  file_path     text not null check (char_length(file_path) <= 400),
  file_name     text check (file_name is null or char_length(file_name) <= 200),
  created_by    uuid default auth.uid() references public.profiles (id),
  created_at    timestamptz not null default now()
);
create index if not exists nutri_documents_patient_idx on public.nutri_documents (patient_id, created_at desc);

do $$
declare t text;
begin
  foreach t in array array['nutri_exams', 'nutri_documents'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%1$s_owner_all" on public.%1$I', t);
    execute format(
      'create policy "%1$s_owner_all" on public.%1$I for all to authenticated using (public.owns_community(community_id)) with check (public.owns_community(community_id))',
      t
    );
    execute format('revoke all on table public.%I from public, anon', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
    execute format('drop trigger if exists %1$s_same_community on public.%1$I', t);
    execute format(
      'create trigger %1$s_same_community before insert or update on public.%1$I for each row execute function public.nutri_same_community()',
      t
    );
  end loop;
end $$;

-- A nutricionista marca quais avaliações a paciente pode ver na evolução.
alter table public.nutri_assessments
  add column if not exists shared_with_patient boolean not null default false;

-- Só uma paciente por participante em cada comunidade.
create unique index if not exists nutri_patients_link_unique
  on public.nutri_patients (community_id, linked_profile_id)
  where linked_profile_id is not null;

-- ---------------------------------------------------------------------
-- Área da paciente: devolve SÓ o que foi compartilhado.
-- ---------------------------------------------------------------------
create or replace function public.get_my_nutri_plan()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_patient record;
  v_plan jsonb;
  v_next date;
  v_evolution jsonb;
begin
  if auth.uid() is null then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select id, community_id, full_name into v_patient
  from public.nutri_patients
  where linked_profile_id = auth.uid() and status = 'ativo'
  order by created_at desc
  limit 1;

  if v_patient.id is null then
    return null;
  end if;

  select jsonb_build_object(
           'id', p.id,
           'name', p.name,
           'objective', p.objective,
           'start_date', p.start_date,
           'review_date', p.review_date,
           'kcal_target', p.kcal_target,
           'protein_g_target', p.protein_g_target,
           'carb_g_target', p.carb_g_target,
           'fat_g_target', p.fat_g_target,
           'fiber_g_target', p.fiber_g_target,
           'water_ml_target', p.water_ml_target,
           'goals', p.goals,
           'guidance', p.guidance,
           'meals', p.meals
         )
    into v_plan
  from public.nutri_plans p
  where p.patient_id = v_patient.id and p.status = 'ativo' and p.shared_with_patient
  order by p.created_at desc
  limit 1;

  select min(c.scheduled_on) into v_next
  from public.nutri_consultations c
  where c.patient_id = v_patient.id and c.status = 'agendada' and c.scheduled_on >= current_date;

  select coalesce(jsonb_agg(jsonb_build_object(
           'assessed_on', a.assessed_on,
           'weight_kg', a.weight_kg,
           'height_cm', a.height_cm,
           'waist_cm', a.waist_cm,
           'body_fat_pct', a.body_fat_pct,
           'muscle_mass_kg', a.muscle_mass_kg
         ) order by a.assessed_on), '[]'::jsonb)
    into v_evolution
  from public.nutri_assessments a
  where a.patient_id = v_patient.id and a.shared_with_patient;

  return jsonb_build_object(
    'patient_name', v_patient.full_name,
    'plan', v_plan,
    'next_consultation', v_next,
    'evolution', v_evolution
  );
end;
$function$;

revoke all on function public.get_my_nutri_plan() from public, anon;
grant execute on function public.get_my_nutri_plan() to authenticated;

commit;

-- Para desfazer:
-- begin;
-- drop function if exists public.get_my_nutri_plan();
-- drop index if exists public.nutri_patients_link_unique;
-- alter table public.nutri_assessments drop column if exists shared_with_patient;
-- drop table if exists public.nutri_documents, public.nutri_exams;
-- (o bucket nutri-files e suas políticas ficam; apague pelo painel se precisar)
-- commit;
