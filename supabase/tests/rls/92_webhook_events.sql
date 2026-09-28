-- =====================================================================
-- 92 — LOG BRUTO DE WEBHOOK ASAAS: webhook_events
-- =====================================================================
-- Fase P1-F3.2 (segunda tabela). `public.webhook_events` armazena o
-- payload bruto de cada evento recebido do gateway de pagamento
-- (Asaas) — dado financeiro sensível (inclui informação de cobrança/
-- pagador). Nunca teve cenário de RLS.
--
-- Estrutura auditada ao vivo (information_schema + pg_constraint):
--   id uuid pk · asaas_event_id text not null (UNIQUE — idempotência)
--   · event_type text not null · payload jsonb not null · received_at
--   timestamptz not null default now() · processed_at timestamptz
--   (nullable — marca conclusão do processamento).
--   Sem FK (tabela solta, sem relação com outras via schema — a
--   ligação com `subscriptions`/`payment_charges`/`product_orders` é
--   feita DENTRO da Edge Function, não no banco).
--
-- RLS: habilitada. Policies: **ZERO** (`pg_policies` devolve 0 linhas
-- para esta tabela).
--
-- GRANTs auditados ao vivo (information_schema.role_table_grants,
-- TODOS os roles, não só anon/authenticated/service_role):
--   anon:          TRUNCATE, REFERENCES, TRIGGER (nada de SELECT/
--                  INSERT/UPDATE/DELETE)
--   authenticated: TRUNCATE, REFERENCES, TRIGGER (idêntico a anon —
--                  nenhuma distinção de role client-side)
--   service_role:  INSERT, UPDATE, TRUNCATE, REFERENCES, TRIGGER
--                  (SEM SELECT explícito, SEM DELETE)
--   postgres:      full CRUD (dono da tabela — não é role client-side)
--
-- CONFIRMAÇÃO POR EXECUÇÃO REAL (não presumida — o roteiro desta fase
-- pediu explicitamente para não presumir que "sem policy" = deny-all
-- sem confirmar com grants E execução):
--   `set local role service_role` + tentativa real de SELECT/UPDATE/
--   DELETE dentro de uma transação com ROLLBACK (nenhum dado alterado)
--   confirmou, por EXECUÇÃO, não só por leitura de schema:
--     • SELECT como service_role -> "permission denied for table
--       webhook_events" (sem GRANT de SELECT, mesmo tendo
--       `rolbypassrls=true` — BYPASSRLS só dispensa a checagem de
--       POLICY, nunca dispensa o GRANT de tabela, que é uma camada
--       INDEPENDENTE).
--     • INSERT como service_role -> **funciona** (não depende de
--       SELECT, é INSERT puro com VALUES).
--     • UPDATE ... WHERE asaas_event_id = '...' como service_role ->
--       **também falha** com "permission denied for table
--       webhook_events". Motivo: o Postgres exige privilégio de
--       SELECT nas colunas referenciadas na cláusula WHERE de um
--       UPDATE, além do UPDATE na(s) coluna(s) alterada(s)
--       (`information_schema.column_privileges` confirma: `service_role`
--       tem INSERT/UPDATE em TODAS as colunas da tabela — não é
--       restrição por coluna — mas NENHUMA coluna tem SELECT). Como o
--       WHERE avalia `asaas_event_id` e não há SELECT nela, o UPDATE é
--       barrado mesmo tendo UPDATE grant na coluna alterada. Mesmo
--       resultado para DELETE (que também precisa avaliar o WHERE).
--
-- >>> ACHADO FORA DO ESCOPO DE RLS, REPORTADO SEM ALTERAÇÃO (proibido
-- alterar grants/Edge Functions nesta fase): o código real de
-- `supabase/functions/asaas-webhook/index.ts` faz, depois de
-- processar o evento, `update('webhook_events').set({processed_at:
-- ...}).eq('asaas_event_id', eventId)` (linhas 673-676) usando o
-- client `service_role`. Pela auditoria acima, esse UPDATE específico
-- **falha com permission denied em produção**, e o código FAZ `throw
-- processedAtError` nesse caso (linha 678-680) — ou seja, a função
-- inteira lança erro no fim de todo processamento bem-sucedido. O
-- atalho de idempotência em caso de retry (linhas 571-575, que faz
-- `select('processed_at')` para decidir se pula reprocessamento)
-- também falha pela mesma causa, mas o código já trata esse erro
-- como "segue para reprocessar" (comentário no próprio arquivo) — não
-- quebra a idempotência, só desliga a otimização de pular
-- reprocessamento. **Isto é um achado operacional sobre o GRANT do
-- `service_role`, não uma vulnerabilidade de RLS** (nenhum cliente
-- ganha acesso por causa disso) — reportado no relatório final desta
-- fase para decisão do time, sem correção aqui.
--
-- Edge Functions: só `asaas-webhook` (escreve via `service_role`).
-- Nenhuma outra Edge Function referencia esta tabela.
-- SECURITY DEFINER: nenhuma função SQL referencia `webhook_events`
-- (confirmado ao vivo, `pg_get_functiondef` sobre todas as funções de
-- `public`) — sem caminho indireto de leitura/escrita via função.
-- Hooks/frontend: nenhum (confirmado por grep em `src/`).
--
-- Master: **SEM bypass nenhum** — diferente de TODAS as outras 8
-- tabelas já cobertas na P1-F3 (todas tinham `is_master()` em pelo
-- menos o SELECT). Aqui não há policy nenhuma, logo não há como
-- Master ter tratamento diferenciado — mesmo GRANT, mesmo bloqueio
-- total que qualquer outro `authenticated`.
--
-- Este cenário prova o invariante de segurança real: deny-all total
-- para QUALQUER persona client-side (member, Professional, Master,
-- anon), nas 4 operações. Não usa fixture alguma — é 100% negativo,
-- e roda mesmo com a tabela vazia em produção. Nenhum dado é criado
-- ou alterado (todo INSERT/UPDATE/DELETE testado é esperado BLOQUEADO
-- e roda dentro da transação com ROLLBACK final, como as demais).
-- =====================================================================

-- ================= SELECT (as 4 personas) =================================

select pg_temp.expect_locked('member: NÃO vê webhook_events (sem GRANT)',
  pg_temp.fx('member'), 'select count(*) from public.webhook_events');

select pg_temp.expect_locked('prof: NÃO vê webhook_events (sem GRANT)',
  pg_temp.fx('prof'), 'select count(*) from public.webhook_events');

select pg_temp.expect_locked('master: NÃO vê webhook_events (sem bypass — sem policy nenhuma para checar)',
  pg_temp.fx('master'), 'select count(*) from public.webhook_events');

select pg_temp.expect_locked('anon: NÃO vê webhook_events (sem GRANT)',
  null, 'select count(*) from public.webhook_events');

-- ================= INSERT (as 4 personas) ==================================

select pg_temp.expect_write('member: INSERT evento de webhook -> BLOQUEADO',
  pg_temp.fx('member'),
  'insert into public.webhook_events (asaas_event_id, event_type, payload) values (''rls-suite-92-member'',''PAYMENT_RECEIVED'',''{}''::jsonb)',
  false);

select pg_temp.expect_write('prof: INSERT evento de webhook -> BLOQUEADO',
  pg_temp.fx('prof'),
  'insert into public.webhook_events (asaas_event_id, event_type, payload) values (''rls-suite-92-prof'',''PAYMENT_RECEIVED'',''{}''::jsonb)',
  false);

select pg_temp.expect_write('master: INSERT evento de webhook -> BLOQUEADO (sem bypass de escrita)',
  pg_temp.fx('master'),
  'insert into public.webhook_events (asaas_event_id, event_type, payload) values (''rls-suite-92-master'',''PAYMENT_RECEIVED'',''{}''::jsonb)',
  false);

select pg_temp.expect_write('anon: INSERT evento de webhook -> BLOQUEADO',
  null,
  'insert into public.webhook_events (asaas_event_id, event_type, payload) values (''rls-suite-92-anon'',''PAYMENT_RECEIVED'',''{}''::jsonb)',
  false);

-- ================= UPDATE (as 4 personas) ===================================
-- Sobre uma chave inexistente de propósito: o objetivo é provar o
-- BLOQUEIO de privilégio (GRANT/coluna), não depender de nenhuma
-- linha real existir (a tabela está vazia em produção hoje).

select pg_temp.expect_write('member: UPDATE processed_at -> BLOQUEADO',
  pg_temp.fx('member'),
  'update public.webhook_events set processed_at = now() where asaas_event_id = ''rls-suite-92-nao-existe''',
  false);

select pg_temp.expect_write('prof: UPDATE processed_at -> BLOQUEADO',
  pg_temp.fx('prof'),
  'update public.webhook_events set processed_at = now() where asaas_event_id = ''rls-suite-92-nao-existe''',
  false);

select pg_temp.expect_write('master: UPDATE processed_at -> BLOQUEADO (sem bypass de escrita)',
  pg_temp.fx('master'),
  'update public.webhook_events set processed_at = now() where asaas_event_id = ''rls-suite-92-nao-existe''',
  false);

select pg_temp.expect_write('anon: UPDATE processed_at -> BLOQUEADO',
  null,
  'update public.webhook_events set processed_at = now() where asaas_event_id = ''rls-suite-92-nao-existe''',
  false);

-- ================= DELETE (as 4 personas) ===================================

select pg_temp.expect_write('member: DELETE de evento -> BLOQUEADO',
  pg_temp.fx('member'),
  'delete from public.webhook_events where asaas_event_id = ''rls-suite-92-nao-existe''',
  false);

select pg_temp.expect_write('prof: DELETE de evento -> BLOQUEADO',
  pg_temp.fx('prof'),
  'delete from public.webhook_events where asaas_event_id = ''rls-suite-92-nao-existe''',
  false);

select pg_temp.expect_write('master: DELETE de evento -> BLOQUEADO (sem bypass de escrita)',
  pg_temp.fx('master'),
  'delete from public.webhook_events where asaas_event_id = ''rls-suite-92-nao-existe''',
  false);

select pg_temp.expect_write('anon: DELETE de evento -> BLOQUEADO',
  null,
  'delete from public.webhook_events where asaas_event_id = ''rls-suite-92-nao-existe''',
  false);

-- ---------- RESULTADO --------------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
