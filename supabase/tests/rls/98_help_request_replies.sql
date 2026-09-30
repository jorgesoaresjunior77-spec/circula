-- =====================================================================
-- 98 — RESPOSTAS DE PEDIDO DE AJUDA: help_request_replies
-- =====================================================================
-- Promove os 27 cenários já validados na auditoria ad-hoc de
-- `help_request_replies`. Antes deste teste, a tabela tinha ZERO
-- referência na suíte permanente (o pai `help_requests` tem 4
-- assertions espalhadas em 10/20/40/60, nenhuma delas cobrindo a
-- filha, UPDATE, DELETE, ou o cruzamento professional×comunidade).
--
-- Policies auditadas ao vivo (pg_policies):
--   help_request_replies_select = EXISTS (hr WHERE hr.id = help_request_id
--     AND (owns_community(hr.community_id)
--          OR (is_community_member(hr.community_id)
--              AND (hr.audience = 'community' OR hr.profile_id = auth.uid()))))
--   help_request_replies_insert (WITH CHECK) = profile_id = auth.uid()
--     AND EXISTS (hr WHERE hr.id = help_request_id
--       AND (is_master() OR owns_community(hr.community_id)
--            OR (is_community_member(hr.community_id)
--                AND (hr.audience = 'community' OR hr.profile_id = auth.uid()))))
--   help_request_replies_delete = profile_id = auth.uid()  -- SEM
--     owns_community(), SEM is_master(): delete é estritamente autoral.
--   SEM policy de UPDATE.
--
-- ACHADO DA AUDITORIA (documentado, NÃO corrigido aqui — fora de escopo
-- alterar policy): `help_request_replies_insert` ainda cita `is_master()`
-- no WITH CHECK, resquício não limpo pelas migrations 12.4/12.4b que já
-- removeram `is_master()` de `help_requests_select`,
-- `help_request_replies_select` e `help_requests_update`. Esse ramo está
-- MORTO na prática: como o EXISTS lê `help_requests` (tabela cuja RLS já
-- não tem is_master()), Master nunca alcança o WITH CHECK verdadeiro
-- para uma comunidade da qual não é dona/membro. Provado abaixo por
-- execução real + um controle positivo (master respondendo onde ELA É
-- dona, via owns_community — não via is_master()) para isolar que o
-- bloqueio é específico à falta de vínculo, não um erro genérico.
--
-- GRANTs auditados ao vivo (information_schema.role_table_grants):
--   help_request_replies: anon=nenhum · authenticated=SELECT,INSERT,DELETE
--     (SEM UPDATE) · service_role=NENHUM (nem SELECT — sem consumidor real:
--     nenhuma Edge Function nem frontend referencia esta tabela hoje,
--     grep confirmado no repositório inteiro) · postgres=CRUD completo.
--
-- Fixtures: `commA` (real, dona=`prof`, `member`=ativa) + `commC`
-- (sintética, dona=`master`, com `prof` adicionada como MERA membro
-- ativa — não dona — para provar isolamento de privacidade "professional"
-- entre pares da MESMA comunidade sem precisar de uma 4ª persona: `prof`
-- assume o papel de "colega qualquer" em C, distinto do seu papel de
-- dona em A). `audience` usa o valor ATUAL pós-rename
-- (`20260917120000_desniche_core.sql`: 'nutri' → 'professional') —
-- confirmado ao vivo via pg_get_constraintdef antes de escrever este
-- teste. Tudo em ROLLBACK — nada persiste.
-- =====================================================================

insert into public.communities (id, owner_id, name, slug, is_discoverable)
values (pg_temp.fx('commC'), pg_temp.fx('master'),
        '[rls-suite] Comunidade C (help_request_replies)', 'rls-suite-c-help', false);

insert into public.community_members (community_id, profile_id, status)
values (pg_temp.fx('commC'), pg_temp.fx('prof'), 'active');

insert into public.help_requests (id, community_id, profile_id, audience, body)
values
  ('9f000000-0000-4000-8000-00000000f001', pg_temp.fx('commA'), pg_temp.fx('member'), 'community',     '[rls-suite] hrA-community'),
  ('9f000000-0000-4000-8000-00000000f002', pg_temp.fx('commA'), pg_temp.fx('member'), 'professional',  '[rls-suite] hrA-professional'),
  ('9f000000-0000-4000-8000-00000000f003', pg_temp.fx('commC'), pg_temp.fx('master'), 'professional',  '[rls-suite] hrC-professional (dona=master)'),
  ('9f000000-0000-4000-8000-00000000f004', pg_temp.fx('commC'), pg_temp.fx('master'), 'community',     '[rls-suite] hrC-community');

insert into public.help_request_replies (id, help_request_id, profile_id, body)
values
  ('9f000000-0000-4000-8000-00000000f101', '9f000000-0000-4000-8000-00000000f001', pg_temp.fx('prof'),   '[rls-suite] resposta do prof em hrA-community'),
  ('9f000000-0000-4000-8000-00000000f102', '9f000000-0000-4000-8000-00000000f002', pg_temp.fx('prof'),   '[rls-suite] resposta do prof (dona/Profissional) em hrA-professional'),
  ('9f000000-0000-4000-8000-00000000f103', '9f000000-0000-4000-8000-00000000f003', pg_temp.fx('master'), '[rls-suite] resposta do master em hrC-professional'),
  ('9f000000-0000-4000-8000-00000000f104', '9f000000-0000-4000-8000-00000000f004', pg_temp.fx('master'), '[rls-suite] resposta do master em hrC-community');

-- ================= 1. SELECT ============================================

select pg_temp.expect_count('98: member vê a resposta da PRÓPRIA hrA-professional (é a solicitante)',
  pg_temp.fx('member'),
  format('select count(*) from public.help_request_replies where id = %L', '9f000000-0000-4000-8000-00000000f102'), 1);

select pg_temp.expect_count('98: member vê a resposta em hrA-community (thread pública da própria comunidade)',
  pg_temp.fx('member'),
  format('select count(*) from public.help_request_replies where id = %L', '9f000000-0000-4000-8000-00000000f101'), 1);

select pg_temp.expect_count('98: member NÃO vê resposta de hrC-professional (outra comunidade, não é a solicitante)',
  pg_temp.fx('member'),
  format('select count(*) from public.help_request_replies where id = %L', '9f000000-0000-4000-8000-00000000f103'), 0);

select pg_temp.expect_count('98: member NÃO vê resposta de hrC-community (não é membro de C)',
  pg_temp.fx('member'),
  format('select count(*) from public.help_request_replies where id = %L', '9f000000-0000-4000-8000-00000000f104'), 0);

select pg_temp.expect_count('98: prof (dona de A) vê resposta de hrA-professional (é a Profissional do pedido privado)',
  pg_temp.fx('prof'),
  format('select count(*) from public.help_request_replies where id = %L', '9f000000-0000-4000-8000-00000000f102'), 1);

select pg_temp.expect_count('98: prof (MERA membro de C, não dona) NÃO vê resposta de hrC-professional (privacidade entre pares)',
  pg_temp.fx('prof'),
  format('select count(*) from public.help_request_replies where id = %L', '9f000000-0000-4000-8000-00000000f103'), 0);

select pg_temp.expect_count('98: prof (membro de C) vê resposta de hrC-community (thread pública, mesmo não sendo dona)',
  pg_temp.fx('prof'),
  format('select count(*) from public.help_request_replies where id = %L', '9f000000-0000-4000-8000-00000000f104'), 1);

select pg_temp.expect_count('98: master (dona de C) vê a resposta do PRÓPRIO pedido privado hrC-professional',
  pg_temp.fx('master'),
  format('select count(*) from public.help_request_replies where id = %L', '9f000000-0000-4000-8000-00000000f103'), 1);

select pg_temp.expect_count('98: master NÃO vê resposta de hrA-professional (não é dona nem membro de A — sem bypass de plataforma)',
  pg_temp.fx('master'),
  format('select count(*) from public.help_request_replies where id = %L', '9f000000-0000-4000-8000-00000000f102'), 0);

select pg_temp.expect_locked('98: anon NÃO vê help_request_replies',
  null,
  'select count(*) from public.help_request_replies');

-- ================= 2. INSERT ============================================

select pg_temp.expect_write('98: member responde à PRÓPRIA hrA-professional (solicitante) -> PERMITIDO',
  pg_temp.fx('member'),
  format('insert into public.help_request_replies (help_request_id, profile_id, body) values (%L,%L,''[rls-suite] ok'')',
         '9f000000-0000-4000-8000-00000000f002', pg_temp.fx('member')), true);

select pg_temp.expect_write('98: member responde em hrA-community (thread pública da própria comunidade) -> PERMITIDO',
  pg_temp.fx('member'),
  format('insert into public.help_request_replies (help_request_id, profile_id, body) values (%L,%L,''[rls-suite] ok'')',
         '9f000000-0000-4000-8000-00000000f001', pg_temp.fx('member')), true);

select pg_temp.expect_write('98: member tenta responder hrC-community (comunidade da qual NÃO participa) -> BLOQUEADO',
  pg_temp.fx('member'),
  format('insert into public.help_request_replies (help_request_id, profile_id, body) values (%L,%L,''[rls-suite] forjado'')',
         '9f000000-0000-4000-8000-00000000f004', pg_temp.fx('member')), false);

select pg_temp.expect_write('98: member tenta responder hrC-professional (privado, de outra comunidade, não é a solicitante) -> BLOQUEADO',
  pg_temp.fx('member'),
  format('insert into public.help_request_replies (help_request_id, profile_id, body) values (%L,%L,''[rls-suite] forjado'')',
         '9f000000-0000-4000-8000-00000000f003', pg_temp.fx('member')), false);

select pg_temp.expect_write('98: prof (MERA membro de C) tenta responder hrC-professional (privado do master, prof não é dona ali) -> BLOQUEADO',
  pg_temp.fx('prof'),
  format('insert into public.help_request_replies (help_request_id, profile_id, body) values (%L,%L,''[rls-suite] forjado'')',
         '9f000000-0000-4000-8000-00000000f003', pg_temp.fx('prof')), false);

select pg_temp.expect_write('98: prof (membro de C) responde hrC-community (thread pública de C) -> PERMITIDO',
  pg_temp.fx('prof'),
  format('insert into public.help_request_replies (help_request_id, profile_id, body) values (%L,%L,''[rls-suite] ok'')',
         '9f000000-0000-4000-8000-00000000f004', pg_temp.fx('prof')), true);

select pg_temp.expect_write('98: member tenta forjar autoria (profile_id=prof) em resposta a hrA-community -> BLOQUEADO',
  pg_temp.fx('member'),
  format('insert into public.help_request_replies (help_request_id, profile_id, body) values (%L,%L,''[rls-suite] spoof'')',
         '9f000000-0000-4000-8000-00000000f001', pg_temp.fx('prof')), false);

select pg_temp.expect_write('98: member tenta responder a help_request_id INEXISTENTE -> BLOQUEADO',
  pg_temp.fx('member'),
  format('insert into public.help_request_replies (help_request_id, profile_id, body) values (%L,%L,''[rls-suite] fantasma'')',
         pg_temp.fx('nil'), pg_temp.fx('member')), false);

-- ACHADO: is_master() ainda está escrito no WITH CHECK, mas fica morto
-- na prática -- provado com 2 bloqueios + 1 controle positivo abaixo.
select pg_temp.expect_write('98: ACHADO -- master tenta responder hrA-professional (NÃO é dona/membro de A) -> BLOQUEADO mesmo com is_master() no texto da policy',
  pg_temp.fx('master'),
  format('insert into public.help_request_replies (help_request_id, profile_id, body) values (%L,%L,''[rls-suite] master tentando A'')',
         '9f000000-0000-4000-8000-00000000f002', pg_temp.fx('master')), false);

select pg_temp.expect_write('98: ACHADO -- master tenta responder hrA-community (NÃO é dona/membro de A) -> BLOQUEADO',
  pg_temp.fx('master'),
  format('insert into public.help_request_replies (help_request_id, profile_id, body) values (%L,%L,''[rls-suite] master tentando A2'')',
         '9f000000-0000-4000-8000-00000000f001', pg_temp.fx('master')), false);

select pg_temp.expect_write('98: CONTROLE -- master responde hrC-professional (comunidade onde ELA É dona) -> PERMITIDO (via owns_community, não via is_master)',
  pg_temp.fx('master'),
  format('insert into public.help_request_replies (help_request_id, profile_id, body) values (%L,%L,''[rls-suite] master em C, legítimo'')',
         '9f000000-0000-4000-8000-00000000f003', pg_temp.fx('master')), true);

-- ================= 3. UPDATE — sem policy nem GRANT =====================

select pg_temp.expect_write('98: member (autora) tenta editar o PRÓPRIO body de resposta -> BLOQUEADO (sem policy/GRANT de UPDATE)',
  pg_temp.fx('member'),
  format('update public.help_request_replies set body = ''[rls-suite] editado'' where id = %L', '9f000000-0000-4000-8000-00000000f101'), false);

select pg_temp.expect_write('98: prof (dona de A) tenta editar resposta alheia na própria comunidade -> BLOQUEADO (sem bypass, sem GRANT)',
  pg_temp.fx('prof'),
  format('update public.help_request_replies set body = ''[rls-suite] editado2'' where id = %L', '9f000000-0000-4000-8000-00000000f101'), false);

-- ================= 4. DELETE — estritamente autoral ======================
-- Os testes de INSERT ALLOWED acima são sempre desfeitos pelo helper
-- (RLSSUITE_OK rola o savepoint), então não sobra nenhuma resposta real
-- do member para testar DELETE -- insere uma nova como postgres só para
-- este bloco.
insert into public.help_request_replies (id, help_request_id, profile_id, body)
values ('9f000000-0000-4000-8000-00000000f105', '9f000000-0000-4000-8000-00000000f001', pg_temp.fx('member'), '[rls-suite] resposta do member p/ deletar');

select pg_temp.expect_write('98: member deleta a PRÓPRIA resposta (f105) -> PERMITIDO',
  pg_temp.fx('member'),
  format('delete from public.help_request_replies where id = %L', '9f000000-0000-4000-8000-00000000f105'), true);

select pg_temp.expect_write('98: member tenta deletar resposta ALHEIA (f101, do prof) -> BLOQUEADO',
  pg_temp.fx('member'),
  format('delete from public.help_request_replies where id = %L', '9f000000-0000-4000-8000-00000000f101'), false);

select pg_temp.expect_write('98: prof (dona de A) tenta deletar resposta do MEMBER (f105) na própria comunidade -> BLOQUEADO (sem bypass de dona)',
  pg_temp.fx('prof'),
  format('delete from public.help_request_replies where id = %L', '9f000000-0000-4000-8000-00000000f105'), false);

insert into public.help_request_replies (id, help_request_id, profile_id, body)
values ('9f000000-0000-4000-8000-00000000f106', '9f000000-0000-4000-8000-00000000f004', pg_temp.fx('prof'), '[rls-suite] resposta do prof (mera membro) em hrC-community');

select pg_temp.expect_write('98: master (dona de C) tenta deletar resposta do PROF (f106, mera membro) em C -> BLOQUEADO (delete é SEMPRE só-autora, sem bypass de dona)',
  pg_temp.fx('master'),
  format('delete from public.help_request_replies where id = %L', '9f000000-0000-4000-8000-00000000f106'), false);

-- ---------- RESULTADO --------------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
