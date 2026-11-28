-- Rodada de 2026-11-27 (noite):
-- 1) Avulsos novos: Mom (R$ 9,80), Baby (R$ 9,80) e Casamento (R$ 11,90), também no Premium.
-- 2) Imagens novas do Painel: capa do Casamento e cards de Mom e Baby.
-- 3) Fluir & Florescer: 3 cards de pacotes de emagrecimento (frente e verso), cadastrados pela profissional.
-- 4) Gorro de Papai Noel na foto do topo: posição ajustável pela profissional.
-- 5) Casamento: gestão para os noivos (convidados, presentes, orçamento, fornecedores, checklist) e as
--    páginas públicas, sem login, de confirmação de presença (RSVP) e de reserva de presente.
-- Aditiva. Rollback no fim.
begin;

-- ---------------------------------------------------------------- 1) chaves de cobrança
alter table public.member_package_access drop constraint if exists member_package_access_package_check;
alter table public.member_package_access add constraint member_package_access_package_check check (
  package = any (array['help_nutri','ebooks','total','respiracao','playlist','wellness','leitura','premium','magazine','receitas','minha_lista','meu_chef','lista_inteligente','exercicios','series_filmes','viagens','carro','financas','rachei',
    'antes_de_tudo','agua','imc','calculadora','agenda','relogio','previsao','diario','jardim','cidade','cotacoes',
    'mom','baby','casamento']::text[])
);
alter table public.addon_subscriptions drop constraint if exists addon_subscriptions_plan_key_check;
alter table public.addon_subscriptions add constraint addon_subscriptions_plan_key_check check (
  plan_key = any (array['magazine','receitas','ebooks','help_nutri','respiracao','playlist','wellness','leitura','minha_lista','meu_chef','lista_inteligente','exercicios','series_filmes','viagens','carro','financas','rachei','premium','cesta',
    'antes_de_tudo','agua','imc','calculadora','agenda','relogio','previsao','diario','jardim','cidade','cotacoes',
    'mom','baby','casamento']::text[])
);

-- ---------------------------------------------------------------- 2) imagens do Painel
alter table public.community_card_images drop constraint if exists community_card_images_card_key_check;
alter table public.community_card_images add constraint community_card_images_card_key_check check (
  card_key = any (array['hoje','desafios','eventos','comunidade','jornada','instagram','eventos_grande','jornada_grande','comunidade_grande','jardim','novo_circulo','revista_escritorio','ferramenta_calendario','ferramenta_agua','ferramenta_imc','menu_leitura','menu_respiracao','menu_planos','menu_playlist','loja_fundo','menu_wellness','menu_lista','banner_cardapio','banner_exercicios','banner_series','banner_diario','banner_planos','menu_series','menu_viagens','menu_rachei','plano_frente','plano_premium','plano_mensal','plano_semestre','plano_anual','banner_lista','banner_cidade','hero_1','hero_2','hero_3','hero_4','hero_5','hero_6',
    'casamento_capa','card_mom','card_baby']::text[])
);

-- ---------------------------------------------------------------- 3) Fluir & Florescer
create table if not exists public.fluir_packages (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  position      smallint not null check (position between 1 and 3),
  front_path    text,
  back_path     text,
  title         text not null default '' check (char_length(title) <= 80),
  description   text not null default '' check (char_length(description) <= 4000),
  price_text    text not null default '' check (char_length(price_text) <= 300),
  payment_text  text not null default '' check (char_length(payment_text) <= 1000),
  faq_text      text not null default '' check (char_length(faq_text) <= 4000),
  updated_at    timestamptz not null default now(),
  unique (community_id, position)
);
alter table public.fluir_packages enable row level security;
drop policy if exists fluir_packages_read on public.fluir_packages;
create policy fluir_packages_read on public.fluir_packages for select to authenticated
  using (public.is_community_member(community_id) or public.owns_community(community_id));
drop policy if exists fluir_packages_write on public.fluir_packages;
create policy fluir_packages_write on public.fluir_packages for all to authenticated
  using (public.owns_community(community_id)) with check (public.owns_community(community_id));

-- ---------------------------------------------------------------- 4) gorro de Papai Noel
create table if not exists public.home_decor (
  community_id  uuid primary key references public.communities (id) on delete cascade,
  hat_enabled   boolean not null default true,
  hat_x         numeric(5,2) not null default 70 check (hat_x between 0 and 100),
  hat_y         numeric(5,2) not null default 55 check (hat_y between 0 and 100),
  hat_size      numeric(5,2) not null default 16 check (hat_size between 4 and 60),
  hat_rotate    numeric(5,1) not null default -12 check (hat_rotate between -90 and 90),
  snow_enabled  boolean not null default true,
  updated_at    timestamptz not null default now()
);
alter table public.home_decor enable row level security;
drop policy if exists home_decor_read on public.home_decor;
create policy home_decor_read on public.home_decor for select to authenticated
  using (public.is_community_member(community_id) or public.owns_community(community_id));
drop policy if exists home_decor_write on public.home_decor;
create policy home_decor_write on public.home_decor for all to authenticated
  using (public.owns_community(community_id)) with check (public.owns_community(community_id));

-- ---------------------------------------------------------------- 5) Casamento
create table if not exists public.weddings (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  partner_one   text not null default '' check (char_length(partner_one) <= 80),
  partner_two   text not null default '' check (char_length(partner_two) <= 80),
  wedding_date  date,
  venue         text not null default '' check (char_length(venue) <= 200),
  budget_cents  bigint not null default 0 check (budget_cents >= 0),
  share_code    text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  public_token  text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at    timestamptz not null default now()
);
create table if not exists public.wedding_members (
  wedding_id  uuid not null references public.weddings (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  role        text not null default 'partner' check (role in ('owner','partner')),
  created_at  timestamptz not null default now(),
  primary key (wedding_id, profile_id)
);
create index if not exists wedding_members_profile_idx on public.wedding_members (profile_id);

create or replace function public.is_wedding_member(p_wedding uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.wedding_members m where m.wedding_id = p_wedding and m.profile_id = auth.uid());
$$;
revoke all on function public.is_wedding_member(uuid) from public;
grant execute on function public.is_wedding_member(uuid) to authenticated;

create table if not exists public.wedding_guests (
  id            uuid primary key default gen_random_uuid(),
  wedding_id    uuid not null references public.weddings (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 120),
  status        text not null default 'pendente' check (status in ('pendente','confirmado','recusou')),
  companions    smallint not null default 0 check (companions between 0 and 20),
  side          text not null default 'ambos' check (side in ('noiva','noivo','ambos')),
  group_name    text not null default '' check (char_length(group_name) <= 80),
  phone         text not null default '' check (char_length(phone) <= 30),
  table_label   text not null default '' check (char_length(table_label) <= 30),
  dietary       text not null default '' check (char_length(dietary) <= 200),
  notes         text not null default '' check (char_length(notes) <= 1000),
  rsvp_token    text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 24),
  responded_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists wedding_guests_wedding_idx on public.wedding_guests (wedding_id, name);

create table if not exists public.wedding_gifts (
  id           uuid primary key default gen_random_uuid(),
  wedding_id   uuid not null references public.weddings (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 160),
  category     text not null default '' check (char_length(category) <= 60),
  value_cents  bigint not null default 0 check (value_cents >= 0),
  link         text not null default '' check (char_length(link) <= 500),
  status       text not null default 'disponivel' check (status in ('disponivel','reservado','comprado','recebido')),
  giver_name   text not null default '' check (char_length(giver_name) <= 120),
  thanked      boolean not null default false,
  reserved_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists wedding_gifts_wedding_idx on public.wedding_gifts (wedding_id, created_at);

create table if not exists public.wedding_vendors (
  id            uuid primary key default gen_random_uuid(),
  wedding_id    uuid not null references public.weddings (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 120),
  service       text not null default '' check (char_length(service) <= 80),
  contact       text not null default '' check (char_length(contact) <= 120),
  phone         text not null default '' check (char_length(phone) <= 30),
  email         text not null default '' check (char_length(email) <= 160),
  status        text not null default 'pesquisando' check (status in ('pesquisando','orcamento','contratado','descartado')),
  agreed_cents  bigint not null default 0 check (agreed_cents >= 0),
  notes         text not null default '' check (char_length(notes) <= 1000),
  created_at    timestamptz not null default now()
);
create index if not exists wedding_vendors_wedding_idx on public.wedding_vendors (wedding_id, name);

create table if not exists public.wedding_budget_items (
  id             uuid primary key default gen_random_uuid(),
  wedding_id     uuid not null references public.weddings (id) on delete cascade,
  item           text not null check (char_length(item) between 1 and 120),
  category       text not null default '' check (char_length(category) <= 60),
  planned_cents  bigint not null default 0 check (planned_cents >= 0),
  paid_cents     bigint not null default 0 check (paid_cents >= 0),
  status         text not null default 'a_contratar' check (status in ('a_contratar','contratado','pago')),
  vendor_id      uuid references public.wedding_vendors (id) on delete set null,
  due_date       date,
  notes          text not null default '' check (char_length(notes) <= 1000),
  created_at     timestamptz not null default now()
);
create index if not exists wedding_budget_wedding_idx on public.wedding_budget_items (wedding_id, created_at);

create table if not exists public.wedding_tasks (
  id             uuid primary key default gen_random_uuid(),
  wedding_id     uuid not null references public.weddings (id) on delete cascade,
  title          text not null check (char_length(title) between 1 and 160),
  months_before  numeric(4,1) not null default 1 check (months_before between 0 and 36),
  done           boolean not null default false,
  done_at        timestamptz,
  notes          text not null default '' check (char_length(notes) <= 1000),
  created_at     timestamptz not null default now()
);
create index if not exists wedding_tasks_wedding_idx on public.wedding_tasks (wedding_id, months_before desc);

alter table public.weddings enable row level security;
alter table public.wedding_members enable row level security;
alter table public.wedding_guests enable row level security;
alter table public.wedding_gifts enable row level security;
alter table public.wedding_vendors enable row level security;
alter table public.wedding_budget_items enable row level security;
alter table public.wedding_tasks enable row level security;

drop policy if exists weddings_select on public.weddings;
create policy weddings_select on public.weddings for select to authenticated using (public.is_wedding_member(id));
drop policy if exists weddings_insert on public.weddings;
create policy weddings_insert on public.weddings for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists weddings_update on public.weddings;
create policy weddings_update on public.weddings for update to authenticated using (public.is_wedding_member(id)) with check (public.is_wedding_member(id));
drop policy if exists weddings_delete on public.weddings;
create policy weddings_delete on public.weddings for delete to authenticated using (owner_id = auth.uid());

drop policy if exists wedding_members_select on public.wedding_members;
create policy wedding_members_select on public.wedding_members for select to authenticated using (public.is_wedding_member(wedding_id));
drop policy if exists wedding_members_delete on public.wedding_members;
create policy wedding_members_delete on public.wedding_members for delete to authenticated
  using (profile_id = auth.uid() or exists (select 1 from public.weddings w where w.id = wedding_id and w.owner_id = auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['wedding_guests','wedding_gifts','wedding_vendors','wedding_budget_items','wedding_tasks'] loop
    execute format('drop policy if exists %I on public.%I', t || '_all', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_wedding_member(wedding_id)) with check (public.is_wedding_member(wedding_id))', t || '_all', t);
  end loop;
end $$;

-- Ao criar o casamento: a dona entra como membro e o checklist já vem com 20 tarefas típicas.
create or replace function public.wedding_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.wedding_members (wedding_id, profile_id, role) values (new.id, new.owner_id, 'owner')
    on conflict do nothing;
  insert into public.wedding_tasks (wedding_id, title, months_before) values
    (new.id, 'Definir o orçamento total e quem ajuda a pagar', 12),
    (new.id, 'Escolher a data e o estilo da festa', 12),
    (new.id, 'Fazer a primeira lista de convidados', 12),
    (new.id, 'Reservar o local da cerimônia e da festa', 11),
    (new.id, 'Contratar assessoria ou cerimonial', 10),
    (new.id, 'Contratar buffet e bebidas', 10),
    (new.id, 'Contratar fotógrafo e filmagem', 9),
    (new.id, 'Contratar decoração e flores', 8),
    (new.id, 'Contratar banda ou DJ', 8),
    (new.id, 'Escolher o vestido e o traje do noivo', 8),
    (new.id, 'Enviar o "save the date"', 7),
    (new.id, 'Montar a lista de presentes', 6),
    (new.id, 'Escolher padrinhos e madrinhas', 6),
    (new.id, 'Dar entrada nos papéis do casamento civil no cartório', 4),
    (new.id, 'Encomendar convites, bolo e doces', 4),
    (new.id, 'Comprar as alianças', 3),
    (new.id, 'Enviar os convites e o link de confirmação', 2),
    (new.id, 'Fazer a prova de cabelo e maquiagem', 1.5),
    (new.id, 'Fechar o número final de convidados e o mapa de mesas', 1),
    (new.id, 'Confirmar horários com todos os fornecedores', 0.3);
  return new;
end $$;
drop trigger if exists weddings_after_insert on public.weddings;
create trigger weddings_after_insert after insert on public.weddings
  for each row execute function public.wedding_after_insert();

-- A outra pessoa do casal entra com o código de compartilhamento (precisa ter conta no Círcula).
create or replace function public.join_wedding(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
  select id into v_id from public.weddings where share_code = upper(trim(p_code));
  if v_id is null then raise exception 'Código não encontrado.'; end if;
  insert into public.wedding_members (wedding_id, profile_id, role) values (v_id, auth.uid(), 'partner')
    on conflict do nothing;
  return v_id;
end $$;
revoke all on function public.join_wedding(text) from public;
grant execute on function public.join_wedding(text) to authenticated;

-- Página pública de confirmação de presença (link único por convidado, sem login).
create or replace function public.public_rsvp_get(p_token text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'name', g.name, 'status', g.status, 'companions', g.companions, 'dietary', g.dietary,
    'partner_one', w.partner_one, 'partner_two', w.partner_two, 'wedding_date', w.wedding_date, 'venue', w.venue,
    'gifts_token', w.public_token)
  from public.wedding_guests g join public.weddings w on w.id = g.wedding_id
  where g.rsvp_token = p_token and char_length(p_token) >= 16;
$$;
create or replace function public.public_rsvp_answer(p_token text, p_status text, p_companions int, p_dietary text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('confirmado','recusou') then raise exception 'Resposta inválida.'; end if;
  update public.wedding_guests
     set status = p_status,
         companions = least(greatest(coalesce(p_companions, 0), 0), 20),
         dietary = left(coalesce(p_dietary, ''), 200),
         responded_at = now()
   where rsvp_token = p_token and char_length(p_token) >= 16;
  return found;
end $$;

-- Página pública da lista de presentes (link do casal, sem login): ver e reservar.
create or replace function public.public_gifts_get(p_token text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'partner_one', w.partner_one, 'partner_two', w.partner_two, 'wedding_date', w.wedding_date,
    'gifts', coalesce((select json_agg(json_build_object('id', g.id, 'name', g.name, 'category', g.category,
                 'value_cents', g.value_cents, 'link', g.link, 'available', g.status = 'disponivel') order by g.status <> 'disponivel', g.value_cents)
               from public.wedding_gifts g where g.wedding_id = w.id), '[]'::json))
  from public.weddings w where w.public_token = p_token and char_length(p_token) >= 16;
$$;
create or replace function public.public_gift_reserve(p_token text, p_gift uuid, p_name text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_wid uuid;
begin
  if coalesce(char_length(trim(p_name)), 0) < 2 then raise exception 'Informe o seu nome.'; end if;
  select id into v_wid from public.weddings where public_token = p_token and char_length(p_token) >= 16;
  if v_wid is null then return false; end if;
  update public.wedding_gifts
     set status = 'reservado', giver_name = left(trim(p_name), 120), reserved_at = now()
   where id = p_gift and wedding_id = v_wid and status = 'disponivel';
  return found;
end $$;
revoke all on function public.public_rsvp_get(text) from public;
revoke all on function public.public_rsvp_answer(text, text, int, text) from public;
revoke all on function public.public_gifts_get(text) from public;
revoke all on function public.public_gift_reserve(text, uuid, text) from public;
grant execute on function public.public_rsvp_get(text) to anon, authenticated;
grant execute on function public.public_rsvp_answer(text, text, int, text) to anon, authenticated;
grant execute on function public.public_gifts_get(text) to anon, authenticated;
grant execute on function public.public_gift_reserve(text, uuid, text) to anon, authenticated;

commit;

-- rollback:
--   drop function public.public_gift_reserve(text, uuid, text), public.public_gifts_get(text),
--     public.public_rsvp_answer(text, text, int, text), public.public_rsvp_get(text), public.join_wedding(text);
--   drop trigger weddings_after_insert on public.weddings; drop function public.wedding_after_insert();
--   drop table public.wedding_tasks, public.wedding_budget_items, public.wedding_vendors, public.wedding_gifts,
--     public.wedding_guests, public.wedding_members, public.weddings; drop function public.is_wedding_member(uuid);
--   drop table public.home_decor, public.fluir_packages;
--   apagar as linhas com 'mom','baby','casamento' e 'casamento_capa','card_mom','card_baby' e recriar os CHECKs
--   de 20261227130000_ferramentas_pagas.sql e 20261227120000_planos_cartoes_semestre_anual.sql.
