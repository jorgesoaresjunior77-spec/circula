-- =====================================================================
-- Diário da Gratidão.
--  • gratitude_prayers: as orações do dia, CADASTRADAS pela nutricionista (o app
--    não escreve orações). Uma é escolhida por dia, em rodízio, entre as
--    publicadas. As participantes da comunidade leem o que está publicado.
--  • gratitude_entries: "Gratidão de hoje" (até 5 itens por dia), privado.
--  • gratitude_requests: "Meus pedidos" (em oração / atendido), privado.
--  • gratitude_amen: dias em que a pessoa disse "Amém" na Oração do Dia, privado.
-- Aditiva, transacional e reversível (rollback no fim).
-- =====================================================================
begin;

create table if not exists public.gratitude_prayers (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  title text check (title is null or char_length(title) <= 120),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  status text not null default 'draft' check (status in ('draft','published')),
  position integer not null default 0,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);
create index if not exists gratitude_prayers_idx on public.gratitude_prayers (community_id, status, position);
alter table public.gratitude_prayers enable row level security;
drop policy if exists "gratitude_prayers_select" on public.gratitude_prayers;
create policy "gratitude_prayers_select" on public.gratitude_prayers for select to authenticated using (
  public.is_master() or public.owns_community(community_id)
  or (status = 'published' and public.is_community_member(community_id))
);
drop policy if exists "gratitude_prayers_write" on public.gratitude_prayers;
create policy "gratitude_prayers_write" on public.gratitude_prayers for all to authenticated
  using (public.owns_community(community_id)) with check (public.owns_community(community_id));
revoke all on table public.gratitude_prayers from public, anon;
grant select, insert, update, delete on table public.gratitude_prayers to authenticated;

create table if not exists public.gratitude_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day date not null default current_date,
  items text[] not null default '{}' check (coalesce(array_length(items, 1), 0) between 1 and 5),
  created_at timestamptz not null default now(),
  unique (profile_id, day)
);
create table if not exists public.gratitude_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  status text not null default 'aberto' check (status in ('aberto','atendido')),
  answered_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists gratitude_requests_idx on public.gratitude_requests (profile_id, created_at desc);
create table if not exists public.gratitude_amen (
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day date not null default current_date,
  primary key (profile_id, day)
);

do $$
declare t text;
begin
  foreach t in array array['gratitude_entries','gratitude_requests','gratitude_amen'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_own" on public.%I', t, t);
    execute format('create policy "%s_own" on public.%I for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid())', t, t);
    execute format('revoke all on table public.%I from public, anon', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
  end loop;
end $$;

commit;

-- ROLLBACK (manual):
--   drop table gratitude_amen, gratitude_requests, gratitude_entries, gratitude_prayers;
