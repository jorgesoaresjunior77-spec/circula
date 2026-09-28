-- =====================================================================
-- 87 — CONFIGURAÇÃO FINANCEIRA GLOBAL: revenue_split_rules
-- =====================================================================
-- Fase P1-F3.1. `public.revenue_split_rules` (`20260827000000`,
-- baseline) é a tabela de faixas de comissão da plataforma por VALOR
-- da venda — consultada por `resolve_split()` ANTES do fallback em
-- `platform_split_settings`. A migration a comenta como
-- `-- ÓRFÃ — preservada`; esse comentário está DESATUALIZADO: a tabela
-- tem 3 linhas reais em produção e é lida ao vivo por `resolve_split()`
-- em toda venda de produto. Nunca teve cenário de RLS. Maior blast
-- radius das 12 tabelas identificadas na auditoria P1-F3 — decide a
-- taxa da Círcula em toda venda que caia numa faixa configurada.
--
-- Estrutura auditada ao vivo (information_schema + pg_constraint):
--   id uuid pk · min_amount_cents int not null · max_amount_cents int
--   (nullable) · circula_percent numeric not null (check 0..100) ·
--   effective_from timestamptz · created_by uuid not null
--   (fk -> profiles.id) · created_at timestamptz.
--   SEM community_id — é configuração GLOBAL da plataforma, não por
--   comunidade. Item "isolamento entre comunidades" do roteiro de
--   auditoria não se aplica a esta tabela (coluna inexistente).
--
-- Policies auditadas ao vivo (pg_policies):
--   revenue_split_rules_select = is_master() OR is_professional()
--   revenue_split_rules_insert (WITH CHECK) = is_master()
--   SEM policy de UPDATE. SEM policy de DELETE.
--
-- GRANTs auditados ao vivo (information_schema.role_table_grants):
--   anon:          nenhum (nem SELECT)
--   authenticated: INSERT, SELECT (sem UPDATE, sem DELETE)
--   service_role:  nenhum grant extra (lê/escreve via BYPASSRLS)
-- A tabela é estruturalmente IMUTÁVEL por API: mesmo Master não
-- consegue UPDATE nem DELETE via client — não existe GRANT dessas
-- operações para `authenticated`, então a barreira nem chega a ser a
-- RLS, é a camada de GRANT. Versionamento é só por INSERT de nova
-- linha com `effective_from` mais recente. Confirmado por sondagem ao
-- vivo antes deste arquivo (master INSERT → ALLOWED; master UPDATE/
-- DELETE → BLOCKED(42501), mesmo sqlstate do bloqueio de GRANT).
--
-- `resolve_split(community_id, amount_cents)` (SECURITY DEFINER,
-- STABLE) lê esta tabela primeiro (fallback em platform_split_settings
-- se nenhuma faixa casar) para decidir `circula_percent`/
-- `circula_amount_cents`/`professional_amount_cents` de cada venda.
-- É só leitura — não escreve em revenue_split_rules. EXECUTE está
-- REVOGADO de `anon` e `authenticated` (confirmado por
-- `has_function_privilege`): só é chamável de dentro de
-- `create_product_order` (também sem EXECUTE para client), que por sua
-- vez só roda via Edge Function server-side. Logo não existe caminho
-- indireto pelo qual um cliente autenticado leia ou altere esta tabela
-- passando por `resolve_split()` — testado abaixo mesmo assim (item 11
-- do roteiro), tentando chamar a função direto.
--
-- Este cenário testa SÓ a segurança de acesso à tabela — não a lógica
-- de cálculo de `resolve_split()` (fora de escopo, não alterada aqui).
--
-- Nenhuma fixture sintética é necessária: usa as 3 linhas REAIS já
-- existentes (somente leitura) e testa escrita com INSERT dentro da
-- transação, desfeito no ROLLBACK — nenhuma linha nova persiste.
-- =====================================================================

-- ================= (1)+(9) acesso legítimo: Master e Professional ====

select pg_temp.expect_count('master: vê as 3 regras reais (bypass by design)',
  pg_temp.fx('master'),
  'select count(*) from public.revenue_split_rules', 3);

select pg_temp.expect_count('prof: vê as 3 regras reais (is_professional(), leitura de transparência)',
  pg_temp.fx('prof'),
  'select count(*) from public.revenue_split_rules', 3);

-- ================= (2)+(3)+(4) isolamento de usuário comum ============
-- (3) isolamento ENTRE COMUNIDADES não se aplica: tabela não tem
-- community_id (config global). O isolamento real e testável aqui é
-- por ROLE (member não vê; qualquer Professional vê tudo).

select pg_temp.expect_count('member: NÃO vê nenhuma regra (role sem bypass)',
  pg_temp.fx('member'),
  'select count(*) from public.revenue_split_rules', 0);

select pg_temp.expect_locked('anon: NÃO vê revenue_split_rules (sem GRANT)',
  null,
  'select count(*) from public.revenue_split_rules');

-- ================= (5) INSERT sem autorização ==========================

select pg_temp.expect_write('member: INSERT nova faixa de comissão -> BLOQUEADO',
  pg_temp.fx('member'),
  format('insert into public.revenue_split_rules (min_amount_cents, circula_percent, created_by) values (0, 50, %L)',
         pg_temp.fx('member')),
  false);

select pg_temp.expect_write('prof: INSERT nova faixa de comissão -> BLOQUEADO (Professional só lê)',
  pg_temp.fx('prof'),
  format('insert into public.revenue_split_rules (min_amount_cents, circula_percent, created_by) values (0, 0, %L)',
         pg_temp.fx('prof')),
  false);

select pg_temp.expect_write('anon: INSERT nova faixa de comissão -> BLOQUEADO',
  null,
  format('insert into public.revenue_split_rules (min_amount_cents, circula_percent, created_by) values (0, 50, %L)',
         pg_temp.fx('master')),
  false);

-- (9) Master: INSERT é o único caminho de escrita, e deve funcionar.
select pg_temp.expect_write('master: INSERT nova faixa de comissão -> PERMITIDO',
  pg_temp.fx('master'),
  format('insert into public.revenue_split_rules (min_amount_cents, circula_percent, created_by) values (999999999, 12.5, %L)',
         pg_temp.fx('master')),
  true);

-- ================= (8) manipulação do campo de ownership (created_by) =
-- Não há community_id nesta tabela. O campo mais próximo de "ownership"
-- é created_by (fk -> profiles, NOT NULL). A policy de INSERT NÃO
-- valida created_by = auth.uid() (só valida is_master()) — Master
-- consegue atribuir a autoria a outro profile_id. Auditado: created_by
-- não é usado por nenhuma policy nem por resolve_split() para decidir
-- acesso — é só metadado de auditoria. Não é vetor de autorização,
-- então NÃO é tratado como vulnerabilidade; documentado como
-- comportamento real e esperado.
select pg_temp.expect_write('master: INSERT com created_by de outro profile -> PERMITIDO (created_by não é vetor de autorização)',
  pg_temp.fx('master'),
  format('insert into public.revenue_split_rules (min_amount_cents, circula_percent, created_by) values (888888888, 20, %L)',
         pg_temp.fx('prof')),
  true);

-- ================= (6) UPDATE sem autorização ===========================
-- Sem policy de UPDATE e sem GRANT UPDATE para `authenticated`: a
-- barreira é a camada de GRANT, antes mesmo da RLS. Vale para
-- QUALQUER persona autenticada, inclusive Master.

select pg_temp.expect_write('member: UPDATE circula_percent -> BLOQUEADO',
  pg_temp.fx('member'),
  'update public.revenue_split_rules set circula_percent = 99 where true',
  false);

select pg_temp.expect_write('prof: UPDATE circula_percent -> BLOQUEADO',
  pg_temp.fx('prof'),
  'update public.revenue_split_rules set circula_percent = 99 where true',
  false);

select pg_temp.expect_write('master: UPDATE circula_percent -> BLOQUEADO (sem GRANT, nem para Master)',
  pg_temp.fx('master'),
  'update public.revenue_split_rules set circula_percent = 99 where true',
  false);

-- ================= (7) DELETE sem autorização ===========================
-- Mesma lógica: sem GRANT DELETE para `authenticated`, inclusive Master.

select pg_temp.expect_write('member: DELETE de regra -> BLOQUEADO',
  pg_temp.fx('member'),
  'delete from public.revenue_split_rules where true',
  false);

select pg_temp.expect_write('prof: DELETE de regra -> BLOQUEADO',
  pg_temp.fx('prof'),
  'delete from public.revenue_split_rules where true',
  false);

select pg_temp.expect_write('master: DELETE de regra -> BLOQUEADO (sem GRANT, nem para Master)',
  pg_temp.fx('master'),
  'delete from public.revenue_split_rules where true',
  false);

-- ================= (10) anon bloqueado (consolidado acima) =============
-- Já provado em SELECT e INSERT acima. Nenhum GRANT de UPDATE/DELETE
-- existe para nenhum role client-side, então não há o que testar a
-- mais para anon nessas operações (bloqueio já é total por GRANT).

-- ================= (11) acesso indireto via resolve_split() ============
-- resolve_split() é STABLE (só leitura) e SECURITY DEFINER, mas o
-- EXECUTE está revogado de anon/authenticated — não existe forma de um
-- cliente ler (nem alterar, já que a função não escreve) a tabela por
-- fora das policies chamando a função diretamente.

select pg_temp.expect_locked('anon: EXECUTE resolve_split() direto -> BLOQUEADO (sem privilégio de função)',
  null,
  format('select public.resolve_split(%L::uuid, 1000)::text', pg_temp.fx('commA')));

select pg_temp.expect_locked('member: EXECUTE resolve_split() direto -> BLOQUEADO (sem privilégio de função)',
  pg_temp.fx('member'),
  format('select public.resolve_split(%L::uuid, 1000)::text', pg_temp.fx('commA')));

-- ---------- RESULTADO --------------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
