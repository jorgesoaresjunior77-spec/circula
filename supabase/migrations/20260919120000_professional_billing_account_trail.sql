-- =====================================================================
-- FASE 16.1 — Onboarding financeiro da Professional: trilha de verificação
-- da conta Asaas conectada
-- =====================================================================
-- Contexto: a tabela `public.professional_billing_accounts` já existe
-- desde a Fase 4 (`20260829120000_product_orders_schema.sql`) como
-- "fonte única da carteira Asaas (walletId) da Professional". Ela tem
-- hoje: `profile_id` (UNIQUE), `asaas_wallet_id`, `payout_method`
-- ('asaas_split' | 'manual', default 'manual'), `verified_at`,
-- `created_at`, `updated_at`. RLS: SELECT da própria linha ou master;
-- INSERT/UPDATE só `service_role` (sem policy para `authenticated`).
--
-- A Etapa 16.1 introduz a Edge Function `connect-asaas-account`, que
-- valida a titularidade da conta Asaas da Professional (cruzando o
-- CPF/CNPJ da conta Asaas com `billing_customer_data`) e então grava
-- `asaas_wallet_id` + `verified_at`. Para a UI e para a trilha de
-- auditoria antifraude, esta migration ADICIONA 4 colunas NÃO sensíveis:
--
--   • asaas_account_name    text  — nome do titular da conta Asaas
--                                   (lido de /myAccount/commercialInfo).
--                                   Serve para a Professional confirmar
--                                   visualmente "sim, é a minha conta".
--   • asaas_account_status  text  — último `general` de /myAccount/status
--                                   observado ('APPROVED' | 'PENDING' |
--                                   'REJECTED' | 'AWAITING_APPROVAL').
--   • verification_method   text  — como o vínculo foi verificado.
--                                   Nesta etapa só 'api_key' (chave
--                                   transitória). 'deferred' fica
--                                   reservado para o fallback descrito
--                                   na auditoria 16.0 (não implementado).
--   • disconnected_at       timestamptz — quando a Professional
--                                   desconectou a conta (via
--                                   `disconnect-asaas-account`).
--
-- NENHUMA credencial é armazenada. A API Key da Professional NUNCA
-- toca o banco — é usada só em memória, dentro da Edge Function.
--
-- Aditivo puro: `add column if not exists`. Não altera RLS, policies,
-- grants (o `grant select ... to authenticated` já é a nível de tabela,
-- então cobre colunas novas automaticamente), triggers, tipos, índices
-- ou qualquer outra tabela. Idempotente. Reversível (rodapé).
--
-- NÃO cria subcontas. NÃO cria tabela de API keys. NÃO enfraquece RLS.
-- =====================================================================

begin;

alter table public.professional_billing_accounts
  add column if not exists asaas_account_name   text;

alter table public.professional_billing_accounts
  add column if not exists asaas_account_status text;

alter table public.professional_billing_accounts
  add column if not exists verification_method  text;

alter table public.professional_billing_accounts
  add column if not exists disconnected_at      timestamptz;

-- Restringe os valores aceitos em `verification_method` sem quebrar
-- linhas existentes (NULL é permitido). `not valid` evita varredura;
-- a tabela está vazia hoje, mas mantém o padrão conservador do projeto.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'professional_billing_accounts_verification_method_check'
  ) then
    alter table public.professional_billing_accounts
      add constraint professional_billing_accounts_verification_method_check
      check (verification_method is null
             or verification_method = any (array['api_key'::text, 'deferred'::text]))
      not valid;
  end if;
end $$;

commit;

-- =====================================================================
-- Reversão (referência):
--
-- begin;
-- alter table public.professional_billing_accounts
--   drop constraint if exists professional_billing_accounts_verification_method_check;
-- alter table public.professional_billing_accounts drop column if exists disconnected_at;
-- alter table public.professional_billing_accounts drop column if exists verification_method;
-- alter table public.professional_billing_accounts drop column if exists asaas_account_status;
-- alter table public.professional_billing_accounts drop column if exists asaas_account_name;
-- commit;
-- =====================================================================
