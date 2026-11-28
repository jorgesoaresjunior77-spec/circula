-- Indicação Premium (regra fechada com o usuário em 28/11/2026):
--  • quem tem o Premium convida (o link leva ?ref=);
--  • a convidada que entra pelo convite ganha 10% na PRIMEIRA assinatura do Premium
--    (já existia: asaas-create-addon-subscription + referrals.discount_used_at);
--  • quem convidou ganha 10% no PRÓXIMO ciclo de pagamento dela, automaticamente,
--    mas SÓ depois que a convidada PAGA o Premium (antes bastava a amiga entrar).
--    O webhook do Asaas marca referrals.invitee_premium_paid_at no pagamento
--    confirmado do Premium da convidada e só então aplica o desconto na próxima
--    cobrança criada de quem convidou (uma convidada = um ciclo com 10%).
begin;

alter table public.referrals add column if not exists invitee_premium_paid_at timestamptz;

-- Convidadas que já pagaram o Premium antes desta regra: marca com o 1º pagamento.
update public.referrals r
set invitee_premium_paid_at = p.first_paid
from (
  select ap.profile_id, min(ap.paid_at) as first_paid
  from public.addon_payments ap
  join public.addon_subscriptions s on s.id = ap.addon_subscription_id
  where s.plan_key = 'premium' and ap.paid_at is not null
  group by ap.profile_id
) p
where p.profile_id = r.invitee_id and r.invitee_premium_paid_at is null;

-- Resumo para quem convidou.
create or replace function public.my_invite_rewards()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'convidadas', count(*),
    'aguardando_premium', count(*) filter (where invitee_premium_paid_at is null and inviter_reward_applied_at is null),
    'pendentes', count(*) filter (where invitee_premium_paid_at is not null and inviter_reward_applied_at is null),
    'aplicados', count(*) filter (where inviter_reward_applied_at is not null)
  ) from public.referrals where inviter_id = auth.uid();
$$;
revoke all on function public.my_invite_rewards() from public, anon;
grant execute on function public.my_invite_rewards() to authenticated;

-- Lista das indicações de quem convidou (só o primeiro nome da convidada).
create or replace function public.my_invite_list()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'nome', coalesce(nullif(split_part(trim(p.full_name), ' ', 1), ''), 'Amiga'),
      'entrou_em', r.created_at,
      'premium_pago_em', r.invitee_premium_paid_at,
      'desconto_aplicado_em', r.inviter_reward_applied_at
    ) order by r.created_at desc), '[]'::jsonb)
  from public.referrals r
  left join public.profiles p on p.id = r.invitee_id
  where r.inviter_id = auth.uid();
$$;
revoke all on function public.my_invite_list() from public, anon;
grant execute on function public.my_invite_list() to authenticated;

commit;
-- ROLLBACK (manual): drop function my_invite_list();
--   alter table referrals drop column invitee_premium_paid_at;
--   recriar my_invite_rewards() da migration 20261208120000.
