-- Meu Jardim: desafio do mes (28 a 31 dias), um texto por dia, check diario.
-- A participante so marca o check no proprio dia (fuso de Sao Paulo,
-- 00:00:00 a 23:59:59), validado no servidor. Sem pontos.
-- Rollback manual: drop table garden_checks, garden_month_days, garden_months cascade;

create table if not exists public.garden_months (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  year int not null check (year between 2024 and 2100),
  month int not null check (month between 1 and 12),
  title text,
  days int not null check (days between 28 and 31),
  created_at timestamptz not null default now(),
  unique (community_id, year, month)
);

create table if not exists public.garden_month_days (
  month_id uuid not null references public.garden_months(id) on delete cascade,
  day int not null check (day between 1 and 31),
  body text not null default '',
  primary key (month_id, day)
);

create table if not exists public.garden_checks (
  month_id uuid not null references public.garden_months(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  day int not null check (day between 1 and 31),
  checked_at timestamptz not null default now(),
  primary key (month_id, profile_id, day)
);
create index if not exists garden_checks_profile_idx on public.garden_checks(profile_id, community_id);

-- O check so vale no proprio dia do mes (horario de Sao Paulo).
create or replace function public.garden_check_only_today()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m public.garden_months%rowtype;
  today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select * into m from public.garden_months where id = new.month_id;
  if not found then raise exception 'mes inexistente'; end if;
  if new.day > m.days then raise exception 'dia fora do desafio'; end if;
  if make_date(m.year, m.month, new.day) <> today then
    raise exception 'o check so pode ser feito no proprio dia';
  end if;
  new.community_id := m.community_id;
  new.checked_at := now();
  return new;
end $$;
revoke all on function public.garden_check_only_today() from public, anon, authenticated;

drop trigger if exists garden_checks_only_today on public.garden_checks;
create trigger garden_checks_only_today before insert on public.garden_checks
  for each row execute function public.garden_check_only_today();

alter table public.garden_months enable row level security;
alter table public.garden_month_days enable row level security;
alter table public.garden_checks enable row level security;

drop policy if exists "garden_months_select" on public.garden_months;
create policy "garden_months_select" on public.garden_months for select to public
  using (public.is_master() or public.owns_community(community_id) or public.is_community_member(community_id));
drop policy if exists "garden_months_write" on public.garden_months;
create policy "garden_months_write" on public.garden_months for all to public
  using (public.owns_community(community_id)) with check (public.owns_community(community_id));

drop policy if exists "garden_month_days_select" on public.garden_month_days;
create policy "garden_month_days_select" on public.garden_month_days for select to public
  using (exists (select 1 from public.garden_months m where m.id = month_id
    and (public.is_master() or public.owns_community(m.community_id) or public.is_community_member(m.community_id))));
drop policy if exists "garden_month_days_write" on public.garden_month_days;
create policy "garden_month_days_write" on public.garden_month_days for all to public
  using (exists (select 1 from public.garden_months m where m.id = month_id and public.owns_community(m.community_id)))
  with check (exists (select 1 from public.garden_months m where m.id = month_id and public.owns_community(m.community_id)));

drop policy if exists "garden_checks_select" on public.garden_checks;
create policy "garden_checks_select" on public.garden_checks for select to public
  using (public.is_master() or profile_id = auth.uid() or public.owns_community(community_id));
drop policy if exists "garden_checks_insert" on public.garden_checks;
create policy "garden_checks_insert" on public.garden_checks for insert to public
  with check (profile_id = auth.uid());

grant select, insert, update, delete on table public.garden_months to authenticated;
grant select, insert, update, delete on table public.garden_month_days to authenticated;
grant select, insert on table public.garden_checks to authenticated;
