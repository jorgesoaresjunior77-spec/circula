-- =====================================================================
-- FIX — preço definitivo do plano member_monthly: R$ 14,90 (1490 centavos)
-- =====================================================================
-- Reconcilia billing_plans.price_cents do plano 'member_monthly' com o
-- valor definitivo. Idempotente: o WHERE price_cents <> 1490 faz a
-- segunda execução ser um no-op. NAO insere plano nenhum — se a linha
-- 'member_monthly' não existir, o UPDATE simplesmente não afeta linhas
-- (a criação das linhas de billing_plans continua sendo do seed.sql).
-- =====================================================================

update public.billing_plans
set price_cents = 1490,
    updated_at = now()
where code = 'member_monthly'
  and price_cents <> 1490;
