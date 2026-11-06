-- =====================================================================
-- 109 — ANTES DE TUDO / CHECKS DE HÁBITOS (migration 20261106140000)
-- =====================================================================
-- NÃO EXECUTÁVEL até a migration ser aplicada no banco alvo.
--
-- Regras: checks são PRIVADOS (só o dono); o dia é decidido pelo servidor
-- (hoje, São Paulo); desmarcar só vale para hoje; não existe UPDATE;
-- só os 7 hábitos conhecidos. Tudo em ROLLBACK.
-- =====================================================================

-- As personas podem já ter checks REAIS de hábitos (o app está em uso). Dentro
-- desta transação (ROLLBACK no fim) eles são limpos, para o fixture não colidir
-- com eles e as contagens serem determinísticas.
delete from public.habit_checks where profile_id in (pg_temp.fx('member'), pg_temp.fx('prof'));

-- Dados de apoio (como superusuário). O trigger força "hoje"; para criar um
-- check de ONTEM ele é desligado só durante esta montagem.
insert into public.habit_checks (profile_id, habit) values (pg_temp.fx('member'), 'agua');
insert into public.habit_checks (profile_id, habit) values (pg_temp.fx('prof'), 'luz');

alter table public.habit_checks disable trigger habit_checks_set_day;
insert into public.habit_checks (profile_id, habit, day)
values (pg_temp.fx('member'), 'leitura', (now() at time zone 'America/Sao_Paulo')::date - 1);
alter table public.habit_checks enable trigger habit_checks_set_day;

-- ================= leitura =============================================
select pg_temp.expect_locked('hábitos: anon NÃO lê nada', null,
  'select count(*) from public.habit_checks');
select pg_temp.expect_count('hábitos: member lê só os próprios (2: hoje e ontem)', pg_temp.fx('member'),
  'select count(*) from public.habit_checks', 2);
select pg_temp.expect_count('hábitos: prof (dona) NÃO lê os da member', pg_temp.fx('prof'),
  format('select count(*) from public.habit_checks where profile_id = %L', pg_temp.fx('member')), 0);
select pg_temp.expect_count('hábitos: master NÃO lê os da member', pg_temp.fx('master'),
  format('select count(*) from public.habit_checks where profile_id = %L', pg_temp.fx('member')), 0);

-- ================= marcar ==============================================
select pg_temp.expect_write('hábitos: member marca um hábito para si -> PERMITIDO', pg_temp.fx('member'),
  format('insert into public.habit_checks (profile_id, habit) values (%L, ''luz'')', pg_temp.fx('member')), true);
select pg_temp.expect_write('hábitos: member marca em nome de OUTRA pessoa -> BLOQUEADO', pg_temp.fx('member'),
  format('insert into public.habit_checks (profile_id, habit) values (%L, ''luz'')', pg_temp.fx('prof')), false);
select pg_temp.expect_write('hábitos: anon marca -> BLOQUEADO', null,
  format('insert into public.habit_checks (profile_id, habit) values (%L, ''luz'')', pg_temp.fx('member')), false);
select pg_temp.expect_write('hábitos: hábito desconhecido -> BLOQUEADO (check)', pg_temp.fx('member'),
  format('insert into public.habit_checks (profile_id, habit) values (%L, ''pular-corda'')', pg_temp.fx('member')), false);
select pg_temp.expect_write('hábitos: marcar o mesmo hábito 2x no dia -> BLOQUEADO (chave única)', pg_temp.fx('member'),
  format('insert into public.habit_checks (profile_id, habit) values (%L, ''agua'')', pg_temp.fx('member')), false);

-- O cliente NÃO escolhe o dia: mesmo pedindo uma data antiga, grava hoje.
select pg_temp.expect_bool('hábitos: o dia do check é HOJE (cliente não escolhe)', pg_temp.fx('member'),
  format($q$with i as (insert into public.habit_checks (profile_id, habit, day) values (%L, 'exercicio', date '2020-01-01') returning day)
            select day = (now() at time zone 'America/Sao_Paulo')::date from i$q$, pg_temp.fx('member')), true);

-- ================= desmarcar / alterar =================================
select pg_temp.expect_count('hábitos: member desmarca o de HOJE', pg_temp.fx('member'),
  'with d as (delete from public.habit_checks where habit = ''agua'' returning 1) select count(*) from d', 1);
select pg_temp.expect_count('hábitos: member NÃO apaga o de ONTEM (histórico fechado)', pg_temp.fx('member'),
  'with d as (delete from public.habit_checks where habit = ''leitura'' returning 1) select count(*) from d', 0);
select pg_temp.expect_write('hábitos: UPDATE não existe -> BLOQUEADO', pg_temp.fx('member'),
  'update public.habit_checks set habit = ''luz'' where habit = ''leitura''', false);
select pg_temp.expect_count('hábitos: prof DELETE no check da member não afeta nenhuma linha', pg_temp.fx('prof'),
  format('with d as (delete from public.habit_checks where profile_id = %L returning 1) select count(*) from d', pg_temp.fx('member')), 0);
select pg_temp.expect_count('hábitos: master DELETE no check da member não afeta nenhuma linha', pg_temp.fx('master'),
  format('with d as (delete from public.habit_checks where profile_id = %L returning 1) select count(*) from d', pg_temp.fx('member')), 0);

-- ---------- RESULTADO --------------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
