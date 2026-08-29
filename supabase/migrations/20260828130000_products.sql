-- =====================================================================
-- FASE 4 — Monetização (Etapa 1): catálogo de produtos por comunidade
-- =====================================================================
-- Cria public.products: produtos que a Professional dona de uma
-- comunidade cadastra para venda futura dentro da própria comunidade.
--
-- Escopo desta migration (Etapa 1 — SÓ catálogo):
--   - tabela + índice + trigger de updated_at
--   - RLS + 4 policies (select / insert / update / delete)
--   - GRANT DML para authenticated (tabela criada fora do Studio NAO
--     recebe GRANT automático — mesmo "infra gotcha" que já causou 403
--     em profiles/communities)
--
-- FORA de escopo (NAO nesta migration): checkout, product_orders,
-- pagamento, split, entitlements, webhook, Asaas, Storage/bucket.
--
-- Idempotente: create table if not exists / create index if not exists /
-- create or replace trigger / drop policy if exists + create policy.
-- =====================================================================

begin;

-- ---- tabela --------------------------------------------------------
create table if not exists public.products (
  id                    uuid not null default gen_random_uuid(),
  community_id           uuid not null,
  created_by            uuid not null,
  type                  text not null,
  title                 text not null,
  description           text,
  cover_image_url       text,
  price_cents           integer not null default 0,
  currency              text not null default 'BRL',
  status                text not null default 'draft',
  max_quantity          integer,
  deliverable_kind      text not null default 'none',
  deliverable_url       text,
  deliverable_file_path text,
  event_starts_at       timestamptz,
  event_is_online       boolean,
  event_location        text,
  requires_shipping     boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint products_pkey primary key (id),
  constraint products_type_check check (
    type = any (array['course'::text, 'ebook'::text, 'workshop'::text, 'event'::text, 'consultation'::text, 'physical'::text])
  ),
  constraint products_price_cents_check check (price_cents >= 0),
  constraint products_currency_check check (currency = 'BRL'::text),
  constraint products_status_check check (
    status = any (array['draft'::text, 'published'::text, 'archived'::text])
  ),
  constraint products_max_quantity_check check (max_quantity is null or max_quantity > 0),
  constraint products_deliverable_kind_check check (
    deliverable_kind = any (array['none'::text, 'file'::text, 'external_link'::text, 'scheduling'::text])
  ),
  constraint products_published_needs_price check (status <> 'published'::text or price_cents > 0),
  constraint products_community_id_fkey foreign key (community_id) references public.communities (id) on delete cascade,
  constraint products_created_by_fkey foreign key (created_by) references public.profiles (id) on delete cascade
);

-- ---- índice -------------------------------------------------------
create index if not exists products_community_id_status_idx
  on public.products using btree (community_id, status);

-- ---- updated_at automático --------------------------------------
create or replace trigger set_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ---- RLS --------------------------------------------------------
alter table public.products enable row level security;

drop policy if exists "products_select" on public.products;
create policy "products_select"
  on public.products for select to public
  using (
    public.is_master()
    or public.owns_community(community_id)
    or (public.is_community_member(community_id) and status = 'published'::text)
  );

drop policy if exists "products_insert" on public.products;
create policy "products_insert"
  on public.products for insert to public
  with check (
    public.owns_community(community_id)
    and created_by = auth.uid()
  );

drop policy if exists "products_update" on public.products;
create policy "products_update"
  on public.products for update to public
  using (public.owns_community(community_id))
  with check (public.owns_community(community_id));

drop policy if exists "products_delete" on public.products;
create policy "products_delete"
  on public.products for delete to public
  using (public.owns_community(community_id));

-- ---- GRANT (DML explícito para authenticated) ------------------
grant select, insert, update, delete on table public.products to authenticated;

commit;
