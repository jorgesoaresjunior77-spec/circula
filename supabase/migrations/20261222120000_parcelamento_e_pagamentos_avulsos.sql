-- Auditoria financeira (26/11/2026):
--  1) Semestral e anual podem ser pagos de uma vez (assinatura que renova) ou PARCELADOS no cartão
--     (uma cobrança só, dividida em até 6 ou 12 parcelas — nunca várias assinaturas mensais).
--     addon_subscriptions guarda quantas parcelas e o id do parcelamento no Asaas.
--  2) Cada pagamento de assinatura avulsa / Premium passa a ter registro financeiro próprio
--     (addon_payments): antes, o webhook só liberava o acesso e não guardava o pagamento.
-- Aditiva: não muda nem apaga nada que já existe.

begin;

alter table public.addon_subscriptions
  add column if not exists installment_count integer not null default 1,
  add column if not exists asaas_installment_id text;

alter table public.addon_subscriptions
  drop constraint if exists addon_subscriptions_installment_count_check;
alter table public.addon_subscriptions
  add constraint addon_subscriptions_installment_count_check check (
    installment_count between 1 and 12
    and (installment_count = 1 or billing_cycle in ('SEMIANNUALLY', 'YEARLY'))
    and (billing_cycle <> 'SEMIANNUALLY' or installment_count <= 6)
  );

create unique index if not exists addon_subscriptions_installment_uidx
  on public.addon_subscriptions (asaas_installment_id)
  where asaas_installment_id is not null;

create table if not exists public.addon_payments (
  id                      uuid primary key default gen_random_uuid(),
  addon_subscription_id   uuid not null references public.addon_subscriptions (id) on delete cascade,
  profile_id              uuid not null references public.profiles (id) on delete cascade,
  community_id            uuid not null references public.communities (id) on delete cascade,
  asaas_payment_id        text not null unique,
  status                  text not null,
  amount_cents            integer not null check (amount_cents >= 0),
  net_value_cents         integer,
  due_date                date,
  paid_at                 timestamptz,
  billing_type            text,
  invoice_url             text,
  installment_number      integer,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists addon_payments_sub_idx on public.addon_payments (addon_subscription_id);
create index if not exists addon_payments_profile_idx on public.addon_payments (profile_id, community_id);

alter table public.addon_payments enable row level security;

-- Leitura: a própria membro, a dona da comunidade e o Master. Escrita só pelo webhook (service role).
drop policy if exists "addon_payments_select" on public.addon_payments;
create policy "addon_payments_select" on public.addon_payments for select to authenticated
  using (profile_id = auth.uid() or public.owns_community(community_id) or public.is_master());

revoke all on table public.addon_payments from public, anon;
grant select on table public.addon_payments to authenticated;

commit;

-- ---- Rollback (manual) ------------------------------------------------
-- begin;
-- drop table if exists public.addon_payments;
-- drop index if exists public.addon_subscriptions_installment_uidx;
-- alter table public.addon_subscriptions drop constraint if exists addon_subscriptions_installment_count_check;
-- alter table public.addon_subscriptions drop column if exists asaas_installment_id, drop column if exists installment_count;
-- commit;
