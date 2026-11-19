-- =====================================================================
-- Dicas de Séries / Filmes (assinatura avulsa 'series_filmes', criada na
-- migração de Exercícios). O Círcula vende o acesso à CURADORIA; o link leva
-- a pessoa à plataforma onde ela assiste (a assinatura do streaming é dela).
--  • series_picks: cada dica (série ou filme) com capa, descrição, gêneros,
--    plataforma, classificação indicativa e link. A leitura da participante
--    exige o pacote no banco (RLS + has_package); a dona escreve e publica.
--  • series_preview(): apresentação antes da compra (sem as dicas completas).
-- Aditiva, transacional e reversível (rollback no fim).
-- =====================================================================
begin;

create table if not exists public.series_picks (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  kind text not null check (kind in ('serie','filme')),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text check (description is null or char_length(description) <= 1200),
  genres text[] not null default '{}' check (coalesce(array_length(genres, 1), 0) <= 6),
  platform text check (platform is null or char_length(platform) <= 60),
  platform_url text check (platform_url is null or (platform_url ~* '^https://' and char_length(platform_url) <= 500)),
  age_rating text check (age_rating is null or age_rating in ('L','10','12','14','16','18')),
  cover_path text,
  status text not null default 'draft' check (status in ('draft','published')),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists series_picks_community_idx on public.series_picks (community_id, status, kind);

create or replace function public.series_touch()
returns trigger language plpgsql set search_path to 'public' as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists series_picks_touch on public.series_picks;
create trigger series_picks_touch before update on public.series_picks for each row execute function public.series_touch();

alter table public.series_picks enable row level security;
drop policy if exists "series_picks_select" on public.series_picks;
create policy "series_picks_select" on public.series_picks for select to authenticated using (
  public.is_master()
  or public.owns_community(community_id)
  or (status = 'published' and public.is_community_member(community_id)
      and public.has_package(community_id, array['series_filmes','premium']))
);
drop policy if exists "series_picks_write" on public.series_picks;
create policy "series_picks_write" on public.series_picks for all to authenticated
  using (public.owns_community(community_id)) with check (public.owns_community(community_id));
revoke all on table public.series_picks from public, anon;
grant select, insert, update, delete on table public.series_picks to authenticated;

create or replace function public.series_preview(p_community uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not (public.is_community_member(p_community) or public.owns_community(p_community) or public.is_master()) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'series_count', (select count(*) from public.series_picks where community_id = p_community and status = 'published' and kind = 'serie'),
    'movie_count', (select count(*) from public.series_picks where community_id = p_community and status = 'published' and kind = 'filme'),
    'genres', (select coalesce(jsonb_agg(distinct g), '[]'::jsonb) from public.series_picks s, unnest(s.genres) g where s.community_id = p_community and s.status = 'published'),
    'samples', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (select title t from public.series_picks where community_id = p_community and status = 'published' order by created_at desc limit 4) x)
  );
end $$;
revoke all on function public.series_preview(uuid) from public, anon;
grant execute on function public.series_preview(uuid) to authenticated;

commit;

-- ROLLBACK (manual):
--   drop function series_preview(uuid), series_touch(); drop table series_picks;
