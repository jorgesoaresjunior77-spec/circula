-- =====================================================================
-- FASE 14.2 (correção) — GRANTs mínimos de service_role para a Edge
-- Function `invite-member`
-- =====================================================================
-- Contexto: o E2E do convite de nova Member falhou com PostgreSQL
-- `42501 insufficient_privilege` ("Grant the required privileges ...").
-- Diagnóstico read-only confirmou:
--
--   - a Edge Function `invite-member` cria um client com
--     `SUPABASE_SERVICE_ROLE_KEY` (padrão idêntico ao das funções
--     `asaas-*`); a chave é válida e resolve para a role
--     `service_role` — o `getUser()` do client anon passou, e o erro
--     é 42501 (privilégio de tabela), não 401 (auth);
--   - este projeto NÃO faz auto-grant de `service_role`: cada acesso
--     de `service_role` é concedido explicitamente, tabela por tabela
--     (baseline: `profiles`, `subscriptions`, `billing_plans`,
--     `billing_customer_data`, ...; `20260829120000`: `product_orders`,
--     `product_entitlements`, ...);
--   - `public.communities` só tem `grant insert, select ... to
--     authenticated` (+ `update` em `20260830140000`) — nada para
--     `service_role`;
--   - `public.community_members` só tem `grant insert, select ... to
--     authenticated` — nada para `service_role`;
--   - RLS NÃO é a causa (`service_role` tem BYPASSRLS; e 42501 dispara
--     na checagem de GRANT, antes da RLS). Nenhuma policy precisa mudar.
--
-- Esta migration concede SÓ o mínimo necessário para as 3 operações de
-- tabela que a `invite-member` faz hoje via o client `service_role`:
--
--   1. SELECT public.communities        — checagem de ownership
--      (`admin.from('communities').select('id, owner_id')`)
--   2. SELECT public.community_members   — rate-limit por comunidade
--      (`admin.from('community_members').select('id', {count})`)
--   3. INSERT public.community_members   — vínculo da nova participante
--      (`admin.from('community_members').insert({ status:'active' })`)
--
-- O `INSERT` não encadeia `.select()` (sem RETURNING) — `INSERT` basta.
-- O trigger `AFTER INSERT` `create_community_trial()` é SECURITY
-- DEFINER — roda como o dono, não como `service_role`, logo não exige
-- grants extras. As checagens de FK (-> communities, -> profiles) usam
-- os triggers internos de integridade referencial, não o privilégio da
-- role que insere. `id`/`joined_at`/`status` têm default
-- `gen_random_uuid()`/`now()`/literal — sem sequence, sem `USAGE`.
--
-- A chamada de Auth Admin (`admin.auth.admin.inviteUserByEmail`) é API
-- do GoTrue, não PostgREST — independe destes grants. O fallback de
-- e-mail já cadastrado usa a RPC `find_member_by_email` pelo JWT da
-- Professional (role `authenticated`, SECURITY DEFINER) — também
-- independe destes grants.
--
-- NÃO concede: UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER,
-- ALL PRIVILEGES. NÃO cria/altera policy, RLS, função, tabela, coluna
-- ou schema. NÃO revoga nada. Aditivo e reversível (rodapé).
-- =====================================================================

begin;

grant select on table public.communities to service_role;

grant select, insert on table public.community_members to service_role;

commit;

-- =====================================================================
-- Reversão (referência):
--
-- begin;
-- revoke select on table public.communities from service_role;
-- revoke select, insert on table public.community_members from service_role;
-- commit;
-- =====================================================================
