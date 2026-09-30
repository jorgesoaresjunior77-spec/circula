-- =====================================================================
-- 97 — LEDGER DE PONTOS: point_accounts (+ point_ledger, +
--       award_points_manual)
-- =====================================================================
-- Promove os 19 cenários já validados na auditoria ad-hoc de
-- `point_accounts`. Antes deste teste, `point_accounts` tinha ZERO
-- referência na suíte permanente e `point_ledger` tinha só 1 assertion
-- isolada em `40_master.sql` ("master NÃO lê point_ledger").
--
-- Policies auditadas ao vivo (pg_policies):
--   point_accounts_select = (profile_id = auth.uid()) OR owns_community(community_id)
--   point_ledger_select   = mesmo padrão (não testado aqui em detalhe —
--                            já coberto indiretamente pelas escritas
--                            bloqueadas abaixo; ver 40_master.sql para o
--                            isolamento de Master)
-- Sem policy de INSERT/UPDATE/DELETE em NENHUMA das duas tabelas, para
-- nenhuma role — inclusive Master (Master não tem bypass nem de leitura
-- individual: só agregados via `points_community_summary`).
--
-- GRANTs auditados ao vivo (information_schema.role_table_grants), IDÊNTICOS
-- para point_accounts e point_ledger:
--   anon=nenhum · authenticated=SELECT (SEM INSERT/UPDATE/DELETE) ·
--   service_role=NENHUM (nem SELECT) · postgres=CRUD completo (owner).
--
-- Saldo é 100% DERIVADO: `point_accounts.balance` só muda via o trigger
-- `_points_apply_balance` (AFTER INSERT em `point_ledger`, SECURITY
-- DEFINER, owner postgres, search_path fixo). Não existe UPDATE direto
-- possível por nenhuma role de API — confirmado abaixo por execução
-- real, inclusive `service_role` (mesmo padrão de teste usado em
-- `94`/`93`: `set local role service_role` + `reset role` antes de
-- gravar o resultado em `_r`, evitando problema de GRANT na tabela temp).
--
-- `award_points_manual(community_id, profile_id, amount, note)` é o
-- ÚNICO caminho humano de crédito. Guardas confirmadas por execução:
-- `owns_community()`, `profile_id <> auth.uid()` (anti-autoconcessão),
-- alvo precisa ser `community_members.status = 'active'`, `amount
-- between 1 and 1000`. `point_ledger.amount` tem CHECK (`amount > 0`) —
-- testado abaixo mesmo como owner (bypass de RLS deliberado), provando
-- que não há caminho estrutural para saldo negativo/estorno nesta fase.
--
-- Usa as fixtures REAIS da suíte (commA = comunidade da dona `prof`,
-- `member` = membro ativo de A, `master` = não participa de A) — mesmo
-- padrão de todos os cenários 10-96, já que `award_points_manual` é
-- inteiramente gated por ownership/membership reais, não por dados
-- sintéticos. A única verificação sensível a valor (delta de saldo) usa
-- ANTES/DEPOIS dentro da mesma transação — imune a qualquer saldo
-- pré-existente ou drift de dados reais. `commB` (comunidade sintética
-- já definida em `_framework.sql`) é usada só como alvo BLOQUEADO de
-- tentativa de hijack de `community_id`. Tudo em ROLLBACK — nada
-- persiste, inclusive a concessão real de +50 pontos ao member.
-- =====================================================================

create function pg_temp.bal(p_community uuid, p_profile uuid) returns int
language sql stable as $$
  select coalesce((select balance from public.point_accounts
                    where community_id = p_community and profile_id = p_profile), 0)
$$;

create temp table _bal_before (v int) on commit drop;
insert into _bal_before values (pg_temp.bal(pg_temp.fx('commA'), pg_temp.fx('member')));

-- ================= ACESSO DIRETO A point_accounts (sempre BLOQUEADO) ===

select pg_temp.expect_write('97: member UPDATE do PRÓPRIO balance em point_accounts -> BLOQUEADO (sem GRANT)',
  pg_temp.fx('member'),
  format('update public.point_accounts set balance = balance + 999999 where community_id=%L and profile_id=%L',
         pg_temp.fx('commA'), pg_temp.fx('member')), false);

select pg_temp.expect_write('97: member UPDATE do balance do professional (mesma comunidade) -> BLOQUEADO',
  pg_temp.fx('member'),
  format('update public.point_accounts set balance = balance + 999999 where community_id=%L and profile_id=%L',
         pg_temp.fx('commA'), pg_temp.fx('prof')), false);

select pg_temp.expect_write('97: professional (dona de A) UPDATE do PRÓPRIO balance -> BLOQUEADO (nem a dona tem GRANT)',
  pg_temp.fx('prof'),
  format('update public.point_accounts set balance = balance + 999999 where community_id=%L and profile_id=%L',
         pg_temp.fx('commA'), pg_temp.fx('prof')), false);

select pg_temp.expect_write('97: master UPDATE de balance alheio -> BLOQUEADO (sem GRANT, sem bypass)',
  pg_temp.fx('master'),
  format('update public.point_accounts set balance = 999999 where community_id=%L and profile_id=%L',
         pg_temp.fx('commA'), pg_temp.fx('member')), false);

select pg_temp.expect_write('97: member INSERT de nova conta (para terceiro) com saldo arbitrário -> BLOQUEADO (sem GRANT de INSERT)',
  pg_temp.fx('member'),
  format('insert into public.point_accounts (community_id, profile_id, balance) values (%L,%L,100000)',
         pg_temp.fx('commA'), pg_temp.fx('master')), false);

select pg_temp.expect_write('97: member DELETE da PRÓPRIA conta de pontos -> BLOQUEADO (sem GRANT de DELETE)',
  pg_temp.fx('member'),
  format('delete from public.point_accounts where community_id=%L and profile_id=%L',
         pg_temp.fx('commA'), pg_temp.fx('member')), false);

select pg_temp.expect_write('97: member UPDATE de community_id da PRÓPRIA conta (hijack de comunidade) -> BLOQUEADO',
  pg_temp.fx('member'),
  format('update public.point_accounts set community_id = %L where community_id=%L and profile_id=%L',
         pg_temp.fx('commB'), pg_temp.fx('commA'), pg_temp.fx('member')), false);

select pg_temp.expect_write('97: member INSERT direto em point_ledger com amount=999999 -> BLOQUEADO (sem GRANT de INSERT, contorna _award_points)',
  pg_temp.fx('member'),
  format('insert into public.point_ledger (community_id, profile_id, amount, reason, dedupe_key) values (%L,%L,999999,''manual'',''97-hack1'')',
         pg_temp.fx('commA'), pg_temp.fx('member')), false);

-- service_role: sem GRANT nenhum na tabela (nem SELECT). Mesmo padrão de
-- 93/94: troca de role, tenta, `reset role`, só ENTÃO grava em `_r`
-- (evita "permission denied for table _r" sob o role trocado).
do $$
declare v_ok boolean := false; v_code text := '';
begin
  execute 'set local role service_role';
  begin
    update public.point_accounts set balance = 999999
      where community_id = pg_temp.fx('commA') and profile_id = pg_temp.fx('member');
    v_ok := true;
  exception when others then
    v_ok := false; v_code := sqlstate;
  end;
  execute 'reset role';
  insert into _r(name,kind,expect,got,ok) values
    ('97: service_role UPDATE direto de balance -> BLOQUEADO (sem GRANT)','write','BLOCKED',
     case when v_ok then 'ALLOWED' else 'BLOCKED('||v_code||')' end, not v_ok);
end $$;

-- ================= award_points_manual — validações da RPC =============

select pg_temp.expect_rpc('97: award_points_manual -- member (não-dona) tenta conceder em A -> BLOQUEADO (not_authorized)',
  pg_temp.fx('member'),
  format('public.award_points_manual(%L,%L,50,''teste'')', pg_temp.fx('commA'), pg_temp.fx('prof')), false);

select pg_temp.expect_rpc('97: award_points_manual -- master (não-dona) tenta conceder em A -> BLOQUEADO (not_authorized, sem bypass)',
  pg_temp.fx('master'),
  format('public.award_points_manual(%L,%L,50,''teste'')', pg_temp.fx('commA'), pg_temp.fx('member')), false);

select pg_temp.expect_rpc('97: award_points_manual -- professional tenta conceder para SI MESMA -> BLOQUEADO (cannot_grant_to_self)',
  pg_temp.fx('prof'),
  format('public.award_points_manual(%L,%L,50,''teste'')', pg_temp.fx('commA'), pg_temp.fx('prof')), false);

select pg_temp.expect_rpc('97: award_points_manual -- professional concede a NÃO-membro (master) -> BLOQUEADO (target_not_member)',
  pg_temp.fx('prof'),
  format('public.award_points_manual(%L,%L,50,''teste'')', pg_temp.fx('commA'), pg_temp.fx('master')), false);

select pg_temp.expect_rpc('97: award_points_manual -- amount=0 -> BLOQUEADO (amount_out_of_range)',
  pg_temp.fx('prof'),
  format('public.award_points_manual(%L,%L,0,''teste'')', pg_temp.fx('commA'), pg_temp.fx('member')), false);

select pg_temp.expect_rpc('97: award_points_manual -- amount=1001 -> BLOQUEADO (amount_out_of_range)',
  pg_temp.fx('prof'),
  format('public.award_points_manual(%L,%L,1001,''teste'')', pg_temp.fx('commA'), pg_temp.fx('member')), false);

select pg_temp.expect_rpc('97: award_points_manual -- amount=-10 -> BLOQUEADO (amount_out_of_range)',
  pg_temp.fx('prof'),
  format('public.award_points_manual(%L,%L,-10,''teste'')', pg_temp.fx('commA'), pg_temp.fx('member')), false);

-- caminho legítimo: professional (dona de A) concede 50 pontos ao member
-- (membro ativo) -> PERMITIDO
select pg_temp.expect_rpc('97: award_points_manual -- professional concede 50 ao member (membro ativo de A) -> PERMITIDO',
  pg_temp.fx('prof'),
  format('public.award_points_manual(%L,%L,50,''[rls-suite] concessão legítima'')', pg_temp.fx('commA'), pg_temp.fx('member')), true);

-- integridade: saldo do member em A aumentou EXATAMENTE +50 (nada a mais,
-- nada a menos) após a concessão legítima acima.
do $$
declare v_before int; v_after int; v_delta int;
begin
  select v into v_before from _bal_before;
  v_after := pg_temp.bal(pg_temp.fx('commA'), pg_temp.fx('member'));
  v_delta := v_after - v_before;
  insert into _r(name,kind,expect,got,ok) values
    ('97: integridade -- balance do member em A aumenta EXATAMENTE +50 após concessão legítima',
     'bool','50', v_delta::text, v_delta = 50);
end $$;

-- defesa em profundidade: mesmo como owner da tabela (bypass de RLS
-- deliberado), o ledger não aceita amount<=0 -- não há caminho
-- estrutural para saldo negativo/estorno nesta fase.
do $$
declare v_ok boolean := false; v_code text := '';
begin
  begin
    insert into public.point_ledger (community_id, profile_id, amount, reason, dedupe_key)
    values (pg_temp.fx('commA'), pg_temp.fx('member'), -50, 'manual', '97-audit-negative-attempt');
    v_ok := true;
  exception when others then
    v_code := sqlstate;
  end;
  insert into _r(name,kind,expect,got,ok) values
    ('97: integridade -- INSERT direto (como owner, bypass RLS) de amount=-50 no ledger -> REJEITADO pelo CHECK (amount > 0)',
     'bool','rejected pelo CHECK',
     case when v_ok then 'ACEITO (não deveria)' else 'REJEITADO('||v_code||')' end,
     not v_ok);
end $$;

-- ---------- RESULTADO --------------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
