-- =====================================================================
-- 88 — CONFIGURAÇÃO FINANCEIRA GLOBAL: platform_split_settings
-- =====================================================================
-- Fase P1-F3.1 (segunda tabela do cluster Split & Pricing).
-- `public.platform_split_settings` (`20260827000000`, baseline) é o
-- split default da plataforma (Círcula × Professional), usado por
-- `resolve_split()` como FALLBACK quando nenhuma faixa de
-- `revenue_split_rules` (87) casa com o valor da venda. Nunca teve
-- cenário de RLS.
--
-- Estrutura auditada ao vivo (information_schema + pg_constraint):
--   id uuid pk · professional_percent numeric not null (check 0..100)
--   · circula_percent numeric not null (check 0..100) · CHECK
--   (professional_percent + circula_percent = 100) · effective_from
--   timestamptz · created_by uuid not null (fk -> profiles.id) ·
--   created_at timestamptz.
--   SEM community_id — mesmo formato de `revenue_split_rules`:
--   configuração GLOBAL da plataforma, não por comunidade. Item
--   "isolamento entre comunidades" do roteiro não se aplica (coluna
--   inexistente).
--   1 linha real em produção hoje (professional_percent=90,
--   circula_percent=10, created_by=master, mesma linha desde
--   2026-08-26).
--
-- Policies auditadas ao vivo (pg_policies) — IDÊNTICAS em forma às de
-- `revenue_split_rules`:
--   platform_split_settings_select = is_master() OR is_professional()
--   platform_split_settings_insert (WITH CHECK) = is_master()
--   SEM policy de UPDATE. SEM policy de DELETE.
--
-- GRANTs auditados ao vivo (information_schema.role_table_grants):
--   anon:          nenhum (nem SELECT)
--   authenticated: INSERT, SELECT (sem UPDATE, sem DELETE)
--   service_role:  nenhum grant extra (BYPASSRLS)
-- Mesma imutabilidade estrutural de `revenue_split_rules`: nem Master
-- consegue UPDATE/DELETE via client — não existe GRANT dessas
-- operações para `authenticated`. Versionamento é só por INSERT de
-- nova linha com `effective_from` mais recente. Confirmado por
-- sondagem ao vivo antes deste arquivo.
--
-- `resolve_split(community_id, amount_cents)` (SECURITY DEFINER,
-- STABLE) só lê `professional_percent`/`circula_percent` daqui quando
-- NENHUMA faixa de `revenue_split_rules` casa com o valor — hoje, as
-- 3 faixas de `revenue_split_rules` cobrem contiguamente 0 até
-- infinito, então esse fallback é código morto na prática (fora de
-- escopo verificar isso — é lógica de negócio, não RLS). EXECUTE de
-- `resolve_split` continua revogado de anon/authenticated (mesmo
-- achado do cenário 87) — sem caminho indireto de leitura por aí.
--
-- Achado NOVO deste cenário: `platform_overview()` (SECURITY DEFINER,
-- STABLE) TAMBÉM lê `platform_split_settings` (campos
-- `split_professional_percent`/`split_circula_percent`, dentro de um
-- payload agregado de métricas da plataforma) e tem EXECUTE concedido
-- a `anon` E `authenticated` (diferente de resolve_split!). Não é uma
-- brecha: a própria função abre com
-- `if not is_master() then raise exception 'not_authorized' ...` —
-- MAIS restritiva que a policy de SELECT da tabela (que também deixa
-- Professional ler direto). Testado abaixo: anon/member/prof batem em
-- RAISE mesmo tendo EXECUTE concedido; só Master passa.
--
-- Este cenário testa SÓ a segurança de acesso à tabela — não a lógica
-- de cálculo de `resolve_split()` nem o conteúdo completo de
-- `platform_overview()` (fora de escopo, não alterados aqui).
--
-- Nenhuma fixture sintética necessária: usa a única linha REAL já
-- existente (somente leitura) e testa escrita com INSERT dentro da
-- transação, desfeito no ROLLBACK — nenhuma linha nova persiste.
-- =====================================================================

-- ================= acesso legítimo: Master e Professional =============

select pg_temp.expect_count('master: vê a regra real de split (bypass by design)',
  pg_temp.fx('master'),
  'select count(*) from public.platform_split_settings', 1);

select pg_temp.expect_count('prof: vê a regra real de split (is_professional(), leitura de transparência)',
  pg_temp.fx('prof'),
  'select count(*) from public.platform_split_settings', 1);

-- ================= isolamento de usuário comum + anon ==================

select pg_temp.expect_count('member: NÃO vê a configuração de split (role sem bypass)',
  pg_temp.fx('member'),
  'select count(*) from public.platform_split_settings', 0);

select pg_temp.expect_locked('anon: NÃO vê platform_split_settings (sem GRANT)',
  null,
  'select count(*) from public.platform_split_settings');

-- ================= INSERT sem autorização ===============================

select pg_temp.expect_write('member: INSERT nova configuração de split -> BLOQUEADO',
  pg_temp.fx('member'),
  format('insert into public.platform_split_settings (professional_percent, circula_percent, created_by) values (80, 20, %L)',
         pg_temp.fx('member')),
  false);

select pg_temp.expect_write('prof: INSERT nova configuração de split -> BLOQUEADO (Professional só lê)',
  pg_temp.fx('prof'),
  format('insert into public.platform_split_settings (professional_percent, circula_percent, created_by) values (80, 20, %L)',
         pg_temp.fx('prof')),
  false);

select pg_temp.expect_write('anon: INSERT nova configuração de split -> BLOQUEADO',
  null,
  format('insert into public.platform_split_settings (professional_percent, circula_percent, created_by) values (80, 20, %L)',
         pg_temp.fx('master')),
  false);

-- Master: INSERT é o único caminho de escrita, e deve funcionar.
select pg_temp.expect_write('master: INSERT nova configuração de split -> PERMITIDO',
  pg_temp.fx('master'),
  format('insert into public.platform_split_settings (professional_percent, circula_percent, created_by) values (85, 15, %L)',
         pg_temp.fx('master')),
  true);

-- ================= tentativa de manipular ownership (created_by) =======
-- Não há community_id. O campo mais próximo de "ownership" é
-- created_by (fk -> profiles, NOT NULL). Mesma auditoria de 87: a
-- policy de INSERT não valida created_by = auth.uid(), só is_master().
-- created_by não é lido por nenhuma policy nem por resolve_split()/
-- platform_overview() para decidir acesso — é só metadado de
-- auditoria. Não é vetor de autorização, então NÃO é tratado como
-- vulnerabilidade.
select pg_temp.expect_write('master: INSERT com created_by de outro profile -> PERMITIDO (created_by não é vetor de autorização)',
  pg_temp.fx('master'),
  format('insert into public.platform_split_settings (professional_percent, circula_percent, created_by) values (70, 30, %L)',
         pg_temp.fx('prof')),
  true);

-- ================= UPDATE sem autorização ================================
-- Sem policy de UPDATE e sem GRANT UPDATE para `authenticated`: a
-- barreira é a camada de GRANT, antes da RLS. Vale para qualquer
-- persona autenticada, inclusive Master.

select pg_temp.expect_write('member: UPDATE circula_percent -> BLOQUEADO',
  pg_temp.fx('member'),
  'update public.platform_split_settings set circula_percent = 99, professional_percent = 1 where true',
  false);

select pg_temp.expect_write('prof: UPDATE circula_percent -> BLOQUEADO',
  pg_temp.fx('prof'),
  'update public.platform_split_settings set circula_percent = 99, professional_percent = 1 where true',
  false);

select pg_temp.expect_write('master: UPDATE circula_percent -> BLOQUEADO (sem GRANT, nem para Master)',
  pg_temp.fx('master'),
  'update public.platform_split_settings set circula_percent = 99, professional_percent = 1 where true',
  false);

-- ================= DELETE sem autorização ================================
-- Mesma lógica: sem GRANT DELETE para `authenticated`, inclusive Master.

select pg_temp.expect_write('member: DELETE da configuração de split -> BLOQUEADO',
  pg_temp.fx('member'),
  'delete from public.platform_split_settings where true',
  false);

select pg_temp.expect_write('prof: DELETE da configuração de split -> BLOQUEADO',
  pg_temp.fx('prof'),
  'delete from public.platform_split_settings where true',
  false);

select pg_temp.expect_write('master: DELETE da configuração de split -> BLOQUEADO (sem GRANT, nem para Master)',
  pg_temp.fx('master'),
  'delete from public.platform_split_settings where true',
  false);

-- ================= acesso indireto via SECURITY DEFINER ================
-- (a) resolve_split(): mesma trava já provada no cenário 87 — EXECUTE
-- revogado de anon/authenticated, sem caminho indireto de leitura.

select pg_temp.expect_locked('member: EXECUTE resolve_split() direto -> BLOQUEADO (sem privilégio de função)',
  pg_temp.fx('member'),
  format('select public.resolve_split(%L::uuid, 1000)::text', pg_temp.fx('commA')));

-- (b) platform_overview(): EXECUTE concedido a anon/authenticated (ao
-- contrário de resolve_split), mas a própria função exige is_master()
-- internamente e levanta 'not_authorized' para qualquer outra persona
-- — inclusive Professional, que poderia ler a tabela direto via SELECT
-- mas NÃO consegue via esta função. Confirma que o payload agregado
-- (que inclui os percentuais de split) não vaza para ninguém abaixo
-- de Master, mesmo com o GRANT de EXECUTE mais aberto.

select pg_temp.expect_rpc('anon: EXECUTE platform_overview() -> RAISE (not_authorized)',
  null, 'public.platform_overview()', false);

select pg_temp.expect_rpc('member: EXECUTE platform_overview() -> RAISE (not_authorized)',
  pg_temp.fx('member'), 'public.platform_overview()', false);

select pg_temp.expect_rpc('prof: EXECUTE platform_overview() -> RAISE (not_authorized, mesmo lendo a tabela direto via SELECT)',
  pg_temp.fx('prof'), 'public.platform_overview()', false);

select pg_temp.expect_rpc('master: EXECUTE platform_overview() -> OK (retorna split_professional_percent/split_circula_percent)',
  pg_temp.fx('master'), 'public.platform_overview()', true);

-- ---------- RESULTADO --------------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
