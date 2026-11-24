-- =====================================================================
-- Finanças: registro pessoal de receitas, gastos e investimentos.
-- PRIVADO: cada pessoa só enxerga e altera os próprios lançamentos. Nem a profissional, nem a
-- administração têm acesso por tela ou consulta comum (sem exceção para master nas políticas).
-- Valores em centavos inteiros. É apenas registro: sem cotação nem rendimento.
-- Aditiva e reversível (rollback no fim).
-- =====================================================================
begin;

create table if not exists public.fin_categorias (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  tipo        text not null check (tipo in ('receita', 'gasto', 'investimento')),
  nome        text not null check (char_length(btrim(nome)) between 1 and 20),
  icone       text not null default 'estrela' check (char_length(icone) between 1 and 30),
  criado_em   timestamptz not null default now()
);
-- nome único por pessoa e tipo (sem diferenciar maiúsculas)
create unique index if not exists fin_categorias_nome_uq on public.fin_categorias (profile_id, tipo, lower(btrim(nome)));

create table if not exists public.fin_lancamentos (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  tipo           text not null check (tipo in ('receita', 'gasto', 'investimento')),
  -- categoria padrão ("padrao:mercado") ou o id de uma categoria própria
  categoria      text not null check (char_length(categoria) between 1 and 60),
  valor_centavos bigint not null check (valor_centavos > 0 and valor_centavos < 100000000000),
  data           date not null,
  observacao     text check (observacao is null or char_length(observacao) <= 200),
  movimento      text check (movimento is null or movimento in ('aplicar', 'resgatar')),
  parcela_grupo  uuid,
  parcela_n      int check (parcela_n is null or parcela_n >= 1),
  parcela_total  int check (parcela_total is null or parcela_total between 2 and 48),
  criado_em      timestamptz not null default now(),
  check ((tipo = 'investimento') = (movimento is not null)),
  check (parcela_grupo is null or tipo = 'gasto')
);
create index if not exists fin_lancamentos_mes_idx on public.fin_lancamentos (profile_id, data);
create index if not exists fin_lancamentos_grupo_idx on public.fin_lancamentos (parcela_grupo) where parcela_grupo is not null;

alter table public.fin_categorias enable row level security;
alter table public.fin_lancamentos enable row level security;

do $$
declare t text;
begin
  foreach t in array array['fin_categorias', 'fin_lancamentos'] loop
    execute format('drop policy if exists "%s_own" on public.%I', t, t);
    execute format('create policy "%s_own" on public.%I for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid())', t, t);
  end loop;
end $$;
revoke all on table public.fin_categorias, public.fin_lancamentos from public, anon, authenticated;
grant select, insert, update, delete on table public.fin_categorias, public.fin_lancamentos to authenticated;
grant all on table public.fin_categorias, public.fin_lancamentos to service_role;

-- categoria própria só pode ser excluída se não tiver lançamentos
create or replace function public.fin_categoria_antes_de_excluir()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if exists (select 1 from public.fin_lancamentos where profile_id = old.profile_id and categoria = old.id::text) then
    raise exception 'categoria_com_lancamentos' using errcode = 'check_violation';
  end if;
  return old;
end $$;
drop trigger if exists fin_categoria_excluir on public.fin_categorias;
create trigger fin_categoria_excluir before delete on public.fin_categorias for each row execute function public.fin_categoria_antes_de_excluir();

-- a categoria de um lançamento precisa existir: padrão (do app) ou própria da mesma pessoa e tipo
create or replace function public.fin_lancamento_valida()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if new.categoria like 'padrao:%' then
    return new;
  end if;
  if not exists (select 1 from public.fin_categorias c where c.id::text = new.categoria and c.profile_id = new.profile_id and c.tipo = new.tipo) then
    raise exception 'categoria_invalida' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists fin_lancamento_valida on public.fin_lancamentos;
create trigger fin_lancamento_valida before insert or update on public.fin_lancamentos for each row execute function public.fin_lancamento_valida();

commit;
-- ROLLBACK (manual): drop table public.fin_lancamentos, public.fin_categorias; drop function public.fin_lancamento_valida(), public.fin_categoria_antes_de_excluir();
