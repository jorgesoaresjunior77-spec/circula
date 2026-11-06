-- =====================================================================
-- 107 — AGENDA PESSOAL (migration 20261106120000_member_appointments)
-- =====================================================================
-- NÃO EXECUTÁVEL até a migration ser aplicada no banco alvo.
--
-- Regra: cada pessoa só lê e altera os PRÓPRIOS compromissos. Nem a
-- profissional dona da comunidade nem a master leem os de outra pessoa.
-- Tudo em ROLLBACK.
-- =====================================================================

-- Compromissos de apoio (inseridos como superusuário, antes de assumir persona).
insert into public.member_appointments (profile_id, title, starts_at)
values
  (pg_temp.fx('member'), '[rls-suite] consulta da member', now() + interval '1 day'),
  (pg_temp.fx('prof'),   '[rls-suite] reuniao da prof',    now() + interval '2 days');

-- ================= leitura =============================================
select pg_temp.expect_count('agenda: anon NÃO lê nada', null,
  'select count(*) from public.member_appointments', 0);
select pg_temp.expect_count('agenda: member lê só o próprio (1)', pg_temp.fx('member'),
  'select count(*) from public.member_appointments where title like ''[rls-suite]%''', 1);
select pg_temp.expect_count('agenda: prof (dona da comunidade) lê só o próprio (1), não o da member', pg_temp.fx('prof'),
  'select count(*) from public.member_appointments where title like ''[rls-suite]%''', 1);
select pg_temp.expect_count('agenda: master NÃO lê compromissos de ninguém', pg_temp.fx('master'),
  'select count(*) from public.member_appointments where title like ''[rls-suite]%''', 0);

-- ================= escrita =============================================
select pg_temp.expect_write('agenda: member cria compromisso para si -> PERMITIDO', pg_temp.fx('member'),
  format('insert into public.member_appointments (profile_id, title, starts_at) values (%L, ''[rls-suite] novo'', now())', pg_temp.fx('member')), true);
select pg_temp.expect_write('agenda: member cria compromisso em nome de OUTRA pessoa -> BLOQUEADO', pg_temp.fx('member'),
  format('insert into public.member_appointments (profile_id, title, starts_at) values (%L, ''[rls-suite] forjado'', now())', pg_temp.fx('prof')), false);
select pg_temp.expect_write('agenda: anon INSERT -> BLOQUEADO', null,
  format('insert into public.member_appointments (profile_id, title, starts_at) values (%L, ''[rls-suite] anon'', now())', pg_temp.fx('member')), false);

select pg_temp.expect_write('agenda: member edita o próprio compromisso -> PERMITIDO', pg_temp.fx('member'),
  'update public.member_appointments set notes = ''ok'' where title = ''[rls-suite] consulta da member''', true);
select pg_temp.expect_count('agenda: prof UPDATE no compromisso da member não afeta nenhuma linha', pg_temp.fx('prof'),
  'with u as (update public.member_appointments set notes = ''invadido'' where title = ''[rls-suite] consulta da member'' returning 1) select count(*) from u', 0);
select pg_temp.expect_write('agenda: member reatribui compromisso a OUTRA pessoa -> BLOQUEADO', pg_temp.fx('member'),
  format('update public.member_appointments set profile_id = %L where title = ''[rls-suite] consulta da member''', pg_temp.fx('prof')), false);

select pg_temp.expect_count('agenda: prof DELETE no compromisso da member não afeta nenhuma linha', pg_temp.fx('prof'),
  'with d as (delete from public.member_appointments where title = ''[rls-suite] consulta da member'' returning 1) select count(*) from d', 0);
select pg_temp.expect_count('agenda: master DELETE no compromisso da member não afeta nenhuma linha', pg_temp.fx('master'),
  'with d as (delete from public.member_appointments where title = ''[rls-suite] consulta da member'' returning 1) select count(*) from d', 0);
select pg_temp.expect_write('agenda: member exclui o próprio compromisso -> PERMITIDO', pg_temp.fx('member'),
  'delete from public.member_appointments where title = ''[rls-suite] consulta da member''', true);

-- ================= restrições do banco =================================
select pg_temp.expect_write('agenda: título vazio -> BLOQUEADO (check)', pg_temp.fx('member'),
  format('insert into public.member_appointments (profile_id, title, starts_at) values (%L, ''   '', now())', pg_temp.fx('member')), false);
select pg_temp.expect_write('agenda: fim antes do começo -> BLOQUEADO (check)', pg_temp.fx('member'),
  format('insert into public.member_appointments (profile_id, title, starts_at, ends_at) values (%L, ''[rls-suite] x'', now(), now() - interval ''1 hour'')', pg_temp.fx('member')), false);

-- ---------- RESULTADO --------------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
