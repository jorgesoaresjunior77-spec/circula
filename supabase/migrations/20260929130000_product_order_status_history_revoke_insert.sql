-- =====================================================================
-- product_order_status_history — revoga o INSERT redundante de service_role
-- =====================================================================
-- Contexto (auditoria de necessidade/impacto, sem alteração, etapa
-- anterior a esta migration):
--   • `public.product_order_status_history` (`20260829120000`) só tem UM
--     caminho de escrita real e em uso: o trigger
--     `product_orders_log_status_change` (AFTER UPDATE ON product_orders),
--     que chama `log_product_order_status_change()` — SECURITY DEFINER,
--     de propriedade de `postgres` (confirmado ao vivo via pg_proc/
--     pg_class: proowner/relowner = postgres). Como é SECURITY DEFINER,
--     o INSERT dentro do trigger roda com o privilégio do DONO da
--     função/tabela, nunca com o privilégio de quem disparou o UPDATE
--     em product_orders (service_role ou qualquer outro role) — logo o
--     GRANT direto de INSERT a service_role nesta tabela NUNCA foi
--     necessário para o trigger funcionar.
--   • Busca em todo o repositório (Edge Functions, frontend, scripts,
--     migrations, testes) não encontrou nenhum INSERT direto nesta
--     tabela fora do trigger. O grant era uma superfície de escrita
--     sem nenhum consumidor real.
--   • A tabela-irmã `subscription_status_history` (schema baseline,
--     citada no próprio comentário de `20260829120000` como o padrão
--     que esta tabela deveria seguir: "Segue o padrao de
--     subscription_status_history") NUNCA teve grant de INSERT para
--     service_role — só `grant select ... to authenticated`. O grant
--     de INSERT em product_order_status_history era uma divergência
--     desse padrão, não uma decisão documentada.
--   • Confirmado empiricamente pelo cenário 94
--     (supabase/tests/rls/94_product_orders_and_status_history.sql)
--     ANTES desta migration: um INSERT direto como service_role, fora
--     do trigger, era ALLOWED. Essa mesma assertion é atualizada nesta
--     mudança para esperar BLOCKED.
--
-- Esta migration remove SÓ o INSERT. Mantém intactos:
--   • SELECT de service_role (grant original preservado, sem alteração);
--   • SELECT de authenticated;
--   • a policy `product_order_status_history_select` (RLS, inalterada);
--   • o trigger e a função SECURITY DEFINER (inalterados) — continuam
--     funcionando exatamente como antes, porque nunca dependeram deste
--     grant;
--   • todas as demais tabelas, grants, policies, triggers, Edge
--     Functions e dados do projeto.
--
-- Idempotente (REVOKE não falha se o privilégio já não existir) e
-- reversível (rodapé).
-- =====================================================================

begin;

revoke insert on table public.product_order_status_history from service_role;

commit;

-- =====================================================================
-- Reversão (referência):
--
-- begin;
-- grant insert on table public.product_order_status_history to service_role;
-- commit;
-- =====================================================================
