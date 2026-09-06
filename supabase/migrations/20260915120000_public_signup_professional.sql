-- =====================================================================
-- FASE 15.1 — Cadastro público de Professional + trial de 21 dias
-- =====================================================================
-- Objetivo: uma pessoa sem conta cria a própria conta pela tela pública
-- e já nasce `role='professional'` com um `subscriptions` de plataforma
-- em `status='trial'` (21 dias). Depois do login ela cai direto na tela
-- "Crie sua comunidade" (roteamento que o Dashboard já faz para
-- `role='professional'` sem comunidade).
--
-- COMO — só o corpo da função `public.handle_new_user()` muda. Ela já
-- é `SECURITY DEFINER`, já roda `AFTER INSERT ON auth.users` (trigger
-- `on_auth_user_created`), e já é o ponto oficial de provisionamento do
-- perfil de um novo usuário. Nada mais é tocado:
--   • `prevent_role_escalation` (trigger BEFORE UPDATE em profiles) —
--     INTACTO. Mudança de role DEPOIS do cadastro continua só para o
--     Master. A única promoção possível aqui é member -> professional,
--     no próprio INSERT.
--   • `create_platform_trial()` (AFTER UPDATE OF role) — INTACTO.
--     Continua servindo o caminho "Master promove member existente".
--     O guard `not exists (... subject='platform' ... status<>'canceled')`
--     — igual ao índice único `subscriptions_platform_unique_idx` —
--     impede assinatura duplicada entre os dois caminhos.
--   • Nenhuma policy, grant, RLS, tabela, coluna, tipo ou índice muda.
--   • Nenhum GRANT novo. `service_role` não é usado aqui nem no
--     frontend — a promoção acontece dentro do trigger DEFINER.
--
-- SEGURANÇA — o `role` sai de um `case` que só produz 'professional'
-- (quando o signup marca `account_type='professional'` no
-- `raw_user_meta_data`) ou 'member' (qualquer outro valor / ausência).
-- **'master' é impossível por construção.** O `raw_user_meta_data` é
-- controlável pelo cliente no `signUp`, mas o pior resultado é virar
-- 'professional' — que é exatamente o produto público — com um trial
-- que precisará ser pago. O usuário não consegue: definir 'master',
-- alterar role de terceiros (INSERT só mexe na própria linha nova;
-- UPDATE segue barrado por `prevent_role_escalation`), nem criar
-- assinatura de outro profile (o INSERT em subscriptions é para
-- `new.id` e acontece só dentro desta função DEFINER; o cliente não
-- tem GRANT INSERT em `subscriptions`).
--
-- Aditivo (só `create or replace function`). Reversível (rodapé).
-- Idempotente. Não afeta usuários já existentes (só roda em INSERT
-- novo de auth.users).
-- =====================================================================

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_role public.user_role;
begin
  -- Fase 15.1 — cadastro público: `account_type='professional'` no
  -- metadata do signup faz o perfil nascer professional. Qualquer
  -- outro valor (ou ausência) -> 'member' (default histórico).
  -- NUNCA 'master'.
  v_role := case
    when new.raw_user_meta_data ->> 'account_type' = 'professional'
      then 'professional'::public.user_role
    else 'member'::public.user_role
  end;

  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data ->> 'full_name', v_role);

  -- Trial de plataforma de 21 dias para o novo professional. Espelha
  -- o corpo de `create_platform_trial()`. Mesmo guard de unicidade do
  -- índice `subscriptions_platform_unique_idx`.
  if v_role = 'professional' then
    if not exists (
      select 1 from public.subscriptions
      where subject = 'platform'
        and profile_id = new.id
        and status <> 'canceled'
    ) then
      insert into public.subscriptions (
        subject, profile_id, plan_id, status,
        trial_ends_at, current_period_start, current_period_end
      )
      values (
        'platform', new.id,
        (select id from public.billing_plans where code = 'professional_monthly'),
        'trial', now() + interval '21 days', now(), now() + interval '21 days'
      );
    end if;
  end if;

  return new;
end;
$function$;

commit;

-- =====================================================================
-- Reversão (referência) — volta `handle_new_user` ao corpo anterior
-- (só cria o profile, sem role, sem trial):
--
-- begin;
-- create or replace function public.handle_new_user()
-- returns trigger language plpgsql security definer set search_path to 'public'
-- as $function$
-- begin
--   insert into public.profiles (id, full_name)
--   values (new.id, new.raw_user_meta_data ->> 'full_name');
--   return new;
-- end;
-- $function$;
-- commit;
-- =====================================================================
