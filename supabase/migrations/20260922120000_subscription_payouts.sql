-- =====================================================================
-- FASE 16.2 — Ledger de repasse de assinatura de comunidade
-- =====================================================================
-- Objetivo: registrar o movimento financeiro de cada cobrança CONFIRMADA
-- de assinatura de comunidade — quanto foi para a Professional, quanto
-- ficou com a Círcula, qual a taxa Asaas — e as reversões (estorno /
-- chargeback). É a fonte do extrato "Recebimentos" da Professional e da
-- reconciliação contábil.
--
-- Espelha `public.product_payouts` (Loja), que já tem exatamente este
-- desenho: kind ('sale'|'reversal'), split_model, gross/asaas_fee/
-- circula_fee/net_amount_cents, status, asaas_transfer_id.
--
-- CRIA UMA TABELA NOVA. Não altera nenhuma tabela existente (só FKs de
-- referência para subscriptions/payment_charges/communities/profiles,
-- todas já aplicadas).
--
-- ESCRITA: exclusivamente pela Edge Function `asaas-webhook`
-- (`service_role`) na Etapa 16.2.4 — não há RPC nem policy de escrita.
-- LEITURA: a Professional vê os próprios repasses; o dono da comunidade
-- idem; o Master (admin de billing). O MEMBER NÃO VÊ (não é o dinheiro
-- dele).
--
-- NÃO altera: RLS/policies/grants de outras tabelas, a arquitetura de
-- split 90/10, o piso R$ 14,90, `resolve_split`, `create_community_trial`,
-- `billing_plans`. Tabela nova = vazia = zero impacto em dados existentes.
--
-- Idempotente (`create table if not exists`, `drop policy if exists` +
-- `create policy`, `create index if not exists`). Transacional.
-- Reversível (rodapé).
-- =====================================================================

begin;

create table if not exists public.subscription_payouts (
  id                 uuid not null default gen_random_uuid(),
  subscription_id    uuid not null,
  payment_charge_id  uuid,
  community_id       uuid not null,
  professional_id    uuid not null,
  kind               text not null,
  split_model        text not null,
  gross_amount_cents integer not null,
  asaas_fee_cents    integer not null default 0,
  circula_fee_cents  integer not null,
  net_amount_cents   integer not null,           -- valor destinado à Professional
  status             text not null,
  asaas_transfer_id  text,
  created_at         timestamptz not null default now(),
  reversed_at        timestamptz,

  constraint subscription_payouts_pkey primary key (id),

  constraint subscription_payouts_subscription_id_fkey
    foreign key (subscription_id) references public.subscriptions (id) on delete cascade,
  constraint subscription_payouts_payment_charge_id_fkey
    foreign key (payment_charge_id) references public.payment_charges (id) on delete set null,
  constraint subscription_payouts_community_id_fkey
    foreign key (community_id) references public.communities (id) on delete restrict,
  constraint subscription_payouts_professional_id_fkey
    foreign key (professional_id) references public.profiles (id) on delete restrict,

  constraint subscription_payouts_kind_check
    check (kind = any (array['sale'::text, 'reversal'::text])),
  constraint subscription_payouts_split_model_check
    check (split_model = any (array['native'::text, 'ledger'::text])),
  constraint subscription_payouts_status_check
    check (status = any (array['paid'::text, 'pending'::text, 'reversed'::text])),
  constraint subscription_payouts_gross_amount_cents_check
    check (gross_amount_cents >= 0),
  constraint subscription_payouts_asaas_fee_cents_check
    check (asaas_fee_cents >= 0),
  constraint subscription_payouts_circula_fee_cents_check
    check (circula_fee_cents >= 0),
  constraint subscription_payouts_net_amount_cents_check
    check (net_amount_cents >= 0),

  -- idempotência: um evento não gera 2 linhas para a mesma cobrança/kind
  constraint subscription_payouts_charge_kind_unique
    unique (subscription_id, payment_charge_id, kind)
);

create index if not exists subscription_payouts_subscription_id_idx
  on public.subscription_payouts using btree (subscription_id);
create index if not exists subscription_payouts_community_id_idx
  on public.subscription_payouts using btree (community_id);
create index if not exists subscription_payouts_professional_id_idx
  on public.subscription_payouts using btree (professional_id);
create index if not exists subscription_payouts_status_idx
  on public.subscription_payouts using btree (status);

alter table public.subscription_payouts enable row level security;

drop policy if exists "subscription_payouts_select" on public.subscription_payouts;
create policy "subscription_payouts_select"
  on public.subscription_payouts for select to public
  using (
    public.is_master()
    or professional_id = auth.uid()
    or public.owns_community(community_id, false)
  );
-- Sem policy de INSERT/UPDATE/DELETE: escrita só via `service_role`
-- (Edge Function `asaas-webhook`).

grant select                 on table public.subscription_payouts to authenticated;
grant select, insert, update on table public.subscription_payouts to service_role;
-- Nada para anon. Nenhum DELETE para ninguém.

commit;

-- =====================================================================
-- Reversão (referência):
--
-- begin;
-- drop policy if exists "subscription_payouts_select" on public.subscription_payouts;
-- drop table if exists public.subscription_payouts;
-- commit;
-- =====================================================================
