-- =====================================================================
-- 106 — CONVITE DA COMUNIDADE POR LINK (migration 20261102120000)
-- =====================================================================
-- NÃO EXECUTÁVEL até a migration ser aplicada no banco alvo.
--
-- Cobre as 6 funções, cada uma com o CAMINHO FELIZ e o CAMINHO DE ERRO
-- com a mensagem EXATA (não só "deu erro"):
--   get_invite_link ............ not_authorized (member, master, sem login)
--   get_or_create_invite_link .. not_authorized (member, master)
--   regenerate_invite_link ..... not_authorized (member)
--   revoke_invite_link ......... not_authorized (member)
--   get_invite_preview ......... ativo=1 · revogado=0 · inexistente=0 (idênticos)
--   join_community_by_invite ... not_authenticated · invalid_invite (inexistente
--                                e revogado) · not_member (prof e master) ·
--                                not_active (bloqueada) · idempotente · pendente→ativa
-- + anon sem EXECUTE nas funções privadas, e a tabela sem acesso direto.
--
-- Persona "recém-chegada": `Sec Test M` (53547dd5…), conta REAL com role
-- member e SEM comunidade — não dá para criar um 4o usuário num teste
-- (profiles.id referencia auth.users). Tudo em ROLLBACK.
-- =====================================================================

-- Como expect_rpc, mas exige a MENSAGEM de erro exata (ou o SQLSTATE).
--   p_who: uuid da persona; NULL = anon; p_nosub = autenticada SEM sub no JWT.
create function pg_temp.expect_rpc_error(p_name text, p_who uuid, p_call text, p_expect text, p_nosub boolean default false)
returns void language plpgsql as $$
declare got text := 'OK (não levantou erro)'; ok boolean;
begin
  if p_nosub then
    perform set_config('request.jwt.claims', json_build_object('role', 'authenticated')::text, true);
    execute 'set local role authenticated';
  elsif p_who is null then
    perform pg_temp.as_anon();
  else
    perform pg_temp.as_persona(p_who);
  end if;
  begin
    execute 'select ' || p_call;
  exception when others then
    got := case when sqlerrm = p_expect then sqlerrm else sqlerrm || ' [' || sqlstate || ']' end;
    ok := (sqlerrm = p_expect) or (sqlstate = p_expect);
  end;
  perform pg_temp.done();
  insert into _r(name, kind, expect, got, ok, gap)
  values (p_name, 'rpc', 'RAISE(' || p_expect || ')', got, coalesce(ok, false), false)
  on conflict (name) do update set kind='rpc', expect=excluded.expect, got=excluded.got, ok=excluded.ok, gap=excluded.gap;
end $$;

-- A comunidade A pode já ter um link ativo REAL (só é permitido um ativo por
-- comunidade). Dentro desta transação (ROLLBACK no fim) ele é revogado para o
-- fixture não colidir com ele.
update public.community_invite_links set revoked_at = now()
 where community_id = pg_temp.fx('commA') and revoked_at is null;

insert into public.community_invite_links (community_id, token, created_by)
values (pg_temp.fx('commA'), 'rls-suite-token-ativo', pg_temp.fx('prof'));

insert into public.community_invite_links (community_id, token, created_by, revoked_at)
values (pg_temp.fx('commA'), 'rls-suite-token-revogado', pg_temp.fx('prof'), now());

-- ================= tabela: sem acesso direto ============================
select pg_temp.expect_locked('tabela: anon NÃO lê', null,
  'select count(*) from public.community_invite_links');
select pg_temp.expect_locked('tabela: member NÃO lê (acesso só por RPC)', pg_temp.fx('member'),
  'select count(*) from public.community_invite_links');
select pg_temp.expect_locked('tabela: prof (dona) também NÃO lê direto', pg_temp.fx('prof'),
  'select count(*) from public.community_invite_links');
select pg_temp.expect_write('tabela: member INSERT direto -> BLOQUEADO', pg_temp.fx('member'),
  format('insert into public.community_invite_links (community_id, token) values (%L, ''x-forjado'')', pg_temp.fx('commA')), false);
select pg_temp.expect_write('tabela: prof (dona) INSERT direto -> BLOQUEADO', pg_temp.fx('prof'),
  format('insert into public.community_invite_links (community_id, token) values (%L, ''y-forjado'')', pg_temp.fx('commA')), false);
select pg_temp.expect_write('tabela: prof (dona) UPDATE direto -> BLOQUEADO', pg_temp.fx('prof'),
  'update public.community_invite_links set revoked_at = null', false);
select pg_temp.expect_write('tabela: prof (dona) DELETE direto -> BLOQUEADO', pg_temp.fx('prof'),
  'delete from public.community_invite_links', false);

-- ================= get_invite_preview (pública) ========================
select pg_temp.expect_count('preview: anon, link ATIVO -> 1 linha', null,
  'select count(*) from public.get_invite_preview(''rls-suite-token-ativo'')', 1);
select pg_temp.expect_count('preview: anon, link REVOGADO -> 0 linhas', null,
  'select count(*) from public.get_invite_preview(''rls-suite-token-revogado'')', 0);
select pg_temp.expect_count('preview: anon, token INEXISTENTE -> 0 linhas (igual ao revogado)', null,
  'select count(*) from public.get_invite_preview(''nao-existe'')', 0);
select pg_temp.expect_bool('preview: o retorno é SÓ o nome da comunidade (1 coluna)', null,
  'select pg_get_function_result(''public.get_invite_preview(text)''::regprocedure) = ''TABLE(community_name text)''', true);

-- ================= get_invite_link (leitura da dona) ===================
select pg_temp.expect_rpc_error('get_invite_link: member -> not_authorized', pg_temp.fx('member'),
  format('public.get_invite_link(%L)', pg_temp.fx('commA')), 'not_authorized');
select pg_temp.expect_rpc_error('get_invite_link: master (não é dona) -> not_authorized', pg_temp.fx('master'),
  format('public.get_invite_link(%L)', pg_temp.fx('commA')), 'not_authorized');
select pg_temp.expect_rpc_error('get_invite_link: autenticada SEM sub -> not_authorized', null,
  format('public.get_invite_link(%L)', pg_temp.fx('commA')), 'not_authorized', true);
select pg_temp.expect_rpc_error('get_invite_link: anon -> sem EXECUTE (42501)', null,
  format('public.get_invite_link(%L)', pg_temp.fx('commA')), '42501');
select pg_temp.expect_rpc('get_invite_link: prof (dona) -> OK', pg_temp.fx('prof'),
  format('public.get_invite_link(%L)', pg_temp.fx('commA')), true);

-- ================= get_or_create_invite_link ===========================
select pg_temp.expect_rpc_error('get_or_create_invite_link: member -> not_authorized', pg_temp.fx('member'),
  format('public.get_or_create_invite_link(%L)', pg_temp.fx('commA')), 'not_authorized');
select pg_temp.expect_rpc_error('get_or_create_invite_link: master -> not_authorized', pg_temp.fx('master'),
  format('public.get_or_create_invite_link(%L)', pg_temp.fx('commA')), 'not_authorized');
select pg_temp.expect_rpc_error('get_or_create_invite_link: anon -> sem EXECUTE (42501)', null,
  format('public.get_or_create_invite_link(%L)', pg_temp.fx('commA')), '42501');
select pg_temp.expect_rpc('get_or_create_invite_link: prof (dona) -> OK', pg_temp.fx('prof'),
  format('public.get_or_create_invite_link(%L)', pg_temp.fx('commA')), true);

-- ================= regenerate_invite_link ==============================
select pg_temp.expect_rpc_error('regenerate_invite_link: member -> not_authorized', pg_temp.fx('member'),
  format('public.regenerate_invite_link(%L)', pg_temp.fx('commA')), 'not_authorized');
select pg_temp.expect_rpc_error('regenerate_invite_link: anon -> sem EXECUTE (42501)', null,
  format('public.regenerate_invite_link(%L)', pg_temp.fx('commA')), '42501');

-- ================= revoke_invite_link ==================================
select pg_temp.expect_rpc_error('revoke_invite_link: member -> not_authorized', pg_temp.fx('member'),
  format('public.revoke_invite_link(%L)', pg_temp.fx('commA')), 'not_authorized');
select pg_temp.expect_rpc_error('revoke_invite_link: anon -> sem EXECUTE (42501)', null,
  format('public.revoke_invite_link(%L)', pg_temp.fx('commA')), '42501');

-- ================= join_community_by_invite ============================
select pg_temp.expect_rpc_error('join: autenticada SEM sub -> not_authenticated', null,
  'public.join_community_by_invite(''rls-suite-token-ativo'')', 'not_authenticated', true);
select pg_temp.expect_rpc_error('join: anon -> sem EXECUTE (42501)', null,
  'public.join_community_by_invite(''rls-suite-token-ativo'')', '42501');
select pg_temp.expect_rpc_error('join: token inexistente -> invalid_invite', '53547dd5-2688-4a44-b0df-4f70df065a1a'::uuid,
  'public.join_community_by_invite(''nao-existe'')', 'invalid_invite');
select pg_temp.expect_rpc_error('join: token REVOGADO -> invalid_invite (igual ao inexistente)', '53547dd5-2688-4a44-b0df-4f70df065a1a'::uuid,
  'public.join_community_by_invite(''rls-suite-token-revogado'')', 'invalid_invite');
select pg_temp.expect_rpc_error('join: prof (role professional) -> not_member', pg_temp.fx('prof'),
  'public.join_community_by_invite(''rls-suite-token-ativo'')', 'not_member');
select pg_temp.expect_rpc_error('join: master (role master) -> not_member', pg_temp.fx('master'),
  'public.join_community_by_invite(''rls-suite-token-ativo'')', 'not_member');
select pg_temp.expect_rpc('join: member já ativa em commA, de novo -> OK (idempotente)', pg_temp.fx('member'),
  'public.join_community_by_invite(''rls-suite-token-ativo'')', true);

-- Bloqueada NUNCA volta por link.
-- (INSERT direto com status 'blocked'/'pending' não vale: o gatilho
-- create_community_trial abre uma assinatura trial e o sync de cobrança
-- devolve o vínculo para 'active'. Mesmo padrão de 20_member_blocked.sql:
-- cria ativa e DEPOIS troca o status.)
insert into public.community_members (community_id, profile_id, status)
values (pg_temp.fx('commA'), '53547dd5-2688-4a44-b0df-4f70df065a1a', 'active');
update public.community_members set status = 'blocked'
 where community_id = pg_temp.fx('commA') and profile_id = '53547dd5-2688-4a44-b0df-4f70df065a1a';

select pg_temp.expect_rpc_error('join: membra BLOQUEADA -> not_active', '53547dd5-2688-4a44-b0df-4f70df065a1a'::uuid,
  'public.join_community_by_invite(''rls-suite-token-ativo'')', 'not_active');
select pg_temp.expect_count('join: a BLOQUEADA continua bloqueada depois da tentativa', '53547dd5-2688-4a44-b0df-4f70df065a1a'::uuid,
  format('select count(*) from public.community_members where community_id = %L and profile_id = ''53547dd5-2688-4a44-b0df-4f70df065a1a'' and status = ''blocked''', pg_temp.fx('commA')), 1);

delete from public.community_members
 where community_id = pg_temp.fx('commA') and profile_id = '53547dd5-2688-4a44-b0df-4f70df065a1a';

-- Pedido pendente vira ativo (a dona já convidou).
insert into public.community_members (community_id, profile_id, status)
values (pg_temp.fx('commA'), '53547dd5-2688-4a44-b0df-4f70df065a1a', 'active');
update public.community_members set status = 'pending'
 where community_id = pg_temp.fx('commA') and profile_id = '53547dd5-2688-4a44-b0df-4f70df065a1a';

select pg_temp.expect_count('join: pré-condição — o vínculo está mesmo PENDENTE antes de entrar', '53547dd5-2688-4a44-b0df-4f70df065a1a'::uuid,
  format('select count(*) from public.community_members where community_id = %L and profile_id = ''53547dd5-2688-4a44-b0df-4f70df065a1a'' and status = ''pending''', pg_temp.fx('commA')), 1);

select pg_temp.expect_rpc('join: membra PENDENTE -> OK', '53547dd5-2688-4a44-b0df-4f70df065a1a'::uuid,
  'public.join_community_by_invite(''rls-suite-token-ativo'')', true);
select pg_temp.expect_count('join: a PENDENTE virou ATIVA', '53547dd5-2688-4a44-b0df-4f70df065a1a'::uuid,
  format('select count(*) from public.community_members where community_id = %L and profile_id = ''53547dd5-2688-4a44-b0df-4f70df065a1a'' and status = ''active''', pg_temp.fx('commA')), 1);

delete from public.community_members
 where community_id = pg_temp.fx('commA') and profile_id = '53547dd5-2688-4a44-b0df-4f70df065a1a';

-- Recém-chegada sem vínculo: entra como ATIVA, e uma 2a vez não duplica.
select pg_temp.expect_rpc('join: recém-chegada (Sec Test M) -> OK', '53547dd5-2688-4a44-b0df-4f70df065a1a'::uuid,
  'public.join_community_by_invite(''rls-suite-token-ativo'')', true);
select pg_temp.expect_rpc('join: recém-chegada de novo -> OK (idempotente)', '53547dd5-2688-4a44-b0df-4f70df065a1a'::uuid,
  'public.join_community_by_invite(''rls-suite-token-ativo'')', true);
select pg_temp.expect_count('join: ficou com UM vínculo ativo, sem duplicar', '53547dd5-2688-4a44-b0df-4f70df065a1a'::uuid,
  format('select count(*) from public.community_members where community_id = %L and profile_id = ''53547dd5-2688-4a44-b0df-4f70df065a1a'' and status = ''active''', pg_temp.fx('commA')), 1);
select pg_temp.expect_count('join: NÃO alterou o role da recém-chegada (segue member)', '53547dd5-2688-4a44-b0df-4f70df065a1a'::uuid,
  'select count(*) from public.profiles where id = ''53547dd5-2688-4a44-b0df-4f70df065a1a'' and role = ''member''', 1);

-- ================= desativar / regenerar (dona) ========================
select pg_temp.expect_rpc('revoke_invite_link: prof (dona) -> OK', pg_temp.fx('prof'),
  format('public.revoke_invite_link(%L)', pg_temp.fx('commA')), true);
select pg_temp.expect_count('revoke: depois de desativar, o preview do token antigo devolve 0', null,
  'select count(*) from public.get_invite_preview(''rls-suite-token-ativo'')', 0);
select pg_temp.expect_rpc_error('revoke: depois de desativar, entrar com o token antigo -> invalid_invite', '53547dd5-2688-4a44-b0df-4f70df065a1a'::uuid,
  'public.join_community_by_invite(''rls-suite-token-ativo'')', 'invalid_invite');
select pg_temp.expect_rpc('regenerate_invite_link: prof (dona) -> OK', pg_temp.fx('prof'),
  format('public.regenerate_invite_link(%L)', pg_temp.fx('commA')), true);

-- ---------- RESULTADO --------------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
