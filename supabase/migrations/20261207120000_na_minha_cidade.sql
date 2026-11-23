-- =====================================================================
-- "Na minha cidade": cadastros locais por cidade (guia de lugares e
-- profissionais, eventos e convites "Vamos juntas?"). SEM chat.
--
--  • cidades: a página da cidade nasce quando a primeira participante a escolhe
--    (RPC choose_city; a lista de municípios vem do IBGE, no app);
--  • profiles ganha city_id e state (a cidade onde a participante mora no Círcula);
--  • um único modelo de cadastro (city_listings) com "tipo":
--    lugar, profissional, evento ou convite;
--  • categorias (Grupo > Categoria) e tags são GLOBAIS (valem para o Brasil todo);
--  • "Também indico" (1 voto por participante), "Salvar" (Meus salvos),
--    "Quero ir" (confirmações) e denúncias;
--  • a administração (master e a nutricionista) oculta/exclui qualquer cadastro,
--    resolve denúncias e cuida das categorias criadas pelas participantes;
--  • o banco repete a checagem de palavras ofensivas e, em Saúde, bloqueia
--    promessa de cura, "antes e depois" e preço de procedimento.
-- Também: my_invite_count() (quantas amigas entraram pelo convite da participante).
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- Apoio
-- ---------------------------------------------------------------------
create or replace function public.is_city_admin()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('master', 'professional'));
$$;
revoke all on function public.is_city_admin() from public, anon;
grant execute on function public.is_city_admin() to authenticated;

-- minúsculas, sem acento, sem pontuação e SEM plural (cada palavra com mais de
-- 3 letras perde o "s" final): "Eletricistas" e "eletricista" ficam iguais.
create or replace function public.city_normalize(p text)
returns text language sql immutable set search_path to 'public' as $$
  select btrim(regexp_replace(
    regexp_replace(
      regexp_replace(
        translate(lower(coalesce(p, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
        '[^a-z0-9 ]', ' ', 'g'),
      '(\w{3,})s(\s|$)', '\1\2', 'g'),
    '\s+', ' ', 'g'))
$$;

-- ---------------------------------------------------------------------
-- Cidades
-- ---------------------------------------------------------------------
create table if not exists public.cidades (
  id        uuid primary key default gen_random_uuid(),
  estado    char(2) not null,
  nome      text not null check (char_length(nome) between 2 and 120),
  ibge_id   integer not null unique,
  criada_em timestamptz not null default now()
);
create index if not exists cidades_estado_idx on public.cidades (estado);

alter table public.profiles add column if not exists city_id uuid references public.cidades (id) on delete set null;
alter table public.profiles add column if not exists state char(2);
create index if not exists profiles_city_id_idx on public.profiles (city_id) where city_id is not null;

-- ---------------------------------------------------------------------
-- Categorias e tags (globais)
-- ---------------------------------------------------------------------
create table if not exists public.city_categories (
  id                uuid primary key default gen_random_uuid(),
  nome              text not null check (char_length(btrim(nome)) between 2 and 30),
  nome_normalizado  text not null,
  grupo             text not null check (grupo in ('comer','compras','beleza','saude','esporte','casa','carros','servicos','familia','pets','lazer','eventos','tecnologia','outros')),
  criada_por        uuid references public.profiles (id) on delete set null,
  status            text not null default 'ativa' check (status in ('ativa','pendente','unida')),
  unida_a           uuid references public.city_categories (id) on delete set null,
  criada_em         timestamptz not null default now(),
  unique (grupo, nome_normalizado)
);

create or replace function public.city_categories_fill()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  new.nome := btrim(new.nome);
  new.nome_normalizado := public.city_normalize(new.nome);
  if new.nome_normalizado = '' then raise exception 'categoria_invalida'; end if;
  return new;
end $$;
drop trigger if exists city_categories_fill on public.city_categories;
create trigger city_categories_fill before insert or update of nome on public.city_categories
  for each row execute function public.city_categories_fill();

create table if not exists public.city_tags (
  id   uuid primary key default gen_random_uuid(),
  nome text not null unique,
  tipo text not null check (tipo in ('perfil','alimentacao','selo','pagamento'))
);

-- ---------------------------------------------------------------------
-- Cadastros (lugar, profissional, evento, convite)
-- ---------------------------------------------------------------------
create table if not exists public.city_listings (
  id                  uuid primary key default gen_random_uuid(),
  city_id             uuid not null references public.cidades (id) on delete cascade,
  tipo                text not null check (tipo in ('lugar','profissional','evento','convite')),
  categoria_id        uuid references public.city_categories (id) on delete restrict,
  titulo              text not null check (char_length(btrim(titulo)) between 2 and 120),
  descricao           text check (descricao is null or char_length(descricao) <= 1200),
  bairro              text check (bairro is null or char_length(bairro) <= 80),
  endereco            text check (endereco is null or char_length(endereco) <= 200),
  contato             text check (contato is null or char_length(contato) <= 120),
  instagram           text check (instagram is null or char_length(instagram) <= 80),
  faixa_preco         text check (faixa_preco in ('$','$$','$$$')),
  horario             text check (horario is null or char_length(horario) <= 120),
  foto                text,
  criado_por          uuid not null references public.profiles (id) on delete cascade,
  e_proprio_negocio   boolean not null default false,
  atende_toda_cidade  boolean not null default false,
  status              text not null default 'ativo' check (status in ('ativo','oculto')),
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  -- evento e convite
  starts_at           timestamptz,
  local_nome          text check (local_nome is null or char_length(local_nome) <= 160),
  valor               text check (valor is null or char_length(valor) <= 60),
  link                text check (link is null or char_length(link) <= 300),
  atividade           text check (atividade is null or char_length(atividade) <= 60),
  vagas               integer check (vagas is null or vagas between 1 and 500),
  nivel               text check (nivel in ('iniciante','todas')),
  check (tipo = 'convite' or categoria_id is not null),
  check (tipo not in ('evento','convite') or starts_at is not null)
);
create index if not exists city_listings_city_idx on public.city_listings (city_id, tipo, criado_em desc);
create index if not exists city_listings_categoria_idx on public.city_listings (categoria_id);
create index if not exists city_listings_autora_idx on public.city_listings (criado_por);

create table if not exists public.city_listing_tags (
  listing_id uuid not null references public.city_listings (id) on delete cascade,
  tag_id     uuid not null references public.city_tags (id) on delete cascade,
  primary key (listing_id, tag_id)
);

create table if not exists public.city_listing_votes (
  listing_id uuid not null references public.city_listings (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (listing_id, user_id)
);

create table if not exists public.city_saved (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.city_listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table if not exists public.city_meetup_rsvps (
  listing_id uuid not null references public.city_listings (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (listing_id, user_id)
);

create table if not exists public.city_reports (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references public.city_listings (id) on delete cascade,
  reported_by uuid not null references public.profiles (id) on delete cascade,
  motivo      text check (motivo is null or char_length(motivo) <= 500),
  status      text not null default 'aberta' check (status in ('aberta','resolvida')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  unique (listing_id, reported_by)
);
create index if not exists city_reports_status_idx on public.city_reports (status, created_at desc);

-- ---------------------------------------------------------------------
-- Regras do cadastro (servidor)
-- ---------------------------------------------------------------------
create or replace function public.city_listing_guard()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid   uuid := auth.uid();
  v_admin boolean := public.is_city_admin();
  v_group text;
  v_txt   text;
begin
  if tg_op = 'INSERT' then
    if v_uid is not null then
      new.criado_por := v_uid;
      if not v_admin then new.status := 'ativo'; end if;
    end if;
  else
    new.criado_por := old.criado_por;
    new.city_id := old.city_id;
    new.tipo := old.tipo;
    if not v_admin then new.status := old.status; end if;
  end if;
  new.atualizado_em := now();

  v_txt := concat_ws(' ', new.titulo, new.descricao, new.bairro, new.local_nome, new.atividade, new.valor, new.horario);
  if public.text_has_blocked_term(v_txt, null) then
    raise exception 'conteudo_bloqueado' using errcode = 'check_violation';
  end if;

  if new.categoria_id is not null then
    select grupo into v_group from public.city_categories where id = new.categoria_id;
  end if;
  -- Saúde: sem promessa de cura, "antes e depois" ou preço de procedimento.
  if v_group = 'saude'
     and (lower(v_txt) ~ '\y(cura|curamos|curar|garantimos|garantido|garantida|garantia)\y|antes e depois|r\$') then
    raise exception 'saude_texto_proibido' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists city_listing_guard on public.city_listings;
create trigger city_listing_guard before insert or update on public.city_listings
  for each row execute function public.city_listing_guard();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.cidades            enable row level security;
alter table public.city_categories    enable row level security;
alter table public.city_tags          enable row level security;
alter table public.city_listings      enable row level security;
alter table public.city_listing_tags  enable row level security;
alter table public.city_listing_votes enable row level security;
alter table public.city_saved         enable row level security;
alter table public.city_meetup_rsvps  enable row level security;
alter table public.city_reports       enable row level security;

drop policy if exists "cidades_select" on public.cidades;
create policy "cidades_select" on public.cidades for select to authenticated using (true);
drop policy if exists "city_categories_select" on public.city_categories;
create policy "city_categories_select" on public.city_categories for select to authenticated using (true);
drop policy if exists "city_tags_select" on public.city_tags;
create policy "city_tags_select" on public.city_tags for select to authenticated using (true);

drop policy if exists "city_listings_select" on public.city_listings;
create policy "city_listings_select" on public.city_listings for select to authenticated
  using (status = 'ativo' or criado_por = auth.uid() or public.is_city_admin());
drop policy if exists "city_listings_insert" on public.city_listings;
create policy "city_listings_insert" on public.city_listings for insert to authenticated
  with check (criado_por = auth.uid());
drop policy if exists "city_listings_update" on public.city_listings;
create policy "city_listings_update" on public.city_listings for update to authenticated
  using (criado_por = auth.uid() or public.is_city_admin())
  with check (criado_por = auth.uid() or public.is_city_admin());
drop policy if exists "city_listings_delete" on public.city_listings;
create policy "city_listings_delete" on public.city_listings for delete to authenticated
  using (criado_por = auth.uid() or public.is_city_admin());

drop policy if exists "city_listing_tags_select" on public.city_listing_tags;
create policy "city_listing_tags_select" on public.city_listing_tags for select to authenticated using (true);
drop policy if exists "city_listing_tags_write" on public.city_listing_tags;
create policy "city_listing_tags_write" on public.city_listing_tags for all to authenticated
  using (exists (select 1 from public.city_listings l where l.id = listing_id and (l.criado_por = auth.uid() or public.is_city_admin())))
  with check (exists (select 1 from public.city_listings l where l.id = listing_id and (l.criado_por = auth.uid() or public.is_city_admin())));

drop policy if exists "city_votes_select_own" on public.city_listing_votes;
create policy "city_votes_select_own" on public.city_listing_votes for select to authenticated using (user_id = auth.uid());
drop policy if exists "city_votes_insert_own" on public.city_listing_votes;
create policy "city_votes_insert_own" on public.city_listing_votes for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.city_listings l where l.id = listing_id and l.status = 'ativo' and l.tipo in ('lugar','profissional')));
drop policy if exists "city_votes_delete_own" on public.city_listing_votes;
create policy "city_votes_delete_own" on public.city_listing_votes for delete to authenticated using (user_id = auth.uid());

drop policy if exists "city_saved_own" on public.city_saved;
create policy "city_saved_own" on public.city_saved for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "city_rsvps_select_own" on public.city_meetup_rsvps;
create policy "city_rsvps_select_own" on public.city_meetup_rsvps for select to authenticated using (user_id = auth.uid());

drop policy if exists "city_reports_insert" on public.city_reports;
create policy "city_reports_insert" on public.city_reports for insert to authenticated
  with check (reported_by = auth.uid());
drop policy if exists "city_reports_admin_select" on public.city_reports;
create policy "city_reports_admin_select" on public.city_reports for select to authenticated
  using (public.is_city_admin() or reported_by = auth.uid());
drop policy if exists "city_reports_admin_update" on public.city_reports;
create policy "city_reports_admin_update" on public.city_reports for update to authenticated
  using (public.is_city_admin()) with check (public.is_city_admin());

revoke all on table public.cidades, public.city_categories, public.city_tags, public.city_listings,
  public.city_listing_tags, public.city_listing_votes, public.city_saved, public.city_meetup_rsvps,
  public.city_reports from public, anon, authenticated;
grant select on table public.cidades, public.city_categories, public.city_tags, public.city_listing_tags to authenticated;
grant select, insert, update, delete on table public.city_listings to authenticated;
grant insert, delete on table public.city_listing_tags to authenticated;
grant select, insert, delete on table public.city_listing_votes to authenticated;
grant select, insert, delete on table public.city_saved to authenticated;
grant select on table public.city_meetup_rsvps to authenticated;
grant select, insert, update on table public.city_reports to authenticated;
grant all on table public.cidades, public.city_categories, public.city_tags, public.city_listings,
  public.city_listing_tags, public.city_listing_votes, public.city_saved, public.city_meetup_rsvps,
  public.city_reports to service_role;

-- ---------------------------------------------------------------------
-- RPCs da participante
-- ---------------------------------------------------------------------

-- Escolhe (ou troca) a cidade. A página da cidade é criada aqui, na primeira escolha.
create or replace function public.choose_city(p_ibge_id integer, p_uf text, p_nome text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid  uuid := auth.uid();
  v_uf   text := upper(btrim(coalesce(p_uf, '')));
  v_nome text := btrim(coalesce(p_nome, ''));
  v_id   uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if v_uf not in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO') then
    raise exception 'estado_invalido';
  end if;
  if p_ibge_id is null or p_ibge_id < 1100000 or p_ibge_id > 5399999 or char_length(v_nome) not between 2 and 120 then
    raise exception 'cidade_invalida';
  end if;
  insert into public.cidades (estado, nome, ibge_id) values (v_uf, v_nome, p_ibge_id)
  on conflict (ibge_id) do nothing;
  select id into v_id from public.cidades where ibge_id = p_ibge_id;
  update public.profiles
     set city_id = v_id, state = v_uf,
         city = case when city is null or btrim(city) = '' then v_nome else city end
   where id = v_uid;
  return v_id;
end $$;
revoke all on function public.choose_city(integer, text, text) from public, anon;
grant execute on function public.choose_city(integer, text, text) to authenticated;

-- A cidade da participante, com os números do card da Home.
create or replace function public.my_city()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_city uuid; r jsonb;
begin
  select city_id into v_city from public.profiles where id = auth.uid();
  if v_city is null then return null; end if;
  return public.city_info(v_city);
end $$;
revoke all on function public.my_city() from public, anon;
grant execute on function public.my_city() to authenticated;

create or replace function public.city_info(p_city uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'id', c.id, 'estado', c.estado, 'nome', c.nome, 'ibge_id', c.ibge_id,
    'mulheres', (select count(*) from public.profiles p where p.city_id = c.id),
    'cadastros', (select count(*) from public.city_listings l where l.city_id = c.id and l.status = 'ativo')
  )
  from public.cidades c where c.id = p_city and auth.uid() is not null;
$$;
revoke all on function public.city_info(uuid) from public, anon;
grant execute on function public.city_info(uuid) to authenticated;

-- Cadastros de uma cidade (ou os salvos da participante, de qualquer cidade).
-- Só primeiro nome e foto de quem criou; nunca telefone nem endereço de residência.
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
      'faixa_preco', l.faixa_preco, 'horario', l.horario, 'foto', l.foto,
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
revoke all on function public.list_city_listings(uuid, boolean) from public, anon;
grant execute on function public.list_city_listings(uuid, boolean) to authenticated;

-- "Quero ir": entra ou sai de um convite (respeita o número de vagas).
create or replace function public.city_meetup_toggle(p_listing uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); l public.city_listings; v_n integer; v_going boolean;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into l from public.city_listings where id = p_listing and tipo = 'convite' and status = 'ativo';
  if not found then raise exception 'convite_nao_encontrado'; end if;
  if l.criado_por = v_uid then raise exception 'convite_proprio'; end if;
  if exists (select 1 from public.city_meetup_rsvps where listing_id = p_listing and user_id = v_uid) then
    delete from public.city_meetup_rsvps where listing_id = p_listing and user_id = v_uid;
    v_going := false;
  else
    select count(*) into v_n from public.city_meetup_rsvps where listing_id = p_listing;
    if l.vagas is not null and v_n >= l.vagas then raise exception 'sem_vagas'; end if;
    insert into public.city_meetup_rsvps (listing_id, user_id) values (p_listing, v_uid);
    v_going := true;
  end if;
  select count(*) into v_n from public.city_meetup_rsvps where listing_id = p_listing;
  return jsonb_build_object('going', v_going, 'count', v_n);
end $$;
revoke all on function public.city_meetup_toggle(uuid) from public, anon;
grant execute on function public.city_meetup_toggle(uuid) to authenticated;

-- Quem confirmou (só o primeiro nome): somente a criadora do convite e a administração.
create or replace function public.city_meetup_attendees(p_listing uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_owner uuid;
begin
  select criado_por into v_owner from public.city_listings where id = p_listing;
  if v_uid is null or v_owner is null or (v_owner <> v_uid and not public.is_city_admin()) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'nome', coalesce(nullif(split_part(btrim(coalesce(p.full_name, '')), ' ', 1), ''), 'Participante'),
      'avatar', p.avatar_url) order by r.created_at)
    from public.city_meetup_rsvps r left join public.profiles p on p.id = r.user_id
    where r.listing_id = p_listing
  ), '[]'::jsonb);
end $$;
revoke all on function public.city_meetup_attendees(uuid) from public, anon;
grant execute on function public.city_meetup_attendees(uuid) to authenticated;

-- Cria categoria nova (fica disponível na hora; a administração revisa depois).
-- Se já existe uma igual ou parecida, devolve a existente em vez de duplicar.
create or replace function public.create_city_category(p_nome text, p_grupo text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_nome text := btrim(coalesce(p_nome, '')); v_norm text; v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if char_length(v_nome) not between 2 and 30 then raise exception 'categoria_invalida'; end if;
  if public.text_has_blocked_term(v_nome, null) then
    raise exception 'conteudo_bloqueado' using errcode = 'check_violation';
  end if;
  v_norm := public.city_normalize(v_nome);
  select id into v_id from public.city_categories where nome_normalizado = v_norm and status <> 'unida'
   order by (grupo = p_grupo) desc limit 1;
  if v_id is not null then return jsonb_build_object('id', v_id, 'existing', true); end if;
  insert into public.city_categories (nome, grupo, criada_por, status)
  values (v_nome, p_grupo, v_uid, 'pendente') returning id into v_id;
  return jsonb_build_object('id', v_id, 'existing', false);
end $$;
revoke all on function public.create_city_category(text, text) from public, anon;
grant execute on function public.create_city_category(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- RPCs da administração
-- ---------------------------------------------------------------------
create or replace function public.city_admin_categories()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.is_city_admin() then raise exception 'sem_permissao' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', k.id, 'nome', k.nome, 'grupo', k.grupo, 'criada_em', k.criada_em,
      'criada_por_nome', nullif(split_part(btrim(coalesce(p.full_name, '')), ' ', 1), ''),
      'usos', (select count(*) from public.city_listings l where l.categoria_id = k.id)
    ) order by k.criada_em desc)
    from public.city_categories k left join public.profiles p on p.id = k.criada_por
    where k.status = 'pendente'
  ), '[]'::jsonb);
end $$;
revoke all on function public.city_admin_categories() from public, anon;
grant execute on function public.city_admin_categories() to authenticated;

create or replace function public.city_category_admin(p_id uuid, p_action text, p_value text default null, p_into uuid default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare k public.city_categories; v_outros uuid;
begin
  if not public.is_city_admin() then raise exception 'sem_permissao' using errcode = '42501'; end if;
  select * into k from public.city_categories where id = p_id;
  if not found then raise exception 'categoria_nao_encontrada'; end if;
  if p_action = 'aprovar' then
    update public.city_categories set status = 'ativa' where id = p_id;
  elsif p_action = 'renomear' then
    if char_length(btrim(coalesce(p_value, ''))) not between 2 and 30 then raise exception 'categoria_invalida'; end if;
    update public.city_categories set nome = p_value, status = 'ativa' where id = p_id;
  elsif p_action = 'unir' then
    if p_into is null or p_into = p_id then raise exception 'categoria_invalida'; end if;
    update public.city_listings set categoria_id = p_into where categoria_id = p_id;
    update public.city_categories set status = 'unida', unida_a = p_into where id = p_id;
  elsif p_action = 'remover' then
    select id into v_outros from public.city_categories where grupo = 'outros' and status = 'ativa' order by criada_em limit 1;
    update public.city_listings set categoria_id = v_outros where categoria_id = p_id;
    delete from public.city_categories where id = p_id;
  else
    raise exception 'acao_invalida';
  end if;
end $$;
revoke all on function public.city_category_admin(uuid, text, text, uuid) from public, anon;
grant execute on function public.city_category_admin(uuid, text, text, uuid) to authenticated;

create or replace function public.city_admin_reports()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.is_city_admin() then raise exception 'sem_permissao' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id, 'listing_id', l.id, 'motivo', r.motivo, 'criada_em', r.created_at,
      'titulo', l.titulo, 'tipo', l.tipo, 'descricao', l.descricao, 'status_cadastro', l.status,
      'cidade', c.nome, 'estado', c.estado,
      'autora_nome', nullif(split_part(btrim(coalesce(a.full_name, '')), ' ', 1), ''),
      'denunciante_nome', nullif(split_part(btrim(coalesce(d.full_name, '')), ' ', 1), '')
    ) order by r.created_at desc)
    from public.city_reports r
    join public.city_listings l on l.id = r.listing_id
    join public.cidades c on c.id = l.city_id
    left join public.profiles a on a.id = l.criado_por
    left join public.profiles d on d.id = r.reported_by
    where r.status = 'aberta'
  ), '[]'::jsonb);
end $$;
revoke all on function public.city_admin_reports() from public, anon;
grant execute on function public.city_admin_reports() to authenticated;

create or replace function public.city_report_resolve(p_report uuid, p_action text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_listing uuid;
begin
  if not public.is_city_admin() then raise exception 'sem_permissao' using errcode = '42501'; end if;
  select listing_id into v_listing from public.city_reports where id = p_report;
  if v_listing is null then raise exception 'denuncia_nao_encontrada'; end if;
  if p_action = 'ocultar' then
    update public.city_listings set status = 'oculto' where id = v_listing;
    update public.city_reports set status = 'resolvida', resolved_at = now() where listing_id = v_listing;
  elsif p_action = 'excluir' then
    delete from public.city_listings where id = v_listing; -- apaga as denúncias em cascata
  elsif p_action = 'ignorar' then
    update public.city_reports set status = 'resolvida', resolved_at = now() where id = p_report;
  else
    raise exception 'acao_invalida';
  end if;
end $$;
revoke all on function public.city_report_resolve(uuid, text) from public, anon;
grant execute on function public.city_report_resolve(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Convite: quantas amigas entraram pelo convite da participante
-- (a participante que convida ganha 10% de desconto no próximo ciclo).
-- ---------------------------------------------------------------------
create or replace function public.my_invite_count()
returns integer language sql stable security definer set search_path to 'public' as $$
  select count(*)::integer from public.referrals where inviter_id = auth.uid();
$$;
revoke all on function public.my_invite_count() from public, anon;
grant execute on function public.my_invite_count() to authenticated;

-- ---------------------------------------------------------------------
-- Sementes: categorias (Grupo > Categoria) e tags
-- ---------------------------------------------------------------------
insert into public.city_categories (nome, grupo, status)
select n, g, 'ativa' from (values
  ('Restaurantes','comer'),('Cafés','comer'),('Padarias','comer'),('Confeitarias e doces','comer'),('Sorveterias','comer'),
  ('Pizzarias','comer'),('Hamburguerias','comer'),('Churrascarias','comer'),('Comida japonesa','comer'),('Comida italiana','comer'),
  ('Comida regional','comer'),('Marmitas e delivery','comer'),('Bares','comer'),('Pubs e cervejarias','comer'),('Vinhos e adegas','comer'),
  ('Docerias e brigadeiros','comer'),('Hortifrúti','comer'),('Açougues','comer'),('Empórios e produtos naturais','comer'),('Feiras e produtores locais','comer'),
  ('Moda feminina','compras'),('Moda infantil','compras'),('Moda praia','compras'),('Calçados','compras'),('Bolsas e acessórios','compras'),
  ('Joias e bijuterias','compras'),('Lingerie','compras'),('Presentes','compras'),('Floricultura','compras'),('Papelaria','compras'),
  ('Livrarias','compras'),('Decoração','compras'),('Utilidades para a casa','compras'),('Artesanato','compras'),('Brechós','compras'),
  ('Eletrônicos','compras'),('Perfumaria e cosméticos','compras'),('Ótica','compras'),('Pet shop','compras'),('Brinquedos','compras'),('Material de construção','compras'),
  ('Salão de beleza','beleza'),('Manicure e pedicure','beleza'),('Estética facial e corporal','beleza'),('Depilação','beleza'),('Maquiagem','beleza'),
  ('Sobrancelhas e cílios','beleza'),('Barbearia','beleza'),('Spa e massagem','beleza'),('Terapias integrativas','beleza'),
  ('Clínicas','saude'),('Médicas','saude'),('Dentistas','saude'),('Psicólogas e terapeutas','saude'),('Fisioterapia','saude'),
  ('Nutrição','saude'),('Fonoaudiologia','saude'),('Laboratórios','saude'),('Farmácias','saude'),('Veterinários','saude'),
  ('Saúde da mulher','saude'),
  ('Academias','esporte'),('Pilates','esporte'),('Yoga','esporte'),('Corrida e caminhada','esporte'),('Natação','esporte'),
  ('Dança','esporte'),('Lutas','esporte'),('Beach tênis e quadra','esporte'),('Personal trainer','esporte'),('Pedalada','esporte'),('Trilhas','esporte'),
  ('Pedreiro','casa'),('Eletricista','casa'),('Encanador','casa'),('Pintor','casa'),('Marceneiro','casa'),('Vidraceiro','casa'),
  ('Serralheiro','casa'),('Gesseiro','casa'),('Arquiteta e engenheira','casa'),('Ar-condicionado','casa'),('Jardinagem e paisagismo','casa'),
  ('Diarista e limpeza','casa'),('Dedetização','casa'),('Chaveiro','casa'),('Mudanças e fretes','casa'),('Reparos em geral','casa'),('Instalação de móveis','casa'),
  ('Mecânica','carros'),('Lava-jato','carros'),('Funilaria e pintura','carros'),('Auto elétrica','carros'),('Borracharia','carros'),
  ('Motorista particular','carros'),('Transporte escolar','carros'),('Táxi e aplicativos','carros'),('Aluguel de carros','carros'),
  ('Contabilidade','servicos'),('Advocacia','servicos'),('Corretora de imóveis','servicos'),('Seguros','servicos'),('Consultoria financeira','servicos'),
  ('Design e marketing','servicos'),('Fotografia e vídeo','servicos'),('Tradução','servicos'),('Costura e ajustes','servicos'),('Gráfica','servicos'),('Coworking','servicos'),
  ('Escolas','familia'),('Escolinhas de esportes','familia'),('Aulas particulares','familia'),('Cursos e idiomas','familia'),('Babá e cuidadoras','familia'),
  ('Creches','familia'),('Atividades para crianças','familia'),('Festas infantis','familia'),('Cuidadora de idosos','familia'),
  ('Pet shop','pets'),('Banho e tosa','pets'),('Veterinário','pets'),('Adestramento','pets'),('Hotel para pets','pets'),('Passeadora de cães','pets'),
  ('Passeios','lazer'),('Parques e praças','lazer'),('Pontos turísticos','lazer'),('Hospedagem','lazer'),('Cinemas e teatros','lazer'),
  ('Museus e cultura','lazer'),('Espaços para eventos','lazer'),('Espaços para festas','lazer'),('Clubes','lazer'),
  ('Buffet','eventos'),('Decoração de festas','eventos'),('Cerimonial','eventos'),('DJ e música','eventos'),('Aluguel de equipamentos','eventos'),
  ('Fotografia de eventos','eventos'),('Lembrancinhas','eventos'),
  ('Assistência técnica de celular','tecnologia'),('Computadores','tecnologia'),('Internet e redes','tecnologia'),('Eletrodomésticos','tecnologia'),('Câmeras e segurança','tecnologia'),
  ('Outros','outros')
) as s(n, g)
on conflict (grupo, nome_normalizado) do nothing;

insert into public.city_tags (nome, tipo) values
  ('Pet friendly','perfil'),('Kids friendly','perfil'),('Ambiente tranquilo','perfil'),('Bom para ir sozinha','perfil'),
  ('Bom para grupo','perfil'),('Acessível','perfil'),('Estacionamento','perfil'),('Wi-Fi','perfil'),('Ar livre','perfil'),
  ('Delivery','perfil'),('Atende em domicílio','perfil'),('Atende online','perfil'),('Agendamento','perfil'),
  ('Vegano','alimentacao'),('Vegetariano','alimentacao'),('Sem glúten','alimentacao'),('Sem lactose','alimentacao'),
  ('Opções saudáveis','alimentacao'),('Sem açúcar','alimentacao'),('Produto local ou artesanal','alimentacao'),
  ('Feito por mulheres','selo'),('Negócio de mulher','selo'),
  ('Aceita Pix','pagamento'),('Aceita cartão','pagamento')
on conflict (nome) do nothing;

commit;

-- ROLLBACK (manual):
--   drop table city_reports, city_meetup_rsvps, city_saved, city_listing_votes, city_listing_tags,
--     city_listings, city_tags, city_categories cascade;
--   alter table profiles drop column city_id, drop column state; drop table cidades;
--   drop function choose_city, my_city, city_info, list_city_listings, city_meetup_toggle,
--     city_meetup_attendees, create_city_category, city_admin_categories, city_category_admin,
--     city_admin_reports, city_report_resolve, my_invite_count, city_listing_guard, city_normalize,
--     city_categories_fill, is_city_admin;
