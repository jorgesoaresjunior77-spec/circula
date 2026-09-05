-- =====================================================================
-- SUÍTE DE TESTES DE RLS DO CÍRCULA — FRAMEWORK (Fase 12.1)
-- =====================================================================
-- NÃO é uma migration. NÃO altera schema nem dados.
--
-- Como funciona:
--   • Cada arquivo de cenário (10_*, 20_*, …) é CONCATENADO após este
--     framework por `run.sh` e executado como UMA transação que termina
--     em ROLLBACK — nada é persistido.
--   • As personas são simuladas com `SET LOCAL request.jwt.claims` +
--     `SET LOCAL ROLE authenticated` (o mesmo caminho que o PostgREST
--     usa para uma chamada REST autenticada). Testar aqui == testar a
--     API direta.
--   • Escritas que DEVEM ter sucesso são desfeitas dentro do próprio
--     helper (via `raise exception 'RLSSUITE_OK'` que rola o savepoint
--     implícito do bloco). Logo, mesmo os testes "ALLOWED" não deixam
--     resíduo.
--   • Fixtures sintéticas (comunidade B/C, posts B/C) são criadas como
--     `postgres` (dono da tabela → ignora RLS) e sumem no ROLLBACK.
--
-- Requisitos: os UUIDs em `_fx` precisam existir no banco alvo. O
-- cenário `00_fixtures_check.sql` valida isso antes de tudo.
-- =====================================================================

begin;

set local statement_timeout = '90s';
set local lock_timeout = '5s';

-- ---- resultados ------------------------------------------------------
create temp table _r (
  name   text primary key,
  kind   text,                -- count | bool | write | rpc
  expect text,
  got    text,
  ok     boolean,
  gap    boolean default false -- true = falha ESPERADA hoje (será fechada por subfase futura)
) on commit drop;

-- ---- fixtures (ids reais + sintéticos) -----------------------------
create temp table _fx (k text primary key, v text) on commit drop;
insert into _fx (k, v) values
  ('master',        '18004064-4776-4c12-8f9f-b1bae6c390f5'),
  ('prof',          '1c20d81a-1312-4bdd-9e40-390a81536fd1'),
  ('member',        '94bc64f8-3ecc-42da-84c2-abfcbc3f80ef'),
  ('commA',         '077aeceb-7321-48ca-8c23-cb256823755a'),
  ('postA',         '5d5b9f92-cc21-43df-856d-7f0e7b27c33d'),  -- visível, autor = prof
  ('challA',        '019cd6ca-1777-48dd-bcc4-d7a8e91dd652'),
  ('joyA',          'f9b6b83d-4963-47c6-9f4c-b78918bbee40'),
  ('contentA',      '17720895-1032-4fb8-8e8e-968ae6bce31e'),  -- community_content publicado
  ('member_sub_A',  'cf65a3fa-ae1e-4397-a0b0-574c03120562'),  -- assinatura trial do member em A
  ('member_plan',   '7162d0df-0e88-438c-96d2-f831bf9b6e1c'),  -- billing_plans member_monthly
  ('commB',         'bbbbbbbb-0000-4000-8000-0000000000b1'),  -- sintético (dono = prof)
  ('postB',         'bbbbbbb0-0000-4000-8000-0000000000b2'),  -- sintético em B
  ('commC',         'cccccccc-0000-4000-8000-0000000000c1'),  -- sintético (dono = master)
  ('postC',         'ccccccc0-0000-4000-8000-0000000000c2'),  -- sintético em C
  ('nil',           '00000000-0000-0000-0000-000000000000');  -- UUID inexistente

create function pg_temp.fx(text) returns uuid language sql stable as
  $$ select v::uuid from _fx where k = $1 $$;

-- ---- helpers de persona -------------------------------------------
create function pg_temp.as_persona(p_sub uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_sub, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
  execute 'set local role anon';
end $$;

create function pg_temp.done() returns void language plpgsql as $$
begin execute 'reset role'; end $$;

-- ---- asserções ----------------------------------------------------
-- SELECT count: linhas visíveis para a persona
create function pg_temp.expect_count(p_name text, p_sub uuid, p_sql text, p_expected bigint, p_gap boolean default false)
returns void language plpgsql as $$
declare v bigint;
begin
  if p_sub is null then perform pg_temp.as_anon(); else perform pg_temp.as_persona(p_sub); end if;
  begin execute p_sql into v; exception when others then v := -1; end;
  perform pg_temp.done();
  insert into _r(name,kind,expect,got,ok,gap)
  values (p_name,'count',p_expected::text,v::text, v = p_expected, p_gap)
  on conflict (name) do update set kind='count',expect=excluded.expect,got=excluded.got,ok=excluded.ok,gap=excluded.gap;
end $$;

-- "nenhum dado vaza": passa se a leitura devolve 0 linhas OU é barrada
-- na cara (permission denied / RLS). Usado sobretudo para o `anon`, cujo
-- role muitas vezes sequer tem GRANT SELECT na tabela — 42501 aqui é o
-- resultado seguro, não uma falha.
create function pg_temp.expect_locked(p_name text, p_sub uuid, p_sql text, p_gap boolean default false)
returns void language plpgsql as $$
declare v bigint; locked boolean := false; got text;
begin
  if p_sub is null then perform pg_temp.as_anon(); else perform pg_temp.as_persona(p_sub); end if;
  begin
    execute p_sql into v;
    locked := (v = 0);
    got := v::text || ' linha(s)';
  exception when others then
    locked := true;                      -- permission denied / policy: nada vaza
    got := 'denied(' || sqlstate || ')';
  end;
  perform pg_temp.done();
  insert into _r(name,kind,expect,got,ok,gap)
  values (p_name,'lock','0 ou denied', got, locked, p_gap)
  on conflict (name) do update set kind='lock',expect=excluded.expect,got=excluded.got,ok=excluded.ok,gap=excluded.gap;
end $$;

-- SELECT que retorna boolean (ex.: can_view_post)
create function pg_temp.expect_bool(p_name text, p_sub uuid, p_sql text, p_expected boolean, p_gap boolean default false)
returns void language plpgsql as $$
declare v boolean;
begin
  if p_sub is null then perform pg_temp.as_anon(); else perform pg_temp.as_persona(p_sub); end if;
  begin execute p_sql into v; exception when others then v := null; end;
  perform pg_temp.done();
  insert into _r(name,kind,expect,got,ok,gap)
  values (p_name,'bool',p_expected::text, coalesce(v::text,'ERR'), v is not distinct from p_expected, p_gap)
  on conflict (name) do update set kind='bool',expect=excluded.expect,got=excluded.got,ok=excluded.ok,gap=excluded.gap;
end $$;

-- INSERT/UPDATE/DELETE direto: p_allow = esperamos que passe?
-- Escritas bem-sucedidas são DESFEITAS (raise RLSSUITE_OK rola o
-- savepoint implícito do bloco) — nada persiste.
-- IMPORTANTE: uma UPDATE/DELETE que "roda sem erro" mas NÃO toca nenhuma
-- linha foi, na prática, BARRADA — o `USING` da policy filtrou todas as
-- linhas-alvo. Só contamos como "escreveu de fato" quando ROW_COUNT >= 1.
-- (Num `execute` com várias instruções, ROW_COUNT reflete a última — por
-- isso os casos "delete-then-insert" terminam sempre em INSERT.)
-- Um INSERT ... VALUES bloqueado nunca cai aqui: viola o WITH CHECK e
-- levanta 42501, tratado no ramo de exceção.
create function pg_temp.expect_write(p_name text, p_sub uuid, p_sql text, p_allow boolean, p_gap boolean default false)
returns void language plpgsql as $$
declare ok boolean := false; code text := ''; n bigint := 0;
begin
  if p_sub is null then perform pg_temp.as_anon(); else perform pg_temp.as_persona(p_sub); end if;
  begin
    execute p_sql;
    get diagnostics n = row_count;
    if n > 0 then
      raise exception 'RLSSUITE_OK';       -- escreveu -> desfaz e marca ok
    else
      raise exception 'RLSSUITE_0ROWS';    -- 0 linhas -> USING barrou
    end if;
  exception
    when others then
      if sqlerrm = 'RLSSUITE_OK' then ok := true;
      elsif sqlerrm = 'RLSSUITE_0ROWS' then ok := false; code := 'USING/0rows';
      else ok := false; code := sqlstate; end if;
  end;
  perform pg_temp.done();
  insert into _r(name,kind,expect,got,ok,gap)
  values (p_name,'write',
    case when p_allow then 'ALLOWED' else 'BLOCKED' end,
    case when ok then 'ALLOWED' else 'BLOCKED('||code||')' end,
    ok = p_allow, p_gap)
  on conflict (name) do update set kind='write',expect=excluded.expect,got=excluded.got,ok=excluded.ok,gap=excluded.gap;
end $$;

-- chamada de RPC: p_ok = esperamos que retorne (true) ou levante (false)
create function pg_temp.expect_rpc(p_name text, p_sub uuid, p_call text, p_ok boolean, p_gap boolean default false)
returns void language plpgsql as $$
declare ok boolean := false; code text := '';
begin
  if p_sub is null then perform pg_temp.as_anon(); else perform pg_temp.as_persona(p_sub); end if;
  begin
    execute 'select ' || p_call;
    ok := true;
  exception when others then ok := false; code := sqlstate;
  end;
  perform pg_temp.done();
  insert into _r(name,kind,expect,got,ok,gap)
  values (p_name,'rpc',
    case when p_ok then 'OK' else 'RAISE' end,
    case when ok then 'OK' else 'RAISE('||code||')' end,
    ok = p_ok, p_gap)
  on conflict (name) do update set kind='rpc',expect=excluded.expect,got=excluded.got,ok=excluded.ok,gap=excluded.gap;
end $$;

-- Cada cenário adiciona linhas em _r e termina com:
--   select jsonb_agg(to_jsonb(_r) order by _r.name) as results from _r;
--   rollback;
