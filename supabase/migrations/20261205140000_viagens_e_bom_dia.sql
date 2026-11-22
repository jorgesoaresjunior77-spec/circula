-- =====================================================================
-- Rodada 21/11/2026
--  1) Plano "Dicas de Viagem" (pacote 'viagens', R$ 5,90): pacote, assinatura
--     avulsa e preço editável aceitam a nova chave.
--  2) Chaves novas de imagem dos cards: menu_series, menu_viagens (faixa
--     fina) e banner_lista (card "Lista de compras").
--  3) Dicas de Viagem: travel_places (os destinos) e travel_images (fundo
--     9:16 e capas dos cards de estado/cidade/para quem). Leitura só para
--     quem tem o plano ou o Premium; escrita só da dona.
--  4) Bom dia da Marluce no Feed, todo dia às 5h (Brasília), com pg_cron.
-- Aditiva e reversível (rollback no fim).
-- =====================================================================
begin;

-- ---- 1) pacote e assinatura ------------------------------------------
alter table public.member_package_access drop constraint if exists member_package_access_package_check;
alter table public.member_package_access add constraint member_package_access_package_check check (
  package in ('help_nutri','ebooks','total','respiracao','playlist','wellness','leitura','premium','magazine','receitas','minha_lista','meu_chef','lista_inteligente','exercicios','series_filmes','viagens')
);
alter table public.addon_subscriptions drop constraint if exists addon_subscriptions_plan_key_check;
alter table public.addon_subscriptions add constraint addon_subscriptions_plan_key_check check (plan_key in (
  'magazine','receitas','ebooks','help_nutri','respiracao','playlist','wellness','leitura','minha_lista','meu_chef','lista_inteligente','exercicios','series_filmes','viagens','premium'
));
alter table public.product_price_overrides drop constraint if exists product_price_overrides_plan_key_check;
alter table public.product_price_overrides add constraint product_price_overrides_plan_key_check
  check (plan_key in ('exercicios','series_filmes','viagens'));

-- ---- 2) imagens dos cards ------------------------------------------------
alter table public.community_card_images drop constraint if exists community_card_images_card_key_check;
alter table public.community_card_images add constraint community_card_images_card_key_check check (
  card_key = any (array['hoje','desafios','eventos','comunidade','jornada','instagram','eventos_grande','jornada_grande','comunidade_grande','jardim','novo_circulo','revista_escritorio','ferramenta_calendario','ferramenta_agua','ferramenta_imc','menu_leitura','menu_respiracao','menu_planos','menu_playlist','loja_fundo','menu_wellness','menu_lista','banner_cardapio','banner_exercicios','banner_series','banner_diario','banner_planos','menu_series','menu_viagens','banner_lista']::text[])
);

-- ---- 3) Dicas de Viagem --------------------------------------------------
create table if not exists public.travel_places (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  state text check (state is null or char_length(state) = 2),
  city text check (city is null or char_length(city) <= 80),
  audiences text[] not null default '{}' check (coalesce(array_length(audiences, 1), 0) <= 12),
  description text check (description is null or char_length(description) <= 4000),
  what_to_do text check (what_to_do is null or char_length(what_to_do) <= 4000),
  points_to_visit text check (points_to_visit is null or char_length(points_to_visit) <= 4000),
  image_paths text[] not null default '{}' check (coalesce(array_length(image_paths, 1), 0) <= 3),
  status text not null default 'draft' check (status in ('draft','published')),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists travel_places_community_idx on public.travel_places (community_id, status, state, city);

create table if not exists public.travel_images (
  community_id uuid not null references public.communities (id) on delete cascade,
  kind text not null check (kind in ('fundo','estado','cidade','publico')),
  key text not null check (char_length(key) between 1 and 100),
  image_path text not null,
  updated_at timestamptz not null default now(),
  primary key (community_id, kind, key)
);

create or replace function public.travel_touch()
returns trigger language plpgsql set search_path to 'public' as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists travel_places_touch on public.travel_places;
create trigger travel_places_touch before update on public.travel_places for each row execute function public.travel_touch();
drop trigger if exists travel_images_touch on public.travel_images;
create trigger travel_images_touch before update on public.travel_images for each row execute function public.travel_touch();

do $$
declare t text;
begin
  foreach t in array array['travel_places','travel_images'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_select" on public.%I', t, t);
    if t = 'travel_places' then
      execute $p$create policy "travel_places_select" on public.travel_places for select to authenticated using (
        public.is_master()
        or public.owns_community(community_id)
        or (status = 'published' and public.is_community_member(community_id)
            and public.has_package(community_id, array['viagens','premium']))
      )$p$;
    else
      execute $p$create policy "travel_images_select" on public.travel_images for select to authenticated using (
        public.is_master()
        or public.owns_community(community_id)
        or (public.is_community_member(community_id)
            and public.has_package(community_id, array['viagens','premium']))
      )$p$;
    end if;
    execute format('drop policy if exists "%s_write" on public.%I', t, t);
    execute format('create policy "%s_write" on public.%I for all to authenticated using (public.owns_community(community_id)) with check (public.owns_community(community_id))', t, t);
    execute format('revoke all on table public.%I from public, anon', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
  end loop;
end $$;

-- Apresentação antes da compra (sem os destinos completos).
create or replace function public.travel_preview(p_community uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not (public.is_community_member(p_community) or public.owns_community(p_community) or public.is_master()) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'place_count', (select count(*) from public.travel_places where community_id = p_community and status = 'published'),
    'states', (select coalesce(jsonb_agg(distinct state), '[]'::jsonb) from public.travel_places where community_id = p_community and status = 'published' and state is not null),
    'samples', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (select title t from public.travel_places where community_id = p_community and status = 'published' order by created_at desc limit 4) x)
  );
end $$;
revoke all on function public.travel_preview(uuid) from public, anon;
grant execute on function public.travel_preview(uuid) to authenticated;

-- ---- 4) Bom dia da Marluce no Feed ---------------------------------------
create table if not exists public.daily_morning_messages (
  id serial primary key,
  body text not null check (char_length(btrim(body)) between 1 and 1500),
  active boolean not null default true
);
alter table public.daily_morning_messages enable row level security;
revoke all on table public.daily_morning_messages from public, anon, authenticated;

insert into public.daily_morning_messages (body)
select b from (values
  ('Bom dia, minhas queridas! ☀️ Que o seu dia comece leve. Hoje, escolha uma tarefa pequena e faça com carinho: um copo de água, uma caminhada curta, uma refeição com calma. Estou aqui no Círcula com vocês e convido todas a participarem da nossa comunidade Fluir & Florescer. 🌸'),
  ('Bom dia! 🌷 Um novo dia é um convite para recomeçar. Você não precisa fazer tudo hoje, só o próximo passo. Vamos juntas? Passe pelo Círcula, marque suas tarefas e converse com a comunidade Fluir & Florescer.'),
  ('Bom dia, flores! 🌼 Lembrem-se: constância vale mais que perfeição. Hoje, cuide de você em pequenos gestos. E não esqueça de participar do Círcula e da nossa comunidade Fluir & Florescer, é um espaço feito com carinho para nós.'),
  ('Bom dia! 🌿 Respire fundo, alongue o corpo e comece o dia com gratidão. Cada tarefa feita hoje é um passo a mais no seu cuidado. Venha participar do Círcula e da comunidade Fluir & Florescer, vai ser bom ter você por perto.'),
  ('Bom dia, minhas lindas! ☕ Que hoje você se trate com a mesma gentileza que oferece aos outros. Vamos cumprir as tarefas do dia, no seu ritmo. Participe do Círcula e da comunidade Fluir & Florescer. Juntas, a caminhada fica mais leve. 💛'),
  ('Bom dia! 🌞 Hoje é dia de se priorizar: beber água, se movimentar e fazer boas escolhas, sem culpa. Conte comigo e com a comunidade Fluir & Florescer aqui no Círcula. Entre, participe e compartilhe o seu dia!'),
  ('Bom dia, queridas! 🌸 Cada manhã traz uma nova chance de florescer. Que tal começar marcando o desafio do dia no Círcula? A comunidade Fluir & Florescer está de portas abertas para você. Vem!'),
  ('Bom dia! 🍃 Você é capaz de mais do que imagina. Faça o que dá para fazer hoje, com calma e com fé. E venha trocar ideias no Círcula, na comunidade Fluir & Florescer: aqui ninguém caminha sozinha.'),
  ('Bom dia, minhas amigas! 🌻 Um dia de cada vez, um passo de cada vez. Cuide da sua alimentação, do seu sono e do seu coração. Participe do Círcula e da comunidade Fluir & Florescer, estamos juntas nessa.'),
  ('Bom dia! ✨ Que a sua manhã seja de paz e a sua tarde de realizações. Faça suas tarefas do dia, se orgulhe de cada pequena vitória e compartilhe conosco no Círcula, na comunidade Fluir & Florescer. 🌷'),
  ('Bom dia, flores do meu jardim! 🌺 Hoje o convite é simples: faça o que você consegue, com amor. Estou torcendo por você. Entre no Círcula e participe da comunidade Fluir & Florescer!'),
  ('Bom dia! 🌅 Comece o dia com um sorriso e uma intenção boa. Você merece cuidado todos os dias, não só de vez em quando. Venha para o Círcula e para a comunidade Fluir & Florescer, vamos florescer juntas.'),
  ('Bom dia, queridas! 💧 Hoje, não esqueça da água, de se mexer um pouquinho e de respirar fundo entre uma tarefa e outra. Passe no Círcula e participe da comunidade Fluir & Florescer, a gente se apoia!'),
  ('Bom dia! 🌸 Nada de se cobrar demais: o que importa é seguir em frente. Hoje, cumpra suas tarefas com leveza e venha contar como foi na comunidade Fluir & Florescer, aqui no Círcula.')
) v(b)
where not exists (select 1 from public.daily_morning_messages);

create or replace function public.post_bom_dia_marluce()
returns integer language plpgsql security definer set search_path to 'public' as $$
declare
  v_msg text;
  v_total integer;
  v_day integer;
  v_count integer := 0;
  c record;
begin
  select count(*) into v_total from public.daily_morning_messages where active;
  if v_total = 0 then return 0; end if;
  v_day := (extract(epoch from (now() at time zone 'America/Sao_Paulo')::date)::bigint / 86400)::integer;

  select body into v_msg
  from (select body, row_number() over (order by id) - 1 as n from public.daily_morning_messages where active) m
  where m.n = v_day % v_total;

  for c in select id, owner_id from public.communities where owner_id is not null loop
    -- um único bom dia por comunidade por dia (horário de Brasília)
    if not exists (
      select 1 from public.posts
      where community_id = c.id and author_id = c.owner_id and title = 'Bom dia'
        and (created_at at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date
    ) then
      insert into public.posts (community_id, author_id, content, title, post_type)
      values (c.id, c.owner_id, v_msg, 'Bom dia', 'standard');
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end $$;
revoke all on function public.post_bom_dia_marluce() from public, anon, authenticated;

create extension if not exists pg_cron;
do $$
begin
  perform cron.unschedule('bom-dia-marluce') where exists (select 1 from cron.job where jobname = 'bom-dia-marluce');
  -- 08:00 UTC = 05:00 em Brasília
  perform cron.schedule('bom-dia-marluce', '0 8 * * *', 'select public.post_bom_dia_marluce()');
end $$;

commit;

-- rollback:
--   select cron.unschedule('bom-dia-marluce');
--   drop function if exists public.post_bom_dia_marluce();
--   drop table if exists public.daily_morning_messages;
--   drop function if exists public.travel_preview(uuid);
--   drop table if exists public.travel_images, public.travel_places;
--   (recriar as constraints sem 'viagens', menu_series, menu_viagens e banner_lista)
