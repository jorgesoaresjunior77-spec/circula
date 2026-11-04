-- =====================================================================
-- Revista Círcula Woman Magazine
-- =====================================================================
-- NÃO APLICADA — aguardando OK explícito do usuário.
--
-- 1) community_card_images ganha 2 chaves novas:
--      'novo_circulo'       -> capa do card "Novo Círculo" da faixa Círculos
--      'revista_escritorio' -> fundo do Escritório Editorial da revista
-- 2) magazine_issues: uma edição (capa + data de lançamento). Nova edição
--    a cada 30 dias, no dia 01 do mês.
-- 3) magazine_pages: as páginas (imagens) de cada edição, em ordem.
--
-- Membro só enxerga edições cuja release_date já chegou; a dona e o
-- Master enxergam todas (para preparar a próxima). Imagens vão para o
-- bucket privado `community-media` (só o PATH é guardado aqui).
--
-- 100% aditivo, idempotente, transacional, reversível.
-- =====================================================================

begin;

alter table public.community_card_images
  drop constraint if exists community_card_images_card_key_check;

alter table public.community_card_images
  add constraint community_card_images_card_key_check check (
    card_key = any (array[
      'hoje'::text, 'desafios'::text, 'eventos'::text,
      'comunidade'::text, 'jornada'::text, 'instagram'::text,
      'eventos_grande'::text, 'jornada_grande'::text, 'comunidade_grande'::text,
      'jardim'::text,
      'novo_circulo'::text, 'revista_escritorio'::text
    ])
  );

create table if not exists public.magazine_issues (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  title         text not null check (length(btrim(title)) > 0),
  cover_path    text,
  release_date  date not null,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists magazine_issues_community_release_idx
  on public.magazine_issues (community_id, release_date desc);

create table if not exists public.magazine_pages (
  id            uuid primary key default gen_random_uuid(),
  issue_id      uuid not null references public.magazine_issues (id) on delete cascade,
  community_id  uuid not null references public.communities (id) on delete cascade,
  position      integer not null default 0,
  image_path    text not null check (length(btrim(image_path)) > 0),
  created_at    timestamptz not null default now()
);

create index if not exists magazine_pages_issue_position_idx
  on public.magazine_pages (issue_id, position);

create or replace trigger set_magazine_issues_updated_at
  before update on public.magazine_issues
  for each row execute function public.set_updated_at();

alter table public.magazine_issues enable row level security;
alter table public.magazine_pages  enable row level security;

drop policy if exists "magazine_issues_select" on public.magazine_issues;
create policy "magazine_issues_select"
  on public.magazine_issues for select to public
  using (
    public.is_master()
    or public.owns_community(community_id)
    or (public.is_community_member(community_id) and release_date <= current_date)
  );

drop policy if exists "magazine_issues_write" on public.magazine_issues;
create policy "magazine_issues_write"
  on public.magazine_issues for all to public
  using (public.owns_community(community_id))
  with check (public.owns_community(community_id));

drop policy if exists "magazine_pages_select" on public.magazine_pages;
create policy "magazine_pages_select"
  on public.magazine_pages for select to public
  using (
    public.is_master()
    or public.owns_community(community_id)
    or (
      public.is_community_member(community_id)
      and exists (
        select 1 from public.magazine_issues i
        where i.id = magazine_pages.issue_id and i.release_date <= current_date
      )
    )
  );

drop policy if exists "magazine_pages_write" on public.magazine_pages;
create policy "magazine_pages_write"
  on public.magazine_pages for all to public
  using (public.owns_community(community_id))
  with check (public.owns_community(community_id));

grant select, insert, update, delete on table public.magazine_issues to authenticated;
grant select, insert, update, delete on table public.magazine_pages  to authenticated;

commit;

-- ---- Rollback (manual) ------------------------------------------
-- begin;
-- drop table if exists public.magazine_pages;
-- drop table if exists public.magazine_issues;
-- delete from public.community_card_images where card_key in ('novo_circulo','revista_escritorio');
-- alter table public.community_card_images drop constraint if exists community_card_images_card_key_check;
-- alter table public.community_card_images add constraint community_card_images_card_key_check check (
--   card_key = any (array['hoje'::text,'desafios'::text,'eventos'::text,'comunidade'::text,'jornada'::text,'instagram'::text,
--     'eventos_grande'::text,'jornada_grande'::text,'comunidade_grande'::text,'jardim'::text]));
-- commit;
