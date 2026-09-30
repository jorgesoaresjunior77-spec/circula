-- =====================================================================
-- 99 — COMANDOS DE ENGAJAMENTO: community_engagement_commands +
--      engagement_command_instances + publish_engagement_command()
-- =====================================================================
-- Promove os 29 cenários já validados na auditoria ad-hoc. Antes deste
-- teste, `70_master_content_config.sql` já cobria SELECT (Master fora
-- da comunidade / member dentro dela) para as duas tabelas, mas
-- NENHUM teste cobria INSERT/UPDATE/DELETE de
-- `community_engagement_commands`, o bloqueio de escrita em
-- `engagement_command_instances`, nem a RPC `publish_engagement_command`.
--
-- Policies auditadas ao vivo (pg_policies):
--   community_engagement_commands_select = owns_community(community_id)
--     OR is_community_member(community_id)   -- SEM is_master() (removido
--     pela 12.4c; nenhuma policy desta família tem bypass de Master)
--   community_engagement_commands_insert (WITH CHECK) =
--     owns_community(community_id) AND created_by = auth.uid()
--   community_engagement_commands_update (USING e WITH CHECK, os DOIS
--     lados da linha) = owns_community(community_id)
--   community_engagement_commands_delete = owns_community(community_id)
--   engagement_command_instances_select = owns_community(community_id)
--     OR is_community_member(community_id)
--   engagement_command_instances: SEM policy de INSERT/UPDATE/DELETE —
--     para nenhuma role.
--
-- GRANTs auditados ao vivo (information_schema.role_table_grants):
--   community_engagement_commands: anon=nenhum ·
--     authenticated=SELECT,INSERT,UPDATE,DELETE · service_role=nenhum ·
--     postgres=CRUD completo.
--   engagement_command_instances: anon=nenhum · authenticated=SELECT
--     apenas (SEM INSERT/UPDATE/DELETE) · service_role=nenhum ·
--     postgres=CRUD completo. Tabela órfã: nenhuma migration, trigger,
--     Edge Function ou tela do frontend jamais insere nela (grep
--     confirmado no repositório inteiro) — só existe pela leitura via
--     SELECT, hoje sempre vazia na prática.
--
-- `publish_engagement_command(p_community_id)` — SECURITY DEFINER, owner
-- postgres, search_path fixo em 'public', EXECUTE concedido a
-- `anon, authenticated, service_role` (grant amplo, mesmo padrão de
-- outras RPCs do projeto) mas gated internamente por
-- `is_professional() AND owns_community(p_community_id)` ANTES de
-- qualquer leitura/escrita. Sorteia um comando ativo do catálogo da
-- comunidade e cria 1 linha em `posts`
-- (post_type='engagement_command', engagement_command_id=<comando>).
-- Não toca `engagement_command_instances`.
--
-- ACHADO DA AUDITORIA (documentado, não é bug): a RPC exige
-- is_professional() ALÉM de owns_community() — mesmo que
-- `communities.owner_id` apontasse para um perfil com role diferente
-- de 'professional' (não deveria acontecer na aplicação real, dado o
-- invariante "1 Professional = 1 comunidade"), a RPC ainda bloquearia.
-- Provado abaixo usando `master` como dona de uma comunidade sintética
-- (role='master', não 'professional').
--
-- Fixtures: `commA` (real, dona=`prof`, `member`=ativo) + `commC`
-- (sintética, dona=`master` — usada só para os testes de isolamento
-- cross-community e para o achado do parágrafo acima; master nunca é
-- 'professional' de verdade, então o teste positivo da RPC usa
-- `prof`+`commA`, que são reais). Tudo em ROLLBACK — nada persiste,
-- inclusive o post criado pela chamada legítima da RPC.
-- =====================================================================

insert into public.communities (id, owner_id, name, slug, is_discoverable)
values (pg_temp.fx('commC'), pg_temp.fx('master'),
        '[rls-suite] Comunidade C (engagement)', 'rls-suite-c-engagement', false);

insert into public.community_engagement_commands (id, community_id, title, content, is_active, created_by)
values
  ('9e100000-0000-4000-8000-000000000c01', pg_temp.fx('commA'), '[rls-suite] comando A1', 'Conte algo bom', true, pg_temp.fx('prof')),
  ('9e100000-0000-4000-8000-000000000c02', pg_temp.fx('commC'), '[rls-suite] comando C1', 'Compartilhe sua conquista', true, pg_temp.fx('master'));

insert into public.engagement_command_instances (id, community_id, command_id, title, content, published_by)
values
  ('9e100000-0000-4000-8000-000000000d01', pg_temp.fx('commA'), '9e100000-0000-4000-8000-000000000c01', '[rls-suite] instancia A1', 'conteudo A1', pg_temp.fx('prof')),
  ('9e100000-0000-4000-8000-000000000d02', pg_temp.fx('commC'), '9e100000-0000-4000-8000-000000000c02', '[rls-suite] instancia C1', 'conteudo C1', pg_temp.fx('master'));

-- ================= 1. community_engagement_commands — SELECT ==========

select pg_temp.expect_count('99: prof (dona de A) vê o próprio comando A1',
  pg_temp.fx('prof'),
  format('select count(*) from public.community_engagement_commands where id = %L', '9e100000-0000-4000-8000-000000000c01'), 1);

select pg_temp.expect_count('99: member (ativo em A) vê comando A1 (is_community_member)',
  pg_temp.fx('member'),
  format('select count(*) from public.community_engagement_commands where id = %L', '9e100000-0000-4000-8000-000000000c01'), 1);

select pg_temp.expect_count('99: member NÃO vê comando C1 (outra comunidade, sem vínculo)',
  pg_temp.fx('member'),
  format('select count(*) from public.community_engagement_commands where id = %L', '9e100000-0000-4000-8000-000000000c02'), 0);

select pg_temp.expect_count('99: master NÃO vê comando A1 (não é dona nem membro de A — sem bypass de plataforma)',
  pg_temp.fx('master'),
  format('select count(*) from public.community_engagement_commands where id = %L', '9e100000-0000-4000-8000-000000000c01'), 0);

select pg_temp.expect_locked('99: anon NÃO vê community_engagement_commands',
  null,
  'select count(*) from public.community_engagement_commands');

-- ================= 2. INSERT =============================================

select pg_temp.expect_write('99: prof (dona de A) cria comando em A com created_by próprio -> PERMITIDO',
  pg_temp.fx('prof'),
  format('insert into public.community_engagement_commands (community_id,title,content,created_by) values (%L,''t'',''c'',%L)',
         pg_temp.fx('commA'), pg_temp.fx('prof')), true);

select pg_temp.expect_write('99: member (não é dona de A) tenta criar comando em A -> BLOQUEADO',
  pg_temp.fx('member'),
  format('insert into public.community_engagement_commands (community_id,title,content,created_by) values (%L,''t'',''c'',%L)',
         pg_temp.fx('commA'), pg_temp.fx('member')), false);

select pg_temp.expect_write('99: prof (dona de A) tenta forjar created_by de outra pessoa (member) -> BLOQUEADO',
  pg_temp.fx('prof'),
  format('insert into public.community_engagement_commands (community_id,title,content,created_by) values (%L,''t'',''c'',%L)',
         pg_temp.fx('commA'), pg_temp.fx('member')), false);

select pg_temp.expect_write('99: prof (dona de A) tenta criar comando em C (comunidade da qual NÃO é dona) -> BLOQUEADO',
  pg_temp.fx('prof'),
  format('insert into public.community_engagement_commands (community_id,title,content,created_by) values (%L,''t'',''c'',%L)',
         pg_temp.fx('commC'), pg_temp.fx('prof')), false);

-- ================= 3. UPDATE ==============================================

select pg_temp.expect_write('99: prof (dona de A) edita o próprio comando A1 -> PERMITIDO',
  pg_temp.fx('prof'),
  format('update public.community_engagement_commands set title = ''[rls-suite] editado'' where id = %L', '9e100000-0000-4000-8000-000000000c01'), true);

select pg_temp.expect_write('99: member tenta editar comando A1 (não é dona) -> BLOQUEADO',
  pg_temp.fx('member'),
  format('update public.community_engagement_commands set title = ''[rls-suite] editado2'' where id = %L', '9e100000-0000-4000-8000-000000000c01'), false);

select pg_temp.expect_write('99: master tenta editar comando A1 (não é dona/membro de A) -> BLOQUEADO',
  pg_temp.fx('master'),
  format('update public.community_engagement_commands set title = ''[rls-suite] editado3'' where id = %L', '9e100000-0000-4000-8000-000000000c01'), false);

select pg_temp.expect_write('99: prof (dona de A) tenta mover comando A1 para C (hijack, não é dona de C) -> BLOQUEADO',
  pg_temp.fx('prof'),
  format('update public.community_engagement_commands set community_id = %L where id = %L', pg_temp.fx('commC'), '9e100000-0000-4000-8000-000000000c01'), false);

-- ================= 4. DELETE ==============================================

select pg_temp.expect_write('99: member tenta deletar comando A1 -> BLOQUEADO',
  pg_temp.fx('member'),
  format('delete from public.community_engagement_commands where id = %L', '9e100000-0000-4000-8000-000000000c01'), false);

select pg_temp.expect_write('99: master tenta deletar comando A1 -> BLOQUEADO',
  pg_temp.fx('master'),
  format('delete from public.community_engagement_commands where id = %L', '9e100000-0000-4000-8000-000000000c01'), false);

select pg_temp.expect_write('99: prof (dona de A) deleta o próprio comando A1 -> PERMITIDO',
  pg_temp.fx('prof'),
  format('delete from public.community_engagement_commands where id = %L', '9e100000-0000-4000-8000-000000000c01'), true);

-- ================= 5. engagement_command_instances (órfã, só SELECT) ====

select pg_temp.expect_count('99: member (ativo em A) vê instância A1 (is_community_member)',
  pg_temp.fx('member'),
  format('select count(*) from public.engagement_command_instances where id = %L', '9e100000-0000-4000-8000-000000000d01'), 1);

select pg_temp.expect_count('99: member NÃO vê instância C1 (outra comunidade)',
  pg_temp.fx('member'),
  format('select count(*) from public.engagement_command_instances where id = %L', '9e100000-0000-4000-8000-000000000d02'), 0);

select pg_temp.expect_count('99: master (dona de C) vê a própria instância C1',
  pg_temp.fx('master'),
  format('select count(*) from public.engagement_command_instances where id = %L', '9e100000-0000-4000-8000-000000000d02'), 1);

select pg_temp.expect_count('99: master NÃO vê instância A1 (não é dona/membro de A)',
  pg_temp.fx('master'),
  format('select count(*) from public.engagement_command_instances where id = %L', '9e100000-0000-4000-8000-000000000d01'), 0);

select pg_temp.expect_locked('99: anon NÃO vê engagement_command_instances',
  null,
  'select count(*) from public.engagement_command_instances');

select pg_temp.expect_write('99: prof (dona de A) tenta INSERT em engagement_command_instances -> BLOQUEADO (sem GRANT)',
  pg_temp.fx('prof'),
  format('insert into public.engagement_command_instances (community_id,title,content,published_by) values (%L,''t'',''c'',%L)',
         pg_temp.fx('commA'), pg_temp.fx('prof')), false);

select pg_temp.expect_write('99: prof (dona de A) tenta UPDATE em engagement_command_instances -> BLOQUEADO (sem GRANT)',
  pg_temp.fx('prof'),
  format('update public.engagement_command_instances set title = ''x'' where id = %L', '9e100000-0000-4000-8000-000000000d01'), false);

select pg_temp.expect_write('99: prof (dona de A) tenta DELETE em engagement_command_instances -> BLOQUEADO (sem GRANT)',
  pg_temp.fx('prof'),
  format('delete from public.engagement_command_instances where id = %L', '9e100000-0000-4000-8000-000000000d01'), false);

-- ================= 6. publish_engagement_command() RPC ===================

select pg_temp.expect_rpc('99: publish_engagement_command -- member (não-dona) -> BLOQUEADO (not_authorized)',
  pg_temp.fx('member'),
  format('public.publish_engagement_command(%L)', pg_temp.fx('commA')), false);

-- achado de design: owns_community() sozinho não basta -- a RPC também
-- exige is_professional() (role='professional'). master é dona de C
-- neste fixture sintético, mas seu role em profiles é 'master', então
-- é bloqueada mesmo sendo dona -- defesa em profundidade (na app real,
-- owner_id de uma comunidade é sempre role='professional', mas a RPC
-- não confia cegamente nisso).
select pg_temp.expect_rpc('99: publish_engagement_command -- master (dona de C, mas role=master, NÃO professional) -> BLOQUEADO mesmo sendo dona',
  pg_temp.fx('master'),
  format('public.publish_engagement_command(%L)', pg_temp.fx('commC')), false);

select pg_temp.expect_rpc('99: publish_engagement_command -- prof (dona de A) tenta publicar em C (não é dona de C) -> BLOQUEADO (not_authorized)',
  pg_temp.fx('prof'),
  format('public.publish_engagement_command(%L)', pg_temp.fx('commC')), false);

-- caminho legítimo real: prof (role=professional, dona de A) publica
-- com o comando ativo A1 (ainda existe -- o DELETE de A1 na seção 4 foi
-- desfeito pelo helper expect_write via savepoint).
select pg_temp.expect_rpc('99: publish_engagement_command -- prof (professional, dona de A) publica com comando ativo (A1) -> PERMITIDO',
  pg_temp.fx('prof'),
  format('public.publish_engagement_command(%L)', pg_temp.fx('commA')), true);

-- confirma o post criado: post_type, engagement_command_id e author_id corretos
do $$
declare v_ok boolean;
begin
  select exists (
    select 1 from public.posts
    where community_id = pg_temp.fx('commA')
      and author_id = pg_temp.fx('prof')
      and post_type = 'engagement_command'
      and engagement_command_id = '9e100000-0000-4000-8000-000000000c01'
  ) into v_ok;
  insert into _r(name,kind,expect,got,ok) values
    ('99: publish_engagement_command -- post resultante tem post_type/engagement_command_id/author_id corretos',
     'bool','true', v_ok::text, v_ok);
end $$;

-- ---------- RESULTADO --------------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
