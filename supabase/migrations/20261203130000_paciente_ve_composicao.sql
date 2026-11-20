-- =====================================================================
-- A paciente passa a ver, na área Nutri, o que a nutricionista COMPARTILHA da
-- avaliação corporal: além de peso, altura, cintura, % de gordura e massa
-- muscular, agora também massa de gordura e quadril (a massa magra é
-- calculada na tela: peso - massa de gordura). Só avaliações marcadas como
-- "compartilhar com a paciente" saem daqui; observações nunca saem.
-- Só redefine a função get_my_nutri_plan (mesma assinatura). Reversível:
-- restaurar a definição da migration 20261121120000_gestao_nutricional_exames_paciente.sql.
-- =====================================================================

begin;

create or replace function public.get_my_nutri_plan()
returns jsonb
language plpgsql
stable security definer
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
           'hip_cm', a.hip_cm,
           'body_fat_pct', a.body_fat_pct,
           'fat_mass_kg', a.fat_mass_kg,
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

commit;
