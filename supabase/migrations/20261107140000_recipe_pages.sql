-- =====================================================================
-- Receitas em formato de revista — páginas (imagens) de cada receita
-- =====================================================================
-- NÃO APLICADA — aguardando OK explícito do usuário.
--
-- A profissional sobe as páginas prontas (capa, ingredientes, modo de
-- fazer, informação nutricional, prato pronto...) e o app as mostra no
-- mesmo leitor da revista. Só imagens: nada é gerado pelo app.
-- As imagens vão para o bucket privado `community-media` (só o PATH é
-- guardado aqui).
--
-- Quem lê: membro ativo vê as páginas de receita PUBLICADA; a dona (e a
-- master) vê também as de rascunho. Quem escreve: só a dona.
-- Idempotente, transacional e reversível (rodapé).
-- =====================================================================

begin;

create table if not exists public.recipe_pages (
  id            uuid primary key default gen_random_uuid(),
  content_id    uuid not null references public.community_content (id) on delete cascade,
  community_id  uuid not null references public.communities (id) on delete cascade,
  position      integer not null default 0,
  image_path    text not null check (length(btrim(image_path)) > 0),
  created_at    timestamptz not null default now()
);

create index if not exists recipe_pages_content_position_idx
  on public.recipe_pages (content_id, position);

alter table public.recipe_pages enable row level security;

drop policy if exists "recipe_pages_select" on public.recipe_pages;
create policy "recipe_pages_select"
  on public.recipe_pages for select to authenticated
  using (
    public.is_master()
    or public.owns_community(community_id)
    or (
      public.is_community_member(community_id)
      and exists (
        select 1 from public.community_content c
        where c.id = recipe_pages.content_id and c.status = 'published'
      )
    )
  );

drop policy if exists "recipe_pages_write" on public.recipe_pages;
create policy "recipe_pages_write"
  on public.recipe_pages for all to authenticated
  using (public.owns_community(community_id))
  with check (
    public.owns_community(community_id)
    and exists (
      select 1 from public.community_content c
      where c.id = recipe_pages.content_id and c.community_id = recipe_pages.community_id
    )
  );

revoke all on table public.recipe_pages from public, anon;
grant select, insert, update, delete on table public.recipe_pages to authenticated;

commit;

-- ---- Rollback (manual) ------------------------------------------
-- drop table if exists public.recipe_pages cascade;
