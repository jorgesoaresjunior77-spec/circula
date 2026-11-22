-- E-books: quem tem o Círcula Premium também lê as páginas. A tela já
-- liberava o Premium (canReadEbooks), mas a política de product_pages só
-- aceitava 'ebooks' e 'total' — o leitor dizia "páginas não cadastradas".
-- Reversível: restaurar a política de 20261107120000 (ebooks, total).
begin;

drop policy if exists "product_pages_select" on public.product_pages;
create policy "product_pages_select"
  on public.product_pages for select to authenticated
  using (
    public.is_master()
    or public.owns_community(community_id)
    or (
      public.is_community_member(community_id)
      and exists (
        select 1 from public.products p
        where p.id = product_pages.product_id and p.status = 'published'
      )
      and (
        public.has_package(community_id, array['ebooks', 'total', 'premium'])
        or exists (
          select 1 from public.product_entitlements e
          where e.product_id = product_pages.product_id
            and e.profile_id = auth.uid()
            and e.revoked_at is null
        )
      )
    )
  );

commit;
