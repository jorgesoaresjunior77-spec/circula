-- =====================================================================
-- Wellness — matérias da profissional
-- =====================================================================
--  1. wellness_articles: título, descrição curta, matéria longa e imagens
--     (capa + imagens da matéria). A leitura da membro depende do plano
--     Wellness (trava feita no app, como o Help Nutri); a RLS só garante
--     que a membro vê o que está publicado na própria comunidade.
--  2. community_card_images ganha a chave 'menu_wellness' (foto do card
--     da roda de menu da Home).
--
-- Aditiva, idempotente e transacional. Rollback no rodapé.
-- =====================================================================

begin;

create table if not exists public.wellness_articles (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  title         text not null check (char_length(btrim(title)) between 1 and 160),
  description   text check (description is null or char_length(description) <= 400),
  body          text check (body is null or char_length(body) <= 20000),
  cover_path    text,
  image_paths   text[] not null default '{}' check (coalesce(array_length(image_paths, 1), 0) <= 12),
  status        text not null default 'draft' check (status in ('draft', 'published')),
  created_by    uuid not null default auth.uid() references public.profiles (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists wellness_articles_community_idx
  on public.wellness_articles (community_id, status, created_at desc);

drop trigger if exists wellness_articles_touch on public.wellness_articles;
create trigger wellness_articles_touch before update on public.wellness_articles
  for each row execute function public.wellness_content_touch();

alter table public.wellness_articles enable row level security;

drop policy if exists "wellness_articles_select" on public.wellness_articles;
create policy "wellness_articles_select" on public.wellness_articles for select to authenticated
  using (
    public.is_master()
    or public.owns_community(community_id)
    or (status = 'published' and public.is_community_member(community_id))
  );

drop policy if exists "wellness_articles_write" on public.wellness_articles;
create policy "wellness_articles_write" on public.wellness_articles for all to authenticated
  using (public.owns_community(community_id))
  with check (public.owns_community(community_id));

revoke all on table public.wellness_articles from public, anon;
grant select, insert, update, delete on table public.wellness_articles to authenticated;

-- Foto do card "Wellness" da roda de menu da Home.
alter table public.community_card_images
  drop constraint if exists community_card_images_card_key_check;

alter table public.community_card_images
  add constraint community_card_images_card_key_check check (
    card_key = any (array[
      'hoje'::text, 'desafios'::text, 'eventos'::text,
      'comunidade'::text, 'jornada'::text, 'instagram'::text,
      'eventos_grande'::text, 'jornada_grande'::text, 'comunidade_grande'::text,
      'jardim'::text,
      'novo_circulo'::text, 'revista_escritorio'::text,
      'ferramenta_calendario'::text, 'ferramenta_agua'::text, 'ferramenta_imc'::text,
      'menu_leitura'::text, 'menu_respiracao'::text, 'menu_planos'::text, 'menu_playlist'::text,
      'loja_fundo'::text, 'menu_wellness'::text
    ])
  );

commit;

-- ---- Rollback (manual) ------------------------------------------------
-- begin;
-- delete from public.community_card_images where card_key = 'menu_wellness';
-- (recriar community_card_images_card_key_check sem 'menu_wellness')
-- drop table if exists public.wellness_articles;
-- commit;
