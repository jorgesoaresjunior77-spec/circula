-- =====================================================================
-- Rodada dez/2026:
--  1) Comentários só em texto: novos comentários não aceitam imagem
--     (os antigos com foto continuam como estão: constraint NOT VALID).
--  2) Lista de compras: marca do produto, supermercado e data da compra,
--     histórico de compras (fotografia do que foi pago) para os gráficos.
--  3) Parceiros: página do parceiro (foto grande, descrição, categoria,
--     cidade, Instagram, site, vínculo com o estabelecimento de "Na minha
--     cidade") e cupons de desconto com resgate controlado no banco.
-- Nada é apagado; só colunas/tabelas novas.
-- =====================================================================
begin;

-- 1) Comentários só em texto -------------------------------------------
alter table public.post_comments drop constraint if exists post_comments_text_only;
alter table public.post_comments add constraint post_comments_text_only check (image_url is null) not valid;

-- 2) Lista de compras ---------------------------------------------------
alter table public.shopping_list_items
  add column if not exists brand text check (brand is null or char_length(brand) <= 80);
alter table public.shopping_lists
  add column if not exists store_name text check (store_name is null or char_length(store_name) <= 120),
  add column if not exists purchased_on date;

create table if not exists public.shopping_purchases (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  community_id  uuid not null references public.communities (id) on delete cascade,
  list_id       uuid references public.shopping_lists (id) on delete set null,
  store_name    text not null check (char_length(btrim(store_name)) between 1 and 120),
  purchased_on  date not null,
  total_cents   integer not null default 0 check (total_cents >= 0),
  items_count   integer not null default 0 check (items_count >= 0),
  created_at    timestamptz not null default now()
);
create index if not exists shopping_purchases_owner_idx on public.shopping_purchases (owner_id, purchased_on desc);
create unique index if not exists shopping_purchases_list_uidx on public.shopping_purchases (list_id) where list_id is not null;

create table if not exists public.shopping_purchase_items (
  id                uuid primary key default gen_random_uuid(),
  purchase_id       uuid not null references public.shopping_purchases (id) on delete cascade,
  name              text not null check (char_length(name) between 1 and 160),
  brand             text check (brand is null or char_length(brand) <= 80),
  category          text not null default 'outros',
  quantity          numeric(10, 3) not null default 1 check (quantity >= 0),
  unit              text not null default 'un',
  est_price_cents   integer check (est_price_cents is null or est_price_cents >= 0),
  paid_price_cents  integer check (paid_price_cents is null or paid_price_cents >= 0)
);
create index if not exists shopping_purchase_items_purchase_idx on public.shopping_purchase_items (purchase_id);

alter table public.shopping_purchases enable row level security;
alter table public.shopping_purchase_items enable row level security;

drop policy if exists shopping_purchases_own on public.shopping_purchases;
create policy shopping_purchases_own on public.shopping_purchases for select to authenticated
  using (owner_id = auth.uid());
drop policy if exists shopping_purchases_delete on public.shopping_purchases;
create policy shopping_purchases_delete on public.shopping_purchases for delete to authenticated
  using (owner_id = auth.uid());
drop policy if exists shopping_purchase_items_own on public.shopping_purchase_items;
create policy shopping_purchase_items_own on public.shopping_purchase_items for select to authenticated
  using (exists (select 1 from public.shopping_purchases p where p.id = purchase_id and p.owner_id = auth.uid()));

revoke all on table public.shopping_purchases, public.shopping_purchase_items from public, anon;
grant select, delete on table public.shopping_purchases to authenticated;
grant select on table public.shopping_purchase_items to authenticated;

-- Salva a compra no histórico: copia os itens comprados (com marca e preço
-- pago) e conclui a lista. Salvar de novo a mesma lista substitui a anterior.
create or replace function public.save_shopping_purchase(p_list_id uuid, p_store text, p_date date)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_list public.shopping_lists%rowtype;
  v_id uuid;
  v_store text := btrim(coalesce(p_store, ''));
  v_count integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.shopping_can_access(p_list_id, true) then raise exception 'forbidden'; end if;
  if char_length(v_store) = 0 or char_length(v_store) > 120 then raise exception 'store_required'; end if;
  if p_date is null or p_date > (now() at time zone 'America/Sao_Paulo')::date + 1 then raise exception 'invalid_date'; end if;

  select * into v_list from public.shopping_lists where id = p_list_id for update;
  select count(*) into v_count from public.shopping_list_items where list_id = p_list_id and bought;
  if v_count = 0 then raise exception 'no_items'; end if;

  delete from public.shopping_purchases where list_id = p_list_id and owner_id = auth.uid();

  insert into public.shopping_purchases (owner_id, community_id, list_id, store_name, purchased_on, total_cents, items_count)
  select auth.uid(), v_list.community_id, p_list_id, v_store, p_date,
         coalesce(sum(i.paid_price_cents), 0), count(*)
    from public.shopping_list_items i
   where i.list_id = p_list_id and i.bought
  returning id into v_id;

  insert into public.shopping_purchase_items (purchase_id, name, brand, category, quantity, unit, est_price_cents, paid_price_cents)
  select v_id, i.name, nullif(btrim(coalesce(i.brand, '')), ''), i.category, i.quantity, i.unit, i.est_price_cents, i.paid_price_cents
    from public.shopping_list_items i
   where i.list_id = p_list_id and i.bought
   order by i.position;

  update public.shopping_lists
     set status = 'concluida', completed_at = now(), store_name = v_store, purchased_on = p_date, updated_at = now()
   where id = p_list_id;

  return v_id;
end $$;
revoke all on function public.save_shopping_purchase(uuid, text, date) from public, anon;
grant execute on function public.save_shopping_purchase(uuid, text, date) to authenticated;

-- 3) Parceiros: página do parceiro ----------------------------------------
alter table public.community_partners
  add column if not exists cover_path text check (cover_path is null or char_length(cover_path) <= 500),
  add column if not exists description text check (description is null or char_length(description) <= 1500),
  add column if not exists category text check (category is null or char_length(category) <= 60),
  add column if not exists city text check (city is null or char_length(city) <= 80),
  add column if not exists instagram text check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  add column if not exists city_listing_id uuid references public.city_listings (id) on delete set null;

-- Cupons ------------------------------------------------------------------
create table if not exists public.partner_coupons (
  id              uuid primary key default gen_random_uuid(),
  community_id    uuid not null references public.communities (id) on delete cascade,
  partner_id      uuid not null references public.community_partners (id) on delete cascade,
  title           text not null check (char_length(btrim(title)) between 1 and 80),
  code            text not null check (code ~ '^[A-Z0-9_-]{3,30}$'),
  benefit         text not null check (char_length(btrim(benefit)) between 1 and 300),
  discount_type   text not null default 'percentual' check (discount_type in ('percentual', 'valor', 'frete_gratis', 'brinde', 'outro')),
  discount_value  numeric(10, 2) check (discount_value is null or (discount_value > 0 and discount_value <= 100000)),
  instructions    text check (instructions is null or char_length(instructions) <= 600),
  max_per_person  integer check (max_per_person is null or max_per_person between 1 and 1000), -- null = ilimitado
  after_redeem    text not null default 'mark' check (after_redeem in ('hide', 'mark')),
  valid_from      date,
  valid_until     date,
  active          boolean not null default true,
  created_by      uuid not null default auth.uid() references public.profiles (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (valid_until is null or valid_from is null or valid_until >= valid_from),
  check (discount_type not in ('percentual') or (discount_value is not null and discount_value <= 100))
);
-- código único por comunidade (sem diferenciar maiúsculas)
create unique index if not exists partner_coupons_code_uidx on public.partner_coupons (community_id, upper(code));
create index if not exists partner_coupons_partner_idx on public.partner_coupons (partner_id, active);

create table if not exists public.partner_coupon_redemptions (
  id            uuid primary key default gen_random_uuid(),
  coupon_id     uuid not null references public.partner_coupons (id) on delete cascade,
  community_id  uuid not null references public.communities (id) on delete cascade,
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  redeemed_at   timestamptz not null default now()
);
create index if not exists partner_coupon_redemptions_idx on public.partner_coupon_redemptions (coupon_id, profile_id);
create index if not exists partner_coupon_redemptions_community_idx on public.partner_coupon_redemptions (community_id, redeemed_at desc);

drop trigger if exists partner_coupons_touch on public.partner_coupons;
create trigger partner_coupons_touch before update on public.partner_coupons
  for each row execute function public.community_partners_touch();

alter table public.partner_coupons enable row level security;
alter table public.partner_coupon_redemptions enable row level security;

-- A profissional (dona) gerencia tudo; a participante NÃO lê a tabela direto:
-- vê só os campos dela pela função list_partner_coupons.
drop policy if exists partner_coupons_owner on public.partner_coupons;
create policy partner_coupons_owner on public.partner_coupons for all to authenticated
  using (public.owns_community(community_id) or public.is_master())
  with check (public.owns_community(community_id));

drop policy if exists partner_coupon_redemptions_select on public.partner_coupon_redemptions;
create policy partner_coupon_redemptions_select on public.partner_coupon_redemptions for select to authenticated
  using (profile_id = auth.uid() or public.owns_community(community_id) or public.is_master());

revoke all on table public.partner_coupons, public.partner_coupon_redemptions from public, anon;
grant select, insert, update, delete on table public.partner_coupons to authenticated;
grant select on table public.partner_coupon_redemptions to authenticated;

-- Cupons de um parceiro para quem está vendo (só os campos da participante).
create or replace function public.list_partner_coupons(p_partner_id uuid)
returns table (
  id uuid, title text, code text, benefit text, discount_type text, discount_value numeric,
  instructions text, valid_from date, valid_until date, max_per_person integer, after_redeem text,
  used integer, available boolean, status text
)
language sql
stable
security definer
set search_path to ''
as $$
  with me as (select auth.uid() as uid),
  base as (
    select c.*, (select count(*)::int from public.partner_coupon_redemptions r, me where r.coupon_id = c.id and r.profile_id = me.uid) as used
      from public.partner_coupons c
      join public.community_partners p on p.id = c.partner_id
     where c.partner_id = p_partner_id
       and p.status = 'published'
       and c.active
       and (public.is_community_member(c.community_id) or public.owns_community(c.community_id))
  ),
  today as (select (now() at time zone 'America/Sao_Paulo')::date as d)
  select b.id, b.title, b.code, b.benefit, b.discount_type, b.discount_value, b.instructions, b.valid_from, b.valid_until,
         b.max_per_person, b.after_redeem, b.used,
         (b.max_per_person is null or b.used < b.max_per_person)
           and (b.valid_from is null or b.valid_from <= t.d)
           and (b.valid_until is null or b.valid_until >= t.d) as available,
         case
           when b.valid_from is not null and b.valid_from > t.d then 'em_breve'
           when b.valid_until is not null and b.valid_until < t.d then 'expirado'
           when b.max_per_person is not null and b.used >= b.max_per_person then 'esgotado'
           else 'disponivel'
         end as status
    from base b, today t
   where not (b.after_redeem = 'hide' and b.max_per_person is not null and b.used >= b.max_per_person)
     and not (b.valid_until is not null and b.valid_until < t.d - 30)
   order by b.created_at;
$$;
revoke all on function public.list_partner_coupons(uuid) from public, anon;
grant execute on function public.list_partner_coupons(uuid) to authenticated;

-- Resgate atômico: trava a linha do cupom (dois toques ao mesmo tempo
-- esperam um pelo outro), confere validade e o limite da pessoa e registra.
create or replace function public.redeem_partner_coupon(p_coupon_id uuid)
returns table (code text, used integer, remaining integer)
language plpgsql
security definer
set search_path to ''
as $$
#variable_conflict use_column
declare
  v_c public.partner_coupons%rowtype;
  v_used integer;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into v_c from public.partner_coupons where id = p_coupon_id for update;
  if not found or not v_c.active then raise exception 'coupon_unavailable'; end if;
  if not exists (select 1 from public.community_partners p where p.id = v_c.partner_id and p.status = 'published') then
    raise exception 'coupon_unavailable';
  end if;
  if not (public.is_community_member(v_c.community_id) or public.owns_community(v_c.community_id)) then
    raise exception 'not_member';
  end if;
  if v_c.valid_from is not null and v_c.valid_from > v_today then raise exception 'not_started'; end if;
  if v_c.valid_until is not null and v_c.valid_until < v_today then raise exception 'expired'; end if;

  select count(*)::int into v_used from public.partner_coupon_redemptions r
   where r.coupon_id = p_coupon_id and r.profile_id = auth.uid();
  if v_c.max_per_person is not null and v_used >= v_c.max_per_person then raise exception 'limit_reached'; end if;

  insert into public.partner_coupon_redemptions (coupon_id, community_id, profile_id)
  values (p_coupon_id, v_c.community_id, auth.uid());

  return query select v_c.code, v_used + 1,
    case when v_c.max_per_person is null then null else v_c.max_per_person - v_used - 1 end;
end $$;
revoke all on function public.redeem_partner_coupon(uuid) from public, anon;
grant execute on function public.redeem_partner_coupon(uuid) to authenticated;

-- Confere se um código já existe na comunidade (o formulário avisa antes de salvar).
create or replace function public.partner_coupon_code_taken(p_community_id uuid, p_code text, p_except uuid default null)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select public.owns_community(p_community_id) and exists (
    select 1 from public.partner_coupons c
     where c.community_id = p_community_id and upper(c.code) = upper(btrim(p_code))
       and (p_except is null or c.id <> p_except)
  );
$$;
revoke all on function public.partner_coupon_code_taken(uuid, text, uuid) from public, anon;
grant execute on function public.partner_coupon_code_taken(uuid, text, uuid) to authenticated;

commit;
