-- =====================================================================
-- "Na minha cidade": reivindicar o negócio e destaque pago da capa.
--  • qualquer participante pode pedir para reivindicar um lugar/profissional
--    (deixa o WhatsApp no pedido); a administração fala com ela pelo WhatsApp e
--    aprova ou recusa;
--  • aprovada, ela passa a ser a dona do cadastro (pode editar) e pode contratar o
--    DESTAQUE da capa: R$ 4,90 por mês (semestral e anual com desconto), cobrado
--    pelo Asaas. Com o destaque ativo, o cadastro aparece primeiro, numa faixa
--    "Em destaque" no topo da cidade.
-- Aditiva e reversível (rollback no fim).
-- =====================================================================
begin;

alter table public.city_listings add column if not exists reivindicado_por uuid references public.profiles (id) on delete set null;

create table if not exists public.city_claims (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid not null references public.city_listings (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  whatsapp     text not null check (char_length(whatsapp) between 10 and 20),
  mensagem     text check (mensagem is null or char_length(mensagem) <= 500),
  status       text not null default 'pendente' check (status in ('pendente','aprovada','recusada')),
  criado_em    timestamptz not null default now(),
  resolvido_em timestamptz
);
-- um pedido em aberto (pendente ou aprovado) por cadastro
create unique index if not exists city_claims_open_uidx on public.city_claims (listing_id) where status in ('pendente','aprovada');
create index if not exists city_claims_user_idx on public.city_claims (user_id);

create table if not exists public.city_highlights (
  id                    uuid primary key default gen_random_uuid(),
  listing_id            uuid not null references public.city_listings (id) on delete cascade,
  user_id               uuid not null references public.profiles (id) on delete cascade,
  billing_cycle         text not null check (billing_cycle in ('MONTHLY','SEMIANNUALLY','YEARLY')),
  price_cents           integer not null check (price_cents > 0),
  asaas_customer_id     text,
  asaas_subscription_id text,
  status                text not null default 'pending' check (status in ('pending','active','past_due','canceled')),
  current_period_end    timestamptz,
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now()
);
create unique index if not exists city_highlights_live_uidx on public.city_highlights (listing_id) where status in ('pending','active','past_due');
create index if not exists city_highlights_sub_idx on public.city_highlights (asaas_subscription_id);

alter table public.city_claims enable row level security;
alter table public.city_highlights enable row level security;
drop policy if exists "city_claims_select" on public.city_claims;
create policy "city_claims_select" on public.city_claims for select to authenticated using (user_id = auth.uid() or public.is_city_admin());
drop policy if exists "city_highlights_select" on public.city_highlights;
create policy "city_highlights_select" on public.city_highlights for select to authenticated using (user_id = auth.uid() or public.is_city_admin());
revoke all on table public.city_claims, public.city_highlights from public, anon, authenticated;
grant select on table public.city_claims, public.city_highlights to authenticated;
grant all on table public.city_claims, public.city_highlights to service_role;

-- A dona (reivindicação aprovada) também edita o cadastro e as tags dele.
drop policy if exists "city_listings_update" on public.city_listings;
create policy "city_listings_update" on public.city_listings for update to authenticated
  using (criado_por = auth.uid() or reivindicado_por = auth.uid() or public.is_city_admin())
  with check (criado_por = auth.uid() or reivindicado_por = auth.uid() or public.is_city_admin());
drop policy if exists "city_listing_tags_write" on public.city_listing_tags;
create policy "city_listing_tags_write" on public.city_listing_tags for all to authenticated
  using (exists (select 1 from public.city_listings l where l.id = listing_id and (l.criado_por = auth.uid() or l.reivindicado_por = auth.uid() or public.is_city_admin())))
  with check (exists (select 1 from public.city_listings l where l.id = listing_id and (l.criado_por = auth.uid() or l.reivindicado_por = auth.uid() or public.is_city_admin())));

-- Só a administração mexe em quem é a dona.
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
      if not v_admin then
        new.status := 'ativo';
        new.reivindicado_por := null;
      end if;
    end if;
  else
    new.criado_por := old.criado_por;
    new.city_id := old.city_id;
    new.tipo := old.tipo;
    if not v_admin then
      new.status := old.status;
      new.reivindicado_por := old.reivindicado_por;
    end if;
  end if;
  new.atualizado_em := now();

  v_txt := concat_ws(' ', new.titulo, new.descricao, new.bairro, new.local_nome, new.atividade, new.valor, new.horario);
  if public.text_has_blocked_term(v_txt, null) then
    raise exception 'conteudo_bloqueado' using errcode = 'check_violation';
  end if;

  if new.categoria_id is not null then
    select grupo into v_group from public.city_categories where id = new.categoria_id;
  end if;
  if v_group = 'saude'
     and (lower(v_txt) ~ '\y(cura|curamos|curar|garantimos|garantido|garantida|garantia)\y|antes e depois|r\$') then
    raise exception 'saude_texto_proibido' using errcode = 'check_violation';
  end if;
  return new;
end $$;

-- ---- RPCs ---------------------------------------------------------------------------
create or replace function public.city_claim_create(p_listing uuid, p_whatsapp text, p_mensagem text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_digits text := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'); v_msg text := nullif(btrim(coalesce(p_mensagem, '')), '');
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if char_length(v_digits) not between 10 and 13 then raise exception 'whatsapp_invalido'; end if;
  if not exists (select 1 from public.city_listings where id = p_listing and status = 'ativo' and tipo in ('lugar','profissional')) then
    raise exception 'cadastro_nao_encontrado';
  end if;
  if v_msg is not null and public.text_has_blocked_term(v_msg, null) then
    raise exception 'conteudo_bloqueado' using errcode = 'check_violation';
  end if;
  begin
    insert into public.city_claims (listing_id, user_id, whatsapp, mensagem) values (p_listing, v_uid, v_digits, v_msg);
  exception when unique_violation then
    raise exception 'ja_reivindicado';
  end;
end $$;
revoke all on function public.city_claim_create(uuid, text, text) from public, anon;
grant execute on function public.city_claim_create(uuid, text, text) to authenticated;

create or replace function public.city_admin_claims()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.is_city_admin() then raise exception 'sem_permissao' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', k.id, 'listing_id', l.id, 'titulo', l.titulo, 'tipo', l.tipo, 'cidade', c.nome, 'estado', c.estado,
      'nome', coalesce(nullif(split_part(btrim(coalesce(p.full_name, '')), ' ', 1), ''), 'Participante'),
      'whatsapp', k.whatsapp, 'mensagem', k.mensagem, 'status', k.status, 'criado_em', k.criado_em,
      'destaque', (select h.status from public.city_highlights h where h.listing_id = l.id and h.status in ('pending','active','past_due') limit 1)
    ) order by (k.status = 'pendente') desc, k.criado_em desc)
    from public.city_claims k
    join public.city_listings l on l.id = k.listing_id
    join public.cidades c on c.id = l.city_id
    left join public.profiles p on p.id = k.user_id
    where k.status in ('pendente','aprovada')
  ), '[]'::jsonb);
end $$;
revoke all on function public.city_admin_claims() from public, anon;
grant execute on function public.city_admin_claims() to authenticated;

create or replace function public.city_claim_resolve(p_claim uuid, p_action text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare k public.city_claims;
begin
  if not public.is_city_admin() then raise exception 'sem_permissao' using errcode = '42501'; end if;
  select * into k from public.city_claims where id = p_claim;
  if not found then raise exception 'pedido_nao_encontrado'; end if;
  if p_action = 'aprovar' then
    update public.city_claims set status = 'aprovada', resolvido_em = now() where id = p_claim;
    update public.city_listings set reivindicado_por = k.user_id, e_proprio_negocio = true where id = k.listing_id;
    insert into public.notifications (profile_id, type, title, body)
    values (k.user_id, 'billing', 'Negócio reivindicado', 'Seu pedido foi aprovado. Abra o cadastro do seu negócio em "Na minha cidade" para contratar o destaque da capa (R$ 4,90 por mês).');
  elsif p_action = 'recusar' then
    update public.city_claims set status = 'recusada', resolvido_em = now() where id = p_claim;
  elsif p_action = 'revogar' then
    -- tira a dona e encerra o pedido (o destaque, se houver, é cancelado pela função do servidor)
    update public.city_claims set status = 'recusada', resolvido_em = now() where id = p_claim;
    update public.city_listings set reivindicado_por = null where id = k.listing_id;
  else
    raise exception 'acao_invalida';
  end if;
end $$;
revoke all on function public.city_claim_resolve(uuid, text) from public, anon;
grant execute on function public.city_claim_resolve(uuid, text) to authenticated;

-- ---- lista de cadastros: com destaque, dona e o pedido da própria participante --------------
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

commit;

-- ROLLBACK (manual):
--   drop function city_claim_create, city_admin_claims, city_claim_resolve;
--   drop table city_highlights, city_claims;
--   alter table city_listings drop column reivindicado_por;
--   (recriar list_city_listings, city_listing_guard e as policies da migration anterior)
