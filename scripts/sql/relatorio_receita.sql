-- RELATORIO DE RECEITA (somente leitura). Sem percentual para a Marluce:
-- toda cobranca fica na conta da plataforma.
-- Valores em reais. taxa/liquido so existem para pagamentos confirmados.
select
  coalesce(p.full_name, '(sem nome)')            as membro,
  s.subject                                      as tipo,
  pc.amount_cents / 100.0                        as bruto,
  pc.asaas_fee_cents / 100.0                     as taxa_asaas,
  pc.net_value_cents / 100.0                     as liquido,
  coalesce(pc.paid_at, pc.due_date::timestamptz) as data,
  pc.status                                      as status_asaas,
  pc.billing_type                                as forma
from payment_charges pc
join subscriptions s on s.id = pc.subscription_id
left join profiles p on p.id = s.profile_id
where pc.paid_at is not null -- so cobrancas pagas; vencidas/pendentes nao sao receita
order by data desc;

-- Totais do periodo (so pagamentos confirmados/recebidos)
-- select sum(amount_cents)/100.0 bruto, sum(asaas_fee_cents)/100.0 taxas, sum(net_value_cents)/100.0 liquido
-- from payment_charges where paid_at is not null
--   and paid_at >= date_trunc('month', now());
