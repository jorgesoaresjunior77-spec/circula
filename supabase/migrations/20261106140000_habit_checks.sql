-- =====================================================================
-- ANTES DE TUDO — check diário de hábitos
-- =====================================================================
-- Uma tabela nova, PRIVADA: cada pessoa só enxerga e altera os próprios
-- checks (nem a profissional dona da comunidade nem a master).
--
-- 1 linha = 1 hábito marcado em 1 dia. O DIA é decidido pelo SERVIDOR
-- (hoje, fuso America/Sao_Paulo, o mesmo do Meu Jardim): o cliente não
-- escolhe a data. Marcar e desmarcar só vale para HOJE; os dias
-- anteriores ficam como histórico fechado e nunca são apagados por
-- quem usa o app. Dia sem check não gera registro nem penalidade.
--
-- Os 7 hábitos são fixos (check de valores abaixo). Acrescentar um novo
-- exige uma migration que atualize o check.
--
-- Idempotente e reversível (rodapé). Não altera tabela existente.
-- =====================================================================

begin;

create table if not exists public.habit_checks (
  profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  day date not null,
  habit text not null check (habit in (
    'luz', 'agua', 'exercicio', 'leitura', 'respiracao', 'organizacao', 'espiritualidade'
  )),
  checked_at timestamptz not null default now(),
  primary key (profile_id, day, habit)
);

-- O dia do check é sempre HOJE em São Paulo (o cliente não decide).
create or replace function public.habit_checks_set_day()
returns trigger language plpgsql set search_path = public as $$
begin
  new.day := (now() at time zone 'America/Sao_Paulo')::date;
  new.checked_at := now();
  return new;
end $$;
revoke all on function public.habit_checks_set_day() from public, anon, authenticated;

drop trigger if exists habit_checks_set_day on public.habit_checks;
create trigger habit_checks_set_day before insert on public.habit_checks
  for each row execute function public.habit_checks_set_day();

alter table public.habit_checks enable row level security;

drop policy if exists "habit_checks_select" on public.habit_checks;
create policy "habit_checks_select" on public.habit_checks
  for select to authenticated using (profile_id = auth.uid());

drop policy if exists "habit_checks_insert" on public.habit_checks;
create policy "habit_checks_insert" on public.habit_checks
  for insert to authenticated with check (profile_id = auth.uid());

-- Desmarcar: só o check de HOJE (o histórico fecha à meia-noite).
drop policy if exists "habit_checks_delete" on public.habit_checks;
create policy "habit_checks_delete" on public.habit_checks
  for delete to authenticated
  using (profile_id = auth.uid() and day = (now() at time zone 'America/Sao_Paulo')::date);

-- Sem UPDATE: um check existe ou não existe.
revoke all on table public.habit_checks from public, anon;
grant select, insert, delete on table public.habit_checks to authenticated;

commit;

-- ---- Rollback (manual) ------------------------------------------
-- drop table if exists public.habit_checks cascade;
-- drop function if exists public.habit_checks_set_day();
