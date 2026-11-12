-- =====================================================================
-- Páginas de e-book: quem COMPROU o e-book também lê
-- =====================================================================
-- Decisão do usuário (2026-11-12): o e-book tem preço; quem não assina o
-- pacote de E-books / plano completo pode comprar só aquele e-book.
-- A leitura passa a valer para: dona, master, membro com o pacote
-- ('ebooks' ou 'total') OU membro com entitlement ativo daquele produto
-- (product_entitlements, concedido só pelo servidor após o pagamento).
-- Só troca a policy de SELECT de product_pages. Idempotente e reversível.
-- =====================================================================

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
        public.has_package(community_id, array['ebooks', 'total'])
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

-- Rollback: recriar a policy sem o trecho de product_entitlements
-- (ver 20261112130000_packages_ebook_pages_garden_visibility.sql).
