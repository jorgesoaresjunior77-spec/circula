-- =====================================================================
-- Carro em Dia: perguntas e respostas para ajudar mulheres a cuidar dos seus carros.
--  1) Avulso 'carro' (R$ 5,10): pacote e assinatura aceitam a chave nova. O Premium NÃO o inclui.
--  2) Configurações do card, categorias (com mapeamento para "Na minha cidade"), profissionais
--     habilitados, perguntas, "foi útil" e denúncias.
--  3) Acesso: só quem tem o pacote 'carro' (ou é da equipe) lê as respostas; o teaser mostra só títulos.
--  4) Avisos no sino (profissionais habilitadas recebem as perguntas; a pessoa recebe a resposta).
--  5) 36 perguntas iniciais, SEM resposta e NÃO públicas, para a profissional responder.
-- Aditiva e reversível (rollback no fim).
-- =====================================================================
begin;

-- ---- 1) pacote e assinatura avulsa -----------------------------------
alter table public.member_package_access drop constraint if exists member_package_access_package_check;
alter table public.member_package_access add constraint member_package_access_package_check check (
  package in ('help_nutri','ebooks','total','respiracao','playlist','wellness','leitura','premium','magazine','receitas','minha_lista','meu_chef','lista_inteligente','exercicios','series_filmes','viagens','carro')
);
alter table public.addon_subscriptions drop constraint if exists addon_subscriptions_plan_key_check;
alter table public.addon_subscriptions add constraint addon_subscriptions_plan_key_check check (plan_key in (
  'magazine','receitas','ebooks','help_nutri','respiracao','playlist','wellness','leitura','minha_lista','meu_chef','lista_inteligente','exercicios','series_filmes','viagens','carro','premium','cesta'
));

-- ---- 2) avisos novos no sino ------------------------------------------
alter table public.social_notifications drop constraint if exists social_notifications_type_check;
alter table public.social_notifications add constraint social_notifications_type_check check (
  type = any (array['post_comment','post_reaction','circle_join','event_rsvp','direct_message','help_request',
    'membership_requested','membership_approved','membership_rejected','circle_request','circle_request_approved',
    'nutri_plan','nutri_appointment','nutri_message','nutri_request','nutri_update','nutri_link',
    'city_claim','city_claim_result','city_category_request','feedback','carro_pergunta','carro_resposta']::text[])
);

-- ---- 3) tabelas -------------------------------------------------------
create table if not exists public.car_settings (
  id              int primary key default 1 check (id = 1),
  ativo           boolean not null default true,
  titulo          text not null default 'Carro em Dia' check (char_length(btrim(titulo)) between 1 and 40),
  subtitulo       text not null default 'Perguntas e respostas para cuidar do seu carro' check (char_length(subtitulo) <= 80),
  icone           text not null default 'carro',
  ordem           int not null default 0,
  teaser          text not null default 'Veja algumas das perguntas. Libere o Carro em Dia para ler as respostas e perguntar também.' check (char_length(teaser) <= 240),
  tempo_resposta  text not null default 'até 3 dias úteis' check (char_length(tempo_resposta) <= 40),
  lembrete_dias   int not null default 3 check (lembrete_dias between 1 and 30),
  imagem          text,
  imagem_alt      text check (imagem_alt is null or char_length(imagem_alt) <= 160)
);
insert into public.car_settings (id) values (1) on conflict do nothing;

create table if not exists public.car_categories (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (char_length(btrim(nome)) between 2 and 60),
  icone         text not null default 'carro',
  ordem         int not null default 0,
  ativa         boolean not null default true,
  cidade_categorias uuid[] not null default '{}'
);

create table if not exists public.car_responders (
  profile_id  uuid primary key references public.profiles (id) on delete cascade,
  nome        text not null check (char_length(btrim(nome)) between 1 and 80),
  funcao      text not null default 'Profissional do Círcula' check (char_length(funcao) <= 80),
  foto        text
);

create table if not exists public.car_questions (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid references public.profiles (id) on delete set null,
  categoria_id    uuid references public.car_categories (id) on delete set null,
  texto           text not null check (char_length(btrim(texto)) between 8 and 1000),
  modelo          text check (modelo is null or char_length(modelo) <= 60),
  ano             int check (ano is null or ano between 1950 and 2100),
  foto            text,
  anonima         boolean not null default false,
  status          text not null default 'aguardando' check (status in ('aguardando','mais_info','respondida','recusada')),
  motivo          text check (motivo is null or char_length(motivo) <= 600),
  resposta        text check (resposta is null or char_length(resposta) <= 6000),
  respondido_por  uuid references public.car_responders (profile_id) on delete set null,
  respondido_em   timestamptz,
  publicada       boolean not null default false,
  fixa            boolean not null default false,
  duplicada_de    uuid references public.car_questions (id) on delete set null,
  lembrete_em     timestamptz,
  criado_em       timestamptz not null default now()
);
create index if not exists car_questions_status_idx on public.car_questions (status, criado_em);
create index if not exists car_questions_owner_idx on public.car_questions (profile_id, criado_em desc);
create index if not exists car_questions_pub_idx on public.car_questions (publicada, respondido_em desc);

create table if not exists public.car_helpful (
  question_id uuid not null references public.car_questions (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  primary key (question_id, profile_id)
);

create table if not exists public.car_reports (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.car_questions (id) on delete cascade,
  profile_id  uuid references public.profiles (id) on delete set null,
  motivo      text not null check (char_length(btrim(motivo)) between 3 and 400),
  resolvida   boolean not null default false,
  criado_em   timestamptz not null default now()
);

alter table public.car_settings enable row level security;
alter table public.car_categories enable row level security;
alter table public.car_responders enable row level security;
alter table public.car_questions enable row level security;
alter table public.car_helpful enable row level security;
alter table public.car_reports enable row level security;

-- configurações, categorias e responsáveis: qualquer pessoa logada lê; só a equipe escreve
drop policy if exists "car_settings_select" on public.car_settings;
create policy "car_settings_select" on public.car_settings for select to authenticated using (true);
drop policy if exists "car_settings_write" on public.car_settings;
create policy "car_settings_write" on public.car_settings for all to authenticated using (public.is_city_admin()) with check (public.is_city_admin());
drop policy if exists "car_categories_select" on public.car_categories;
create policy "car_categories_select" on public.car_categories for select to authenticated using (true);
drop policy if exists "car_categories_write" on public.car_categories;
create policy "car_categories_write" on public.car_categories for all to authenticated using (public.is_city_admin()) with check (public.is_city_admin());
drop policy if exists "car_responders_select" on public.car_responders;
create policy "car_responders_select" on public.car_responders for select to authenticated using (true);
drop policy if exists "car_responders_write" on public.car_responders;
create policy "car_responders_write" on public.car_responders for all to authenticated using (public.is_city_admin()) with check (public.is_city_admin());
-- perguntas, "foi útil" e denúncias: nada direto; só pelas funções abaixo (e a equipe lê denúncias)
drop policy if exists "car_reports_select" on public.car_reports;
create policy "car_reports_select" on public.car_reports for select to authenticated using (public.is_city_admin());
drop policy if exists "car_reports_update" on public.car_reports;
create policy "car_reports_update" on public.car_reports for update to authenticated using (public.is_city_admin()) with check (public.is_city_admin());

revoke all on table public.car_settings, public.car_categories, public.car_responders, public.car_questions, public.car_helpful, public.car_reports from public, anon, authenticated;
grant select on table public.car_settings, public.car_categories, public.car_responders to authenticated;
grant insert, update, delete on table public.car_settings, public.car_categories, public.car_responders to authenticated;
grant select, update on table public.car_reports to authenticated;
grant all on table public.car_settings, public.car_categories, public.car_responders, public.car_questions, public.car_helpful, public.car_reports to service_role;

-- ---- 4) funções de apoio ----------------------------------------------
create or replace function public.car_can_answer()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.car_responders where profile_id = auth.uid())
      or exists (select 1 from public.profiles where id = auth.uid() and role = 'master');
$$;
revoke all on function public.car_can_answer() from public, anon;
grant execute on function public.car_can_answer() to authenticated;

-- quem pode ler as respostas e perguntar: pacote 'carro' (o Premium não inclui) ou equipe
create or replace function public.car_has_access()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.is_city_admin()
      or public.car_can_answer()
      or exists (select 1 from public.member_package_access where profile_id = auth.uid() and package = 'carro');
$$;
revoke all on function public.car_has_access() from public, anon;
grant execute on function public.car_has_access() to authenticated;

-- tira placa, telefone e CPF do texto
create or replace function public.car_clean_text(p text)
returns text language sql immutable set search_path to 'public' as $$
  select btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(coalesce(p, ''),
          '\m[A-Za-z]{3}[- ]?[0-9][A-Za-z0-9][0-9]{2}\M', '[placa removida]', 'g'),
        '(\(?\d{2}\)?[\s.-]?)?9?\d{4}[\s.-]?\d{4}', '[telefone removido]', 'g'),
      '\d{3}\.?\d{3}\.?\d{3}-?\d{2}', '[CPF removido]', 'g'));
$$;

create or replace function public.car_notify(p_profile uuid, p_type text, p_title text, p_body text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  begin
    insert into public.social_notifications (profile_id, actor_profile_id, type, title, body)
    values (p_profile, auth.uid(), p_type, p_title, p_body);
  exception when others then
    null; -- aviso nunca bloqueia a ação
  end;
end $$;
revoke all on function public.car_notify(uuid, text, text, text) from public, anon, authenticated;

create or replace function public.car_notify_responders(p_title text, p_body text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare r record;
begin
  for r in select profile_id from public.car_responders loop
    perform public.car_notify(r.profile_id, 'carro_pergunta', p_title, p_body);
  end loop;
end $$;
revoke all on function public.car_notify_responders(text, text) from public, anon, authenticated;

-- ---- 5) funções da usuária --------------------------------------------
-- Tela inicial: configurações, categorias e teaser (só títulos). Vale para todas as logadas.
create or replace function public.car_home()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  return jsonb_build_object(
    'settings', (select to_jsonb(s) from public.car_settings s where id = 1),
    'acesso', public.car_has_access(),
    'pode_responder', public.car_can_answer(),
    'categorias', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'icone', c.icone, 'cidade_categorias', c.cidade_categorias) order by c.ordem, c.nome) from public.car_categories c where c.ativa), '[]'::jsonb),
    'teaser', coalesce((select jsonb_agg(t.texto) from (select q.texto from public.car_questions q where q.publicada or q.profile_id is null order by q.fixa desc, q.criado_em limit 6) t), '[]'::jsonb)
  );
end $$;
revoke all on function public.car_home() from public, anon;
grant execute on function public.car_home() to authenticated;

create or replace function public.car_list()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.car_has_access() then raise exception 'sem_acesso' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', q.id, 'texto', q.texto, 'resposta', q.resposta, 'categoria_id', q.categoria_id,
      'respondido_em', q.respondido_em, 'fixa', q.fixa,
      'util', (select count(*) from public.car_helpful h where h.question_id = q.id),
      'meu_util', exists (select 1 from public.car_helpful h where h.question_id = q.id and h.profile_id = auth.uid()),
      'por_nome', r.nome, 'por_funcao', r.funcao, 'por_foto', r.foto,
      'foto', q.foto
    ) order by q.fixa desc, q.respondido_em desc)
    from public.car_questions q
    left join public.car_responders r on r.profile_id = q.respondido_por
    where q.publicada
  ), '[]'::jsonb);
end $$;
revoke all on function public.car_list() from public, anon;
grant execute on function public.car_list() to authenticated;

-- perguntas parecidas já respondidas, enquanto a pessoa digita
create or replace function public.car_similar(p_texto text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v_words text[];
begin
  if not public.car_has_access() then return '[]'::jsonb; end if;
  select array_agg('%' || w || '%') into v_words
    from (select distinct lower(w) as w from regexp_split_to_table(coalesce(p_texto, ''), '\W+') w where char_length(w) > 3 limit 6) s;
  if v_words is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', t.id, 'texto', t.texto))
    from (select q.id, q.texto from public.car_questions q where q.publicada and lower(q.texto) like any (v_words) order by q.fixa desc, q.respondido_em desc limit 3) t
  ), '[]'::jsonb);
end $$;
revoke all on function public.car_similar(text) from public, anon;
grant execute on function public.car_similar(text) to authenticated;

create or replace function public.car_ask(p_texto text, p_categoria uuid, p_modelo text, p_ano int, p_foto text, p_anonima boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_texto text; v_nome text; v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if not public.car_has_access() then raise exception 'sem_acesso' using errcode = '42501'; end if;
  v_texto := public.car_clean_text(p_texto);
  if char_length(v_texto) not between 8 and 1000 then raise exception 'texto_invalido'; end if;
  if public.text_has_blocked_term(v_texto, null) then raise exception 'conteudo_bloqueado' using errcode = 'check_violation'; end if;
  if (select count(*) from public.car_questions where profile_id = v_uid and criado_em > now() - interval '1 day') >= 5 then
    raise exception 'limite_diario';
  end if;
  if p_categoria is not null and not exists (select 1 from public.car_categories where id = p_categoria and ativa) then p_categoria := null; end if;
  insert into public.car_questions (profile_id, categoria_id, texto, modelo, ano, foto, anonima)
  values (v_uid, p_categoria, v_texto, nullif(left(public.car_clean_text(p_modelo), 60), ''), p_ano, nullif(btrim(coalesce(p_foto, '')), ''), coalesce(p_anonima, false))
  returning id into v_id;
  select coalesce(nullif(split_part(btrim(coalesce(full_name, '')), ' ', 1), ''), 'Participante') into v_nome from public.profiles where id = v_uid;
  perform public.car_notify_responders('Nova pergunta no Carro em Dia', case when coalesce(p_anonima, false) then 'Assinante do Círcula' else v_nome end || ': ' || left(v_texto, 120));
end $$;
revoke all on function public.car_ask(text, uuid, text, int, text, boolean) from public, anon;
grant execute on function public.car_ask(text, uuid, text, int, text, boolean) to authenticated;

-- as perguntas da própria pessoa, com o andamento
create or replace function public.car_my()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', q.id, 'texto', q.texto, 'status', q.status, 'motivo', q.motivo, 'criado_em', q.criado_em,
      'resposta', coalesce(q.resposta, o.resposta), 'respondido_em', coalesce(q.respondido_em, o.respondido_em),
      'por_nome', r.nome, 'por_funcao', r.funcao
    ) order by q.criado_em desc)
    from public.car_questions q
    left join public.car_questions o on o.id = q.duplicada_de
    left join public.car_responders r on r.profile_id = coalesce(q.respondido_por, o.respondido_por)
    where q.profile_id = auth.uid()
  ), '[]'::jsonb);
end $$;
revoke all on function public.car_my() from public, anon;
grant execute on function public.car_my() to authenticated;

create or replace function public.car_helpful_toggle(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.car_has_access() then raise exception 'sem_acesso' using errcode = '42501'; end if;
  if not exists (select 1 from public.car_questions where id = p_id and publicada) then raise exception 'nao_encontrada'; end if;
  if exists (select 1 from public.car_helpful where question_id = p_id and profile_id = auth.uid()) then
    delete from public.car_helpful where question_id = p_id and profile_id = auth.uid();
  else
    insert into public.car_helpful (question_id, profile_id) values (p_id, auth.uid());
  end if;
end $$;
revoke all on function public.car_helpful_toggle(uuid) from public, anon;
grant execute on function public.car_helpful_toggle(uuid) to authenticated;

create or replace function public.car_report(p_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.car_has_access() then raise exception 'sem_acesso' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_motivo, ''))) < 3 then raise exception 'motivo_invalido'; end if;
  insert into public.car_reports (question_id, profile_id, motivo) values (p_id, auth.uid(), left(btrim(p_motivo), 400));
  perform public.city_notify_admins('feedback', 'Denúncia no Carro em Dia', left(btrim(p_motivo), 120));
end $$;
revoke all on function public.car_report(uuid, text) from public, anon;
grant execute on function public.car_report(uuid, text) to authenticated;

-- ---- 6) funções da equipe ---------------------------------------------
create or replace function public.car_queue()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.car_can_answer() and not public.is_city_admin() then raise exception 'sem_permissao' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', q.id, 'texto', q.texto, 'status', q.status, 'motivo', q.motivo, 'resposta', q.resposta,
      'categoria_id', q.categoria_id, 'modelo', q.modelo, 'ano', q.ano, 'foto', q.foto,
      'publicada', q.publicada, 'fixa', q.fixa, 'criado_em', q.criado_em, 'respondido_em', q.respondido_em,
      'semente', q.profile_id is null,
      'quem', case when q.profile_id is null then 'Pergunta inicial'
                   else coalesce(nullif(split_part(btrim(coalesce(p.full_name, '')), ' ', 1), ''), 'Participante') || case when q.anonima then ' (quis ficar anônima)' else '' end end
    ) order by q.criado_em desc)
    from (select * from public.car_questions order by criado_em desc limit 600) q
    left join public.profiles p on p.id = q.profile_id
  ), '[]'::jsonb);
end $$;
revoke all on function public.car_queue() from public, anon;
grant execute on function public.car_queue() to authenticated;

-- ação da profissional sobre uma pergunta: rascunho | publicar | mais_info | recusar
create or replace function public.car_review(p_id uuid, p_acao text, p_texto text, p_categoria uuid, p_resposta text, p_motivo text, p_duplicada_de uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare q public.car_questions; v_resp text := nullif(btrim(coalesce(p_resposta, '')), ''); v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  if not public.car_can_answer() then raise exception 'sem_permissao' using errcode = '42501'; end if;
  select * into q from public.car_questions where id = p_id;
  if q.id is null then raise exception 'nao_encontrada'; end if;
  if p_acao not in ('rascunho', 'publicar', 'mais_info', 'recusar') then raise exception 'acao_invalida'; end if;

  update public.car_questions set
    texto = coalesce(nullif(btrim(coalesce(p_texto, '')), ''), texto),
    categoria_id = coalesce(p_categoria, categoria_id)
  where id = p_id;

  if p_acao = 'rascunho' then
    update public.car_questions set resposta = v_resp where id = p_id;
    return;
  end if;

  if p_acao = 'publicar' then
    if p_duplicada_de is not null then
      -- repete a resposta de uma pergunta que já existe; esta não vai para a lista pública
      update public.car_questions set duplicada_de = p_duplicada_de, status = 'respondida', publicada = false, motivo = null,
        respondido_por = (select respondido_por from public.car_questions where id = p_duplicada_de), respondido_em = now()
      where id = p_id;
    else
      if v_resp is null then raise exception 'resposta_vazia'; end if;
      update public.car_questions set resposta = v_resp, status = 'respondida', publicada = true, motivo = null,
        respondido_por = auth.uid(), respondido_em = now()
      where id = p_id;
    end if;
    if q.profile_id is not null then
      perform public.car_notify(q.profile_id, 'carro_resposta', 'Sua pergunta foi respondida', left(q.texto, 120));
    end if;
    return;
  end if;

  if v_motivo is null then raise exception 'motivo_obrigatorio'; end if;
  if p_acao = 'mais_info' then
    update public.car_questions set status = 'mais_info', publicada = false, motivo = v_motivo where id = p_id;
    if q.profile_id is not null then
      perform public.car_notify(q.profile_id, 'carro_resposta', 'Precisamos de um pouquinho mais de informação', left(v_motivo, 140));
    end if;
  else
    update public.car_questions set status = 'recusada', publicada = false, motivo = v_motivo where id = p_id;
    if q.profile_id is not null then
      perform public.car_notify(q.profile_id, 'carro_resposta', 'Sua pergunta não pôde ser publicada', left(v_motivo, 140));
    end if;
  end if;
end $$;
revoke all on function public.car_review(uuid, text, text, uuid, text, text, uuid) from public, anon;
grant execute on function public.car_review(uuid, text, text, uuid, text, text, uuid) to authenticated;

-- despublicar, republicar e fixar
create or replace function public.car_flags(p_id uuid, p_publicada boolean, p_fixa boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.car_can_answer() then raise exception 'sem_permissao' using errcode = '42501'; end if;
  update public.car_questions set
    publicada = case when p_publicada and resposta is not null then true else false end,
    fixa = coalesce(p_fixa, false)
  where id = p_id;
end $$;
revoke all on function public.car_flags(uuid, boolean, boolean) from public, anon;
grant execute on function public.car_flags(uuid, boolean, boolean) to authenticated;

-- lembrete diário: pergunta parada há mais de N dias avisa as profissionais UMA vez
create or replace function public.car_remind_stale()
returns int language plpgsql security definer set search_path to 'public' as $$
declare v_dias int; v_n int;
begin
  select lembrete_dias into v_dias from public.car_settings where id = 1;
  with st as (
    update public.car_questions set lembrete_em = now()
    where status = 'aguardando' and profile_id is not null and lembrete_em is null
      and criado_em < now() - make_interval(days => coalesce(v_dias, 3))
    returning id
  ) select count(*) into v_n from st;
  if v_n > 0 then
    perform public.car_notify_responders('Perguntas esperando resposta', v_n || ' pergunta(s) no Carro em Dia esperam há mais de ' || coalesce(v_dias, 3) || ' dias.');
  end if;
  return v_n;
end $$;
revoke all on function public.car_remind_stale() from public, anon, authenticated;

create extension if not exists pg_cron;
do $$
begin
  perform cron.unschedule('carro-lembrete') where exists (select 1 from cron.job where jobname = 'carro-lembrete');
  perform cron.schedule('carro-lembrete', '0 11 * * *', 'select public.car_remind_stale()');
end $$;

-- ---- 7) quem já é da equipe passa a poder responder ---------------------
insert into public.car_responders (profile_id, nome, funcao)
select id, coalesce(nullif(btrim(full_name), ''), 'Profissional'), 'Profissional do Círcula'
from public.profiles where role in ('master', 'professional')
on conflict do nothing;

-- ---- 8) categorias e perguntas iniciais (SEM resposta, NÃO públicas) ----
do $$
declare
  cats text[][] := array[
    ['Pane e emergências','alerta'],['Luzes do painel','luz'],['Manutenção e revisão','chave'],['Pneus e freios','pneu'],
    ['Oficina: como não ser enganada','oficina'],['Documentos, seguro e multas','doc'],['Segurança ao dirigir','escudo'],
    ['Limpeza e estética','brilho'],['Compra, venda e economia','moeda']
  ];
  qs text[][] := array[
    ['Pane e emergências','O carro não pega: o que verifico antes de chamar o guincho?'],
    ['Pane e emergências','Como trocar um pneu com segurança, passo a passo?'],
    ['Pane e emergências','O que fazer se o carro esquentar na estrada?'],
    ['Pane e emergências','Como dar carga na bateria ("chupeta") sem danificar o carro?'],
    ['Luzes do painel','O que significa cada luz do painel?'],
    ['Luzes do painel','A luz da injeção acendeu: posso continuar dirigindo?'],
    ['Luzes do painel','A luz da bateria ou do óleo acendeu: o que fazer?'],
    ['Luzes do painel','A luz do ABS ou do freio acendeu: é perigoso?'],
    ['Manutenção e revisão','De quanto em quanto tempo trocar o óleo?'],
    ['Manutenção e revisão','Quando fazer a revisão e o que conferir?'],
    ['Manutenção e revisão','Como conferir óleo e água do radiador sozinha?'],
    ['Manutenção e revisão','O que são alinhamento e balanceamento e quando fazer?'],
    ['Pneus e freios','Como saber se o pneu está careca?'],
    ['Pneus e freios','Qual é a calibragem certa e com que frequência conferir?'],
    ['Pneus e freios','Barulho ao frear: é grave?'],
    ['Pneus e freios','Quando trocar as pastilhas de freio?'],
    ['Oficina: como não ser enganada','Como pedir orçamento e comparar oficinas?'],
    ['Oficina: como não ser enganada','Posso pedir as peças trocadas de volta?'],
    ['Oficina: como não ser enganada','Como saber se o serviço foi mesmo feito?'],
    ['Oficina: como não ser enganada','Quais serviços costumam ser empurrados sem necessidade?'],
    ['Documentos, seguro e multas','O que fazer em caso de batida?'],
    ['Documentos, seguro e multas','Como funcionam seguro e franquia?'],
    ['Documentos, seguro e multas','Como consultar IPVA, licenciamento e multas?'],
    ['Documentos, seguro e multas','Quais documentos preciso levar no carro?'],
    ['Segurança ao dirigir','Cuidados ao dirigir à noite'],
    ['Segurança ao dirigir','O que fazer se o carro quebrar em local deserto?'],
    ['Segurança ao dirigir','Como abastecer e estacionar com mais segurança?'],
    ['Segurança ao dirigir','Como deixar contatos de emergência e compartilhar a localização?'],
    ['Limpeza e estética','Como lavar o carro em casa sem riscar a pintura?'],
    ['Limpeza e estética','Polimento, cristalização e vitrificação: qual a diferença?'],
    ['Limpeza e estética','Como tirar mau cheiro e manchas do banco?'],
    ['Limpeza e estética','Higienização do ar-condicionado: quando fazer?'],
    ['Compra, venda e economia','O que olhar ao comprar um carro usado?'],
    ['Compra, venda e economia','Como economizar combustível?'],
    ['Compra, venda e economia','Álcool ou gasolina: qual compensa?'],
    ['Compra, venda e economia','Quanto custa manter um carro por mês?']
  ];
  i int; v_id uuid;
begin
  if exists (select 1 from public.car_categories) then return; end if;
  for i in 1 .. array_length(cats, 1) loop
    insert into public.car_categories (nome, icone, ordem) values (cats[i][1], cats[i][2], i);
  end loop;
  for i in 1 .. array_length(qs, 1) loop
    select id into v_id from public.car_categories where nome = qs[i][1];
    insert into public.car_questions (profile_id, categoria_id, texto, status) values (null, v_id, qs[i][2], 'aguardando');
  end loop;
end $$;

commit;
-- ROLLBACK (manual): select cron.unschedule('carro-lembrete'); drop function car_* ; drop table car_reports, car_helpful, car_questions, car_responders, car_categories, car_settings;
-- (recriar os CHECKs de member_package_access, addon_subscriptions e social_notifications sem 'carro', 'carro_pergunta' e 'carro_resposta')
