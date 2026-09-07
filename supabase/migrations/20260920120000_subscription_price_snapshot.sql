-- =====================================================================
-- FASE 16.2 — Snapshot de preço/ciclo/split na assinatura de comunidade
-- =====================================================================
-- Objetivo: congelar, no momento da assinatura (checkout), o preço, o
-- ciclo e a resolução de split usados. Assim uma alteração futura de
-- `community_billing_settings` (feita pela Professional) NÃO reprecifica
-- assinaturas já criadas — novas assinaturas usam o preço novo, as
-- existentes renovam pelo snapshot (grandfathered).
--
-- Espelha o padrão já provado de `public.product_orders` (Loja), que
-- congela `unit_price_cents_snapshot`, `split_model_snapshot`,
-- `circula_amount_cents_snapshot`, `professional_amount_cents_snapshot`,
-- `professional_wallet_id_snapshot`, etc.
--
-- ADITIVO PURO: 8 colunas NULLABLE em `public.subscriptions`, sem
-- default, sem NOT NULL. `plan_id` continua NOT NULL apontando o plano
-- `member_monthly` (decorativo a partir da 16.2 — a verdade do preço
-- passa a ser `price_cents_snapshot` / `community_billing_settings`).
--
-- NÃO altera: RLS, policies, grants (o `grant select, update ... to
-- authenticated/service_role` é a nível de tabela e cobre colunas novas
-- automaticamente), triggers, tipos, índices, `plan_id`, o piso R$ 14,90
-- (que segue em `community_billing_settings` + `set_community_price` +
-- revalidação no checkout), a arquitetura de split 90/10, `resolve_split`,
-- `create_community_trial`, `billing_plans`, ou qualquer outra tabela.
--
-- As colunas serão GRAVADAS pela Edge Function `asaas-create-subscription`
-- (ramo `subject='community'`) na Etapa 16.2.3 — esta migration é só
-- schema. Nenhuma linha existente é alterada (snapshots ficam NULL).
--
-- Idempotente (`add column if not exists`, `do $$ ... if not exists`).
-- Transacional. Reversível (rodapé).
-- =====================================================================

begin;

alter table public.subscriptions
  add column if not exists price_cents_snapshot              integer;

alter table public.subscriptions
  add column if not exists billing_cycle_snapshot            text;

alter table public.subscriptions
  add column if not exists currency_snapshot                 text;

alter table public.subscriptions
  add column if not exists split_model_snapshot              text;

alter table public.subscriptions
  add column if not exists circula_percent_snapshot          numeric(5,2);

alter table public.subscriptions
  add column if not exists circula_amount_cents_snapshot      integer;

alter table public.subscriptions
  add column if not exists professional_amount_cents_snapshot integer;

alter table public.subscriptions
  add column if not exists professional_wallet_id_snapshot    text;

-- Constraints `not valid`: não varrem as 6 linhas atuais (todas com
-- snapshot NULL), mas passam a valer para todo INSERT/UPDATE futuro.
-- Mesmo padrão conservador da migration `20260919120000`.
do $$
begin
  if not exists (select 1 from pg_constraint
                 where conname = 'subscriptions_price_cents_snapshot_check') then
    alter table public.subscriptions
      add constraint subscriptions_price_cents_snapshot_check
      check (price_cents_snapshot is null or price_cents_snapshot > 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint
                 where conname = 'subscriptions_billing_cycle_snapshot_check') then
    alter table public.subscriptions
      add constraint subscriptions_billing_cycle_snapshot_check
      check (billing_cycle_snapshot is null
             or billing_cycle_snapshot = any (array['MONTHLY'::text,'SEMIANNUALLY'::text,'YEARLY'::text]))
      not valid;
  end if;

  if not exists (select 1 from pg_constraint
                 where conname = 'subscriptions_split_model_snapshot_check') then
    alter table public.subscriptions
      add constraint subscriptions_split_model_snapshot_check
      check (split_model_snapshot is null
             or split_model_snapshot = any (array['native'::text,'ledger'::text]))
      not valid;
  end if;

  -- coerência: split nativo exige walletId congelado (igual a
  -- product_orders_split_model_wallet_coherence_check)
  if not exists (select 1 from pg_constraint
                 where conname = 'subscriptions_split_model_wallet_coherence_check') then
    alter table public.subscriptions
      add constraint subscriptions_split_model_wallet_coherence_check
      check (split_model_snapshot is distinct from 'native'
             or professional_wallet_id_snapshot is not null)
      not valid;
  end if;

  -- círcula e professional: ambos presentes ou ambos ausentes
  if not exists (select 1 from pg_constraint
                 where conname = 'subscriptions_split_amounts_coherence_check') then
    alter table public.subscriptions
      add constraint subscriptions_split_amounts_coherence_check
      check ((circula_amount_cents_snapshot is null) = (professional_amount_cents_snapshot is null))
      not valid;
  end if;
end $$;

commit;

-- =====================================================================
-- Reversão (referência):
--
-- begin;
-- alter table public.subscriptions
--   drop constraint if exists subscriptions_split_amounts_coherence_check,
--   drop constraint if exists subscriptions_split_model_wallet_coherence_check,
--   drop constraint if exists subscriptions_split_model_snapshot_check,
--   drop constraint if exists subscriptions_billing_cycle_snapshot_check,
--   drop constraint if exists subscriptions_price_cents_snapshot_check;
-- alter table public.subscriptions
--   drop column if exists professional_wallet_id_snapshot,
--   drop column if exists professional_amount_cents_snapshot,
--   drop column if exists circula_amount_cents_snapshot,
--   drop column if exists circula_percent_snapshot,
--   drop column if exists split_model_snapshot,
--   drop column if exists currency_snapshot,
--   drop column if exists billing_cycle_snapshot,
--   drop column if exists price_cents_snapshot;
-- commit;
-- =====================================================================
