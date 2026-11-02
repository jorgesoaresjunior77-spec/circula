-- =====================================================================
-- 103 — SOLICITAÇÕES DE NOVO CÍRCULO: circle_requests
-- (migration 20261030130000, v2 pós-auditoria — aplicada no remoto)
-- =====================================================================
-- Cobre: GRANT explícito (mesmo achado da 102), isolamento entre
-- comunidades, autora vê a própria solicitação mesmo a dona não tendo
-- decidido ainda, índice único parcial (duplicata 'pending' bloqueada),
-- só a dona decide (UPDATE), member não decide a própria solicitação.
--
-- Fixture sintética (1 solicitação pending do member em commA) criada
-- como `postgres` e some no ROLLBACK.
-- =====================================================================

insert into public.circle_requests
  (id, community_id, profile_id, suggested_name, status)
values
  ('b0000000-0000-4000-8000-000000000b01', pg_temp.fx('commA'), pg_temp.fx('member'), '[rls-suite] Clube do livro', 'pending');

-- ================= SELECT ==============================================

select pg_temp.expect_count('member: vê a própria solicitação',
  pg_temp.fx('member'),
  format('select count(*) from public.circle_requests where id = %L', 'b0000000-0000-4000-8000-000000000b01'), 1);

select pg_temp.expect_count('prof (dona de commA): vê a solicitação da própria comunidade',
  pg_temp.fx('prof'),
  format('select count(*) from public.circle_requests where id = %L', 'b0000000-0000-4000-8000-000000000b01'), 1);

select pg_temp.expect_count('master: NÃO vê solicitação de comunidade que não é sua',
  pg_temp.fx('master'),
  format('select count(*) from public.circle_requests where id = %L', 'b0000000-0000-4000-8000-000000000b01'), 0);

select pg_temp.expect_locked('anon: NÃO vê circle_requests',
  null,
  'select count(*) from public.circle_requests');

-- ================= INSERT — só membro ativo, só em nome próprio =======

-- Caminho positivo da policy de INSERT: precisa de uma membra ATIVA que
-- NÃO tenha 'pending' na fixture — a `member` já tem uma em commA (e o
-- índice único parcial barraria uma segunda). Só existem 3 personas reais
-- (profiles.id referencia auth.users, não dá para criar uma 4ª num teste),
-- então segue o precedente do 98: `prof` entra como MERA membra ativa de
-- uma comunidade sintética (commC, dona = master), sem nenhuma solicitação.
insert into public.communities (id, owner_id, name, slug, is_discoverable)
values (pg_temp.fx('commC'), pg_temp.fx('master'),
        '[rls-suite] Comunidade C (circle_requests)', 'rls-suite-c-circle-requests', false);

insert into public.community_members (community_id, profile_id, status)
values (pg_temp.fx('commC'), pg_temp.fx('prof'), 'active');

select pg_temp.expect_write('membra ativa sem pendência (prof em commC): envia NOVA solicitação -> PERMITIDO',
  pg_temp.fx('prof'),
  format('insert into public.circle_requests (community_id, profile_id, suggested_name) values (%L,%L,''[rls-suite] Corrida de rua'')',
         pg_temp.fx('commC'), pg_temp.fx('prof')), true);

select pg_temp.expect_write('member: tenta forjar solicitação em nome da prof -> BLOQUEADO',
  pg_temp.fx('member'),
  format('insert into public.circle_requests (community_id, profile_id, suggested_name) values (%L,%L,''[rls-suite] forjada'')',
         pg_temp.fx('commA'), pg_temp.fx('prof')), false);

select pg_temp.expect_write('master: NÃO é membro de commA -> BLOQUEADO (is_community_member exige vínculo real, owner/Master não contam)',
  pg_temp.fx('master'),
  format('insert into public.circle_requests (community_id, profile_id, suggested_name) values (%L,%L,''[rls-suite] master pedindo'')',
         pg_temp.fx('commA'), pg_temp.fx('master')), false);

-- Índice único parcial — segunda solicitação 'pending' do MESMO membro
-- na MESMA comunidade é bloqueada no banco, não só na UI.
-- Exige o código 23505 (unique_violation) — um bloqueio genérico poderia
-- ser a RLS (42501) e o índice único nem estar funcionando.
create function pg_temp.expect_write_code(p_name text, p_sub uuid, p_sql text, p_code text)
returns void language plpgsql as $$
declare code text := 'ALLOWED';
begin
  perform pg_temp.as_persona(p_sub);
  begin
    execute p_sql;
    raise exception 'RLSSUITE_OK';
  exception when others then
    if sqlerrm = 'RLSSUITE_OK' then code := 'ALLOWED'; else code := sqlstate; end if;
  end;
  perform pg_temp.done();
  insert into _r(name,kind,expect,got,ok,gap)
  values (p_name,'write','BLOCKED('||p_code||')','BLOCKED('||code||')', code = p_code, false)
  on conflict (name) do update set kind='write',expect=excluded.expect,got=excluded.got,ok=excluded.ok,gap=excluded.gap;
end $$;

select pg_temp.expect_write_code('member: envia SEGUNDA solicitação pending (a fixture já tem uma) -> BLOQUEADO pelo índice único (23505)',
  pg_temp.fx('member'),
  format('insert into public.circle_requests (community_id, profile_id, suggested_name) values (%L,%L,''[rls-suite] duplicata'')',
         pg_temp.fx('commA'), pg_temp.fx('member')),
  '23505');

-- ================= UPDATE — só a dona decide ===========================

select pg_temp.expect_write('member: tenta aprovar a PRÓPRIA solicitação -> BLOQUEADO',
  pg_temp.fx('member'),
  format('update public.circle_requests set status = ''approved'' where id = %L', 'b0000000-0000-4000-8000-000000000b01'), false);

select pg_temp.expect_write('prof (dona de commA): marca como "em análise" -> PERMITIDO',
  pg_temp.fx('prof'),
  format('update public.circle_requests set status = ''reviewing'' where id = %L', 'b0000000-0000-4000-8000-000000000b01'), true);

select pg_temp.expect_write('master: NÃO decide solicitação de comunidade que não é sua -> BLOQUEADO',
  pg_temp.fx('master'),
  format('update public.circle_requests set status = ''approved'' where id = %L', 'b0000000-0000-4000-8000-000000000b01'), false);

-- ---------- RESULTADO --------------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
