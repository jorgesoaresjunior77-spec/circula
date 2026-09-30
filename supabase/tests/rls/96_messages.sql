-- =====================================================================
-- 96 — MENSAGENS PRIVADAS: messages
-- =====================================================================
-- Fecha o gap documentado em `84_conversations.sql` (que cobre só
-- `conversations` + `conversation_participants` e deixa `messages`
-- explicitamente fora do escopo) e em `40_master.sql` (que só tinha 1
-- assertion isolada: "master NÃO lê messages"). Promove os 21 cenários
-- já validados na auditoria ad-hoc (fora da suíte, com ROLLBACK) para a
-- suíte permanente.
--
-- Policies auditadas ao vivo (pg_policies, não só o arquivo de migration):
--   messages_select = is_conversation_participant(conversation_id)
--   messages_insert (WITH CHECK) =
--     (sender_id = auth.uid()) AND is_conversation_participant(conversation_id)
-- Sem policy de UPDATE nem DELETE — para nenhuma role, Master incluído
-- (Master não é um role de Postgres à parte, é só `profiles.role =
-- 'master'`; nenhuma policy de `messages` cita `is_master()`).
--
-- GRANTs auditados ao vivo (information_schema.role_table_grants):
--   messages: anon=nenhum · authenticated=SELECT,INSERT (SEM UPDATE, SEM
--             DELETE) · service_role=NENHUM (nem SELECT) · postgres=CRUD
--             completo (owner).
--   service_role sem GRANT nenhum é intencional: nenhuma Edge Function
--   ou script do repositório referencia `messages` (grep confirmado na
--   auditoria) — não há caminho de escrita server-side para esta tabela.
--   UPDATE/DELETE ficam bloqueados em DUAS camadas independentes (sem
--   GRANT e sem policy) para toda role authenticated, Master incluído.
--
-- `is_conversation_participant(uuid)` é STABLE SECURITY DEFINER (owner
-- postgres, search_path=public, confirmado ao vivo) e depende SÓ de
-- `conversation_participants` — não há atalho por comunidade/post. Por
-- isso o Master só lê/escreve mensagens de conversas das quais
-- participa de fato, igual a qualquer outra usuária; não há bypass de
-- plataforma nesta tabela (diferente de `product_orders`/`notifications`).
--
-- Fixtures sintéticas (2 conversas, 4 participações, 2 mensagens) são
-- criadas como `postgres` (dono da tabela -> ignora RLS) e somem no
-- ROLLBACK final. NADA é persistido. Não há nenhuma asserção baseada em
-- contagem de dados reais/agregados — todo `count` é sobre uma linha
-- sintética específica por `id`, imune a drift de dados de produção.
-- =====================================================================

-- Conversa X: member + prof (member É participante; master NÃO é)
insert into public.conversations (id, is_group, direct_key, created_by)
values ('9e000000-0000-4000-8000-00000000ec01', false, '[rls-suite] X', pg_temp.fx('member'));

insert into public.conversation_participants (conversation_id, profile_id)
values
  ('9e000000-0000-4000-8000-00000000ec01', pg_temp.fx('member')),
  ('9e000000-0000-4000-8000-00000000ec01', pg_temp.fx('prof'));

-- Conversa Y: prof + master (member NÃO é participante)
insert into public.conversations (id, is_group, direct_key, created_by)
values ('9e000000-0000-4000-8000-00000000ec02', false, '[rls-suite] Y', pg_temp.fx('prof'));

insert into public.conversation_participants (conversation_id, profile_id)
values
  ('9e000000-0000-4000-8000-00000000ec02', pg_temp.fx('prof')),
  ('9e000000-0000-4000-8000-00000000ec02', pg_temp.fx('master'));

-- Mensagens semeadas (como postgres, ignora RLS)
insert into public.messages (id, conversation_id, sender_id, body)
values
  ('9e000000-0000-4000-8000-00000000ed01', '9e000000-0000-4000-8000-00000000ec01', pg_temp.fx('member'), '[rls-suite] msgX1 do member'),
  ('9e000000-0000-4000-8000-00000000ed02', '9e000000-0000-4000-8000-00000000ec02', pg_temp.fx('prof'), '[rls-suite] msgY1 do prof');

-- ================= SELECT — participação real, não community-based ====

select pg_temp.expect_count('member: vê msgX1 (é participante de X)',
  pg_temp.fx('member'),
  format('select count(*) from public.messages where id = %L', '9e000000-0000-4000-8000-00000000ed01'), 1);

select pg_temp.expect_count('member: NÃO vê msgY1 (não participa de Y)',
  pg_temp.fx('member'),
  format('select count(*) from public.messages where id = %L', '9e000000-0000-4000-8000-00000000ed02'), 0);

select pg_temp.expect_count('prof: vê msgX1 (participante de X)',
  pg_temp.fx('prof'),
  format('select count(*) from public.messages where id = %L', '9e000000-0000-4000-8000-00000000ed01'), 1);

select pg_temp.expect_count('prof: vê msgY1 (participante de Y)',
  pg_temp.fx('prof'),
  format('select count(*) from public.messages where id = %L', '9e000000-0000-4000-8000-00000000ed02'), 1);

select pg_temp.expect_count('master: vê msgY1 (participante de Y)',
  pg_temp.fx('master'),
  format('select count(*) from public.messages where id = %L', '9e000000-0000-4000-8000-00000000ed02'), 1);

select pg_temp.expect_count('master: NÃO vê msgX1 (não participa de X — sem bypass de plataforma)',
  pg_temp.fx('master'),
  format('select count(*) from public.messages where id = %L', '9e000000-0000-4000-8000-00000000ed01'), 0);

select pg_temp.expect_locked('anon: NÃO vê messages',
  null,
  'select count(*) from public.messages');

-- ================= INSERT — participação + sender_id = auth.uid() =====

select pg_temp.expect_write('member: insere em X (participante) com sender_id próprio -> PERMITIDO',
  pg_temp.fx('member'),
  format('insert into public.messages (conversation_id, sender_id, body) values (%L,%L,''[rls-suite] ok'')',
         '9e000000-0000-4000-8000-00000000ec01', pg_temp.fx('member')), true);

select pg_temp.expect_write('member: insere em Y (NÃO participante) com sender_id próprio -> BLOQUEADO',
  pg_temp.fx('member'),
  format('insert into public.messages (conversation_id, sender_id, body) values (%L,%L,''[rls-suite] forjado'')',
         '9e000000-0000-4000-8000-00000000ec02', pg_temp.fx('member')), false);

select pg_temp.expect_write('member: insere em X (participante) MAS com sender_id=prof (spoof) -> BLOQUEADO',
  pg_temp.fx('member'),
  format('insert into public.messages (conversation_id, sender_id, body) values (%L,%L,''[rls-suite] spoof'')',
         '9e000000-0000-4000-8000-00000000ec01', pg_temp.fx('prof')), false);

select pg_temp.expect_write('member: insere em Y (não participante) com sender_id=prof (duplo forjado) -> BLOQUEADO',
  pg_temp.fx('member'),
  format('insert into public.messages (conversation_id, sender_id, body) values (%L,%L,''[rls-suite] duplo forjado'')',
         '9e000000-0000-4000-8000-00000000ec02', pg_temp.fx('prof')), false);

select pg_temp.expect_write('prof: insere em Y (participante) com sender_id=master (spoof do outro participante) -> BLOQUEADO',
  pg_temp.fx('prof'),
  format('insert into public.messages (conversation_id, sender_id, body) values (%L,%L,''[rls-suite] spoof2'')',
         '9e000000-0000-4000-8000-00000000ec02', pg_temp.fx('master')), false);

select pg_temp.expect_write('master: insere em X (NÃO participante) com sender_id próprio -> BLOQUEADO (sem bypass)',
  pg_temp.fx('master'),
  format('insert into public.messages (conversation_id, sender_id, body) values (%L,%L,''[rls-suite] master tentando X'')',
         '9e000000-0000-4000-8000-00000000ec01', pg_temp.fx('master')), false);

select pg_temp.expect_write('master: insere em Y (participante) com sender_id próprio -> PERMITIDO (participante comum, sem bypass especial)',
  pg_temp.fx('master'),
  format('insert into public.messages (conversation_id, sender_id, body) values (%L,%L,''[rls-suite] master em Y'')',
         '9e000000-0000-4000-8000-00000000ec02', pg_temp.fx('master')), true);

-- ================= UPDATE — sem policy nem GRANT para nenhuma role =====

select pg_temp.expect_write('member: tenta editar o PRÓPRIO body em X -> BLOQUEADO (sem GRANT de UPDATE)',
  pg_temp.fx('member'),
  format('update public.messages set body = ''[rls-suite] editado'' where id = %L', '9e000000-0000-4000-8000-00000000ed01'), false);

select pg_temp.expect_write('member: tenta editar body de msgY1 (nem participante) -> BLOQUEADO',
  pg_temp.fx('member'),
  format('update public.messages set body = ''[rls-suite] editado2'' where id = %L', '9e000000-0000-4000-8000-00000000ed02'), false);

select pg_temp.expect_write('member: tenta trocar sender_id da PRÓPRIA msgX1 para prof -> BLOQUEADO (sem GRANT de UPDATE)',
  pg_temp.fx('member'),
  format('update public.messages set sender_id = %L where id = %L', pg_temp.fx('prof'), '9e000000-0000-4000-8000-00000000ed01'), false);

select pg_temp.expect_write('master: tenta editar msgY1 (conversa onde é participante) -> BLOQUEADO (sem GRANT de UPDATE)',
  pg_temp.fx('master'),
  format('update public.messages set body = ''[rls-suite] master editando'' where id = %L', '9e000000-0000-4000-8000-00000000ed02'), false);

-- ================= DELETE — sem policy nem GRANT para nenhuma role =====

select pg_temp.expect_write('member: tenta deletar a PRÓPRIA msgX1 -> BLOQUEADO (sem GRANT de DELETE)',
  pg_temp.fx('member'),
  format('delete from public.messages where id = %L', '9e000000-0000-4000-8000-00000000ed01'), false);

select pg_temp.expect_write('prof: tenta deletar msgX1 (mensagem do member, mesma conversa) -> BLOQUEADO',
  pg_temp.fx('prof'),
  format('delete from public.messages where id = %L', '9e000000-0000-4000-8000-00000000ed01'), false);

select pg_temp.expect_write('master: tenta deletar msgY1 (conversa onde é participante) -> BLOQUEADO (sem GRANT de DELETE)',
  pg_temp.fx('master'),
  format('delete from public.messages where id = %L', '9e000000-0000-4000-8000-00000000ed02'), false);

-- ---------- RESULTADO --------------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
