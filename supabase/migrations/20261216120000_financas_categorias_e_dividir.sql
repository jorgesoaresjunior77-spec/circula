-- =====================================================================
-- Finanças: (1) editar/ocultar categorias padrão e reclassificar lançamentos ao excluir;
--           (2) Dividir: grupos de despesas compartilhadas (viagem, churrasco, festa).
-- PRIVADO: só a dona do grupo/categoria enxerga e altera. Aditiva e reversível (rollback no fim).
-- =====================================================================
begin;

-- (1) Ajustes sobre categorias padrão (que moram no app): renomear, trocar ícone ou ocultar.
create table if not exists public.fin_categoria_ajustes (
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  categoria  text not null check (categoria like 'padrao:%'),
  nome       text check (nome is null or char_length(btrim(nome)) between 1 and 20),
  icone      text check (icone is null or char_length(icone) between 1 and 30),
  oculta     boolean not null default false,
  primary key (profile_id, categoria)
);
alter table public.fin_categoria_ajustes enable row level security;
drop policy if exists fin_categoria_ajustes_own on public.fin_categoria_ajustes;
create policy fin_categoria_ajustes_own on public.fin_categoria_ajustes for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
revoke all on table public.fin_categoria_ajustes from public, anon, authenticated;
grant select, insert, update, delete on table public.fin_categoria_ajustes to authenticated;
grant all on table public.fin_categoria_ajustes to service_role;

-- Passa todos os lançamentos de uma categoria para outra do MESMO tipo (nunca apaga histórico).
create or replace function public.fin_reclassificar(p_origem text, p_destino text, p_tipo text)
returns integer language plpgsql security invoker set search_path to 'public' as $$
declare n integer;
begin
  if p_origem = p_destino then return 0; end if;
  update public.fin_lancamentos set categoria = p_destino
   where profile_id = auth.uid() and categoria = p_origem and tipo = p_tipo;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.fin_reclassificar(text, text, text) from public, anon;
grant execute on function public.fin_reclassificar(text, text, text) to authenticated;

-- (2) Dividir
create table if not exists public.div_grupos (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  nome       text not null check (char_length(btrim(nome)) between 1 and 40),
  criado_em  timestamptz not null default now()
);
create table if not exists public.div_participantes (
  id        uuid primary key default gen_random_uuid(),
  grupo_id  uuid not null references public.div_grupos (id) on delete cascade,
  nome      text not null check (char_length(btrim(nome)) between 1 and 30),
  ativo     boolean not null default true,
  criado_em timestamptz not null default now()
);
create table if not exists public.div_despesas (
  id             uuid primary key default gen_random_uuid(),
  grupo_id       uuid not null references public.div_grupos (id) on delete cascade,
  descricao      text not null check (char_length(btrim(descricao)) between 1 and 60),
  valor_centavos bigint not null check (valor_centavos > 0 and valor_centavos < 100000000000),
  pagador_id     uuid not null references public.div_participantes (id),
  -- quem participou desta despesa (a divisão é igual entre eles)
  participantes  uuid[] not null check (cardinality(participantes) >= 1),
  data           date not null default current_date,
  criado_em      timestamptz not null default now()
);
create table if not exists public.div_acertos (
  id             uuid primary key default gen_random_uuid(),
  grupo_id       uuid not null references public.div_grupos (id) on delete cascade,
  de_id          uuid not null references public.div_participantes (id),
  para_id        uuid not null references public.div_participantes (id),
  valor_centavos bigint not null check (valor_centavos > 0),
  feito_em       timestamptz not null default now(),
  check (de_id <> para_id)
);
create index if not exists div_participantes_grupo_idx on public.div_participantes (grupo_id);
create index if not exists div_despesas_grupo_idx on public.div_despesas (grupo_id);
create index if not exists div_acertos_grupo_idx on public.div_acertos (grupo_id);

alter table public.div_grupos enable row level security;
alter table public.div_participantes enable row level security;
alter table public.div_despesas enable row level security;
alter table public.div_acertos enable row level security;

drop policy if exists div_grupos_own on public.div_grupos;
create policy div_grupos_own on public.div_grupos for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
do $$
declare t text;
begin
  foreach t in array array['div_participantes', 'div_despesas', 'div_acertos'] loop
    execute format('drop policy if exists "%s_own" on public.%I', t, t);
    execute format('create policy "%s_own" on public.%I for all to authenticated using (exists (select 1 from public.div_grupos g where g.id = grupo_id and g.profile_id = auth.uid())) with check (exists (select 1 from public.div_grupos g where g.id = grupo_id and g.profile_id = auth.uid()))', t, t);
  end loop;
end $$;
revoke all on table public.div_grupos, public.div_participantes, public.div_despesas, public.div_acertos from public, anon, authenticated;
grant select, insert, update, delete on table public.div_grupos, public.div_participantes, public.div_despesas, public.div_acertos to authenticated;
grant all on table public.div_grupos, public.div_participantes, public.div_despesas, public.div_acertos to service_role;

commit;
-- ROLLBACK (manual): drop table public.div_acertos, public.div_despesas, public.div_participantes, public.div_grupos, public.fin_categoria_ajustes; drop function public.fin_reclassificar(text, text, text);
