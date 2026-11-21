-- Receitas: as páginas (imagens) da receita só chegam a quem tem o plano
-- Receitas ou o Premium (ou à dona da comunidade e ao master). Antes bastava
-- ser membro e a receita estar publicada. A tela já mostra o convite de
-- assinatura; esta regra impede ler as imagens por fora do app.
-- Reversível: restaurar a política de 20261107140000_recipe_pages.sql.
begin;

drop policy if exists "recipe_pages_select" on public.recipe_pages;
create policy "recipe_pages_select"
  on public.recipe_pages for select to authenticated
  using (
    public.is_master()
    or public.owns_community(community_id)
    or (
      public.is_community_member(community_id)
      and public.has_package(community_id, array['receitas', 'premium'])
      and exists (
        select 1 from public.community_content c
        where c.id = recipe_pages.content_id and c.status = 'published'
      )
    )
  );

commit;
