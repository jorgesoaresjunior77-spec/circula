-- =====================================================================
-- 60 — DISCOVERY + SOLICITAÇÃO DE ENTRADA (PENDING)  — Fase 12.3
-- =====================================================================
-- Concatenar após _framework.sql (mesmo padrão dos demais cenários).
-- Cobre as regras A-R pedidas para a Fase 12.3. Usa community A (real)
-- para os testes que precisam de uma DONA que não seja o Master (só
-- existem 3 perfis reais: master/prof/member — prof já é dona de A, e
-- UNIQUE(owner_id) impede uma segunda comunidade seguindo dela numa
-- comunidade sintética). Usa a comunidade sintética D (dona = master)
-- para os testes que precisam de uma comunidade "alheia" às três
-- pessoas reais. Tudo dentro de uma transação com ROLLBACK.
-- =====================================================================

-- ---------- fixture: comunidade sintética D (dona = master) ----------
-- Só master pode ser dona de uma comunidade sintética nesta transação
-- (UNIQUE(owner_id) + prof já é dona da real A) — então D também serve
-- de teste da regra 1 (DEFAULT de is_discoverable): INSERT SEM
-- especificar a coluna, deve nascer false.
insert into public.communities (id, owner_id, name, slug)
values (pg_temp.fx('commB'), pg_temp.fx('master'), '[rls-suite] Comunidade D (discovery)', 'rls-suite-discovery-d');
-- (reaproveita a chave 'commB' do framework como "comunidade sintética
--  genérica" deste cenário — sem colisão, cada cenário roda em sua
--  própria transação isolada)

select pg_temp.expect_bool('regra1: nova comunidade sem is_discoverable explícito nasce NÃO discoverable',
  pg_temp.fx('master'),
  format('select is_discoverable from public.communities where id = %L', pg_temp.fx('commB')), false);

-- ---------- regra 2/D: comunidade NÃO discoverable não aparece -------
select pg_temp.expect_count('D: comunidade NÃO discoverable NÃO aparece para quem não é membro',
  pg_temp.fx('member'),
  format('select count(*) from public.communities where id = %L', pg_temp.fx('commB')), 0);

-- torna D discoverable
update public.communities set is_discoverable = true where id = pg_temp.fx('commB');

-- ---------- regra 3: comunidade discoverable PODE aparecer -----------
select pg_temp.expect_count('regra3: comunidade discoverable aparece para quem não é membro',
  pg_temp.fx('member'),
  format('select count(*) from public.communities where id = %L', pg_temp.fx('commB')), 1);

-- ---------- regra 4/E: aparecer na descoberta NÃO concede acesso -----
select pg_temp.expect_count('E: antes de solicitar, member NÃO lê nada do conteúdo de D (nem existe post ainda)',
  pg_temp.fx('member'),
  format('select count(*) from public.community_members where community_id = %L and profile_id = %L', pg_temp.fx('commB'), pg_temp.fx('member')), 0);
select pg_temp.expect_bool('E: is_community_member(D) = false antes de solicitar',
  pg_temp.fx('member'),
  format('select public.is_community_member(%L)', pg_temp.fx('commB')), false);

-- ---------- A: não autenticado não consegue solicitar entrada --------
select pg_temp.expect_write('A: anon NÃO consegue solicitar entrada em D',
  null,
  format('insert into public.community_members(community_id, profile_id, status) values (%L, %L, ''pending'')',
         pg_temp.fx('commB'), pg_temp.fx('member')), false);

-- ---------- B/C: member consegue solicitar entrada; fica pending -----
select pg_temp.expect_write('B: member consegue solicitar entrada em D (comunidade discoverable)',
  pg_temp.fx('member'),
  format('insert into public.community_members(community_id, profile_id, status) values (%L, %L, ''pending'')',
         pg_temp.fx('commB'), pg_temp.fx('member')), true);

-- (a linha da regra B acima foi desfeita pelo próprio expect_write —
--  insere de novo, desta vez SEM desfazer, para os testes seguintes
--  precisarem da linha pending realmente presente)
insert into public.community_members (community_id, profile_id, status)
values (pg_temp.fx('commB'), pg_temp.fx('member'), 'pending');

select pg_temp.expect_bool('C: solicitação criada fica com status = pending',
  pg_temp.fx('member'),
  format('select (status = ''pending'') from public.community_members where community_id=%L and profile_id=%L',
         pg_temp.fx('commB'), pg_temp.fx('member')), true);

-- ---------- E (reforço): discoverable + solicitação pending ainda
-- NÃO concede acesso a conteúdo -----------------------------------------
select pg_temp.expect_bool('E: is_community_member(D) continua false com solicitação pending',
  pg_temp.fx('member'),
  format('select public.is_community_member(%L)', pg_temp.fx('commB')), false);

-- posto sintético em D (como postgres, bypassa RLS) para os testes F/H/I
insert into public.posts (id, community_id, author_id, content)
values (pg_temp.fx('postB'), pg_temp.fx('commB'), pg_temp.fx('master'), '[rls-suite] post em D (conteúdo privado)');

-- ---------- F: member pending NÃO lê conteúdo privado -----------------
select pg_temp.expect_count('F: member pending NÃO lê posts de D',
  pg_temp.fx('member'),
  format('select count(*) from public.posts where community_id = %L', pg_temp.fx('commB')), 0);
select pg_temp.expect_bool('F: can_view_post do post de D = false p/ member pending',
  pg_temp.fx('member'),
  format('select public.can_view_post(%L)', pg_temp.fx('postB')), false);

-- ---------- G: member pending NÃO cria post -----------------------
select pg_temp.expect_write('G: member pending NÃO cria post em D',
  pg_temp.fx('member'),
  format('insert into public.posts(community_id,author_id,content) values (%L,%L,%L)',
         pg_temp.fx('commB'), pg_temp.fx('member'), '[rls-suite]'), false);

-- ---------- H: member pending NÃO comenta --------------------------
select pg_temp.expect_write('H: member pending NÃO comenta no post de D',
  pg_temp.fx('member'),
  format('insert into public.post_comments(post_id,author_id,content) values (%L,%L,%L)',
         pg_temp.fx('postB'), pg_temp.fx('member'), '[rls-suite]'), false);

-- ---------- I: member pending NÃO reage ----------------------------
select pg_temp.expect_write('I: member pending NÃO reage ao post de D',
  pg_temp.fx('member'),
  format('insert into public.post_reactions(post_id,profile_id) values (%L,%L)',
         pg_temp.fx('postB'), pg_temp.fx('member')), false);

-- (desafios/conteúdo restrito — mesma família de guarda: is_community_member)
select pg_temp.expect_write('regra6: member pending NÃO cria joy_moment em D',
  pg_temp.fx('member'),
  format('insert into public.joy_moments(community_id,profile_id,body) values (%L,%L,%L)',
         pg_temp.fx('commB'), pg_temp.fx('member'), '[rls-suite]'), false);
select pg_temp.expect_write('regra6: member pending NÃO cria help_request em D',
  pg_temp.fx('member'),
  format('insert into public.help_requests(community_id,profile_id,audience,body) values (%L,%L,''community'',%L)',
         pg_temp.fx('commB'), pg_temp.fx('member'), '[rls-suite]'), false);

-- ---------- J: member pending NÃO altera o próprio status p/ active --
select pg_temp.expect_write('J: member pending NÃO faz UPDATE direto (sem GRANT)',
  pg_temp.fx('member'),
  format('update public.community_members set status=''active'' where community_id=%L and profile_id=%L',
         pg_temp.fx('commB'), pg_temp.fx('member')), false);
select pg_temp.expect_write('J: member pending NÃO insere uma 2a linha ''active'' para burlar (unique barra)',
  pg_temp.fx('member'),
  format('insert into public.community_members(community_id,profile_id,status) values (%L,%L,''active'')',
         pg_temp.fx('commB'), pg_temp.fx('member')), false);

-- ---------- K: o próprio member (não-dona, não-master) NÃO aprova ----
-- (equivalente a "outro member" do ponto de vista do guard da RPC, que
--  só olha owns_community()/is_master() — nunca "quem é o solicitante")
select pg_temp.expect_rpc('K: member NÃO aprova a própria solicitação via RPC',
  pg_temp.fx('member'),
  format('public.approve_membership_request(%L, %L)', pg_temp.fx('commB'), pg_temp.fx('member')), false);

-- ---------- L: Professional de OUTRA comunidade NÃO aprova -----------
select pg_temp.expect_rpc('L: prof (dona de A, não de D) NÃO aprova solicitação de D',
  pg_temp.fx('prof'),
  format('public.approve_membership_request(%L, %L)', pg_temp.fx('commB'), pg_temp.fx('member')), false);

-- confirma que nada mudou depois das tentativas K e L
select pg_temp.expect_bool('K/L: status continua pending após tentativas inválidas de aprovação',
  pg_temp.fx('member'),
  format('select (status = ''pending'') from public.community_members where community_id=%L and profile_id=%L',
         pg_temp.fx('commB'), pg_temp.fx('member')), true);

-- ---------- P: não existe duplicação de solicitação -------------------
select pg_temp.expect_write('P: 2a solicitação para o mesmo par (community,member) é barrada (UNIQUE)',
  pg_temp.fx('member'),
  format('insert into public.community_members(community_id,profile_id,status) values (%L,%L,''pending'')',
         pg_temp.fx('commB'), pg_temp.fx('member')), false);

-- =====================================================================
-- M/N/O — aprovação por uma DONA real (não-master): usa a comunidade A
-- (real, dona = prof) e o Master como "solicitante" (nenhum dos 3
-- perfis reais tem uma 2a conta de member disponível; o Master aqui só
-- está agindo como um profile qualquer solicitando entrada — o teste
-- valida o RAMO owns_community() do guard, isolado de is_master()).
-- =====================================================================

-- R (checagem prévia): antes de virar membro, Master continua sem
-- leitura direta de A — a 12.4 segue intacta.
select pg_temp.expect_count('R (antes): master NÃO lê posts de A (12.4 intacta)',
  pg_temp.fx('master'),
  format('select count(*) from public.posts where community_id = %L', pg_temp.fx('commA')), 0);

-- master solicita entrada em A (comunidade real, discoverable=true)
select pg_temp.expect_write('setup M/N/O: master solicita entrada em A (self-request vira pending)',
  pg_temp.fx('master'),
  format('insert into public.community_members(community_id,profile_id,status) values (%L,%L,''pending'')',
         pg_temp.fx('commA'), pg_temp.fx('master')), true);
insert into public.community_members (community_id, profile_id, status)
values (pg_temp.fx('commA'), pg_temp.fx('master'), 'pending');

select pg_temp.expect_count('E (reforço com A): master pending NÃO lê posts de A mesmo sendo comunidade real',
  pg_temp.fx('master'),
  format('select count(*) from public.posts where community_id = %L', pg_temp.fx('commA')), 0);

-- M: prof (dona real de A, NÃO master) aprova
select pg_temp.expect_rpc('M: prof (dona real, não-master) aprova a solicitação em A',
  pg_temp.fx('prof'),
  format('public.approve_membership_request(%L, %L)', pg_temp.fx('commA'), pg_temp.fx('master')), true);

-- N: pending -> active
select pg_temp.expect_bool('N: após aprovação, status de master em A vira active',
  pg_temp.fx('master'),
  format('select (status = ''active'') from public.community_members where community_id=%L and profile_id=%L',
         pg_temp.fx('commA'), pg_temp.fx('master')), true);

-- O: acesso normal restaurado (mesmas regras de sempre: is_community_member agora true)
select pg_temp.expect_count('O: após aprovação, master lê os posts de A como qualquer membro ativo',
  pg_temp.fx('master'),
  format('select count(*) from public.posts where community_id = %L', pg_temp.fx('commA')), 11);
select pg_temp.expect_bool('O: is_community_member(A) = true após aprovação',
  pg_temp.fx('master'),
  format('select public.is_community_member(%L)', pg_temp.fx('commA')), true);

-- ---------- R (depois): restrições do Master continuam, no ESCOPO
-- certo --------------------------------------------------------------
-- IMPORTANTE (achado do próprio teste, documentado em vez de forçado):
-- depois de M/N/O, o Master é um membro ATIVO genuíno de A — então ele
-- passa a enxergar community_members(A) e os profiles de quem
-- compartilha A com ele (prof/member) pelos MESMOS mecanismos
-- (`profile_id=auth.uid()` / `shares_active_community`) que qualquer
-- outra pessoa ativa em A também teria. Isso NÃO é bypass de
-- is_master() (a 12.4 removeu exatamente esse ramo) — é o acesso
-- normal de quem é, de fato, membro ativo daquela comunidade. Testar
-- "Master não vê nada" aqui seria testar o cenário errado: D é a
-- comunidade que o Master REALMENTE não integra, e sobre ela a
-- restrição segue de pé:
select pg_temp.expect_bool('R (depois): master NÃO é membro de D (só dona/proprietária no cadastro, nunca solicitou)',
  pg_temp.fx('master'),
  format('select public.is_community_member(%L)', pg_temp.fx('commB')), false);
select pg_temp.expect_rpc('R (depois): platform_overview() continua OK para master',
  pg_temp.fx('master'), 'public.platform_overview()', true);
-- A reverificação completa e independente de que o Master, SEM
-- nenhuma membership, continua com 0 leituras diretas em todas as
-- tabelas narrowed pela 12.4 já é feita (e passa) por 40_master.sql,
-- que este cenário não duplica nem altera.

-- ---------- rejeição (regra 9) — usa o pedido pending de D -------------
select pg_temp.expect_rpc('rejeicao: dona (master, dona de D) rejeita a solicitação pending de D',
  pg_temp.fx('master'),
  format('public.reject_membership_request(%L, %L)', pg_temp.fx('commB'), pg_temp.fx('member')), true);
select pg_temp.expect_count('rejeicao: linha da solicitação rejeitada foi removida (sem acesso concedido)',
  pg_temp.fx('member'),
  format('select count(*) from public.community_members where community_id=%L and profile_id=%L', pg_temp.fx('commB'), pg_temp.fx('member')), 0);
select pg_temp.expect_rpc('rejeicao: rejeitar de novo (já não há pending) levanta no_pending_request_found',
  pg_temp.fx('master'),
  format('public.reject_membership_request(%L, %L)', pg_temp.fx('commB'), pg_temp.fx('member')), false);

-- após a rejeição, member pode solicitar de novo (não ficou "preso")
select pg_temp.expect_write('rejeicao: após rejeitada, member CONSEGUE solicitar de novo',
  pg_temp.fx('member'),
  format('insert into public.community_members(community_id,profile_id,status) values (%L,%L,''pending'')',
         pg_temp.fx('commB'), pg_temp.fx('member')), true);

-- ---------- Q: isolamento entre comunidades continua funcionando -----
-- member tem pedido(s) mexidos em D o tempo todo neste cenário, mas
-- nunca deixou de ler normalmente a própria comunidade A (ativa, real)
select pg_temp.expect_count('Q: member (ativo em A, mexendo com D o cenário inteiro) sempre leu A normalmente',
  pg_temp.fx('member'),
  format('select count(*) from public.posts where community_id = %L', pg_temp.fx('commA')), 11);
select pg_temp.expect_count('Q: member NUNCA leu conteúdo de D (nem pending nem depois de rejeitado)',
  pg_temp.fx('member'),
  format('select count(*) from public.posts where community_id = %L', pg_temp.fx('commB')), 0);

-- ---------- RESULTADO ----------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
