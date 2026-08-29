-- =====================================================================
-- FASE 4 — Monetizacao (Etapa 4.2): funcoes de checkout de produto
-- =====================================================================
-- Cria as duas funcoes de negocio pendentes apos a Etapa 4.1:
--   1. resolve_split(p_community_id, p_amount_cents)
--      Resolve percentual/valores do split e o modelo (native|ledger),
--      registrando a origem da regra. Reutiliza revenue_split_rules
--      (faixa por valor) com fallback em platform_split_settings.
--   2. create_product_order(p_product_id, p_buyer_profile_id,
--                           p_idempotency_key, p_quantity)
--      Cria 1 product_orders de forma atomica: trava a linha de products
--      (FOR UPDATE), valida publicado + membro ativo + entitlement +
--      estoque (max_quantity) contra compras concorrentes, congela o
--      snapshot de preco e de split e devolve o id do pedido.
--      Idempotente por idempotency_key.
--
-- Ambas SECURITY DEFINER / search_path=public / EXECUTE apenas para
-- service_role (chamadas pelas Edge Functions, nunca pelo cliente).
--
-- NAO altera nenhuma tabela, RLS, grant de tabela, trigger ou funcao da
-- Etapa 4.1 nem de billing. NAO faz chamada a Asaas.
--
-- Idempotente: create or replace function + revoke/grant repetiveis.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. resolve_split(p_community_id uuid, p_amount_cents integer)
-- ---------------------------------------------------------------------
create or replace function public.resolve_split(
  p_community_id uuid,
  p_amount_cents integer
)
returns table (
  circula_percent           numeric(5,2),
  circula_amount_cents      integer,
  professional_amount_cents integer,
  split_rule_id             uuid,
  split_rule_source         text,
  split_model               text,
  professional_wallet_id    text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_pct      numeric(5,2);
  v_rule_id  uuid;
  v_source   text;
  v_circula  integer;
  v_owner_id uuid;
  v_wallet   text;
  v_method   text;
  v_verified timestamptz;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'resolve_split: amount_cents invalido (%)', p_amount_cents
      using errcode = 'check_violation';
  end if;

  select c.owner_id
    into v_owner_id
  from public.communities c
  where c.id = p_community_id;

  if v_owner_id is null then
    raise exception 'resolve_split: comunidade % inexistente', p_community_id
      using errcode = 'foreign_key_violation';
  end if;

  -- 1) faixa vigente de revenue_split_rules aplicavel ao valor
  select r.circula_percent, r.id
    into v_pct, v_rule_id
  from public.revenue_split_rules r
  where r.effective_from <= now()
    and p_amount_cents >= r.min_amount_cents
    and (r.max_amount_cents is null or p_amount_cents <= r.max_amount_cents)
  order by r.effective_from desc, r.id desc
  limit 1;

  if v_pct is not null then
    v_source := 'revenue_split_rules';
  else
    -- 2) fallback: platform_split_settings vigente mais recente
    select s.circula_percent
      into v_pct
    from public.platform_split_settings s
    where s.effective_from <= now()
    order by s.effective_from desc, s.id desc
    limit 1;

    if v_pct is not null then
      v_rule_id := null;
      v_source  := 'platform_split_settings';
    end if;
  end if;

  -- 3) nenhuma regra -> a venda nunca segue sem split
  if v_pct is null then
    raise exception 'resolve_split: nenhuma regra de split para community % / amount %',
      p_community_id, p_amount_cents
      using errcode = 'no_data_found';
  end if;

  if v_pct < 0 or v_pct > 100 then
    raise exception 'resolve_split: circula_percent fora de faixa (%)', v_pct
      using errcode = 'check_violation';
  end if;

  -- 4) valores em centavos; a Professional absorve o arredondamento
  v_circula := round(p_amount_cents::numeric * v_pct / 100.0);
  if v_circula < 0 then
    v_circula := 0;
  elsif v_circula > p_amount_cents then
    v_circula := p_amount_cents;
  end if;

  -- 5) modelo: nativo apenas se a Professional dona tem carteira Asaas
  --    verificada e metodo de repasse = asaas_split
  select a.asaas_wallet_id, a.payout_method, a.verified_at
    into v_wallet, v_method, v_verified
  from public.professional_billing_accounts a
  where a.profile_id = v_owner_id;

  circula_percent           := v_pct;
  circula_amount_cents      := v_circula;
  professional_amount_cents := p_amount_cents - v_circula;
  split_rule_id             := v_rule_id;
  split_rule_source         := v_source;

  if v_wallet is not null
     and v_method = 'asaas_split'
     and v_verified is not null then
    split_model            := 'native';
    professional_wallet_id := v_wallet;
  else
    split_model            := 'ledger';
    professional_wallet_id := null;
  end if;

  return next;
end;
$function$;

revoke all on function public.resolve_split(uuid, integer) from public;
grant execute on function public.resolve_split(uuid, integer) to service_role;

-- ---------------------------------------------------------------------
-- 2. create_product_order(p_product_id, p_buyer_profile_id,
--                         p_idempotency_key, p_quantity)
-- ---------------------------------------------------------------------
create or replace function public.create_product_order(
  p_product_id       uuid,
  p_buyer_profile_id uuid,
  p_idempotency_key  uuid,
  p_quantity         integer default 1
)
returns uuid
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  v_existing_id    uuid;
  v_product        public.products%rowtype;
  v_owner_id       uuid;
  v_amount_total   integer;
  v_reserved_qty   integer;
  v_split          record;
  v_reserved_until timestamptz;
  v_new_id         uuid;
begin
  if p_product_id is null or p_buyer_profile_id is null or p_idempotency_key is null then
    raise exception 'create_product_order: parametros obrigatorios ausentes'
      using errcode = 'null_value_not_allowed';
  end if;

  if p_quantity is null or p_quantity < 1 then
    raise exception 'create_product_order: quantity invalido (%)', p_quantity
      using errcode = 'check_violation';
  end if;

  -- idempotencia: pedido ja criado com essa chave -> devolve o mesmo id
  select id
    into v_existing_id
  from public.product_orders
  where idempotency_key = p_idempotency_key;

  if v_existing_id is not null then
    return v_existing_id;
  end if;

  -- trava a linha do produto: serializa compradores concorrentes
  select *
    into v_product
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'create_product_order: produto % inexistente', p_product_id
      using errcode = 'no_data_found';
  end if;

  if v_product.status <> 'published' then
    raise exception 'create_product_order: produto % nao esta publicado (status=%)',
      p_product_id, v_product.status
      using errcode = 'check_violation';
  end if;

  if v_product.price_cents is null or v_product.price_cents <= 0 then
    raise exception 'create_product_order: produto % com preco invalido (%)',
      p_product_id, v_product.price_cents
      using errcode = 'check_violation';
  end if;

  select c.owner_id
    into v_owner_id
  from public.communities c
  where c.id = v_product.community_id;

  if v_owner_id is null then
    raise exception 'create_product_order: comunidade % inexistente', v_product.community_id
      using errcode = 'foreign_key_violation';
  end if;

  -- add-on: comprador precisa ser membro ativo da comunidade
  if not exists (
    select 1
    from public.community_members m
    where m.community_id = v_product.community_id
      and m.profile_id = p_buyer_profile_id
      and m.status = 'active'
  ) then
    raise exception 'create_product_order: comprador % nao e membro ativo da comunidade %',
      p_buyer_profile_id, v_product.community_id
      using errcode = 'insufficient_privilege';
  end if;

  -- produto nao fisico ja adquirido (entitlement ativo) -> bloqueia recompra
  if v_product.type <> 'physical' and exists (
    select 1
    from public.product_entitlements e
    where e.product_id = p_product_id
      and e.profile_id = p_buyer_profile_id
      and e.revoked_at is null
  ) then
    raise exception 'create_product_order: produto % ja adquirido pelo comprador %',
      p_product_id, p_buyer_profile_id
      using errcode = 'unique_violation';
  end if;

  v_amount_total := v_product.price_cents * p_quantity;

  -- estoque: pedidos que consomem vaga (pagos ou reserva ainda valida)
  if v_product.max_quantity is not null then
    select coalesce(sum(o.quantity), 0)
      into v_reserved_qty
    from public.product_orders o
    where o.product_id = p_product_id
      and (
        o.financial_status in ('confirmed', 'received')
        or (o.status in ('reserved', 'awaiting_payment') and o.reserved_until > now())
      );

    if v_reserved_qty + p_quantity > v_product.max_quantity then
      raise exception 'create_product_order: produto % esgotado (max_quantity=%, reservado=%, pedido=%)',
        p_product_id, v_product.max_quantity, v_reserved_qty, p_quantity
        using errcode = 'check_violation';
    end if;
  end if;

  -- congela o split desta venda
  select *
    into v_split
  from public.resolve_split(v_product.community_id, v_amount_total);

  v_reserved_until := now() + interval '30 minutes';

  begin
    insert into public.product_orders (
      product_id,
      community_id,
      buyer_profile_id,
      seller_id,
      quantity,
      status,
      financial_status,
      fulfillment_status,
      reserved_until,
      product_title_snapshot,
      product_type_snapshot,
      unit_price_cents_snapshot,
      currency_snapshot,
      amount_total_cents,
      split_model_snapshot,
      split_rule_id_snapshot,
      split_rule_source,
      circula_percent_snapshot,
      circula_amount_cents_snapshot,
      professional_amount_cents_snapshot,
      professional_wallet_id_snapshot,
      asaas_billing_type,
      idempotency_key
    )
    values (
      v_product.id,
      v_product.community_id,
      p_buyer_profile_id,
      v_owner_id,
      p_quantity,
      'reserved',
      'pending',
      'not_applicable',
      v_reserved_until,
      v_product.title,
      v_product.type,
      v_product.price_cents,
      v_product.currency,
      v_amount_total,
      v_split.split_model,
      v_split.split_rule_id,
      v_split.split_rule_source,
      v_split.circula_percent,
      v_split.circula_amount_cents,
      v_split.professional_amount_cents,
      v_split.professional_wallet_id,
      'UNDEFINED',
      p_idempotency_key
    )
    returning id into v_new_id;
  exception
    when unique_violation then
      -- corrida: outra transacao criou o pedido em paralelo
      select id
        into v_existing_id
      from public.product_orders
      where idempotency_key = p_idempotency_key;

      if v_existing_id is not null then
        return v_existing_id;
      end if;

      raise exception 'create_product_order: conflito ao criar pedido para produto % / comprador %',
        p_product_id, p_buyer_profile_id
        using errcode = 'unique_violation';
  end;

  return v_new_id;
end;
$function$;

revoke all on function public.create_product_order(uuid, uuid, uuid, integer) from public;
grant execute on function public.create_product_order(uuid, uuid, uuid, integer) to service_role;

commit;
