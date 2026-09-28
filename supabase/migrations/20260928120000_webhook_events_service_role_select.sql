-- =====================================================================
-- webhook_events — concede SELECT ao service_role
-- =====================================================================
-- Contexto: achado da fase P1-F3.2 (cenário RLS 92, teste puro, sem
-- alteração — commit 11fb68d e continuação). `public.webhook_events`
-- tem RLS habilitada e ZERO policies (deny-all real para anon/
-- authenticated, confirmado por execução — cenário 92, 16/16 PASS).
-- Isso não muda aqui.
--
-- O problema é outro, na camada de GRANT (independente de RLS):
-- `service_role` já tinha INSERT + UPDATE em `webhook_events`, mas
-- NUNCA teve SELECT. Isso quebra, hoje, em produção, duas operações
-- da própria Edge Function `asaas-webhook` (que roda como
-- `service_role`):
--   1. o SELECT de idempotência (`select('processed_at')` antes de
--      decidir se reprocessa um evento repetido);
--   2. o UPDATE final que marca `processed_at` — todo UPDATE/DELETE
--      com WHERE exige SELECT nas colunas referenciadas na cláusula
--      WHERE, além do UPDATE na coluna alterada (comportamento padrão
--      do Postgres, não é RLS).
-- Confirmado por execução real (`set local role service_role` +
-- SELECT/UPDATE dentro de transação com ROLLBACK): ambos falham com
-- "permission denied for table webhook_events", mesmo com
-- `rolbypassrls=true` — BYPASSRLS dispensa a checagem de POLICY,
-- nunca dispensa o GRANT de tabela (camada independente).
--
-- Efeito em produção: o UPDATE final faz `throw` no erro, capturado
-- pelo catch externo da função — ou seja, TODO evento de webhook que
-- termina de processar com sucesso responde HTTP 500 para a Asaas.
-- Isso aciona o mecanismo de reenvio da Asaas (retry com backoff,
-- documentado publicamente: até 15 tentativas antes de pausar a fila
-- do webhook inteira).
--
-- Esta migration corrige SÓ isso: concede o SELECT que faltava a
-- `service_role`. Nada mais.
--   • NÃO cria, altera ou remove nenhuma policy de RLS.
--   • NÃO concede nada a `anon` nem a `authenticated` — continuam só
--     com TRUNCATE/REFERENCES/TRIGGER, sem SELECT/INSERT/UPDATE/
--     DELETE (deny-all total, inalterado).
--   • NÃO altera grants de `postgres` (dono, já tinha CRUD completo).
--   • NÃO concede DELETE a `service_role` — a Edge Function nunca
--     deleta desta tabela, então não é necessário.
--   • NÃO toca em Edge Function, lógica de idempotência, lógica de
--     billing, migration de schema, dado real.
--
-- O achado separado sobre duplicidade no ramo `subject='platform'`
-- (extensão de período sem guard determinístico, ao contrário do
-- ramo `community`) fica para uma fase/análise futura, depois que o
-- webhook voltar a responder 200 corretamente — não é tocado aqui.
--
-- Idempotente (GRANT não falha se já existir) e reversível (rodapé).
-- =====================================================================

begin;

grant select on public.webhook_events to service_role;

commit;

-- =====================================================================
-- Reversão (referência):
--
-- begin;
-- revoke select on public.webhook_events from service_role;
-- commit;
-- =====================================================================
