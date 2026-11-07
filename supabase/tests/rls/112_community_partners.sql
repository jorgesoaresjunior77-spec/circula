-- =====================================================================
-- 112 — PARCEIROS DA COMUNIDADE (migration 20261107130000)
-- =====================================================================
-- NÃO EXECUTÁVEL até a migration ser aplicada no banco alvo.
-- Membro ativo lê só o PUBLICADO; dona e master leem também rascunhos;
-- só a dona escreve; link só https. Tudo em ROLLBACK.
-- =====================================================================

insert into public.community_partners (community_id, name, logo_path, status, created_by) values
  (pg_temp.fx('commA'), '[rls-suite] publicado', 'x/logo1.png', 'published', pg_temp.fx('prof')),
  (pg_temp.fx('commA'), '[rls-suite] rascunho',  'x/logo2.png', 'draft',     pg_temp.fx('prof'));

select pg_temp.expect_locked('parceiros: anon NÃO lê', null,
  'select count(*) from public.community_partners');
select pg_temp.expect_count('parceiros: member ativo lê só o PUBLICADO (1)', pg_temp.fx('member'),
  'select count(*) from public.community_partners where name like ''[rls-suite]%''', 1);
select pg_temp.expect_count('parceiros: dona lê publicado e rascunho (2)', pg_temp.fx('prof'),
  'select count(*) from public.community_partners where name like ''[rls-suite]%''', 2);
select pg_temp.expect_count('parceiros: master lê publicado e rascunho (2)', pg_temp.fx('master'),
  'select count(*) from public.community_partners where name like ''[rls-suite]%''', 2);

select pg_temp.expect_write('parceiros: dona cadastra com link https -> PERMITIDO', pg_temp.fx('prof'),
  format('insert into public.community_partners (community_id, name, logo_path, link_url) values (%L, ''[rls-suite] n'', ''x/l.png'', ''https://exemplo.com'')', pg_temp.fx('commA')), true);
select pg_temp.expect_write('parceiros: link http (sem s) -> BLOQUEADO (check)', pg_temp.fx('prof'),
  format('insert into public.community_partners (community_id, name, logo_path, link_url) values (%L, ''[rls-suite] n'', ''x/l.png'', ''http://exemplo.com'')', pg_temp.fx('commA')), false);
select pg_temp.expect_write('parceiros: link javascript: -> BLOQUEADO (check)', pg_temp.fx('prof'),
  format('insert into public.community_partners (community_id, name, logo_path, link_url) values (%L, ''[rls-suite] n'', ''x/l.png'', ''javascript:alert(1)'')', pg_temp.fx('commA')), false);
select pg_temp.expect_write('parceiros: nome vazio -> BLOQUEADO (check)', pg_temp.fx('prof'),
  format('insert into public.community_partners (community_id, name, logo_path) values (%L, ''  '', ''x/l.png'')', pg_temp.fx('commA')), false);
select pg_temp.expect_write('parceiros: member cadastra -> BLOQUEADO', pg_temp.fx('member'),
  format('insert into public.community_partners (community_id, name, logo_path) values (%L, ''[rls-suite] m'', ''x/l.png'')', pg_temp.fx('commA')), false);
