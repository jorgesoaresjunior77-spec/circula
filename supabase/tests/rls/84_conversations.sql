-- =====================================================================
-- 84 — MENSAGENS PRIVADAS: conversations + conversation_participants
-- =====================================================================
-- Fase P1-F1. Cobre exclusivamente `public.conversations` e
-- `public.conversation_participants` (schema `20260831160000_messages_schema.sql`).
-- `public.messages` fica FORA do escopo desta fase (já tem 1 asserção
-- isolada em `40_master.sql`; cobertura completa de `messages` fica para
-- uma fase futura, não tratada aqui).
--
-- Policies auditadas ao vivo (pg_policies, não só o arquivo de migration):
--   conversations_select              = is_conversation_participant(id)
--   conversation_participants_select  = is_conversation_participant(conversation_id)
--   conversation_participants_update_own = profile_id = auth.uid()  (USING e WITH CHECK)
-- Sem policy de INSERT/DELETE para `authenticated`/`public` em nenhuma
-- das duas tabelas — GRANT confirma: `conversations` só tem SELECT para
-- `authenticated`; `conversation_participants` só tem SELECT + UPDATE.
-- Criação de conversa é exclusivamente via RPC SECURITY DEFINER
-- `get_or_create_direct_conversation`, que exige `shares_active_community`.
--
-- IMPORTANTE (achado da auditoria, documentado no relatório da fase):
-- uma sondagem ad-hoc (fora deste arquivo, com ROLLBACK) confirmou que
-- tentar "sequestrar" a própria linha de `conversation_participants`
-- trocando `conversation_id` para uma conversa alheia é BLOQUEADO pela
-- RLS em tempo de execução (`new row violates row-level security
-- policy`), mesmo o texto do `WITH CHECK` só mencionar `profile_id`.
-- O teste 14 abaixo prova isso permanentemente na suíte.
--
-- Master NÃO tem nenhum bypass aqui — não há ramo `is_master()` em
-- nenhuma policy desta tabela, e `shares_active_community()` depende de
-- `community_members`, tabela da qual Master nunca é linha (Master é
-- dona de comunidade via `communities.owner_id`, não participante).
--
-- Fixtures sintéticas (2 conversas, 4 linhas de participante) criadas
-- como `postgres` (ignora RLS) e somem no ROLLBACK final. NADA é
-- persistido — nenhuma conversa/participante real é tocada.
-- =====================================================================

-- Conversa X: member + prof (ambas participam)
insert into public.conversations (id, is_group, direct_key, created_by)
values ('c0000000-0000-4000-8000-0000000000c1', false, '[rls-suite] X', pg_temp.fx('member'));

-- Conversa Y: prof + master (member NÃO participa, apesar de prof estar nas duas)
insert into public.conversations (id, is_group, direct_key, created_by)
values ('c0000000-0000-4000-8000-0000000000c2', false, '[rls-suite] Y', pg_temp.fx('prof'));

insert into public.conversation_participants (id, conversation_id, profile_id)
values
  ('c1000000-0000-4000-8000-0000000000d1', 'c0000000-0000-4000-8000-0000000000c1', pg_temp.fx('member')),
  ('c1000000-0000-4000-8000-0000000000d2', 'c0000000-0000-4000-8000-0000000000c1', pg_temp.fx('prof')),
  ('c1000000-0000-4000-8000-0000000000d3', 'c0000000-0000-4000-8000-0000000000c2', pg_temp.fx('prof')),
  ('c1000000-0000-4000-8000-0000000000d4', 'c0000000-0000-4000-8000-0000000000c2', pg_temp.fx('master'));

-- ================= conversations — SELECT ==============================

-- (1) Usuária A (member) consegue acessar a conversa da qual participa (X)
select pg_temp.expect_count('member (A): vê a conversa X da qual participa',
  pg_temp.fx('member'),
  format('select count(*) from public.conversations where id = %L', 'c0000000-0000-4000-8000-0000000000c1'), 1);

-- (2) Usuária B (prof) consegue acessar a mesma conversa X
select pg_temp.expect_count('prof (B): vê a conversa X da qual participa',
  pg_temp.fx('prof'),
  format('select count(*) from public.conversations where id = %L', 'c0000000-0000-4000-8000-0000000000c1'), 1);

-- (3) Usuária C (master), que não participa de X, NÃO consegue acessá-la
select pg_temp.expect_count('master (C, estranha a X): NÃO vê a conversa X',
  pg_temp.fx('master'),
  format('select count(*) from public.conversations where id = %L', 'c0000000-0000-4000-8000-0000000000c1'), 0);

-- (4) Uma participante (member, em X) NÃO acessa outra conversa privada da
-- qual não participa (Y) — mesmo prof estando presente nas duas.
select pg_temp.expect_count('member: NÃO vê a conversa Y (participa de X, não de Y)',
  pg_temp.fx('member'),
  format('select count(*) from public.conversations where id = %L', 'c0000000-0000-4000-8000-0000000000c2'), 0);

-- controle positivo: prof participa das DUAS, deve ver as duas
select pg_temp.expect_count('prof: vê X e Y (participa das duas)',
  pg_temp.fx('prof'),
  format('select count(*) from public.conversations where id in (%L,%L)',
         'c0000000-0000-4000-8000-0000000000c1', 'c0000000-0000-4000-8000-0000000000c2'), 2);

-- (8) anon não acessa nenhuma conversa
select pg_temp.expect_locked('anon: NÃO vê conversations',
  null,
  'select count(*) from public.conversations');

-- ================= conversation_participants — SELECT ==================

-- (5) isolamento correto: member vê os 2 participantes de X (ela + prof)
select pg_temp.expect_count('member: vê os 2 participantes de X',
  pg_temp.fx('member'),
  format('select count(*) from public.conversation_participants where conversation_id = %L', 'c0000000-0000-4000-8000-0000000000c1'), 2);

-- member não vê NENHUMA linha de participante de Y
select pg_temp.expect_count('member: NÃO vê participantes de Y',
  pg_temp.fx('member'),
  format('select count(*) from public.conversation_participants where conversation_id = %L', 'c0000000-0000-4000-8000-0000000000c2'), 0);

-- master (estranha a X) não vê participantes de X
select pg_temp.expect_count('master: NÃO vê participantes de X',
  pg_temp.fx('master'),
  format('select count(*) from public.conversation_participants where conversation_id = %L', 'c0000000-0000-4000-8000-0000000000c1'), 0);

-- anon não vê nenhuma linha de participante
select pg_temp.expect_locked('anon: NÃO vê conversation_participants',
  null,
  'select count(*) from public.conversation_participants');

-- ================= conversation_participants — UPDATE ===================

-- member marca a PRÓPRIA leitura em X -> PERMITIDO
select pg_temp.expect_write('member: atualiza last_read_at da própria linha em X -> PERMITIDO',
  pg_temp.fx('member'),
  format('update public.conversation_participants set last_read_at = now() where id = %L',
         'c1000000-0000-4000-8000-0000000000d1'), true);

-- (7) member tenta atualizar a linha de TERCEIRO (prof) em X -> BLOQUEADO
select pg_temp.expect_write('member: atualiza last_read_at da linha do prof em X -> BLOQUEADO',
  pg_temp.fx('member'),
  format('update public.conversation_participants set last_read_at = now() where id = %L',
         'c1000000-0000-4000-8000-0000000000d2'), false);

-- (6) member tenta reatribuir a PRÓPRIA linha para outra profile_id -> BLOQUEADO (WITH CHECK)
select pg_temp.expect_write('member: reatribui profile_id da própria linha -> BLOQUEADO',
  pg_temp.fx('member'),
  format('update public.conversation_participants set profile_id = %L where id = %L',
         pg_temp.fx('prof'), 'c1000000-0000-4000-8000-0000000000d1'), false);

-- (6)+(10) member tenta "sequestrar" a própria linha movendo conversation_id
-- de X para Y, se autoadicionando a uma conversa da qual nunca participou.
-- Confirmado por sondagem ad-hoc: BLOQUEADO pela RLS em tempo de execução.
select pg_temp.expect_write('member: move a própria linha de X para Y (conversation_id) -> BLOQUEADO',
  pg_temp.fx('member'),
  format('update public.conversation_participants set conversation_id = %L where id = %L',
         'c0000000-0000-4000-8000-0000000000c2', 'c1000000-0000-4000-8000-0000000000d1'), false);

-- (7) master (sem participar nem ser admin aqui) tenta alterar a linha do
-- member em X -> BLOQUEADO (sem bypass de plataforma)
select pg_temp.expect_write('master: atualiza last_read_at da linha do member em X -> BLOQUEADO',
  pg_temp.fx('master'),
  format('update public.conversation_participants set last_read_at = now() where id = %L',
         'c1000000-0000-4000-8000-0000000000d1'), false);

-- ================= conversations / conversation_participants — INSERT ===
-- Sem policy nem GRANT de INSERT para authenticated em nenhuma das duas
-- tabelas — criação é só via RPC SECURITY DEFINER.

select pg_temp.expect_write('member: INSERT direto em conversations -> BLOQUEADO',
  pg_temp.fx('member'),
  format('insert into public.conversations (is_group, direct_key, created_by) values (false, %L, %L)',
         '[rls-suite] forjada', pg_temp.fx('member')), false);

select pg_temp.expect_write('member: tenta se autoadicionar em Y via INSERT direto -> BLOQUEADO',
  pg_temp.fx('member'),
  format('insert into public.conversation_participants (conversation_id, profile_id) values (%L,%L)',
         'c0000000-0000-4000-8000-0000000000c2', pg_temp.fx('member')), false);

select pg_temp.expect_write('member: forja entrada do master em X via INSERT direto -> BLOQUEADO',
  pg_temp.fx('member'),
  format('insert into public.conversation_participants (conversation_id, profile_id) values (%L,%L)',
         'c0000000-0000-4000-8000-0000000000c1', pg_temp.fx('master')), false);

-- ================= conversation_participants — DELETE ===================
-- Sem policy nem GRANT de DELETE para authenticated (nem para sair da
-- própria conversa — comportamento atual do produto, não desta fase).

select pg_temp.expect_write('member: remove a participação do prof em X -> BLOQUEADO',
  pg_temp.fx('member'),
  format('delete from public.conversation_participants where id = %L',
         'c1000000-0000-4000-8000-0000000000d2'), false);

select pg_temp.expect_write('member: remove a PRÓPRIA participação em X -> BLOQUEADO (sem fluxo de sair)',
  pg_temp.fx('member'),
  format('delete from public.conversation_participants where id = %L',
         'c1000000-0000-4000-8000-0000000000d1'), false);

-- ================= (9) criação de conversa — regra da RPC ===============
-- `get_or_create_direct_conversation` exige `shares_active_community`.
-- Master nunca é linha de `community_members` -> não compartilha
-- comunidade com ninguém -> não consegue criar/obter conversa alguma.

select pg_temp.expect_rpc('master: get_or_create_direct_conversation(member) -> RAISE (não compartilha comunidade)',
  pg_temp.fx('master'),
  format('public.get_or_create_direct_conversation(%L)', pg_temp.fx('member')), false);

-- controle positivo: member e prof compartilham a comunidade A (fixture
-- real) -> a RPC funciona normalmente para quem tem permissão real.
select pg_temp.expect_rpc('member: get_or_create_direct_conversation(prof) -> OK (compartilham comunidade A)',
  pg_temp.fx('member'),
  format('public.get_or_create_direct_conversation(%L)', pg_temp.fx('prof')), true);

-- ---------- RESULTADO --------------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
