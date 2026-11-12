-- =====================================================================
-- Pacotes das membros, páginas de e-book e jardim visível entre membros
-- =====================================================================
-- Autorizado pelo usuário em 2026-11-12 (itens 1, 2 e 3 da conversa).
--
-- 1. member_package_access — quem tem qual pacote pago à parte:
--      'help_nutri' (falar com a nutri), 'ebooks' (ler os e-books da Loja)
--      e 'total' (plano completo: vale pelos dois).
--    Enquanto a cobrança desses pacotes não existe no sistema, quem libera
--    é a dona da comunidade (a nutricionista), no Painel. A membro só LÊ as
--    próprias linhas; não consegue se liberar sozinha.
-- 2. product_pages — páginas (imagens) de um e-book da Loja, lidas no
--    leitor da revista. Só a dona escreve. Membro lê se o produto está
--    publicado E ela tem o pacote 'ebooks' ou 'total'.
--    As imagens ficam no bucket privado `community-media` (aqui só o PATH).
-- 3. garden_checks — membros da mesma comunidade passam a enxergar os
--    checks umas das outras (flor do mês e árvore do ano no perfil). Só
--    leitura; marcar o check continua sendo só o próprio (policy de insert
--    não muda).
--
-- Não toca em assinaturas, pagamentos, Asaas nem em auth. Aditiva,
-- idempotente, transacional e reversível (rollback no rodapé).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Pacotes das membros
-- ---------------------------------------------------------------------
create table if not exists public.member_package_access (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  package       text not null check (package in ('help_nutri', 'ebooks', 'total')),
  granted_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint member_package_access_unique unique (community_id, profile_id, package)
);

create index if not exists member_package_access_profile_idx
  on public.member_package_access (profile_id, community_id);

alter table public.member_package_access enable row level security;

drop policy if exists "member_package_access_select" on public.member_package_access;
create policy "member_package_access_select"
  on public.member_package_access for select to authenticated
  using (
    public.is_master()
    or profile_id = auth.uid()
    or public.owns_community(community_id)
  );

drop policy if exists "member_package_access_insert" on public.member_package_access;
create policy "member_package_access_insert"
  on public.member_package_access for insert to authenticated
  with check (public.owns_community(community_id));

drop policy if exists "member_package_access_delete" on public.member_package_access;
create policy "member_package_access_delete"
  on public.member_package_access for delete to authenticated
  using (public.owns_community(community_id));

revoke all on table public.member_package_access from public, anon;
grant select, insert, delete on table public.member_package_access to authenticated;

-- A usuária autenticada tem algum dos pacotes pedidos nesta comunidade?
create or replace function public.has_package(p_community_id uuid, p_packages text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.member_package_access a
    where a.community_id = p_community_id
      and a.profile_id = auth.uid()
      and a.package = any (p_packages)
  );
$$;

revoke all on function public.has_package(uuid, text[]) from public, anon;
grant execute on function public.has_package(uuid, text[]) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Páginas de e-book
-- ---------------------------------------------------------------------
create table if not exists public.product_pages (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products (id) on delete cascade,
  community_id  uuid not null references public.communities (id) on delete cascade,
  position      integer not null default 0,
  image_path    text not null check (length(btrim(image_path)) > 0),
  created_at    timestamptz not null default now()
);

create index if not exists product_pages_product_position_idx
  on public.product_pages (product_id, position);

alter table public.product_pages enable row level security;

drop policy if exists "product_pages_select" on public.product_pages;
create policy "product_pages_select"
  on public.product_pages for select to authenticated
  using (
    public.is_master()
    or public.owns_community(community_id)
    or (
      public.is_community_member(community_id)
      and public.has_package(community_id, array['ebooks', 'total'])
      and exists (
        select 1 from public.products p
        where p.id = product_pages.product_id and p.status = 'published'
      )
    )
  );

drop policy if exists "product_pages_write" on public.product_pages;
create policy "product_pages_write"
  on public.product_pages for all to authenticated
  using (public.owns_community(community_id))
  with check (
    public.owns_community(community_id)
    and exists (
      select 1 from public.products p
      where p.id = product_pages.product_id and p.community_id = product_pages.community_id
    )
  );

revoke all on table public.product_pages from public, anon;
grant select, insert, update, delete on table public.product_pages to authenticated;

-- ---------------------------------------------------------------------
-- 3. Jardim visível entre membros da mesma comunidade (só leitura)
-- ---------------------------------------------------------------------
drop policy if exists "garden_checks_select" on public.garden_checks;
create policy "garden_checks_select" on public.garden_checks for select to public
  using (
    public.is_master()
    or profile_id = auth.uid()
    or public.owns_community(community_id)
    or public.is_community_member(community_id)
  );

commit;

-- ---- Rollback (manual) ------------------------------------------------
-- begin;
-- drop policy if exists "garden_checks_select" on public.garden_checks;
-- create policy "garden_checks_select" on public.garden_checks for select to public
--   using (public.is_master() or profile_id = auth.uid() or public.owns_community(community_id));
-- drop table if exists public.product_pages cascade;
-- drop function if exists public.has_package(uuid, text[]);
-- drop table if exists public.member_package_access cascade;
-- commit;
