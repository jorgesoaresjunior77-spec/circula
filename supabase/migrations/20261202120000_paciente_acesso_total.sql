-- =====================================================================
-- Paciente da nutricionista: acesso gratuito a TODO o ecossistema do app.
--
-- Quando a Marluce concede a isenção a uma paciente vinculada (painel
-- Nutri > Acompanhamento), a paciente passa a ter também o pacote
-- 'premium' (todos os conteúdos). Ao retirar a isenção, o pacote sai,
-- exceto se ela tiver um Premium pago ativo (addon_subscriptions).
-- As pacientes já isentas hoje recebem o pacote agora (backfill).
-- Aditiva e reversível (rollback no rodapé). NÃO FOI APLICADA NO REMOTO.
-- =====================================================================

begin;

create or replace function public.grant_nutri_exemption(p_patient uuid, p_note text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare pt record; v_plan uuid; v_sub uuid;
begin
  select * into pt from public.nutri_patients where id = p_patient;
  if pt.id is null then raise exception 'patient_not_found'; end if;
  if not public.owns_community(pt.community_id) then raise exception 'not_authorized' using errcode = '42501'; end if;
  if pt.linked_profile_id is null then raise exception 'patient_not_linked'; end if;
  if exists (select 1 from public.nutri_exemptions where patient_id = p_patient and revoked_at is null) then return; end if;

  select id, plan_id into v_sub, v_plan from public.subscriptions
   where subject = 'community' and profile_id = pt.linked_profile_id and community_id = pt.community_id
   order by created_at desc limit 1;
  if v_sub is null then
    select id into v_plan from public.billing_plans where subject = 'community' order by created_at limit 1;
    if v_plan is null then raise exception 'no_plan'; end if;
    insert into public.subscriptions (subject, profile_id, community_id, plan_id, status, trial_ends_at, current_period_start, current_period_end)
    values ('community', pt.linked_profile_id, pt.community_id, v_plan, 'active', now(), now(), now() + interval '100 years');
  else
    update public.subscriptions
       set status = 'active', current_period_end = now() + interval '100 years', grace_period_ends_at = null,
           canceled_at = null, updated_at = now()
     where id = v_sub;
  end if;
  insert into public.nutri_exemptions (patient_id, profile_id, community_id, granted_by, note)
  values (p_patient, pt.linked_profile_id, pt.community_id, auth.uid(), p_note);

  insert into public.member_package_access (community_id, profile_id, package, granted_by)
  values (pt.community_id, pt.linked_profile_id, 'premium', auth.uid())
  on conflict (community_id, profile_id, package) do nothing;

  perform public.nutri_notify(pt.linked_profile_id, 'nutri_update', 'Acesso liberado', 'Sua nutricionista liberou o Círculo completo para você, sem cobrança.', pt.community_id);
end $$;
revoke all on function public.grant_nutri_exemption(uuid, text) from public, anon;
grant execute on function public.grant_nutri_exemption(uuid, text) to authenticated;

create or replace function public.revoke_nutri_exemption(p_patient uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare pt record;
begin
  select * into pt from public.nutri_patients where id = p_patient;
  if pt.id is null then raise exception 'patient_not_found'; end if;
  if not public.owns_community(pt.community_id) then raise exception 'not_authorized' using errcode = '42501'; end if;
  update public.nutri_exemptions set revoked_at = now(), revoked_by = auth.uid()
   where patient_id = p_patient and revoked_at is null;
  if found then
    update public.subscriptions set status = 'canceled', canceled_at = now(), current_period_end = now(), updated_at = now()
     where subject = 'community' and profile_id = pt.linked_profile_id and community_id = pt.community_id
       and asaas_subscription_id is null;
    if not exists (
      select 1 from public.addon_subscriptions a
       where a.profile_id = pt.linked_profile_id and a.community_id = pt.community_id
         and a.plan_key = 'premium' and a.status = 'active'
    ) then
      delete from public.member_package_access
       where community_id = pt.community_id and profile_id = pt.linked_profile_id and package = 'premium';
    end if;
  end if;
end $$;
revoke all on function public.revoke_nutri_exemption(uuid) from public, anon;
grant execute on function public.revoke_nutri_exemption(uuid) to authenticated;

-- Backfill: pacientes já isentas ganham o pacote completo.
insert into public.member_package_access (community_id, profile_id, package, granted_by)
select e.community_id, e.profile_id, 'premium', e.granted_by
  from public.nutri_exemptions e
 where e.revoked_at is null
on conflict (community_id, profile_id, package) do nothing;

commit;

-- ROLLBACK (manual):
--   restaurar grant_nutri_exemption/revoke_nutri_exemption da migration 20261128120000_nutri_paciente_integrada.sql
--   e, se quiser, remover os pacotes: delete from public.member_package_access p using public.nutri_exemptions e
--     where e.revoked_at is null and p.profile_id = e.profile_id and p.community_id = e.community_id and p.package = 'premium';
