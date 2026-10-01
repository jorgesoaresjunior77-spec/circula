-- =====================================================================
-- FASE 18.1 — Guard de autorização em 3 funções SECURITY DEFINER
-- =====================================================================
-- Contexto: a auditoria de SECURITY DEFINER (read-only, sem alterar
-- nada) confirmou em runtime que 3 funções expostas como RPC pública
-- (GRANT EXECUTE para `anon` desde a 20260827000000_baseline_remote_
-- schema.sql, bloco de grant em lote) não validam se quem chama tem
-- relação com o recurso consultado:
--
--   1) calculate_subscription_state(p_subscription_id uuid)
--      — devolve o estado derivado (trial/trial_ending/trial_expired/
--      active/renewing_soon/...) de QUALQUER subscription, dado só o
--      uuid. Zero guard. Provado: anon e um profile sem nenhum vínculo
--      leem o estado real de uma assinatura alheia.
--
--   2) has_active_access(p_profile_id uuid, p_community_id uuid)
--   3) community_subscription_active(p_member_id uuid, p_community_id uuid)
--      — ambas recebem o profile-alvo como PARÂMETRO explícito (em vez
--      de usar auth.uid() internamente, como has_product_access faz
--      corretamente). Provado: anon e um Master sem vínculo com a
--      comunidade conseguem perguntar "profile X tem acesso pago à
--      comunidade Y?" para qualquer X/Y e receber o boolean real.
--
-- QUEM REALMENTE CHAMA CADA UMA (grep completo em src/, supabase/
-- functions/, todas as migrations — nenhuma Edge Function ou trigger
-- toca nessas 3):
--   • calculate_subscription_state: só `useSubscription.ts`, sempre com
--     o id de uma linha que o PRÓPRIO frontend já buscou via
--     `.from('subscriptions').select('*')...` — ou seja, sempre um id
--     que já passou pela policy `subscriptions_select`.
--   • has_active_access: só dentro de
--     `is_community_member(p_community_id, p_enforce_billing)`, sempre
--     como `has_active_access(auth.uid(), p_community_id)` — nunca um
--     terceiro.
--   • community_subscription_active: só dentro do próprio
--     has_active_access, repassando o MESMO p_profile_id que ele
--     recebeu (que, pelo ponto acima, é sempre auth.uid()).
--
-- GUARD ESCOLHIDO — espelha exatamente o predicado já existente em
-- `subscriptions_select` (profile_id = auth.uid() OR is_master() OR
-- (subject='community' AND owns_community(community_id, false))), que
-- é o modelo de autorização já estabelecido para este recurso:
--
--   • calculate_subscription_state: se a subscription encontrada não
--     satisfaz esse predicado, devolve NULL — o MESMO caminho já usado
--     para "não encontrada" (não diferenciar os dois casos evita um
--     oráculo de enumeração: anon não consegue distinguir "não existe"
--     de "existe mas não é sua").
--
--   • has_active_access / community_subscription_active: o profile
--     consultado só é aceito quando `p_profile_id IS NOT DISTINCT FROM
--     auth.uid()` (não `=` — ver nota abaixo) OR is_master() OR
--     owns_community(p_community_id). Caso contrário, devolvem `false`
--     (NUNCA raise).
--
-- POR QUE `IS NOT DISTINCT FROM` E NÃO RAISE: o único call site real de
-- has_active_access passa `auth.uid()` como parâmetro. Para `anon`,
-- isso é `NULL`. Com `=` comum, `NULL = NULL` é `NULL` (falsy) — o
-- guard bloquearia o PRÓPRIO caminho interno legítimo usado por
-- `is_community_member()`, hoje referenciado em dezenas de policies de
-- RLS, quebrando a avaliação de RLS para `anon` em várias tabelas.
-- `IS NOT DISTINCT FROM` trata NULL-vs-NULL como autorizado (idêntico
-- ao comportamento atual, inofensivo: profile_id NULL nunca bate com
-- nenhuma subscription real). Da mesma forma, `false` em vez de `raise`
-- preserva a composição booleana pura usada por `is_community_member`
-- (`exists(...) AND (... OR has_active_access(...))`), que depende de
-- um booleano, nunca de uma exceção.
--
-- ZERO REGRESSÃO para o fluxo legítimo: como o guard de
-- `calculate_subscription_state` é um espelho exato de
-- `subscriptions_select`, qualquer subscription_id que o frontend já
-- conseguiu enxergar via SELECT continua passando no guard e
-- devolvendo o estado real. Os únicos call sites de
-- has_active_access/community_subscription_active sempre passam
-- auth.uid() como o profile — meta sempre batida pelo primeiro ramo do
-- guard, SECURITY DEFINER não muda auth.uid().
--
-- NÃO ALTERADO: GRANT/REVOKE (fora de escopo desta correção — o
-- problema é de autorização dentro da função, não de GRANT; hardening
-- de GRANT das demais ~35 funções fica para uma etapa futura), schema,
-- RLS de tabelas, dados.
--
-- Aditivo (CREATE OR REPLACE). Reversível (rodapé). Transacional.
-- =====================================================================

begin;

-- ---- 1) calculate_subscription_state ---------------------------------
create or replace function public.calculate_subscription_state(p_subscription_id uuid)
 returns text
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_sub record;
  v_now timestamptz := now();
  v_days_to_trial_end numeric;
  v_days_to_period_end numeric;
begin
  select * into v_sub from public.subscriptions where id = p_subscription_id;

  if not found then
    return null;
  end if;

  -- coalesce(..., false): `v_sub.profile_id = auth.uid()` é NULL (não
  -- false) quando auth.uid() é NULL (anon) — em plpgsql, `if not (NULL)`
  -- NÃO dispara (lógica de 3 valores), o que deixaria o guard inofensivo
  -- para anon. O coalesce garante "nega por padrão" sempre que a
  -- expressão não resolver claramente para true.
  if not coalesce(
    v_sub.profile_id = auth.uid()
    or public.is_master()
    or (v_sub.subject = 'community' and public.owns_community(v_sub.community_id, false)),
    false
  ) then
    return null;
  end if;

  if v_sub.status = 'trial' then
    v_days_to_trial_end := extract(epoch from (v_sub.trial_ends_at - v_now)) / 86400.0;
    if v_days_to_trial_end <= 0 then
      return 'trial_expired';
    elsif v_days_to_trial_end <= 3 then
      return 'trial_ending';
    else
      return 'trial';
    end if;
  end if;

  if v_sub.status = 'active' then
    v_days_to_period_end := extract(epoch from (v_sub.current_period_end - v_now)) / 86400.0;
    if v_days_to_period_end <= 3 and v_days_to_period_end > 0 then
      return 'renewing_soon';
    else
      return 'active';
    end if;
  end if;

  return v_sub.status::text;
end;
$function$;

-- ---- 2) community_subscription_active --------------------------------
create or replace function public.community_subscription_active(p_member_id uuid, p_community_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select case
    when not (
      p_member_id is not distinct from auth.uid()
      or public.is_master()
      or public.owns_community(p_community_id)
    ) then false
    else coalesce(
      (
        select status <> 'blocked'
        from public.subscriptions
        where subject = 'community' and profile_id = p_member_id and community_id = p_community_id
        order by created_at desc
        limit 1
      ),
      true
    )
  end;
$function$;

-- ---- 3) has_active_access ---------------------------------------------
create or replace function public.has_active_access(p_profile_id uuid, p_community_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select case
    when not (
      p_profile_id is not distinct from auth.uid()
      or public.is_master()
      or public.owns_community(p_community_id)
    ) then false
    else (
      public.is_master()
      or (
        public.professional_platform_active(
          (select owner_id from public.communities where id = p_community_id)
        )
        and (
          (select owner_id from public.communities where id = p_community_id) = p_profile_id
          or public.community_subscription_active(p_profile_id, p_community_id)
        )
      )
    )
  end;
$function$;

commit;

-- =====================================================================
-- Reversão (referência) — volta aos corpos sem guard de autorização
-- (NÃO recomendado — restaura as 3 vulnerabilidades confirmadas):
--
-- begin;
--
-- create or replace function public.calculate_subscription_state(p_subscription_id uuid)
--  returns text language plpgsql stable security definer set search_path to 'public'
-- as $function$
-- declare
--   v_sub record;
--   v_now timestamptz := now();
--   v_days_to_trial_end numeric;
--   v_days_to_period_end numeric;
-- begin
--   select * into v_sub from public.subscriptions where id = p_subscription_id;
--   if not found then return null; end if;
--   if v_sub.status = 'trial' then
--     v_days_to_trial_end := extract(epoch from (v_sub.trial_ends_at - v_now)) / 86400.0;
--     if v_days_to_trial_end <= 0 then return 'trial_expired';
--     elsif v_days_to_trial_end <= 3 then return 'trial_ending';
--     else return 'trial'; end if;
--   end if;
--   if v_sub.status = 'active' then
--     v_days_to_period_end := extract(epoch from (v_sub.current_period_end - v_now)) / 86400.0;
--     if v_days_to_period_end <= 3 and v_days_to_period_end > 0 then return 'renewing_soon';
--     else return 'active'; end if;
--   end if;
--   return v_sub.status::text;
-- end;
-- $function$;
--
-- create or replace function public.community_subscription_active(p_member_id uuid, p_community_id uuid)
--  returns boolean language sql stable security definer set search_path to 'public'
-- as $function$
--   select coalesce(
--     (select status <> 'blocked' from public.subscriptions
--      where subject = 'community' and profile_id = p_member_id and community_id = p_community_id
--      order by created_at desc limit 1),
--     true
--   );
-- $function$;
--
-- create or replace function public.has_active_access(p_profile_id uuid, p_community_id uuid)
--  returns boolean language sql stable security definer set search_path to 'public'
-- as $function$
--   select
--     public.is_master()
--     or (
--       public.professional_platform_active((select owner_id from public.communities where id = p_community_id))
--       and (
--         (select owner_id from public.communities where id = p_community_id) = p_profile_id
--         or public.community_subscription_active(p_profile_id, p_community_id)
--       )
--     );
-- $function$;
--
-- commit;
-- =====================================================================
