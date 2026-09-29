-- =====================================================================
-- process_platform_subscription_payment — idempotência atômica do
-- ramo subject='platform' do webhook Asaas
-- =====================================================================
-- Contexto (cadeia de achados, nenhum revertido aqui):
--   • commit eea4162 (`fix: allow service role to process webhook
--     events`) + migration 20260928120000: corrigiu o GRANT de SELECT
--     que faltava a `service_role` em `webhook_events` (a Edge Function
--     `asaas-webhook` respondia HTTP 500 mesmo após processar com
--     sucesso, disparando retries da Asaas).
--   • Essa mesma migration já registrou, sem corrigir, um achado
--     separado: o ramo `subject='platform'` de `asaas-webhook/index.ts`
--     recalcula `current_period_end` a partir do valor MUTÁVEL já
--     gravado em `subscriptions` (`base = max(current_period_end,
--     now())`), sem nenhuma guarda determinística — ao contrário do
--     ramo `subject='community'`, que ancora o alvo em
--     `payment.dueDate` (fixo por evento) e usa `.lt(current_period_end,
--     targetEnd)`.
--   • Consequência: um retry do MESMO `asaas_event_id` que chegue depois
--     de `current_period_end` já ter sido estendido, mas antes de
--     `webhook_events.processed_at` ser gravado (falha de rede, timeout
--     da function, etc.), reprocessa a lógica inteira e soma MAIS um
--     ciclo — porque a decisão "já processei?" (linhas 566-582 do
--     arquivo, antes desta migration) só é confiável quando
--     `processed_at` já está preenchido, e essa gravação acontecia em
--     um UPDATE separado, SEPARADO em outra "operação" (não é uma
--     transação de banco de dados de fato, mas sim uma chamada de rede
--     diferente) do que a extensão do período.
--
-- Esta migration fecha essa janela para o ramo `platform` (comunidade e
-- pedido de produto SEGUEM COMO ESTÃO, não são tocados) encapsulando
-- em UMA função `SECURITY DEFINER`, executada em UMA transação:
--   1. claim de idempotência em `webhook_events` (INSERT ... ON CONFLICT
--      DO NOTHING + SELECT processed_at ... FOR UPDATE — trava a linha
--      do evento; se já processado, retorna sem tocar em mais nada);
--   2. SELECT ... FOR UPDATE da subscription (trava a linha da
--      assinatura — serializa qualquer execução concorrente/retry para
--      a MESMA assinatura);
--   3. upsert de payment_charges (idêntico ao upsert que já existia no
--      ramo platform da Edge Function, byte a byte, incluindo o
--      comportamento de zerar `paid_at` em eventos não confirmados);
--   4. transição de subscriptions (idêntica: mesmos CONFIRMED_EVENTS,
--      REOPENABLE_STATUSES, OVERDUE_EVENTS, base = max(current_period_end,
--      now()), addCycleMonths, grace_period_ends_at);
--   5. UPDATE de processed_at — NA MESMA TRANSAÇÃO dos passos 3 e 4.
--
-- Efeito: "processed_at preenchido" passa a ser um sinal 100% confiável
-- de "a mutação de negócio já commitou" — os dois só podem existir
-- juntos (mesma transação) ou nenhum dos dois (rollback total em caso
-- de erro/queda de conexão a qualquer momento da execução).
--
-- addCycleMonths — nota de fidelidade: a implementação original em
-- TypeScript (`supabase/functions/_shared/asaas.ts`) usa
-- `Date.prototype.setUTCMonth`, que ao ultrapassar o número de dias do
-- mês de destino TRANSBORDA para o mês seguinte (ex.: 31/jan + 1 mês =
-- 03/mar em ano não bissexto, não 28/fev). Um simples
-- `current_period_end + interval '1 month'` do Postgres NÃO reproduz
-- isso — ele TRUNCA no último dia válido do mês de destino (28/fev).
-- Para preservar EXATAMENTE o comportamento atual (conforme instruído
-- — nenhuma regra de negócio foi alterada nesta migration), o cálculo
-- abaixo reproduz o transbordo: ancora no primeiro dia do mês-base (em
-- UTC), soma os meses do ciclo, e só então readiciona o deslocamento
-- (dias + hora) dentro do mês original — replicando bit a bit o que
-- `setUTCMonth` faz. Todo o cálculo é feito em `timestamp` (sem fuso),
-- convertendo de/para UTC explicitamente, para não depender do
-- `TimeZone` da sessão do Postgres.
--
-- NÃO corrigido aqui (decisão de produto pendente, fora do escopo
-- desta correção, já registrada na análise técnica que precedeu esta
-- migration): dois eventos CONFIRMADOS e LEGÍTIMOS e DIFERENTES
-- (`asaas_event_id` distintos) para o MESMO `asaas_payment_id` — ex.:
-- Asaas enviando `PAYMENT_CONFIRMED` e depois `PAYMENT_RECEIVED` para a
-- mesma cobrança — continuam, cada um, estendendo o período em um
-- ciclo completo, porque a idempotência é chaveada por
-- `asaas_event_id`, não por `asaas_payment_id`, e a fórmula
-- `base = max(current_period_end, now())` foi mantida exatamente como
-- pedido (não ancorada em `payment.dueDate`, que é o que torna o ramo
-- `community` imune a este caso específico).
--
-- NÃO altera: ramos `community`/`product_order` do webhook, RLS,
-- grants de tabela existentes, dado em produção.
-- =====================================================================

begin;

create or replace function public.process_platform_subscription_payment(
  p_asaas_event_id   text,
  p_event_type       text,
  p_payload          jsonb,
  p_subscription_id  uuid,
  p_asaas_payment_id text,
  p_payment_status   text,
  p_amount_cents     integer,
  p_due_date         date,
  p_billing_type     text,
  p_invoice_url      text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  v_processed_at       timestamptz;
  v_sub                public.subscriptions%rowtype;
  v_cycle              public.billing_cycle;
  v_months             integer;
  v_base               timestamptz;
  v_base_naive         timestamp;
  v_month_start_naive  timestamp;
  v_next_naive         timestamp;
  v_next_period_end    timestamptz;
  v_confirmed_events   constant text[] := array['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'];
  v_overdue_events     constant text[] := array['PAYMENT_OVERDUE'];
  v_reopenable_status  constant public.subscription_status[] :=
    array['trial', 'active', 'past_due']::public.subscription_status[];
begin
  if p_asaas_event_id is null or p_event_type is null or p_payload is null
     or p_subscription_id is null or p_asaas_payment_id is null
     or p_payment_status is null or p_amount_cents is null or p_due_date is null then
    raise exception 'process_platform_subscription_payment: parametros obrigatorios ausentes'
      using errcode = 'null_value_not_allowed';
  end if;

  -- ---- 1) claim de idempotencia em webhook_events ---------------------
  insert into public.webhook_events (asaas_event_id, event_type, payload)
  values (p_asaas_event_id, p_event_type, p_payload)
  on conflict (asaas_event_id) do nothing;

  select processed_at
    into v_processed_at
  from public.webhook_events
  where asaas_event_id = p_asaas_event_id
  for update;

  if v_processed_at is not null then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'subscription_id', p_subscription_id
    );
  end if;

  -- ---- 2) trava a subscription (serializa retries/concorrencia) ------
  select *
    into v_sub
  from public.subscriptions
  where id = p_subscription_id
  for update;

  if not found then
    raise exception 'process_platform_subscription_payment: subscription % inexistente', p_subscription_id
      using errcode = 'no_data_found';
  end if;

  if v_sub.subject <> 'platform' then
    raise exception 'process_platform_subscription_payment: subscription % nao e subject=platform (subject=%)',
      p_subscription_id, v_sub.subject
      using errcode = 'check_violation';
  end if;

  -- ---- 3) billing_cycle do plano (mesmo fallback do codigo atual) ----
  select bp.billing_cycle
    into v_cycle
  from public.billing_plans bp
  where bp.id = v_sub.plan_id;

  v_cycle := coalesce(v_cycle, 'MONTHLY'::public.billing_cycle);

  -- ---- 4) payment_charges upsert (identico ao ramo platform atual) ---
  insert into public.payment_charges (
    subscription_id, asaas_payment_id, status, amount_cents, due_date,
    billing_type, invoice_url, paid_at
  ) values (
    p_subscription_id, p_asaas_payment_id, p_payment_status, p_amount_cents, p_due_date,
    p_billing_type, p_invoice_url,
    case when p_event_type = any(v_confirmed_events) then now() else null end
  )
  on conflict (asaas_payment_id) do update set
    subscription_id = excluded.subscription_id,
    status          = excluded.status,
    amount_cents    = excluded.amount_cents,
    due_date        = excluded.due_date,
    billing_type    = excluded.billing_type,
    invoice_url     = excluded.invoice_url,
    paid_at         = excluded.paid_at;

  -- ---- 5) transicao de subscriptions (identica ao ramo platform atual) --
  if p_event_type = any(v_confirmed_events) and v_sub.status = any(v_reopenable_status) then
    v_base := greatest(v_sub.current_period_end, now());

    v_months := case v_cycle
      when 'MONTHLY' then 1
      when 'SEMIANNUALLY' then 6
      when 'YEARLY' then 12
    end;

    -- reproduz o transbordo de Date.setUTCMonth (ver nota de fidelidade
    -- no cabecalho desta migration) inteiramente em UTC, sem depender
    -- do TimeZone da sessao.
    v_base_naive        := v_base at time zone 'UTC';
    v_month_start_naive := date_trunc('month', v_base_naive);
    v_next_naive         := v_month_start_naive
                              + (v_months || ' months')::interval
                              + (v_base_naive - v_month_start_naive);
    v_next_period_end    := v_next_naive at time zone 'UTC';

    update public.subscriptions
    set status = 'active',
        current_period_end = v_next_period_end,
        grace_period_ends_at = null
    where id = v_sub.id;

    v_sub.status := 'active';
    v_sub.current_period_end := v_next_period_end;
    v_sub.grace_period_ends_at := null;

  elsif p_event_type = any(v_overdue_events) and v_sub.status = any(v_reopenable_status) then
    update public.subscriptions
    set status = 'past_due',
        grace_period_ends_at = now() + interval '3 days'
    where id = v_sub.id;

    v_sub.status := 'past_due';
    v_sub.grace_period_ends_at := now() + interval '3 days';
  end if;

  -- ---- 6) marca processado — MESMA transacao dos passos 4 e 5 -------
  update public.webhook_events
  set processed_at = now()
  where asaas_event_id = p_asaas_event_id;

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'subscription_id', v_sub.id,
    'status', v_sub.status,
    'current_period_end', v_sub.current_period_end
  );
end;
$function$;

comment on function public.process_platform_subscription_payment(
  text, text, jsonb, uuid, text, text, integer, date, text, text
) is
  'Processa, de forma atomicamente idempotente, um evento Asaas de pagamento de assinatura subject=platform: '
  'claim de webhook_events + upsert de payment_charges + transicao de subscriptions + marcacao de processed_at '
  'em uma unica transacao. Chamada apenas por supabase/functions/asaas-webhook (service_role). '
  'Nao usada pelos ramos subject=community nem product_order.';

-- server-side only: nunca exposta via PostgREST a anon/authenticated.
revoke all on function public.process_platform_subscription_payment(
  text, text, jsonb, uuid, text, text, integer, date, text, text
) from public;

grant execute on function public.process_platform_subscription_payment(
  text, text, jsonb, uuid, text, text, integer, date, text, text
) to service_role;

commit;

-- =====================================================================
-- Reversão (referência):
--
-- begin;
-- drop function if exists public.process_platform_subscription_payment(
--   text, text, jsonb, uuid, text, text, integer, date, text, text
-- );
-- commit;
-- =====================================================================
