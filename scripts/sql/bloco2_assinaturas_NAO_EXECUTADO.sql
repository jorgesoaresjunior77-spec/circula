-- PREPARADO, NAO EXECUTADO. Cada bloco so roda com OK explicito do Jorge.
-- Projeto: kdqtanqywjpwbnjedafn. Todos os UPDATE filtram por id E por status de origem.

-- ============ ANTES (leitura) ============
select s.id, p.full_name, s.subject, s.status, s.trial_ends_at, s.current_period_end,
       s.grace_period_ends_at, cm.status as membership_status
from subscriptions s
join profiles p on p.id = s.profile_id
left join community_members cm on cm.profile_id = s.profile_id and cm.community_id = s.community_id
where s.id in (
  '7f6c1fd4-bfba-452f-aa69-31784e2ed75c',  -- Marluce plataforma (past_due)
  '2248b52d-1e27-4b69-ab67-1199d3ead14d',  -- Marluce comunidade (trial vencido)
  '47944cfb-570b-43c8-9311-294af9527037',  -- JR Filmes (trial vencido)
  'eaf88014-a34b-48da-babb-ba83ae653233'   -- Junior (trial vencido)
);

-- ============ A) ISENTAR a Marluce (dona) ============
-- Plataforma: ativa, periodo longo, sem tolerancia. Precisa cancelar a assinatura
-- sandbox sub_vw4h60qctr0qsl4q no painel do Asaas, senao o proximo PAYMENT_OVERDUE
-- a devolve para past_due.
update subscriptions
set status = 'active', current_period_end = '2099-01-01T00:00:00Z', grace_period_ends_at = null
where id = '7f6c1fd4-bfba-452f-aa69-31784e2ed75c' and status = 'past_due';

-- Comunidade (ela e a dona; nao paga a propria comunidade)
update subscriptions
set status = 'active', current_period_end = '2099-01-01T00:00:00Z', trial_ends_at = '2099-01-01T00:00:00Z'
where id = '2248b52d-1e27-4b69-ab67-1199d3ead14d' and status = 'trial';

-- ============ B1) ESTENDER JR Filmes / Junior por 30 dias (se forem contas de teste a manter) ============
update subscriptions
set trial_ends_at = now() + interval '30 days', current_period_end = now() + interval '30 days'
where id in ('47944cfb-570b-43c8-9311-294af9527037','eaf88014-a34b-48da-babb-ba83ae653233')
  and status = 'trial';

-- ============ B2) OU deixar o sweep bloquear (conta de teste descartavel): nenhum SQL ============

-- ============ DEPOIS (leitura) = repetir o SELECT de ANTES ============
