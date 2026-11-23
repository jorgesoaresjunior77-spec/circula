-- =====================================================================
-- "Na minha cidade" — rodada 2:
--  • avaliações (1 a 5 estrelas) e comentários nos lugares/profissionais,
--    uma avaliação por participante (como no Google);
--  • horário de funcionamento por dia (city_listings.horarios) + campo livre;
--  • imagens dos grupos de categorias (a administração cadastra);
--  • desconto de 10% de quem convida amigas: cada amiga que entra pelo convite
--    vale 10% no PRÓXIMO ciclo da assinatura (aplicado pelo webhook do Asaas).
-- Aditiva e reversível (rollback no fim).
-- =====================================================================
begin;

-- ---- horários -------------------------------------------------------------
alter table public.city_listings add column if not exists horarios jsonb
  check (horarios is null or jsonb_typeof(horarios) = 'object');
alter table public.city_listings drop constraint if exists city_listings_horario_check;
alter table public.city_listings add constraint city_listings_horario_check
  check (horario is null or char_length(horario) <= 300);

-- ---- avaliações -------------------------------------------------------------
create table if not exists public.city_listing_reviews (
  listing_id    uuid not null references public.city_listings (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  nota          smallint not null check (nota between 1 and 5),
  comentario    text check (comentario is null or char_length(comentario) <= 600),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (listing_id, user_id)
);
alter table public.city_listing_reviews enable row level security;
revoke all on table public.city_listing_reviews from public, anon, authenticated;
grant all on table public.city_listing_reviews to service_role;
-- a leitura e a escrita passam só pelas funções abaixo

create or replace function public.city_review_set(p_listing uuid, p_nota integer, p_comentario text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); l public.city_listings; v_txt text := nullif(btrim(coalesce(p_comentario, '')), '');
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_nota is null or p_nota not between 1 and 5 then raise exception 'nota_invalida'; end if;
  select * into l from public.city_listings where id = p_listing and status = 'ativo' and tipo in ('lugar','profissional');
  if not found then raise exception 'cadastro_nao_encontrado'; end if;
  if l.criado_por = v_uid then raise exception 'avaliacao_propria'; end if;
  if v_txt is not null and public.text_has_blocked_term(v_txt, null) then
    raise exception 'conteudo_bloqueado' using errcode = 'check_violation';
  end if;
  insert into public.city_listing_reviews (listing_id, user_id, nota, comentario)
  values (p_listing, v_uid, p_nota, v_txt)
  on conflict (listing_id, user_id)
  do update set nota = excluded.nota, comentario = excluded.comentario, atualizado_em = now();
end $$;
revoke all on function public.city_review_set(uuid, integer, text) from public, anon;
grant execute on function public.city_review_set(uuid, integer, text) to authenticated;

create or replace function public.city_review_delete(p_listing uuid)
returns void language sql security definer set search_path to 'public' as $$
  delete from public.city_listing_reviews where listing_id = p_listing and user_id = auth.uid();
$$;
revoke all on function public.city_review_delete(uuid) from public, anon;
grant execute on function public.city_review_delete(uuid) to authenticated;

-- A administração também pode apagar um comentário impróprio.
create or replace function public.city_review_admin_delete(p_listing uuid, p_user uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_city_admin() then raise exception 'sem_permissao' using errcode = '42501'; end if;
  delete from public.city_listing_reviews where listing_id = p_listing and user_id = p_user;
end $$;
revoke all on function public.city_review_admin_delete(uuid, uuid) from public, anon;
grant execute on function public.city_review_admin_delete(uuid, uuid) to authenticated;

create or replace function public.city_reviews_list(p_listing uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', r.user_id,
      'nome', coalesce(nullif(split_part(btrim(coalesce(p.full_name, '')), ' ', 1), ''), 'Participante'),
      'avatar', p.avatar_url, 'nota', r.nota, 'comentario', r.comentario, 'criado_em', r.criado_em,
      'minha', r.user_id = auth.uid()
    ) order by r.criado_em desc)
    from (
      select * from public.city_listing_reviews where listing_id = p_listing order by criado_em desc limit 100
    ) r left join public.profiles p on p.id = r.user_id
  ), '[]'::jsonb);
end $$;
revoke all on function public.city_reviews_list(uuid) from public, anon;
grant execute on function public.city_reviews_list(uuid) to authenticated;

-- ---- lista de cadastros: agora com média, nº de avaliações, minha nota e horários ----
create or replace function public.list_city_listings(p_city uuid default null, p_only_saved boolean default false)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_admin boolean := public.is_city_admin(); v jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_city is null and not p_only_saved then raise exception 'cidade_obrigatoria'; end if;
  select coalesce(jsonb_agg(q.x order by q.criado_em desc), '[]'::jsonb) into v from (
    select l.criado_em, jsonb_build_object(
      'id', l.id, 'city_id', l.city_id, 'cidade', c.nome, 'estado', c.estado,
      'tipo', l.tipo, 'categoria_id', l.categoria_id, 'titulo', l.titulo, 'descricao', l.descricao,
      'bairro', l.bairro, 'endereco', l.endereco, 'contato', l.contato, 'instagram', l.instagram,
      'faixa_preco', l.faixa_preco, 'horario', l.horario, 'horarios', l.horarios, 'foto', l.foto,
      'criado_por', l.criado_por,
      'autora_nome', nullif(split_part(btrim(coalesce(p.full_name, '')), ' ', 1), ''),
      'autora_avatar', p.avatar_url,
      'e_proprio_negocio', l.e_proprio_negocio, 'atende_toda_cidade', l.atende_toda_cidade,
      'status', l.status, 'criado_em', l.criado_em,
      'starts_at', l.starts_at, 'local_nome', l.local_nome, 'valor', l.valor, 'link', l.link,
      'atividade', l.atividade, 'vagas', l.vagas, 'nivel', l.nivel,
      'votos', (select count(*) from public.city_listing_votes v where v.listing_id = l.id),
      'votei', exists (select 1 from public.city_listing_votes v where v.listing_id = l.id and v.user_id = v_uid),
      'salvei', exists (select 1 from public.city_saved s where s.listing_id = l.id and s.user_id = v_uid),
      'confirmadas', (select count(*) from public.city_meetup_rsvps r where r.listing_id = l.id),
      'vou', exists (select 1 from public.city_meetup_rsvps r where r.listing_id = l.id and r.user_id = v_uid),
      'media', (select round(avg(r.nota)::numeric, 1) from public.city_listing_reviews r where r.listing_id = l.id),
      'avaliacoes', (select count(*) from public.city_listing_reviews r where r.listing_id = l.id),
      'minha_nota', (select r.nota from public.city_listing_reviews r where r.listing_id = l.id and r.user_id = v_uid),
      'tags', coalesce((select jsonb_agg(t.tag_id) from public.city_listing_tags t where t.listing_id = l.id), '[]'::jsonb)
    ) as x
    from public.city_listings l
    join public.cidades c on c.id = l.city_id
    left join public.profiles p on p.id = l.criado_por
    where (p_city is null or l.city_id = p_city)
      and (not p_only_saved or exists (select 1 from public.city_saved s where s.listing_id = l.id and s.user_id = v_uid))
      and (l.status = 'ativo' or l.criado_por = v_uid or v_admin)
    order by l.criado_em desc
    limit 1000
  ) q;
  return v;
end $$;

-- ---- imagens dos grupos ---------------------------------------------------------
create table if not exists public.city_group_images (
  grupo         text primary key check (grupo in ('comer','compras','beleza','saude','esporte','casa','carros','servicos','familia','pets','lazer','eventos','tecnologia','outros')),
  image_url     text not null check (char_length(btrim(image_url)) > 0),
  atualizado_em timestamptz not null default now()
);
alter table public.city_group_images enable row level security;
drop policy if exists "city_group_images_select" on public.city_group_images;
create policy "city_group_images_select" on public.city_group_images for select to authenticated using (true);
drop policy if exists "city_group_images_write" on public.city_group_images;
create policy "city_group_images_write" on public.city_group_images for all to authenticated
  using (public.is_city_admin()) with check (public.is_city_admin());
revoke all on table public.city_group_images from public, anon, authenticated;
grant select, insert, update, delete on table public.city_group_images to authenticated;
grant all on table public.city_group_images to service_role;

-- ---- desconto de quem convida ----------------------------------------------------
alter table public.referrals add column if not exists inviter_reward_applied_at timestamptz;
alter table public.referrals add column if not exists inviter_reward_payment text;

create or replace function public.my_invite_rewards()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'convidadas', count(*),
    'pendentes', count(*) filter (where inviter_reward_applied_at is null),
    'aplicados', count(*) filter (where inviter_reward_applied_at is not null)
  ) from public.referrals where inviter_id = auth.uid();
$$;
revoke all on function public.my_invite_rewards() from public, anon;
grant execute on function public.my_invite_rewards() to authenticated;

commit;

-- ROLLBACK (manual):
--   drop function my_invite_rewards, city_reviews_list, city_review_set, city_review_delete, city_review_admin_delete;
--   drop table city_group_images, city_listing_reviews;
--   alter table referrals drop column inviter_reward_applied_at, drop column inviter_reward_payment;
--   alter table city_listings drop column horarios;
--   (e recriar list_city_listings da migration 20261207120000)
