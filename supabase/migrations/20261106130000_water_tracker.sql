-- =====================================================================
-- Calculadora de água — peso informado e registros do dia
-- =====================================================================
-- Duas tabelas novas, PRIVADAS (só o dono lê e altera; nem a profissional
-- nem a master veem). Peso é dado de saúde: fica à parte do perfil, com
-- tabela e RLS próprias, e a pessoa pode apagar o próprio peso.
--
--   water_profiles  — 1 linha por pessoa: o peso (kg) usado na estimativa.
--   water_logs      — 1 linha por gole registrado ("bebi 300 ml").
--
-- O DIA do registro é decidido pelo SERVIDOR (fuso America/Sao_Paulo, o
-- mesmo do Meu Jardim): o cliente não escolhe a data. Corrigir ou apagar
-- um registro só vale para o dia de hoje; os dias anteriores ficam como
-- histórico fechado.
--
-- Idempotente e reversível (rodapé). Não altera tabela existente.
-- =====================================================================

begin;

create table if not exists public.water_profiles (
  profile_id uuid primary key default auth.uid() references public.profiles(id) on delete cascade,
  weight_kg numeric(5,1) not null check (weight_kg between 20 and 300),
  updated_at timestamptz not null default now()
);

create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  day date not null,
  amount_ml int not null check (amount_ml between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists water_logs_profile_day_idx on public.water_logs (profile_id, day);

-- updated_at do peso: sempre do servidor.
create or replace function public.water_profiles_touch()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.water_profiles_touch() from public, anon, authenticated;

drop trigger if exists water_profiles_touch on public.water_profiles;
create trigger water_profiles_touch before insert or update on public.water_profiles
  for each row execute function public.water_profiles_touch();

-- O dia do registro é sempre HOJE em São Paulo (o cliente não decide).
create or replace function public.water_logs_set_day()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.day := (now() at time zone 'America/Sao_Paulo')::date;
  else
    new.day := old.day;
    new.profile_id := old.profile_id;
  end if;
  return new;
end $$;
revoke all on function public.water_logs_set_day() from public, anon, authenticated;

drop trigger if exists water_logs_set_day on public.water_logs;
create trigger water_logs_set_day before insert or update on public.water_logs
  for each row execute function public.water_logs_set_day();

alter table public.water_profiles enable row level security;
alter table public.water_logs enable row level security;

drop policy if exists "water_profiles_select" on public.water_profiles;
create policy "water_profiles_select" on public.water_profiles
  for select to authenticated using (profile_id = auth.uid());
drop policy if exists "water_profiles_insert" on public.water_profiles;
create policy "water_profiles_insert" on public.water_profiles
  for insert to authenticated with check (profile_id = auth.uid());
drop policy if exists "water_profiles_update" on public.water_profiles;
create policy "water_profiles_update" on public.water_profiles
  for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
drop policy if exists "water_profiles_delete" on public.water_profiles;
create policy "water_profiles_delete" on public.water_profiles
  for delete to authenticated using (profile_id = auth.uid());

drop policy if exists "water_logs_select" on public.water_logs;
create policy "water_logs_select" on public.water_logs
  for select to authenticated using (profile_id = auth.uid());
drop policy if exists "water_logs_insert" on public.water_logs;
create policy "water_logs_insert" on public.water_logs
  for insert to authenticated with check (profile_id = auth.uid());
-- Corrigir/apagar: só os registros de hoje (o histórico fecha à meia-noite).
drop policy if exists "water_logs_update" on public.water_logs;
create policy "water_logs_update" on public.water_logs
  for update to authenticated
  using (profile_id = auth.uid() and day = (now() at time zone 'America/Sao_Paulo')::date)
  with check (profile_id = auth.uid());
drop policy if exists "water_logs_delete" on public.water_logs;
create policy "water_logs_delete" on public.water_logs
  for delete to authenticated
  using (profile_id = auth.uid() and day = (now() at time zone 'America/Sao_Paulo')::date);

revoke all on table public.water_profiles from public, anon;
revoke all on table public.water_logs from public, anon;
grant select, insert, update, delete on table public.water_profiles to authenticated;
grant select, insert, update, delete on table public.water_logs to authenticated;

commit;

-- ---- Rollback (manual) ------------------------------------------
-- drop table if exists public.water_logs cascade;
-- drop table if exists public.water_profiles cascade;
-- drop function if exists public.water_logs_set_day();
-- drop function if exists public.water_profiles_touch();
