-- =====================================================================
-- FASE 16.2 — Reconciliação de Split em payment_charges
-- =====================================================================
-- Objetivo: guardar, por cobrança confirmada de assinatura de comunidade,
-- o que a Asaas efetivamente reportou:
--   • net_value_cents          — valor líquido da cobrança (bruto − taxa)
--   • split_professional_cents — parcela repassada à Professional
--   • split_circula_cents      — parcela retida pela Círcula
--   • asaas_fee_cents          — taxa cobrada pela Asaas
-- Base para reconciliar webhook ↔ Split (o Split usa percentualValue=90
-- sobre o netValue; estas colunas registram o resultado real).
--
-- `payment_charges` já tem: id, subscription_id, asaas_payment_id,
-- status, amount_cents, due_date, paid_at, billing_type, invoice_url,
-- created_at, updated_at. RLS: SELECT da própria assinatura / dono /
-- master; INSERT/UPDATE só `service_role` (webhook).
--
-- ADITIVO PURO: 4 colunas NULLABLE, sem default. As colunas serão
-- GRAVADAS pela Edge Function `asaas-webhook` (evento PAYMENT_RECEIVED)
-- na Etapa 16.2.4 — esta migration é só schema.
--
-- NÃO altera: RLS, policies, grants (nível de tabela), triggers,
-- `amount_cents`, a arquitetura de split 90/10, o piso R$ 14,90, ou
-- qualquer outra tabela. A 1 linha existente ganha NULLs.
--
-- Idempotente (`add column if not exists`). Transacional. Reversível.
-- =====================================================================

begin;

alter table public.payment_charges
  add column if not exists net_value_cents          integer;

alter table public.payment_charges
  add column if not exists split_professional_cents integer;

alter table public.payment_charges
  add column if not exists split_circula_cents      integer;

alter table public.payment_charges
  add column if not exists asaas_fee_cents          integer;

-- CHECKs validados na hora (a única linha existente tem tudo NULL).
do $$
begin
  if not exists (select 1 from pg_constraint
                 where conname = 'payment_charges_net_value_cents_check') then
    alter table public.payment_charges
      add constraint payment_charges_net_value_cents_check
      check (net_value_cents is null or net_value_cents >= 0);
  end if;

  if not exists (select 1 from pg_constraint
                 where conname = 'payment_charges_split_professional_cents_check') then
    alter table public.payment_charges
      add constraint payment_charges_split_professional_cents_check
      check (split_professional_cents is null or split_professional_cents >= 0);
  end if;

  if not exists (select 1 from pg_constraint
                 where conname = 'payment_charges_split_circula_cents_check') then
    alter table public.payment_charges
      add constraint payment_charges_split_circula_cents_check
      check (split_circula_cents is null or split_circula_cents >= 0);
  end if;

  if not exists (select 1 from pg_constraint
                 where conname = 'payment_charges_asaas_fee_cents_check') then
    alter table public.payment_charges
      add constraint payment_charges_asaas_fee_cents_check
      check (asaas_fee_cents is null or asaas_fee_cents >= 0);
  end if;
end $$;

commit;

-- =====================================================================
-- Reversão (referência):
--
-- begin;
-- alter table public.payment_charges
--   drop constraint if exists payment_charges_asaas_fee_cents_check,
--   drop constraint if exists payment_charges_split_circula_cents_check,
--   drop constraint if exists payment_charges_split_professional_cents_check,
--   drop constraint if exists payment_charges_net_value_cents_check;
-- alter table public.payment_charges
--   drop column if exists asaas_fee_cents,
--   drop column if exists split_circula_cents,
--   drop column if exists split_professional_cents,
--   drop column if exists net_value_cents;
-- commit;
-- =====================================================================
