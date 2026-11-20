-- =====================================================================
--  1) Imagem do card "Planos e assinaturas" da Home: nova chave 'banner_planos'
--     em community_card_images (a nutricionista envia no painel de imagens).
--  2) nutri_patient_billing(): na ficha da paciente, a nutricionista vê o plano
--     que ela paga, o ciclo, o valor, a situação, a próxima cobrança, a forma de
--     pagamento e os últimos pagamentos. Só a dona da comunidade chama; só lê.
-- Aditiva, transacional e reversível (rollback no fim).
-- =====================================================================
begin;

alter table public.community_card_images drop constraint if exists community_card_images_card_key_check;
alter table public.community_card_images add constraint community_card_images_card_key_check check (
  card_key = any (array['hoje','desafios','eventos','comunidade','jornada','instagram','eventos_grande','jornada_grande','comunidade_grande','jardim','novo_circulo','revista_escritorio','ferramenta_calendario','ferramenta_agua','ferramenta_imc','menu_leitura','menu_respiracao','menu_planos','menu_playlist','loja_fundo','menu_wellness','menu_lista','banner_cardapio','banner_exercicios','banner_series','banner_diario','banner_planos']::text[])
);

create or replace function public.nutri_patient_billing(p_patient uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  pt record;
  sub record;
  v_charges jsonb := '[]'::jsonb;
  v_addons jsonb := '[]'::jsonb;
begin
  select id, community_id, linked_profile_id into pt from public.nutri_patients where id = p_patient;
  if pt.id is null then raise exception 'patient_not_found'; end if;
  if not public.owns_community(pt.community_id) then raise exception 'not_authorized' using errcode = '42501'; end if;
  if pt.linked_profile_id is null then return jsonb_build_object('linked', false); end if;

  select s.id, s.status, s.billing_cycle_snapshot as cycle, s.price_cents_snapshot as price_cents,
         s.current_period_end, s.trial_ends_at, s.asaas_subscription_id, bp.name as plan_name
    into sub
    from public.subscriptions s
    left join public.billing_plans bp on bp.id = s.plan_id
   where s.subject = 'community' and s.profile_id = pt.linked_profile_id and s.community_id = pt.community_id
   order by s.created_at desc limit 1;

  if sub.id is not null then
    select coalesce(jsonb_agg(jsonb_build_object('due_date', c.due_date, 'amount_cents', c.amount_cents, 'status', c.status,
             'billing_type', c.billing_type, 'paid_at', c.paid_at) order by c.due_date desc), '[]'::jsonb)
      into v_charges
      from (select * from public.payment_charges where subscription_id = sub.id order by due_date desc limit 8) c;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('plan_key', a.plan_key, 'billing_cycle', a.billing_cycle, 'status', a.status,
           'current_period_end', a.current_period_end) order by a.created_at desc), '[]'::jsonb)
    into v_addons
    from public.addon_subscriptions a
   where a.profile_id = pt.linked_profile_id and a.community_id = pt.community_id;

  return jsonb_build_object(
    'linked', true,
    'exempt', exists (select 1 from public.nutri_exemptions where patient_id = p_patient and revoked_at is null),
    'subscription', case when sub.id is null then null else jsonb_build_object(
        'plan_name', sub.plan_name, 'status', sub.status, 'cycle', sub.cycle, 'price_cents', sub.price_cents,
        'current_period_end', sub.current_period_end, 'trial_ends_at', sub.trial_ends_at,
        'via_asaas', sub.asaas_subscription_id is not null) end,
    'charges', v_charges,
    'addons', v_addons
  );
end $$;
revoke all on function public.nutri_patient_billing(uuid) from public, anon;
grant execute on function public.nutri_patient_billing(uuid) to authenticated;

commit;

-- ROLLBACK (manual):
--   drop function if exists public.nutri_patient_billing(uuid);
--   (recriar community_card_images_card_key_check sem 'banner_planos')
