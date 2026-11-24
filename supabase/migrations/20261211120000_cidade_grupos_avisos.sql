-- Na minha cidade: grupos e categorias que a profissional cria (com imagem e descrição),
-- logo + fachada nos cadastros, e avisos (sino e bolinha) de pedidos novos.
begin;

-- ---- 1) grupos ------------------------------------------------------------------
create table if not exists public.city_groups (
  slug       text primary key check (slug ~ '^[a-z0-9-]{2,40}$'),
  nome       text not null check (char_length(btrim(nome)) between 2 and 40),
  icone      text,
  descricao  text check (descricao is null or char_length(descricao) <= 200),
  imagem     text,
  ordem      int not null default 100,
  criado_em  timestamptz not null default now()
);
alter table public.city_groups enable row level security;
drop policy if exists "city_groups_select" on public.city_groups;
create policy "city_groups_select" on public.city_groups for select to authenticated using (true);
revoke all on table public.city_groups from public, anon, authenticated;
grant select on table public.city_groups to authenticated;
grant all on table public.city_groups to service_role;

insert into public.city_groups (slug, nome, icone, ordem) values
  ('comer', 'Comer e beber', '🍽️', 1), ('compras', 'Compras', '🛍️', 2), ('beleza', 'Beleza e bem-estar', '💅', 3),
  ('saude', 'Saúde', '🩺', 4), ('esporte', 'Esporte e movimento', '🏃‍♀️', 5), ('casa', 'Casa e obras', '🛠️', 6),
  ('carros', 'Carros e transporte', '🚗', 7), ('servicos', 'Serviços profissionais', '💼', 8),
  ('familia', 'Família e educação', '📚', 9), ('pets', 'Pets', '🐾', 10), ('lazer', 'Lazer e turismo', '🌳', 11),
  ('eventos', 'Eventos e festas', '🎉', 12), ('tecnologia', 'Tecnologia e reparos', '📱', 13), ('outros', 'Outros', '✨', 99)
on conflict (slug) do nothing;

-- imagens que já tinham sido cadastradas por grupo
update public.city_groups g set imagem = i.image_url from public.city_group_images i where i.grupo = g.slug and g.imagem is null;

-- ---- 2) categorias: grupo livre (vem de city_groups), descrição e imagem ---------------
alter table public.city_categories drop constraint if exists city_categories_grupo_check;
alter table public.city_categories drop constraint if exists city_categories_grupo_fkey;
alter table public.city_categories add constraint city_categories_grupo_fkey foreign key (grupo) references public.city_groups (slug) on update cascade;
alter table public.city_categories add column if not exists descricao text check (descricao is null or char_length(descricao) <= 200);
alter table public.city_categories add column if not exists imagem text;
alter table public.city_categories add column if not exists grupo_sugerido text check (grupo_sugerido is null or char_length(grupo_sugerido) <= 40);

-- ---- 3) cadastros: logo (a foto atual passa a ser a fachada) -----------------------------
alter table public.city_listings add column if not exists logo text;

-- ---- 4) avisos ---------------------------------------------------------------------
alter table public.social_notifications drop constraint if exists social_notifications_type_check;
alter table public.social_notifications add constraint social_notifications_type_check check (
  type = any (array['post_comment','post_reaction','circle_join','event_rsvp','direct_message','help_request',
    'membership_requested','membership_approved','membership_rejected','circle_request','circle_request_approved',
    'nutri_plan','nutri_appointment','nutri_message','nutri_request','nutri_update','nutri_link',
    'city_claim','city_claim_result','city_category_request']::text[])
);

create or replace function public.city_notify_admins(p_type text, p_title text, p_body text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  begin
    insert into public.social_notifications (profile_id, actor_profile_id, type, title, body)
    select p.id, auth.uid(), p_type, p_title, p_body from public.profiles p where p.role in ('master', 'professional');
  exception when others then
    null; -- aviso nunca bloqueia o pedido
  end;
end $$;
revoke all on function public.city_notify_admins(text, text, text) from public, anon, authenticated;

-- pedido de reivindicação -> avisa a profissional (sino) com o nome do negócio
create or replace function public.city_claim_create(p_listing uuid, p_whatsapp text, p_mensagem text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_digits text := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'); v_msg text := nullif(btrim(coalesce(p_mensagem, '')), ''); v_titulo text;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if char_length(v_digits) not between 10 and 13 then raise exception 'whatsapp_invalido'; end if;
  select titulo into v_titulo from public.city_listings where id = p_listing and status = 'ativo' and tipo in ('lugar','profissional');
  if v_titulo is null then raise exception 'cadastro_nao_encontrado'; end if;
  if v_msg is not null and public.text_has_blocked_term(v_msg, null) then
    raise exception 'conteudo_bloqueado' using errcode = 'check_violation';
  end if;
  begin
    insert into public.city_claims (listing_id, user_id, whatsapp, mensagem) values (p_listing, v_uid, v_digits, v_msg);
  exception when unique_violation then
    raise exception 'ja_reivindicado';
  end;
  perform public.city_notify_admins('city_claim', 'Pedido para reivindicar um negócio', v_titulo);
end $$;
revoke all on function public.city_claim_create(uuid, text, text) from public, anon;
grant execute on function public.city_claim_create(uuid, text, text) to authenticated;

-- decisão -> avisa quem pediu
create or replace function public.city_claim_resolve(p_claim uuid, p_action text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare k public.city_claims; v_titulo text;
begin
  if not public.is_city_admin() then raise exception 'sem_permissao' using errcode = '42501'; end if;
  select * into k from public.city_claims where id = p_claim;
  if not found then raise exception 'pedido_nao_encontrado'; end if;
  select titulo into v_titulo from public.city_listings where id = k.listing_id;
  if p_action = 'aprovar' then
    update public.city_claims set status = 'aprovada', resolvido_em = now() where id = p_claim;
    update public.city_listings set reivindicado_por = k.user_id, e_proprio_negocio = true where id = k.listing_id;
    insert into public.notifications (profile_id, type, title, body)
    values (k.user_id, 'billing', 'Negócio reivindicado', 'Seu pedido foi aprovado. Abra o cadastro do seu negócio em "Na minha cidade" para contratar o destaque da capa (R$ 4,90 por mês).');
    insert into public.social_notifications (profile_id, actor_profile_id, type, title, body)
    values (k.user_id, auth.uid(), 'city_claim_result', 'Pedido aprovado', v_titulo);
  elsif p_action = 'recusar' then
    update public.city_claims set status = 'recusada', resolvido_em = now() where id = p_claim;
    insert into public.social_notifications (profile_id, actor_profile_id, type, title, body)
    values (k.user_id, auth.uid(), 'city_claim_result', 'Pedido não aprovado', v_titulo);
  elsif p_action = 'revogar' then
    update public.city_claims set status = 'recusada', resolvido_em = now() where id = p_claim;
    update public.city_listings set reivindicado_por = null where id = k.listing_id;
  else
    raise exception 'acao_invalida';
  end if;
end $$;
revoke all on function public.city_claim_resolve(uuid, text) from public, anon;
grant execute on function public.city_claim_resolve(uuid, text) to authenticated;

-- pedido de categoria nova (e, se quiser, de um grupo novo) -> avisa a profissional
drop function if exists public.create_city_category(text, text);
create or replace function public.create_city_category(p_nome text, p_grupo text, p_grupo_sugerido text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_nome text := btrim(coalesce(p_nome, '')); v_norm text; v_id uuid; v_grupo text := p_grupo; v_sug text := nullif(btrim(coalesce(p_grupo_sugerido, '')), '');
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if char_length(v_nome) not between 2 and 30 then raise exception 'categoria_invalida'; end if;
  if public.text_has_blocked_term(v_nome, null) or (v_sug is not null and public.text_has_blocked_term(v_sug, null)) then
    raise exception 'conteudo_bloqueado' using errcode = 'check_violation';
  end if;
  if v_sug is not null and char_length(v_sug) > 40 then raise exception 'categoria_invalida'; end if;
  -- pedido de grupo novo: fica em "Outros" até a profissional criar o grupo
  if v_sug is not null then v_grupo := 'outros'; end if;
  if not exists (select 1 from public.city_groups where slug = v_grupo) then raise exception 'categoria_invalida'; end if;
  v_norm := public.city_normalize(v_nome);
  select id into v_id from public.city_categories where nome_normalizado = v_norm and status <> 'unida'
   order by (grupo = v_grupo) desc limit 1;
  if v_id is not null then return jsonb_build_object('id', v_id, 'existing', true); end if;
  insert into public.city_categories (nome, grupo, criada_por, status, grupo_sugerido)
  values (v_nome, v_grupo, v_uid, 'pendente', v_sug) returning id into v_id;
  perform public.city_notify_admins('city_category_request', 'Pedido de nova categoria', v_nome || coalesce(' (grupo novo: ' || v_sug || ')', ''));
  return jsonb_build_object('id', v_id, 'existing', false);
end $$;
revoke all on function public.create_city_category(text, text, text) from public, anon;
grant execute on function public.create_city_category(text, text, text) to authenticated;

-- ---- 5) a profissional cria e edita grupos e categorias -------------------------------------
create or replace function public.city_group_save(p_slug text, p_nome text, p_icone text, p_descricao text, p_imagem text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_nome text := btrim(coalesce(p_nome, '')); v_slug text := nullif(btrim(coalesce(p_slug, '')), '');
begin
  if not public.is_city_admin() then raise exception 'sem_permissao' using errcode = '42501'; end if;
  if char_length(v_nome) not between 2 and 40 then raise exception 'grupo_invalido'; end if;
  if v_slug is null then
    v_slug := regexp_replace(lower(public.city_normalize(v_nome)), '[^a-z0-9]+', '-', 'g');
    v_slug := btrim(v_slug, '-');
    if char_length(v_slug) < 2 then raise exception 'grupo_invalido'; end if;
    if exists (select 1 from public.city_groups where slug = v_slug) then v_slug := v_slug || '-' || substr(gen_random_uuid()::text, 1, 4); end if;
  end if;
  insert into public.city_groups (slug, nome, icone, descricao, imagem, ordem)
  values (v_slug, v_nome, nullif(btrim(coalesce(p_icone, '')), ''), nullif(btrim(coalesce(p_descricao, '')), ''), nullif(btrim(coalesce(p_imagem, '')), ''),
          coalesce((select max(ordem) + 1 from public.city_groups where ordem < 99), 50))
  on conflict (slug) do update set nome = excluded.nome, icone = excluded.icone, descricao = excluded.descricao, imagem = excluded.imagem;
  return v_slug;
end $$;
revoke all on function public.city_group_save(text, text, text, text, text) from public, anon;
grant execute on function public.city_group_save(text, text, text, text, text) to authenticated;

create or replace function public.city_group_delete(p_slug text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_city_admin() then raise exception 'sem_permissao' using errcode = '42501'; end if;
  if p_slug = 'outros' then raise exception 'grupo_protegido'; end if;
  if exists (select 1 from public.city_categories where grupo = p_slug) then raise exception 'grupo_com_categorias'; end if;
  delete from public.city_groups where slug = p_slug;
end $$;
revoke all on function public.city_group_delete(text) from public, anon;
grant execute on function public.city_group_delete(text) to authenticated;

create or replace function public.city_category_save(p_id uuid, p_nome text, p_grupo text, p_descricao text, p_imagem text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_nome text := btrim(coalesce(p_nome, '')); v_id uuid := p_id;
begin
  if not public.is_city_admin() then raise exception 'sem_permissao' using errcode = '42501'; end if;
  if char_length(v_nome) not between 2 and 30 then raise exception 'categoria_invalida'; end if;
  if not exists (select 1 from public.city_groups where slug = p_grupo) then raise exception 'grupo_invalido'; end if;
  if v_id is null then
    insert into public.city_categories (nome, grupo, status, descricao, imagem, criada_por)
    values (v_nome, p_grupo, 'ativa', nullif(btrim(coalesce(p_descricao, '')), ''), nullif(btrim(coalesce(p_imagem, '')), ''), auth.uid()) returning id into v_id;
  else
    update public.city_categories set nome = v_nome, grupo = p_grupo, status = 'ativa',
      descricao = nullif(btrim(coalesce(p_descricao, '')), ''), imagem = nullif(btrim(coalesce(p_imagem, '')), ''), grupo_sugerido = null
    where id = v_id;
    if not found then raise exception 'categoria_nao_encontrada'; end if;
  end if;
  return v_id;
exception when unique_violation then
  raise exception 'categoria_ja_existe';
end $$;
revoke all on function public.city_category_save(uuid, text, text, text, text) from public, anon;
grant execute on function public.city_category_save(uuid, text, text, text, text) to authenticated;

-- ---- 6) contadores das bolinhas -------------------------------------------------------------
create or replace function public.city_pending_counts()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.is_city_admin() then return jsonb_build_object('claims', 0, 'categorias', 0, 'denuncias', 0); end if;
  return jsonb_build_object(
    'claims', (select count(*) from public.city_claims where status = 'pendente'),
    'categorias', (select count(*) from public.city_categories where status = 'pendente'),
    'denuncias', (select count(*) from public.city_reports where status = 'aberta')
  );
end $$;
revoke all on function public.city_pending_counts() from public, anon;
grant execute on function public.city_pending_counts() to authenticated;

-- membro: cadastros novos na cidade dela desde a última visita (feitos por outras pessoas)
create or replace function public.city_new_count(p_since timestamptz)
returns int language sql stable security definer set search_path to 'public' as $$
  select count(*)::int from public.city_listings l
  where l.status = 'ativo' and l.criado_por is distinct from auth.uid() and l.criado_em > p_since
    and l.city_id = (select city_id from public.profiles where id = auth.uid());
$$;
revoke all on function public.city_new_count(timestamptz) from public, anon;
grant execute on function public.city_new_count(timestamptz) to authenticated;

-- ---- 7) lista de cadastros com a logo -------------------------------------------------------
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
      'faixa_preco', l.faixa_preco, 'horario', l.horario, 'horarios', l.horarios, 'foto', l.foto, 'logo', l.logo,
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
      'reivindicado', l.reivindicado_por is not null,
      'sou_dona', l.reivindicado_por = v_uid,
      'minha_reivindicacao', (select k.status from public.city_claims k where k.listing_id = l.id and k.user_id = v_uid order by k.criado_em desc limit 1),
      'pedido_em_aberto', exists (select 1 from public.city_claims k where k.listing_id = l.id and k.status in ('pendente','aprovada')),
      'destaque', exists (select 1 from public.city_highlights h where h.listing_id = l.id and h.status in ('active','past_due') and h.current_period_end + interval '3 days' > now()),
      'destaque_meu', (select h.status from public.city_highlights h where h.listing_id = l.id and h.user_id = v_uid and h.status in ('pending','active','past_due') limit 1),
      'destaque_meu_id', (select h.id from public.city_highlights h where h.listing_id = l.id and h.user_id = v_uid and h.status in ('pending','active','past_due') limit 1),
      'destaque_ate', (select h.current_period_end from public.city_highlights h where h.listing_id = l.id and h.user_id = v_uid and h.status in ('active','past_due') limit 1),
      'tags', coalesce((select jsonb_agg(t.tag_id) from public.city_listing_tags t where t.listing_id = l.id), '[]'::jsonb)
    ) as x
    from public.city_listings l
    join public.cidades c on c.id = l.city_id
    left join public.profiles p on p.id = l.criado_por
    where (p_city is null or l.city_id = p_city)
      and (not p_only_saved or exists (select 1 from public.city_saved s where s.listing_id = l.id and s.user_id = v_uid))
      and (l.status = 'ativo' or l.criado_por = v_uid or l.reivindicado_por = v_uid or v_admin)
    order by l.criado_em desc
    limit 1000
  ) q;
  return v;
end $$;

create or replace function public.city_admin_categories()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.is_city_admin() then raise exception 'sem_permissao' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', k.id, 'nome', k.nome, 'grupo', k.grupo, 'grupo_sugerido', k.grupo_sugerido, 'criada_em', k.criada_em,
      'criada_por_nome', nullif(split_part(btrim(coalesce(p.full_name, '')), ' ', 1), ''),
      'usos', (select count(*) from public.city_listings l where l.categoria_id = k.id)
    ) order by k.criada_em desc)
    from public.city_categories k left join public.profiles p on p.id = k.criada_por
    where k.status = 'pendente'
  ), '[]'::jsonb);
end $$;

commit;

-- ROLLBACK (manual): alter table city_listings drop column logo; alter table city_categories drop column descricao, drop column imagem,
--   drop column grupo_sugerido, drop constraint city_categories_grupo_fkey; drop table city_groups; (recriar o CHECK de grupo e as funções antigas)
