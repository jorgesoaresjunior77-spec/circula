-- Imagens que a profissional cadastra para estados, cidades e para qualquer lugar ou autônomo.
begin;

create table if not exists public.city_state_images (
  uf        text primary key check (char_length(uf) = 2),
  imagem    text not null check (char_length(btrim(imagem)) > 0),
  atualizado_em timestamptz not null default now()
);
alter table public.city_state_images enable row level security;
drop policy if exists "city_state_images_select" on public.city_state_images;
create policy "city_state_images_select" on public.city_state_images for select to authenticated using (true);
revoke all on table public.city_state_images from public, anon, authenticated;
grant select on table public.city_state_images to authenticated;
grant all on table public.city_state_images to service_role;

alter table public.cidades add column if not exists imagem text;

create or replace function public.city_state_image_set(p_uf text, p_url text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_city_admin() then raise exception 'sem_permissao' using errcode = '42501'; end if;
  if p_url is null or btrim(p_url) = '' then
    delete from public.city_state_images where uf = upper(p_uf);
  else
    insert into public.city_state_images (uf, imagem) values (upper(p_uf), p_url)
    on conflict (uf) do update set imagem = excluded.imagem, atualizado_em = now();
  end if;
end $$;
revoke all on function public.city_state_image_set(text, text) from public, anon;
grant execute on function public.city_state_image_set(text, text) to authenticated;

create or replace function public.city_image_set(p_city uuid, p_url text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_city_admin() then raise exception 'sem_permissao' using errcode = '42501'; end if;
  update public.cidades set imagem = nullif(btrim(coalesce(p_url, '')), '') where id = p_city;
end $$;
revoke all on function public.city_image_set(uuid, text) from public, anon;
grant execute on function public.city_image_set(uuid, text) to authenticated;

-- lugares e autônomos para a profissional ajustar logo e fachada (busca por nome)
create or replace function public.city_admin_listings(p_q text default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.is_city_admin() then raise exception 'sem_permissao' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', l.id, 'titulo', l.titulo, 'tipo', l.tipo, 'cidade', c.nome, 'estado', c.estado, 'logo', l.logo, 'foto', l.foto) order by l.criado_em desc)
    from (
      select * from public.city_listings
      where tipo in ('lugar', 'profissional') and status <> 'removido'
        and (coalesce(btrim(p_q), '') = '' or public.city_normalize(titulo) like '%' || public.city_normalize(p_q) || '%')
      order by criado_em desc limit 40
    ) l
    join public.cidades c on c.id = l.city_id
  ), '[]'::jsonb);
end $$;
revoke all on function public.city_admin_listings(text) from public, anon;
grant execute on function public.city_admin_listings(text) to authenticated;

create or replace function public.city_listing_images_set(p_listing uuid, p_logo text, p_foto text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_city_admin() then raise exception 'sem_permissao' using errcode = '42501'; end if;
  update public.city_listings set logo = nullif(btrim(coalesce(p_logo, '')), ''), foto = nullif(btrim(coalesce(p_foto, '')), '') where id = p_listing;
end $$;
revoke all on function public.city_listing_images_set(uuid, text, text) from public, anon;
grant execute on function public.city_listing_images_set(uuid, text, text) to authenticated;

commit;
-- ROLLBACK (manual): drop function city_state_image_set, city_image_set, city_admin_listings, city_listing_images_set; drop table city_state_images; alter table cidades drop column imagem;
