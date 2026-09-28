-- =====================================================================
-- 91 — CONTA DE REPASSE FINANCEIRO DA PROFESSIONAL: professional_billing_accounts
-- =====================================================================
-- Fase P1-F3.2 (primeira tabela — a mais crítica das 4 identificadas
-- na auditoria: único dado tipo "conta bancária" de uma pessoa real no
-- schema, alimenta `resolve_split()` e tem 2 Edge Functions + 1 hook
-- de frontend em produção). Nunca teve cenário de RLS. Tabela vazia em
-- produção hoje (nenhuma Professional real conectou Asaas ainda) — o
-- cenário inteiro roda sobre fixtures sintéticas.
--
-- Estrutura auditada ao vivo (information_schema + pg_constraint):
--   id uuid pk · profile_id uuid not null (fk -> profiles.id, CASCADE,
--   UNIQUE — 1 conta por profile) · asaas_wallet_id text (identificador
--   financeiro Asaas) · payout_method text not null default 'manual'
--   (check: asaas_split|manual) · verified_at timestamptz ·
--   asaas_account_name · asaas_account_status · verification_method
--   (check NOT VALID: api_key|deferred) · disconnected_at ·
--   created_at/updated_at.
--   Campos financeiros/Asaas: `asaas_wallet_id` (identificador de
--   carteira, usado no split nativo), `asaas_account_name`/
--   `asaas_account_status` (metadados da conta), `payout_method`/
--   `verified_at` (decidem se o split é nativo ou via ledger).
--
-- Policies auditadas ao vivo (pg_policies):
--   professional_billing_accounts_select = profile_id = auth.uid() OR is_master()
--   SEM policy de INSERT/UPDATE/DELETE.
--
-- GRANTs auditados ao vivo (information_schema.role_table_grants):
--   anon:          nenhum (nem SELECT)
--   authenticated: SOMENTE SELECT (sem INSERT/UPDATE/DELETE — a
--                  barreira de escrita é a camada de GRANT, nem chega
--                  a precisar de policy; vale para QUALQUER persona
--                  autenticada, inclusive a própria dona e inclusive
--                  Master — só SELECT tem bypass de Master, escrita
--                  não tem bypass nenhum)
--   service_role:  INSERT, SELECT, UPDATE (SEM DELETE — nem o server
--                  consegue apagar; desconexão é UPDATE zerando os
--                  campos + `disconnected_at`, nunca DELETE)
--
-- Edge Functions (únicas escritoras, via `service_role`):
--   `connect-asaas-account` — a Professional cola a API Key da PRÓPRIA
--     conta Asaas; a função usa essa key SÓ EM MEMÓRIA para 3 GETs de
--     leitura à Asaas (wallet real, nome/CPF-CNPJ do titular, status),
--     CRUZA o `cpfCnpj` retornado com `billing_customer_data.
--     document_number` do PRÓPRIO perfil (rejeita com 422 se não
--     bater), rejeita wallet da própria Círcula (`CIRCULA_WALLET_IDS`),
--     e só então faz upsert. A API Key nunca é persistida.
--   `disconnect-asaas-account` — UPDATE escopado a
--     `.eq('profile_id', user.id)` (do JWT do chamador, nunca de
--     input do cliente) — zera `asaas_wallet_id`/`payout_method`/
--     `verified_at`, marca `disconnected_at`.
--   `asaas-create-subscription` — só LÊ (para decidir o split da
--     assinatura sendo criada).
--
-- Hook: `useProfessionalBillingAccount.ts` — `select('*')` da própria
-- linha (RLS `profile_id = auth.uid()`), nunca escreve direto — todo
-- connect/disconnect passa pelas Edge Functions acima.
--
-- Relação com `RevenuePanel`/`useProfessionalRevenue.ts`: **não lê
-- esta tabela** — comentário explícito no código confirma que o
-- extrato de recebimentos usa só `subscription_payouts`/
-- `product_payouts` (já cobertos), nunca `walletId`/
-- `asaas_customer_id`/dado bancário. Confirmado por leitura do código,
-- não presumido.
--
-- Relação com `resolve_split(community_id, amount_cents)` (SECURITY
-- DEFINER, STABLE): lê `asaas_wallet_id`/`payout_method`/`verified_at`
-- da DONA da comunidade para decidir `split_model` ('native' só se
-- carteira verificada E `payout_method='asaas_split'`, senão
-- 'ledger'). `EXECUTE` continua revogado de `anon`/`authenticated`
-- (reconfirmado ao vivo nesta auditoria) — sem caminho indireto de
-- leitura por aí.
--
-- Sem relação com `communities`/`subscriptions`/`products` diretamente
-- (a ponte com `communities` é só via `resolve_split()`, que já é
-- SECURITY DEFINER e não expõe a tabela ao cliente).
--
-- Fixtures: 2 contas sintéticas — "Professional A" = persona real
-- `prof` (1c20d81a…, dona da comunidade A) e "Professional B" = perfil
-- real PRÉ-EXISTENTE `335783ca-e125-4aaf-91c3-0ded657723fb`
-- ("Teste Profissional 15.1", `role='professional'`, sem nenhuma linha
-- prévia nesta tabela, conferido antes de escrever o cenário) — usado
-- só como PERSONA (via `set_config`/`set local role`) para provar
-- isolamento profissional-a-profissional genuíno, nunca alterada de
-- fato (toda escrita roda em transação com ROLLBACK final).
-- `profiles` não tem INSERT direto possível nesta suíte (FK para
-- `auth.users`), por isso reusa um perfil profissional real já
-- existente em vez de criar um sintético.
-- =====================================================================

insert into public.professional_billing_accounts
  (id, profile_id, asaas_wallet_id, payout_method, verified_at, asaas_account_name, asaas_account_status, verification_method)
values
  ('91000000-0000-4000-8000-0000000000a1', pg_temp.fx('prof'), 'wallet_sintetico_A_91', 'asaas_split', now(), '[rls-suite] Conta A', 'APPROVED', 'api_key'),
  ('91000000-0000-4000-8000-0000000000b1', '335783ca-e125-4aaf-91c3-0ded657723fb', 'wallet_sintetico_B_91', 'asaas_split', now(), '[rls-suite] Conta B', 'APPROVED', 'api_key');

-- ================= ISOLAMENTO (SELECT) ===================================

-- Professional A acessa a própria conta.
select pg_temp.expect_count('prof (A): vê a própria conta',
  pg_temp.fx('prof'),
  'select count(*) from public.professional_billing_accounts where id = ''91000000-0000-4000-8000-0000000000a1''', 1);

-- Professional B acessa a própria conta.
select pg_temp.expect_count('Professional B: vê a própria conta',
  '335783ca-e125-4aaf-91c3-0ded657723fb',
  'select count(*) from public.professional_billing_accounts where id = ''91000000-0000-4000-8000-0000000000b1''', 1);

-- Professional B NÃO acessa o registro de A (dado sensível — prova que
-- identificadores Asaas/wallet de A não ficam acessíveis a outra
-- Professional).
select pg_temp.expect_count('Professional B: NÃO vê a conta de A (isolamento entre Professionals)',
  '335783ca-e125-4aaf-91c3-0ded657723fb',
  'select count(*) from public.professional_billing_accounts where id = ''91000000-0000-4000-8000-0000000000a1''', 0);

-- E o inverso: A não vê a conta de B.
select pg_temp.expect_count('prof (A): NÃO vê a conta de B (isolamento mútuo)',
  pg_temp.fx('prof'),
  'select count(*) from public.professional_billing_accounts where id = ''91000000-0000-4000-8000-0000000000b1''', 0);

-- Member (sem vínculo nenhum com conta de repasse) não acessa.
select pg_temp.expect_count('member: NÃO vê a conta de A (sem vínculo)',
  pg_temp.fx('member'),
  'select count(*) from public.professional_billing_accounts where id = ''91000000-0000-4000-8000-0000000000a1''', 0);

-- anon bloqueado.
select pg_temp.expect_locked('anon: NÃO vê professional_billing_accounts (sem GRANT)',
  null,
  'select count(*) from public.professional_billing_accounts');

-- Master: bypass explícito, vê as duas contas.
select pg_temp.expect_count('master: vê as contas de A e B (bypass by design)',
  pg_temp.fx('master'),
  'select count(*) from public.professional_billing_accounts where id in (''91000000-0000-4000-8000-0000000000a1'',''91000000-0000-4000-8000-0000000000b1'')', 2);

-- ================= ESCRITA: só service_role (nenhum GRANT p/ authenticated) =

-- INSERT: bloqueado até para a própria dona (sem GRANT de INSERT).
select pg_temp.expect_write('prof (A): INSERT nova conta -> BLOQUEADO (só service_role, via connect-asaas-account)',
  pg_temp.fx('prof'),
  'insert into public.professional_billing_accounts (profile_id, payout_method) values (''335783ca-e125-4aaf-91c3-0ded657723fb'', ''manual'')',
  false);

select pg_temp.expect_write('member: INSERT nova conta -> BLOQUEADO',
  pg_temp.fx('member'),
  'insert into public.professional_billing_accounts (profile_id, payout_method) values (''335783ca-e125-4aaf-91c3-0ded657723fb'', ''manual'')',
  false);

select pg_temp.expect_write('anon: INSERT nova conta -> BLOQUEADO',
  null,
  'insert into public.professional_billing_accounts (profile_id, payout_method) values (''335783ca-e125-4aaf-91c3-0ded657723fb'', ''manual'')',
  false);

-- UPDATE: bloqueado até para a própria dona (mesmo motivo — sem GRANT).
select pg_temp.expect_write('prof (A): UPDATE payout_method da própria conta -> BLOQUEADO (só service_role, via disconnect-asaas-account)',
  pg_temp.fx('prof'),
  'update public.professional_billing_accounts set payout_method = ''manual'' where id = ''91000000-0000-4000-8000-0000000000a1''',
  false);

select pg_temp.expect_write('member: UPDATE da conta de A -> BLOQUEADO',
  pg_temp.fx('member'),
  'update public.professional_billing_accounts set payout_method = ''manual'' where id = ''91000000-0000-4000-8000-0000000000a1''',
  false);

-- Master também NÃO tem bypass de escrita — só o SELECT tem `is_master()`.
select pg_temp.expect_write('master: UPDATE da conta de A -> BLOQUEADO (sem bypass de escrita)',
  pg_temp.fx('master'),
  'update public.professional_billing_accounts set payout_method = ''manual'' where id = ''91000000-0000-4000-8000-0000000000a1''',
  false);

-- DELETE: bloqueado para todo mundo via client (nem o service_role tem
-- GRANT de DELETE nesta tabela, confirmado na auditoria — desconexão é
-- sempre UPDATE, nunca DELETE).
select pg_temp.expect_write('prof (A): DELETE da própria conta -> BLOQUEADO (nem service_role tem esse GRANT)',
  pg_temp.fx('prof'),
  'delete from public.professional_billing_accounts where id = ''91000000-0000-4000-8000-0000000000a1''',
  false);

-- ================= OWNERSHIP: tentativas de hijack ========================

-- Alterar profile_id da própria conta (tentativa de "transferir" a
-- posse) — bloqueado pelo mesmo GRANT ausente de UPDATE.
select pg_temp.expect_write('prof (A): UPDATE profile_id da própria conta (transferência) -> BLOQUEADO',
  pg_temp.fx('prof'),
  format('update public.professional_billing_accounts set profile_id = %L where id = ''91000000-0000-4000-8000-0000000000a1''', pg_temp.fx('member')),
  false);

-- Substituir o identificador financeiro (wallet) da própria conta.
select pg_temp.expect_write('prof (A): UPDATE asaas_wallet_id da própria conta (troca de identificador financeiro) -> BLOQUEADO',
  pg_temp.fx('prof'),
  'update public.professional_billing_accounts set asaas_wallet_id = ''wallet_roubada'' where id = ''91000000-0000-4000-8000-0000000000a1''',
  false);

-- Member tentando se apropriar da conta de A via profile_id (hijack
-- por terceiro, não pela própria dona).
select pg_temp.expect_write('member: UPDATE profile_id da conta de A (apropriação por terceiro) -> BLOQUEADO',
  pg_temp.fx('member'),
  format('update public.professional_billing_accounts set profile_id = %L where id = ''91000000-0000-4000-8000-0000000000a1''', pg_temp.fx('member')),
  false);

-- Não há community_id/ownership de comunidade nesta tabela (é 1:1 por
-- profile) — "hijack de comunidade" não se aplica, já coberto acima
-- pelo hijack de profile_id.

-- ================= CAMINHO INDIRETO: resolve_split() ======================
-- resolve_split() lê asaas_wallet_id/payout_method/verified_at desta
-- tabela para decidir o split_model de toda venda/assinatura — mas é
-- SECURITY DEFINER com EXECUTE revogado de anon/authenticated: não dá
-- pra usar a função como atalho para ler (ou alterar — ela só lê) o
-- dado financeiro por fora da policy de SELECT.

select pg_temp.expect_locked('member: EXECUTE resolve_split() direto -> BLOQUEADO (sem privilégio de função)',
  pg_temp.fx('member'),
  format('select public.resolve_split(%L::uuid, 1000)::text', pg_temp.fx('commA')));

select pg_temp.expect_locked('anon: EXECUTE resolve_split() direto -> BLOQUEADO (sem privilégio de função)',
  null,
  format('select public.resolve_split(%L::uuid, 1000)::text', pg_temp.fx('commA')));

-- ---------- RESULTADO --------------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
