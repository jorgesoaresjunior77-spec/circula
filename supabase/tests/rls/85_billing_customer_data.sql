-- =====================================================================
-- 85 — IDENTIDADE FINANCEIRA: billing_customer_data + asaas_customers
-- =====================================================================
-- Fase P1-F2. Cobre as duas tabelas de identidade/cobrança do profile
-- que nunca tiveram cenário de RLS: `public.billing_customer_data`
-- (CPF/CNPJ, `20260825221926`) e `public.asaas_customers` (vínculo com
-- o customer da Asaas, `20260829120000`).
--
-- Agrupadas no MESMO arquivo (decisão técnica, ver relatório da fase):
-- schema quase idêntico (profile_id UNIQUE + FK profiles, SEM
-- community_id, SELECT com is_master(), sem policy de DELETE), e são a
-- dupla que a Edge Function `connect-asaas-account` cruza entre si
-- (CPF/CNPJ de `billing_customer_data` × titular da conta Asaas) — faz
-- sentido auditar as duas juntas. `product_entitlements` é
-- estruturalmente mais complexa (community_id, revogação) e fica em
-- `86_product_entitlements.sql`.
--
-- Policies auditadas ao vivo (pg_policies + information_schema, não só
-- o arquivo de migration):
--   billing_customer_data_select  = profile_id = auth.uid() OR is_master()
--   billing_customer_data_insert  = with check profile_id = auth.uid()
--   billing_customer_data_update  = profile_id = auth.uid() (using e with check)
--   (sem policy de DELETE)
--   asaas_customers_select        = profile_id = auth.uid() OR is_master()
--   (sem policy de INSERT/UPDATE/DELETE)
--
-- GRANTs (information_schema.role_table_grants, authenticated):
--   billing_customer_data: SELECT, INSERT, UPDATE (sem DELETE — nem para
--     service_role; a única forma de sumir é CASCADE de profiles)
--   asaas_customers: SOMENTE SELECT (INSERT/UPDATE são só service_role —
--     dono do vínculo é sempre o backend/webhook, nunca o cliente)
--
-- Nenhuma das duas tabelas tem `community_id` — não existe dimensão de
-- "outra comunidade" no schema; isolamento aqui É isolamento por
-- profile_id, e é exatamente isso que os testes abaixo provam.
--
-- Relação entre as duas tabelas (item 8 do pedido): NÃO há FK nem view
-- unindo `billing_customer_data` e `asaas_customers` — o único ponto em
-- comum é `profile_id`, e cada tabela tem sua própria RLS independente
-- sobre essa coluna. Não existe caminho indireto (join/RPC/view) que
-- vaze uma através da outra; por isso o isolamento é testado em cada
-- tabela separadamente, não haveria o que testar "de caminho cruzado"
-- além disso.
--
-- Dados reais: `member` e `prof` JÁ têm linha real em
-- `billing_customer_data`; `member` já tem linha real em
-- `asaas_customers`. Os testes de SELECT/UPDATE reaproveitam essas
-- linhas reais (leitura, e escrita sempre desfeita em ROLLBACK — mesma
-- técnica de toda a suíte). Os testes de INSERT usam `master`, que não
-- tem linha em nenhuma das duas tabelas (evita conflito de UNIQUE
-- profile_id, que seria um falso-negativo de teste, não um resultado de
-- RLS).
-- =====================================================================

-- ================= billing_customer_data — SELECT =======================

select pg_temp.expect_count('member: vê a própria linha em billing_customer_data',
  pg_temp.fx('member'),
  format('select count(*) from public.billing_customer_data where profile_id = %L', pg_temp.fx('member')), 1);

select pg_temp.expect_count('prof: NÃO vê a linha do member em billing_customer_data',
  pg_temp.fx('prof'),
  format('select count(*) from public.billing_customer_data where profile_id = %L', pg_temp.fx('member')), 0);

select pg_temp.expect_count('member: NÃO vê a linha do prof em billing_customer_data',
  pg_temp.fx('member'),
  format('select count(*) from public.billing_customer_data where profile_id = %L', pg_temp.fx('prof')), 0);

-- Master: bypass EXPLÍCITO na policy (is_master()) — comportamento real
-- e intencional, confirmado por execução, não uma falha.
select pg_temp.expect_count('master: vê a linha do member em billing_customer_data (bypass by design)',
  pg_temp.fx('master'),
  format('select count(*) from public.billing_customer_data where profile_id = %L', pg_temp.fx('member')), 1);

select pg_temp.expect_locked('anon: NÃO vê billing_customer_data',
  null,
  'select count(*) from public.billing_customer_data');

-- ================= billing_customer_data — INSERT ========================

-- master (sem linha prévia) insere a PRÓPRIA linha -> PERMITIDO
select pg_temp.expect_write('master: INSERT da própria linha em billing_customer_data -> PERMITIDO',
  pg_temp.fx('master'),
  format('insert into public.billing_customer_data (profile_id, document_type, document_number) values (%L, ''CPF'', ''11122233344'')',
         pg_temp.fx('master')), true);

-- member tenta forjar uma linha para o master -> BLOQUEADO
select pg_temp.expect_write('member: INSERT forjando linha do master -> BLOQUEADO',
  pg_temp.fx('member'),
  format('insert into public.billing_customer_data (profile_id, document_type, document_number) values (%L, ''CPF'', ''55566677788'')',
         pg_temp.fx('master')), false);

-- ================= billing_customer_data — UPDATE =========================

-- member atualiza a PRÓPRIA linha real -> PERMITIDO (valor sintético,
-- desfeito no ROLLBACK final da suíte; nunca persiste)
select pg_temp.expect_write('member: UPDATE do próprio document_number -> PERMITIDO',
  pg_temp.fx('member'),
  format('update public.billing_customer_data set document_number = ''00011122233'' where profile_id = %L',
         pg_temp.fx('member')), true);

-- prof tenta atualizar a linha do member (terceiro) -> BLOQUEADO
select pg_temp.expect_write('prof: UPDATE da linha do member -> BLOQUEADO',
  pg_temp.fx('prof'),
  format('update public.billing_customer_data set document_number = ''99988877766'' where profile_id = %L',
         pg_temp.fx('member')), false);

-- member tenta reatribuir a PRÓPRIA linha para o prof (item 6: mudar o
-- vínculo para acessar/transferir dados de outra pessoa) -> BLOQUEADO
select pg_temp.expect_write('member: reatribui profile_id da própria linha para o prof -> BLOQUEADO',
  pg_temp.fx('member'),
  format('update public.billing_customer_data set profile_id = %L where profile_id = %L',
         pg_temp.fx('prof'), pg_temp.fx('member')), false);

-- ================= billing_customer_data — DELETE ==========================
-- Sem policy e sem GRANT de DELETE para ninguém além de CASCADE via profiles.

select pg_temp.expect_write('member: DELETE da própria linha -> BLOQUEADO',
  pg_temp.fx('member'),
  format('delete from public.billing_customer_data where profile_id = %L', pg_temp.fx('member')), false);

select pg_temp.expect_write('prof: DELETE da linha do member -> BLOQUEADO',
  pg_temp.fx('prof'),
  format('delete from public.billing_customer_data where profile_id = %L', pg_temp.fx('member')), false);

-- ================= asaas_customers — SELECT ================================

select pg_temp.expect_count('member: vê a própria linha em asaas_customers',
  pg_temp.fx('member'),
  format('select count(*) from public.asaas_customers where profile_id = %L', pg_temp.fx('member')), 1);

select pg_temp.expect_count('prof: NÃO vê a linha do member em asaas_customers',
  pg_temp.fx('prof'),
  format('select count(*) from public.asaas_customers where profile_id = %L', pg_temp.fx('member')), 0);

select pg_temp.expect_count('master: vê a linha do member em asaas_customers (bypass by design)',
  pg_temp.fx('master'),
  format('select count(*) from public.asaas_customers where profile_id = %L', pg_temp.fx('member')), 1);

select pg_temp.expect_locked('anon: NÃO vê asaas_customers',
  null,
  'select count(*) from public.asaas_customers');

-- ================= asaas_customers — escrita ================================
-- Sem NENHUMA policy de INSERT/UPDATE/DELETE, e o GRANT a `authenticated`
-- é só SELECT — diferente de `billing_customer_data`, aqui nem a própria
-- dona escreve. Só `service_role` (webhook) grava.

select pg_temp.expect_write('master: INSERT da própria linha em asaas_customers -> BLOQUEADO (sem GRANT)',
  pg_temp.fx('master'),
  format('insert into public.asaas_customers (profile_id, asaas_customer_id) values (%L, ''cus_sintetico_master'')',
         pg_temp.fx('master')), false);

select pg_temp.expect_write('member: UPDATE da própria linha em asaas_customers -> BLOQUEADO (sem GRANT)',
  pg_temp.fx('member'),
  format('update public.asaas_customers set asaas_customer_id = ''cus_forjado'' where profile_id = %L',
         pg_temp.fx('member')), false);

select pg_temp.expect_write('prof: UPDATE da linha do member em asaas_customers -> BLOQUEADO',
  pg_temp.fx('prof'),
  format('update public.asaas_customers set asaas_customer_id = ''cus_forjado'' where profile_id = %L',
         pg_temp.fx('member')), false);

select pg_temp.expect_write('member: DELETE da própria linha em asaas_customers -> BLOQUEADO (sem GRANT)',
  pg_temp.fx('member'),
  format('delete from public.asaas_customers where profile_id = %L', pg_temp.fx('member')), false);

-- ---------- RESULTADO --------------------------------------------------
select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
rollback;
