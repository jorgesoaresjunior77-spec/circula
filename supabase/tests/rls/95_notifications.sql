-- =====================================================================
-- 95 — NOTIFICAÇÕES DE BILLING: notifications
-- =====================================================================
-- Fecha o gap identificado na auditoria pós-`94`: `public.notifications`
-- nunca teve cenário próprio (existe desde `20260827000000_baseline_
-- remote_schema.sql`, comentada lá como "sem consumidor no app —
-- preservada" — desatualizado: hoje é escrita por 2 Edge Functions
-- (`asaas-cancel-subscription`, `billing-daily-sweep`) e lida pelo
-- front em `src/hooks/useBillingNotices.ts`).
--
-- Policies auditadas ao vivo (pg_policies, não só o arquivo de migration):
--   notifications_select      = profile_id = auth.uid() OR is_master()
--   notifications_update_own  = profile_id = auth.uid()  (USING e WITH CHECK)
--                                — SEM is_master() aqui: o bypass do
--                                Master vale só para leitura.
--
-- GRANTs auditados ao vivo (information_schema.role_table_grants):
--   notifications: anon=nenhum · authenticated=SELECT,UPDATE (SEM INSERT,
--                  SEM DELETE) · service_role=INSERT (SEM SELECT, SEM
--                  UPDATE, SEM DELETE) · postgres=CRUD completo.
--   O INSERT de service_role é REAL e necessário (ao contrário do achado
--   em `94`): usado por `asaas-cancel-subscription/index.ts:103` e
--   `billing-daily-sweep/index.ts:58`.
--
-- ACHADO DESTA AUDITORIA (documentado e provado abaixo, não corrigido
-- neste teste — está fora do escopo desta suíte alterar policy):
--   `notifications_update_own` restringe a LINHA por `profile_id`, mas
--   não restringe QUAIS colunas mudam. Não há trigger nem policy de
--   coluna. Logo a dona de uma notificação pode reescrever o próprio
--   `title`/`body`/`type` via UPDATE direto pela API — não só marcar
--   como lida. Impacto é baixo (a linha já pertence à própria usuária, e
--   só é lida por ela mesma/Master), mas fica registrado como
--   comportamento real, não suposição.
--
-- Fixtures sintéticas (3 notificações, uma por persona real) são criadas
-- como `postgres` (dono da tabela -> ignora RLS) e somem no ROLLBACK
-- final. NADA é persistido.
-- =====================================================================

insert into public.notifications
  (id, profile_id, type, title, body)
values
  ('95000000-0000-4000-8000-0000000000a1', pg_temp.fx('member'), 'billing', '[rls-suite] cobrança pendente', 'Sua assinatura vence em 3 dias.'),
  ('95000000-0000-4000-8000-0000000000a2', pg_temp.fx('prof'), 'billing', '[rls-suite] repasse processado', 'Seu repasse foi processado.'),
  ('95000000-0000-4000-8000-0000000000a3', pg_temp.fx('master'), 'billing', '[rls-suite] assinatura cancelada', 'Assinatura cancelada pela Asaas.');

-- ================= SELECT — cada usuária a própria + Master vê tudo ===

select pg_temp.expect_count('member: vê a própria notificação',
  pg_temp.fx('member'),
  format('select count(*) from public.notifications where id = %L', '95000000-0000-4000-8000-0000000000a1'), 1);

select pg_temp.expect_count('member: NÃO vê notificação do prof (isolamento)',
  pg_temp.fx('member'),
  format('select count(*) from public.notifications where id = %L', '95000000-0000-4000-8000-0000000000a2'), 0);

select pg_temp.expect_count('member: NÃO vê notificação do master (isolamento)',
  pg_temp.fx('member'),
  format('select count(*) from public.notifications where id = %L', '95000000-0000-4000-8000-0000000000a3'), 0);

select pg_temp.expect_count('prof: vê a própria notificação',
  pg_temp.fx('prof'),
  format('select count(*) from public.notifications where id = %L', '95000000-0000-4000-8000-0000000000a2'), 1);

select pg_temp.expect_count('prof: NÃO vê notificação do member (isolamento)',
  pg_temp.fx('prof'),
  format('select count(*) from public.notifications where id = %L', '95000000-0000-4000-8000-0000000000a1'), 0);

-- Master TEM bypass de plataforma aqui (ao contrário de
-- social_notifications) — vê a própria e a de qualquer outra usuária.
select pg_temp.expect_count('master: vê a própria notificação',
  pg_temp.fx('master'),
  format('select count(*) from public.notifications where id = %L', '95000000-0000-4000-8000-0000000000a3'), 1);

select pg_temp.expect_count('master: vê notificação do member (bypass de plataforma)',
  pg_temp.fx('master'),
  format('select count(*) from public.notifications where id = %L', '95000000-0000-4000-8000-0000000000a1'), 1);

select pg_temp.expect_count('master: vê notificação do prof (bypass de plataforma)',
  pg_temp.fx('master'),
  format('select count(*) from public.notifications where id = %L', '95000000-0000-4000-8000-0000000000a2'), 1);

-- anon: sem GRANT de SELECT -> permission denied antes mesmo da RLS
select pg_temp.expect_locked('anon: NÃO vê notifications',
  null,
  'select count(*) from public.notifications');

-- ================= UPDATE — só a PRÓPRIA, sem bypass de Master =========

select pg_temp.expect_write('member: marca a própria notificação como lida -> PERMITIDO',
  pg_temp.fx('member'),
  format('update public.notifications set read_at = now() where id = %L',
         '95000000-0000-4000-8000-0000000000a1'), true);

select pg_temp.expect_write('member: marca notificação do prof como lida -> BLOQUEADO',
  pg_temp.fx('member'),
  format('update public.notifications set read_at = now() where id = %L',
         '95000000-0000-4000-8000-0000000000a2'), false);

select pg_temp.expect_write('prof: marca notificação do member como lida -> BLOQUEADO',
  pg_temp.fx('prof'),
  format('update public.notifications set read_at = now() where id = %L',
         '95000000-0000-4000-8000-0000000000a1'), false);

-- Master NÃO tem bypass de escrita: a policy update_own só cita
-- profile_id = auth.uid(), sem is_master().
select pg_temp.expect_write('master: marca notificação do member como lida -> BLOQUEADO (sem bypass de escrita)',
  pg_temp.fx('master'),
  format('update public.notifications set read_at = now() where id = %L',
         '95000000-0000-4000-8000-0000000000a1'), false);

-- WITH CHECK: member não consegue "roubar" a notificação do prof
-- reatribuindo profile_id para si mesma.
select pg_temp.expect_write('member: tenta reatribuir profile_id da notificação do prof -> BLOQUEADO',
  pg_temp.fx('member'),
  format('update public.notifications set profile_id = %L where id = %L',
         pg_temp.fx('member'), '95000000-0000-4000-8000-0000000000a2'), false);

-- ACHADO: a policy não restringe COLUNAS, só a linha. A dona pode
-- reescrever title/body/type da própria notificação (não só read_at).
-- Provado explicitamente aqui — é comportamento real, não suposição.
select pg_temp.expect_write('member: reescreve title/body/type da PRÓPRIA notificação -> PERMITIDO (achado: sem trava de coluna)',
  pg_temp.fx('member'),
  format('update public.notifications set title = ''forjado'', body = ''forjado'', type = ''forjado'' where id = %L',
         '95000000-0000-4000-8000-0000000000a1'), true);

-- ================= INSERT/DELETE — só service_role (Edge Functions) ====
-- Sem GRANT de INSERT/DELETE para authenticated -> barrado antes mesmo
-- de qualquer policy.

select pg_temp.expect_write('member: INSERT direto para si mesma -> BLOQUEADO',
  pg_temp.fx('member'),
  format('insert into public.notifications (profile_id, type, title, body) values (%L,''billing'',''forjada'',''forjada'')',
         pg_temp.fx('member')), false);

select pg_temp.expect_write('member: INSERT forjando notificação para o prof -> BLOQUEADO',
  pg_temp.fx('member'),
  format('insert into public.notifications (profile_id, type, title, body) values (%L,''billing'',''forjada'',''forjada'')',
         pg_temp.fx('prof')), false);

select pg_temp.expect_write('member: DELETE da própria notificação -> BLOQUEADO',
  pg_temp.fx('member'),
  format('delete from public.notifications where id = %L',
         '95000000-0000-4000-8000-0000000000a1'), false);

-- ---------- RESULTADO --------------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
