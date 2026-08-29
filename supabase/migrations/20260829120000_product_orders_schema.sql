-- =====================================================================
-- FASE 4 — Monetizacao (Etapa 4.1): infraestrutura de PEDIDOS de produto
-- =====================================================================
-- Primeira migration ESTRUTURAL do checkout de produtos. Cria apenas
-- tabelas, constraints, indices, RLS, GRANTs, triggers de updated_at, a
-- trilha de status do pedido e a funcao de leitura has_product_access.
--
-- ESCOPO desta migration:
--   1. asaas_customers                 -- vinculo profile -> customer Asaas
--   2. professional_billing_accounts   -- carteira Asaas da Professional
--   3. product_orders                  -- pedido de compra (1 pedido = 1 produto)
--   4. product_order_status_history    -- auditoria de estado + trigger
--   5. product_entitlements            -- fonte unica de acesso ao produto
--   6. product_payouts                 -- ledger de repasse a Professional
--   7. has_product_access(uuid)        -- SO leitura (STABLE, SECURITY DEFINER)
--
-- FORA DE ESCOPO (migrations / etapas seguintes):
--   - resolve_split() e create_product_order() (logica de checkout)
--   - qualquer chamada a Asaas / Edge Function / frontend
--   - product_split_rules: a especificacao REUTILIZA revenue_split_rules
--     e platform_split_settings -- nada e criado aqui
--   - communities.asaas_wallet_id: NAO e adicionada. A carteira vive
--     somente em professional_billing_accounts (fonte unica)
--   - products.sold_count: NAO e adicionada. A concorrencia de estoque
--     sera tratada em create_product_order() via SELECT ... FOR UPDATE
--     sobre a linha de products
--   - captura de endereco / logistica (futura order_shipping_details)
--
-- NAO altera products nem nenhuma tabela / funcao de billing / assinaturas.
--
-- Idempotente: create table/index if not exists, create or replace
-- function/trigger, drop policy if exists + create policy, grant repetivel.
-- Erros estruturais reais (FK para tabela inexistente, etc.) continuam
-- falhando -- nada e silenciado.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. asaas_customers
--    Centraliza o vinculo profile -> customer Asaas (hoje o id so existe
--    espalhado em linhas de subscriptions). Sem PII: CPF/e-mail seguem
--    em billing_customer_data / auth.users.
-- ---------------------------------------------------------------------
create table if not exists public.asaas_customers (
  id                uuid not null default gen_random_uuid(),
  profile_id        uuid not null,
  asaas_customer_id text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint asaas_customers_pkey primary key (id),
  constraint asaas_customers_profile_id_key unique (profile_id),
  constraint asaas_customers_profile_id_fkey
    foreign key (profile_id) references public.profiles (id) on delete cascade
);

create or replace trigger set_asaas_customers_updated_at
  before update on public.asaas_customers
  for each row execute function public.set_updated_at();

alter table public.asaas_customers enable row level security;

drop policy if exists "asaas_customers_select" on public.asaas_customers;
create policy "asaas_customers_select"
  on public.asaas_customers for select to public
  using (profile_id = auth.uid() or public.is_master());

grant select                 on table public.asaas_customers to authenticated;
grant select, insert, update on table public.asaas_customers to service_role;

-- ---------------------------------------------------------------------
-- 2. professional_billing_accounts
--    Fonte UNICA da carteira Asaas (walletId) da Professional e do
--    metodo de repasse. verified_at so e escrito pelo servidor: nao ha
--    policy de INSERT/UPDATE para authenticated.
-- ---------------------------------------------------------------------
create table if not exists public.professional_billing_accounts (
  id              uuid not null default gen_random_uuid(),
  profile_id      uuid not null,
  asaas_wallet_id text,
  payout_method   text not null default 'manual',
  verified_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint professional_billing_accounts_pkey primary key (id),
  constraint professional_billing_accounts_profile_id_key unique (profile_id),
  constraint professional_billing_accounts_payout_method_check
    check (payout_method = any (array['asaas_split'::text, 'manual'::text])),
  constraint professional_billing_accounts_profile_id_fkey
    foreign key (profile_id) references public.profiles (id) on delete cascade
);

create or replace trigger set_professional_billing_accounts_updated_at
  before update on public.professional_billing_accounts
  for each row execute function public.set_updated_at();

alter table public.professional_billing_accounts enable row level security;

drop policy if exists "professional_billing_accounts_select" on public.professional_billing_accounts;
create policy "professional_billing_accounts_select"
  on public.professional_billing_accounts for select to public
  using (profile_id = auth.uid() or public.is_master());

grant select                 on table public.professional_billing_accounts to authenticated;
grant select, insert, update on table public.professional_billing_accounts to service_role;

-- ---------------------------------------------------------------------
-- 3. product_orders
--    1 pedido = 1 produto. Criado EXCLUSIVAMENTE pelo servidor (Edge
--    Function + create_product_order() na proxima migration). Nenhuma
--    policy de INSERT/UPDATE/DELETE para authenticated.
--    Todo o snapshot financeiro / de split e congelado na criacao.
--
--    FK product_id / community_id = ON DELETE RESTRICT: apagar um
--    produto ou comunidade que ja tenha pedido passa a falhar (preserva
--    historico financeiro). O botao "Excluir produto" do ProductManager
--    devera virar "Arquivar" quando houver pedidos -- ajuste de uma
--    etapa futura de frontend.
-- ---------------------------------------------------------------------
create table if not exists public.product_orders (
  id                                 uuid not null default gen_random_uuid(),

  product_id                         uuid not null,
  community_id                       uuid not null,
  buyer_profile_id                   uuid not null,
  seller_id                          uuid not null,
  quantity                           integer not null default 1,

  status                             text not null default 'reserved',
  financial_status                   text not null default 'pending',
  fulfillment_status                 text not null default 'not_applicable',
  reserved_until                     timestamptz,

  -- snapshot do produto
  product_title_snapshot             text not null,
  product_type_snapshot              text not null,

  -- snapshot financeiro
  unit_price_cents_snapshot          integer not null,
  currency_snapshot                  text not null default 'BRL',
  amount_total_cents                 integer not null,

  -- snapshot do split (congelado na criacao do pedido)
  split_model_snapshot               text not null,
  split_rule_id_snapshot             uuid,
  split_rule_source                  text not null default 'none',
  circula_percent_snapshot           numeric(5,2) not null,
  circula_amount_cents_snapshot      integer not null,
  professional_amount_cents_snapshot integer not null,
  professional_wallet_id_snapshot    text,

  -- Asaas
  asaas_customer_id                  text,
  asaas_billing_type                 text not null default 'UNDEFINED',
  asaas_payment_id                   text,
  invoice_url                        text,
  asaas_net_value_cents              integer,
  asaas_fee_cents                    integer,

  -- idempotencia (clique / criacao de pedido)
  idempotency_key                    uuid not null,

  -- datas
  paid_at                            timestamptz,
  refunded_at                        timestamptz,
  canceled_at                        timestamptz,
  created_at                         timestamptz not null default now(),
  updated_at                         timestamptz not null default now(),

  constraint product_orders_pkey primary key (id),
  constraint product_orders_idempotency_key_key unique (idempotency_key),

  constraint product_orders_quantity_check
    check (quantity > 0),
  constraint product_orders_unit_price_cents_snapshot_check
    check (unit_price_cents_snapshot >= 0),
  constraint product_orders_amount_total_cents_check
    check (amount_total_cents > 0),
  constraint product_orders_currency_snapshot_check
    check (currency_snapshot = 'BRL'::text),
  constraint product_orders_status_check
    check (status = any (array['reserved'::text, 'awaiting_payment'::text, 'completed'::text, 'expired'::text, 'canceled'::text, 'refunded'::text])),
  constraint product_orders_financial_status_check
    check (financial_status = any (array['pending'::text, 'confirmed'::text, 'received'::text, 'overdue'::text, 'refunded'::text, 'chargeback'::text])),
  constraint product_orders_fulfillment_status_check
    check (fulfillment_status = any (array['not_applicable'::text, 'pending'::text, 'in_progress'::text, 'fulfilled'::text, 'canceled'::text])),
  constraint product_orders_product_type_snapshot_check
    check (product_type_snapshot = any (array['course'::text, 'ebook'::text, 'workshop'::text, 'event'::text, 'consultation'::text, 'physical'::text])),
  constraint product_orders_split_model_snapshot_check
    check (split_model_snapshot = any (array['native'::text, 'ledger'::text])),
  constraint product_orders_split_rule_source_check
    check (split_rule_source = any (array['revenue_split_rules'::text, 'platform_split_settings'::text, 'none'::text])),
  constraint product_orders_circula_percent_snapshot_check
    check (circula_percent_snapshot >= 0::numeric and circula_percent_snapshot <= 100::numeric),
  constraint product_orders_circula_amount_cents_snapshot_check
    check (circula_amount_cents_snapshot >= 0),
  constraint product_orders_professional_amount_cents_snapshot_check
    check (professional_amount_cents_snapshot >= 0),
  constraint product_orders_split_amounts_sum_check
    check (circula_amount_cents_snapshot + professional_amount_cents_snapshot = amount_total_cents),
  constraint product_orders_split_model_wallet_coherence_check
    check ((split_model_snapshot = 'native'::text) = (professional_wallet_id_snapshot is not null)),
  constraint product_orders_asaas_net_value_cents_check
    check (asaas_net_value_cents is null or asaas_net_value_cents >= 0),
  constraint product_orders_asaas_fee_cents_check
    check (asaas_fee_cents is null or asaas_fee_cents >= 0),

  constraint product_orders_product_id_fkey
    foreign key (product_id) references public.products (id) on delete restrict,
  constraint product_orders_community_id_fkey
    foreign key (community_id) references public.communities (id) on delete restrict,
  constraint product_orders_buyer_profile_id_fkey
    foreign key (buyer_profile_id) references public.profiles (id) on delete restrict,
  constraint product_orders_seller_id_fkey
    foreign key (seller_id) references public.profiles (id) on delete restrict
);

-- indices
create index if not exists product_orders_product_id_idx
  on public.product_orders using btree (product_id);
create index if not exists product_orders_buyer_profile_id_idx
  on public.product_orders using btree (buyer_profile_id, created_at desc);
create index if not exists product_orders_community_id_status_idx
  on public.product_orders using btree (community_id, status);
create index if not exists product_orders_financial_status_idx
  on public.product_orders using btree (financial_status);
create index if not exists product_orders_reserved_until_idx
  on public.product_orders using btree (reserved_until)
  where status = any (array['reserved'::text, 'awaiting_payment'::text]);
create index if not exists product_orders_stock_active_idx
  on public.product_orders using btree (product_id)
  where status = any (array['reserved'::text, 'awaiting_payment'::text, 'completed'::text]);

-- asaas_payment_id: unico quando presente
create unique index if not exists product_orders_asaas_payment_id_key
  on public.product_orders using btree (asaas_payment_id)
  where asaas_payment_id is not null;

-- no maximo 1 pedido ABERTO/PAGO por (produto, comprador) para itens NAO
-- fisicos; produto fisico pode ser recomprado
create unique index if not exists product_orders_open_by_buyer_product_uidx
  on public.product_orders using btree (product_id, buyer_profile_id)
  where status = any (array['reserved'::text, 'awaiting_payment'::text, 'completed'::text])
    and financial_status <> 'refunded'::text
    and product_type_snapshot <> 'physical'::text;

-- updated_at
create or replace trigger set_product_orders_updated_at
  before update on public.product_orders
  for each row execute function public.set_updated_at();

-- RLS
alter table public.product_orders enable row level security;

drop policy if exists "product_orders_select" on public.product_orders;
create policy "product_orders_select"
  on public.product_orders for select to public
  using (
    buyer_profile_id = auth.uid()
    or public.owns_community(community_id)
    or public.is_master()
  );

grant select                 on table public.product_orders to authenticated;
grant select, insert, update on table public.product_orders to service_role;

-- ---------------------------------------------------------------------
-- 4. product_order_status_history
--    Trilha de auditoria das mudancas de status / financial_status /
--    fulfillment_status do pedido. Escrita SO pelo trigger
--    log_product_order_status_change (SECURITY DEFINER). Segue o padrao
--    de subscription_status_history.
-- ---------------------------------------------------------------------
create table if not exists public.product_order_status_history (
  id                     uuid not null default gen_random_uuid(),
  order_id               uuid not null,
  old_status             text,
  new_status             text,
  old_financial_status   text,
  new_financial_status   text,
  old_fulfillment_status text,
  new_fulfillment_status text,
  reason                 text,
  created_at             timestamptz not null default now(),
  constraint product_order_status_history_pkey primary key (id),
  constraint product_order_status_history_order_id_fkey
    foreign key (order_id) references public.product_orders (id) on delete cascade
);

create index if not exists product_order_status_history_order_id_idx
  on public.product_order_status_history using btree (order_id, created_at);

create or replace function public.log_product_order_status_change()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.status is distinct from old.status
     or new.financial_status is distinct from old.financial_status
     or new.fulfillment_status is distinct from old.fulfillment_status then
    insert into public.product_order_status_history (
      order_id,
      old_status,             new_status,
      old_financial_status,   new_financial_status,
      old_fulfillment_status, new_fulfillment_status
    )
    values (
      new.id,
      old.status,             new.status,
      old.financial_status,   new.financial_status,
      old.fulfillment_status, new.fulfillment_status
    );
  end if;
  return new;
end;
$function$;

create or replace trigger product_orders_log_status_change
  after update on public.product_orders
  for each row execute function public.log_product_order_status_change();

alter table public.product_order_status_history enable row level security;

drop policy if exists "product_order_status_history_select" on public.product_order_status_history;
create policy "product_order_status_history_select"
  on public.product_order_status_history for select to public
  using (
    public.is_master()
    or exists (
      select 1
      from public.product_orders o
      where o.id = product_order_status_history.order_id
        and (o.buyer_profile_id = auth.uid() or public.owns_community(o.community_id))
    )
  );

grant execute on function public.log_product_order_status_change() to anon, authenticated, service_role;
grant select         on table public.product_order_status_history to authenticated;
grant select, insert on table public.product_order_status_history to service_role;

-- ---------------------------------------------------------------------
-- 5. product_entitlements
--    Fonte UNICA de acesso ao produto. Concedido/revogado SO pelo
--    servidor (webhook). Nenhuma policy de escrita para authenticated.
--    Parcial UNIQUE garante no maximo 1 entitlement ATIVO por
--    (produto, pessoa).
-- ---------------------------------------------------------------------
create table if not exists public.product_entitlements (
  id            uuid not null default gen_random_uuid(),
  order_id      uuid not null,
  product_id    uuid not null,
  profile_id    uuid not null,
  community_id  uuid not null,
  source        text not null default 'purchase',
  granted_at    timestamptz not null default now(),
  revoked_at    timestamptz,
  revoke_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint product_entitlements_pkey primary key (id),
  constraint product_entitlements_order_id_key unique (order_id),
  constraint product_entitlements_source_check
    check (source = any (array['purchase'::text, 'manual_grant'::text, 'reinstated'::text])),
  constraint product_entitlements_order_id_fkey
    foreign key (order_id) references public.product_orders (id) on delete cascade,
  constraint product_entitlements_product_id_fkey
    foreign key (product_id) references public.products (id) on delete restrict,
  constraint product_entitlements_profile_id_fkey
    foreign key (profile_id) references public.profiles (id) on delete cascade,
  constraint product_entitlements_community_id_fkey
    foreign key (community_id) references public.communities (id) on delete restrict
);

create unique index if not exists product_entitlements_active_uidx
  on public.product_entitlements using btree (product_id, profile_id)
  where revoked_at is null;

create index if not exists product_entitlements_profile_active_idx
  on public.product_entitlements using btree (profile_id)
  where revoked_at is null;
create index if not exists product_entitlements_community_id_idx
  on public.product_entitlements using btree (community_id);
create index if not exists product_entitlements_product_id_idx
  on public.product_entitlements using btree (product_id);

create or replace trigger set_product_entitlements_updated_at
  before update on public.product_entitlements
  for each row execute function public.set_updated_at();

alter table public.product_entitlements enable row level security;

drop policy if exists "product_entitlements_select" on public.product_entitlements;
create policy "product_entitlements_select"
  on public.product_entitlements for select to public
  using (
    profile_id = auth.uid()
    or public.owns_community(community_id)
    or public.is_master()
  );

grant select                 on table public.product_entitlements to authenticated;
grant select, insert, update on table public.product_entitlements to service_role;

-- ---------------------------------------------------------------------
-- 6. product_payouts
--    Ledger de repasse a Professional. 1 linha kind='sale' na
--    confirmacao; 1 linha kind='reversal' em reembolso / chargeback.
--    Member NAO enxerga (dado financeiro da Professional).
--
--    A CHECK de identidade "gross = circula_fee + asaas_fee + net" NAO
--    e criada aqui: depende da politica de absorcao da taxa Asaas, que
--    sera decidida junto com a migration de funcoes.
-- ---------------------------------------------------------------------
create table if not exists public.product_payouts (
  id                 uuid not null default gen_random_uuid(),
  order_id           uuid not null,
  community_id       uuid not null,
  professional_id    uuid not null,
  kind               text not null,
  split_model        text not null,
  gross_amount_cents integer not null,
  asaas_fee_cents    integer not null default 0,
  circula_fee_cents  integer not null,
  net_amount_cents   integer not null,
  status             text not null default 'pending',
  asaas_transfer_id  text,
  created_at         timestamptz not null default now(),
  reversed_at        timestamptz,
  constraint product_payouts_pkey primary key (id),
  constraint product_payouts_order_id_kind_key unique (order_id, kind),
  constraint product_payouts_kind_check
    check (kind = any (array['sale'::text, 'reversal'::text])),
  constraint product_payouts_split_model_check
    check (split_model = any (array['native'::text, 'ledger'::text])),
  constraint product_payouts_status_check
    check (status = any (array['pending'::text, 'paid'::text, 'reversed'::text])),
  constraint product_payouts_gross_amount_cents_check
    check (gross_amount_cents >= 0),
  constraint product_payouts_asaas_fee_cents_check
    check (asaas_fee_cents >= 0),
  constraint product_payouts_circula_fee_cents_check
    check (circula_fee_cents >= 0),
  constraint product_payouts_net_amount_cents_check
    check (net_amount_cents >= 0),
  constraint product_payouts_order_id_fkey
    foreign key (order_id) references public.product_orders (id) on delete cascade,
  constraint product_payouts_community_id_fkey
    foreign key (community_id) references public.communities (id) on delete restrict,
  constraint product_payouts_professional_id_fkey
    foreign key (professional_id) references public.profiles (id) on delete restrict
);

create index if not exists product_payouts_community_id_created_at_idx
  on public.product_payouts using btree (community_id, created_at desc);
create index if not exists product_payouts_professional_id_status_idx
  on public.product_payouts using btree (professional_id, status);
create index if not exists product_payouts_order_id_idx
  on public.product_payouts using btree (order_id);

alter table public.product_payouts enable row level security;

drop policy if exists "product_payouts_select" on public.product_payouts;
create policy "product_payouts_select"
  on public.product_payouts for select to public
  using (public.owns_community(community_id) or public.is_master());

grant select                 on table public.product_payouts to authenticated;
grant select, insert, update on table public.product_payouts to service_role;

-- ---------------------------------------------------------------------
-- 7. has_product_access(p_product_id uuid)
--    SO leitura: o usuario autenticado possui entitlement ATIVO do
--    produto? Uso futuro: policies de acesso a entregaveis (URL
--    assinada de bucket privado). NAO cria logica de checkout.
-- ---------------------------------------------------------------------
create or replace function public.has_product_access(p_product_id uuid)
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.product_entitlements e
    where e.product_id = p_product_id
      and e.profile_id = auth.uid()
      and e.revoked_at is null
  );
$function$;

grant execute on function public.has_product_access(uuid) to anon, authenticated, service_role;

commit;
