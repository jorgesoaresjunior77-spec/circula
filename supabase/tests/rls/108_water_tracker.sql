-- =====================================================================
-- 108 — CALCULADORA DE ÁGUA (migration 20261106130000_water_tracker)
-- =====================================================================
-- NÃO EXECUTÁVEL até a migration ser aplicada no banco alvo.
--
-- Regras: peso e registros são PRIVADOS (só o dono); o dia do registro é
-- decidido pelo servidor (hoje, São Paulo), nunca pelo cliente; corrigir
-- ou apagar só vale para hoje. Tudo em ROLLBACK.
-- =====================================================================

-- Dados de apoio (inseridos como superusuário, antes de assumir persona).
insert into public.water_profiles (profile_id, weight_kg)
values (pg_temp.fx('member'), 62.5), (pg_temp.fx('prof'), 70);

insert into public.water_logs (profile_id, amount_ml) values (pg_temp.fx('member'), 300);
insert into public.water_logs (profile_id, amount_ml) values (pg_temp.fx('prof'), 500);

-- Um registro de ONTEM da member: o trigger força "hoje", então ele é
-- desligado só para montar este dado de apoio (volta antes de qualquer teste).
alter table public.water_logs disable trigger water_logs_set_day;
insert into public.water_logs (profile_id, amount_ml, day)
values (pg_temp.fx('member'), 250, (now() at time zone 'America/Sao_Paulo')::date - 1);
alter table public.water_logs enable trigger water_logs_set_day;

-- ================= leitura =============================================
select pg_temp.expect_locked('água: anon NÃO lê o peso', null,
  'select count(*) from public.water_profiles');
select pg_temp.expect_locked('água: anon NÃO lê registros', null,
  'select count(*) from public.water_logs');
select pg_temp.expect_count('água: member lê só o próprio peso (1)', pg_temp.fx('member'),
  'select count(*) from public.water_profiles', 1);
select pg_temp.expect_count('água: member lê só os próprios registros (2: hoje e ontem)', pg_temp.fx('member'),
  'select count(*) from public.water_logs', 2);
select pg_temp.expect_count('água: prof (dona) NÃO lê o peso da member', pg_temp.fx('prof'),
  format('select count(*) from public.water_profiles where profile_id = %L', pg_temp.fx('member')), 0);
select pg_temp.expect_count('água: prof (dona) NÃO lê registros da member', pg_temp.fx('prof'),
  format('select count(*) from public.water_logs where profile_id = %L', pg_temp.fx('member')), 0);
select pg_temp.expect_count('água: master NÃO lê o peso de ninguém', pg_temp.fx('master'),
  format('select count(*) from public.water_profiles where profile_id = %L', pg_temp.fx('member')), 0);
select pg_temp.expect_count('água: master NÃO lê registros de ninguém', pg_temp.fx('master'),
  format('select count(*) from public.water_logs where profile_id = %L', pg_temp.fx('member')), 0);

-- ================= escrita: peso =======================================
select pg_temp.expect_write('água: member atualiza o próprio peso -> PERMITIDO', pg_temp.fx('member'),
  'update public.water_profiles set weight_kg = 63', true);
select pg_temp.expect_write('água: member grava peso em nome de OUTRA pessoa -> BLOQUEADO', pg_temp.fx('member'),
  format('update public.water_profiles set profile_id = %L', pg_temp.fx('master')), false);
select pg_temp.expect_write('água: peso absurdo (10 kg) -> BLOQUEADO (check)', pg_temp.fx('member'),
  'update public.water_profiles set weight_kg = 10', false);
select pg_temp.expect_write('água: peso absurdo (500 kg) -> BLOQUEADO (check)', pg_temp.fx('member'),
  'update public.water_profiles set weight_kg = 500', false);
select pg_temp.expect_write('água: member apaga o próprio peso -> PERMITIDO', pg_temp.fx('member'),
  'delete from public.water_profiles', true);
select pg_temp.expect_count('água: prof UPDATE no peso da member não afeta nenhuma linha', pg_temp.fx('prof'),
  format('with u as (update public.water_profiles set weight_kg = 99 where profile_id = %L returning 1) select count(*) from u', pg_temp.fx('member')), 0);

-- ================= escrita: registros ==================================
select pg_temp.expect_write('água: member registra a própria água -> PERMITIDO', pg_temp.fx('member'),
  format('insert into public.water_logs (profile_id, amount_ml) values (%L, 200)', pg_temp.fx('member')), true);
select pg_temp.expect_write('água: member registra em nome de OUTRA pessoa -> BLOQUEADO', pg_temp.fx('member'),
  format('insert into public.water_logs (profile_id, amount_ml) values (%L, 200)', pg_temp.fx('prof')), false);
select pg_temp.expect_write('água: anon INSERT -> BLOQUEADO', null,
  format('insert into public.water_logs (profile_id, amount_ml) values (%L, 200)', pg_temp.fx('member')), false);
select pg_temp.expect_write('água: 0 ml -> BLOQUEADO (check)', pg_temp.fx('member'),
  format('insert into public.water_logs (profile_id, amount_ml) values (%L, 0)', pg_temp.fx('member')), false);
select pg_temp.expect_write('água: 5 litros de uma vez -> BLOQUEADO (check)', pg_temp.fx('member'),
  format('insert into public.water_logs (profile_id, amount_ml) values (%L, 5000)', pg_temp.fx('member')), false);

-- O cliente NÃO escolhe o dia: mesmo pedindo "ontem", grava hoje.
select pg_temp.expect_bool('água: o dia do registro é HOJE (cliente não escolhe)', pg_temp.fx('member'),
  format($q$with i as (insert into public.water_logs (profile_id, amount_ml, day) values (%L, 100, date '2020-01-01') returning day)
            select day = (now() at time zone 'America/Sao_Paulo')::date from i$q$, pg_temp.fx('member')), true);

select pg_temp.expect_write('água: member corrige registro de HOJE -> PERMITIDO', pg_temp.fx('member'),
  'update public.water_logs set amount_ml = 350 where amount_ml = 300', true);
select pg_temp.expect_count('água: member NÃO corrige registro de ONTEM (fechado)', pg_temp.fx('member'),
  'with u as (update public.water_logs set amount_ml = 999 where amount_ml = 250 returning 1) select count(*) from u', 0);
select pg_temp.expect_count('água: member NÃO apaga registro de ONTEM (fechado)', pg_temp.fx('member'),
  'with d as (delete from public.water_logs where amount_ml = 250 returning 1) select count(*) from d', 0);
select pg_temp.expect_count('água: member apaga registro de HOJE', pg_temp.fx('member'),
  'with d as (delete from public.water_logs where amount_ml = 300 returning 1) select count(*) from d', 1);
select pg_temp.expect_count('água: prof UPDATE em registro da member não afeta nenhuma linha', pg_temp.fx('prof'),
  format('with u as (update public.water_logs set amount_ml = 1 where profile_id = %L returning 1) select count(*) from u', pg_temp.fx('member')), 0);
select pg_temp.expect_count('água: master DELETE em registro da member não afeta nenhuma linha', pg_temp.fx('master'),
  format('with d as (delete from public.water_logs where profile_id = %L returning 1) select count(*) from d', pg_temp.fx('member')), 0);

-- ---------- RESULTADO --------------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
