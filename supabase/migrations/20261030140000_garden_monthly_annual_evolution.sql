-- =====================================================================
-- Etapa 6 (evolução/experiência/gamificação) — Meu Jardim: desafio
-- mensal (pontuação) e progressão anual — v2, corrigida após auditoria
-- =====================================================================
-- NÃO APLICADA — preparada nesta etapa, aguardando autorização explícita
-- do usuário antes de rodar contra o banco remoto.
--
-- Esta é a SEGUNDA versão deste arquivo. A primeira passou por uma
-- auditoria completa (leitura própria + consultas read-only ao banco
-- remoto) que encontrou 6 problemas reais, todos corrigidos aqui:
--
--   1) GRANT ausente (achado NOVO, mais grave que os outros 5 — só
--      apareceu ao investigar a Seção 3 do pedido de correção): neste
--      projeto, tabela criada por migration SQL (fora do Studio) NÃO
--      recebe GRANT automático para `authenticated`/`anon` — "gotcha"
--      de infra já documentado e resolvido manualmente em TODA tabela
--      nova do projeto (ver GRANT explícito em
--      20260831120000_community_events.sql, 20260831150000_social_
--      notifications.sql, etc. — confirmado por consulta real ao
--      remoto: `event_participants` e `social_notifications` só têm
--      para `authenticated` exatamente os privilégios que o GRANT
--      explícito de cada uma concede, nunca mais). A v1 deste arquivo
--      não tinha NENHUM GRANT para as 2 tabelas novas — sem corrigir,
--      a Member não conseguiria nem LER o próprio progresso (a seção
--      "Meu Jardim" do app ficaria permanentemente "indisponível" —
--      bug tão grave quanto RLS errada, só que do lado oposto: acesso
--      NEGADO DEMAIS, não de menos). Corrigido na Seção 2 abaixo —
--      resolve também o pedido explícito da Seção 3 (REVOKE de
--      INSERT/UPDATE/DELETE): em vez de conceder tudo e revogar depois,
--      seguimos o padrão REAL do projeto — conceder só o que é preciso
--      (só SELECT para `authenticated`; INSERT/UPDATE nunca concedidos,
--      então não há nada para revogar).
--   2) Estorno de pontos — Seção 5.
--   3) Corrida no limite diário — Seção 4 (advisory lock).
--   4) `total_points` congelado — Seção 4 (_garden_recompute_completion).
--   5) Fuso horário UTC vs. hora local do navegador — Seção 1
--      (communities.timezone + garden_community_timezone()).
--
-- MATRIZ DE PONTUAÇÃO (inalterada da v1, mensal, reinicia todo dia 1 no
-- fuso oficial da comunidade — ver Seção 1):
--   publicar um post            -> 5 pontos  (limite 1x/dia)
--   comentar em um post         -> 2 pontos  (limite 3x/dia)
--   reagir a um post            -> 1 ponto   (limite 5x/dia)
--   participar de um Círculo    -> 10 pontos (natural: 1x por círculo)
--   confirmar presença em evento-> 8 pontos  (natural: 1x por evento)
--   concluir um dia do Jardim   -> 6 pontos  (natural: 1x por dia/desafio)
--   compartilhar conclusão      -> 4 pontos  (natural: 1x por conclusão,
--                                  UNIQUE(completion_id) real em
--                                  garden_shares — verificado no remoto)
--   check-in de humor do dia    -> 3 pontos  (natural: 1x por dia)
-- Meta do mês: 100 pontos (garden_monthly_points_goal()).
--
-- SERVIDOR COMO FONTE ÚNICA DA VERDADE — mantido: nenhum GRANT de
-- INSERT/UPDATE/DELETE para `authenticated` nas 2 tabelas; todo ponto
-- nasce/morre/renasce por um gatilho SECURITY DEFINER na tabela de
-- origem real. Idempotente via UNIQUE(source, source_id, profile_id) +
-- ON CONFLICT DO NOTHING (concessão) e via `reversed_at IS [NOT] NULL`
-- nas WHERE de estorno/restauração (nunca dá para estornar ou
-- restaurar a mesma linha duas vezes seguidas sem efeito).
--
-- PROGRESSÃO ANUAL — continua sendo a CONTAGEM de linhas em
-- garden_monthly_completions dentro do ciclo anual corrente, nunca uma
-- tabela própria. Regra especial de início preservada e agora também
-- calculada no fuso oficial (Seção 1): o primeiro ciclo é 01/01/2027 a
-- 31/12/2027 no fuso da comunidade (America/Sao_Paulo por padrão) —
-- `garden_annual_cycle_bounds()` retorna vazio para qualquer instante
-- anterior a essa data LOCAL.
--
-- 100% aditivo, idempotente, transacional, reversível. Não altera
-- nenhuma tabela/policy/RLS existente além de LER (SELECT) linhas de
-- outras tabelas dentro dos gatilhos SECURITY DEFINER, e 1 ADD COLUMN
-- aditivo em `communities` (Seção 1).
-- =====================================================================

begin;

-- =====================================================================
-- SEÇÃO 1 — Fuso horário oficial dos ciclos
-- =====================================================================
-- `communities.timezone` (nullable) — arquitetura JÁ preparada para
-- fuso configurável por comunidade (basta a Profissional preencher esta
-- coluna no futuro; nenhuma tela faz isso ainda nesta etapa — fora de
-- escopo deste pedido, que foi só "verificar se a arquitetura permite").
-- Sem valor próprio, cai no padrão global `America/Sao_Paulo` — mesma
-- constante usada pelo cliente (ver src/lib/timezone.ts), então hoje,
-- com nenhuma comunidade tendo configurado um fuso próprio, servidor e
-- frontend concordam exatamente, sempre.
alter table public.communities add column if not exists timezone text;

comment on column public.communities.timezone is
  'Etapa 6 (correção pós-auditoria): fuso IANA (ex. America/Sao_Paulo) usado para os ciclos mensal/anual do Meu Jardim desta comunidade. NULL = usa o padrão global (garden_community_timezone()). Nenhuma tela ainda escreve aqui.';

create or replace function public.garden_community_timezone(p_community_id uuid)
returns text
language sql
stable
as $function$
  select coalesce(
    (select timezone from public.communities where id = p_community_id),
    'America/Sao_Paulo'
  )
$function$;

comment on function public.garden_community_timezone(uuid) is
  'Etapa 6: fuso horário oficial dos ciclos do Meu Jardim desta comunidade — único lugar que resolve o fuso efetivo (coluna própria ou o padrão global). Usado por _garden_award_points/_garden_recompute_completion para period_month e janela do limite diário; o cliente usa a MESMA constante padrão (America/Sao_Paulo) em src/lib/timezone.ts.';

-- ---- 0) constantes como funções IMMUTABLE ----------------------------
create or replace function public.garden_monthly_points_goal()
returns integer
language sql
immutable
as $function$ select 100 $function$;

comment on function public.garden_monthly_points_goal() is
  'Etapa 6: pontos necessários para concluir o desafio mensal do Meu Jardim. Único lugar que define este número.';

-- Início do ciclo anual corrente no FUSO informado (ou NULL se ainda
-- não começou — regra especial: nada antes de 01/01/2027 local).
-- `p_at` é o instante de referência (normalmente now()); parametrizado
-- para ser testável com qualquer data/fuso, sem depender do relógio ou
-- fuso reais. Pura (não lê tabela) — por isso pode seguir `immutable`;
-- quem precisa do fuso efetivo de uma comunidade resolve com
-- garden_community_timezone() ANTES de chamar esta.
create or replace function public.garden_annual_cycle_bounds(
  p_at timestamptz,
  p_timezone text default 'America/Sao_Paulo'
)
returns table(cycle_start date, cycle_end date)
language sql
immutable
as $function$
  select
    date_trunc('year', p_at at time zone p_timezone)::date as cycle_start,
    (date_trunc('year', p_at at time zone p_timezone) + interval '1 year' - interval '1 day')::date as cycle_end
  where (p_at at time zone p_timezone) >= '2027-01-01'::timestamp;
$function$;

comment on function public.garden_annual_cycle_bounds(timestamptz, text) is
  'Etapa 6 (correção pós-auditoria — agora recebe o fuso explicitamente): limites (1o de janeiro a 31 de dezembro, NO FUSO INFORMADO) do ciclo anual do Meu Jardim que contém p_at. Vazio (nenhuma linha) se p_at, convertido para esse fuso, for anterior a 2027-01-01 00:00 local — regra especial de início, sem progresso anual retroativo em 2026.';

-- =====================================================================
-- SEÇÃO 2 — tabelas, índices, RLS e GRANTS
-- =====================================================================
create table if not exists public.garden_monthly_points (
  id           uuid not null default gen_random_uuid(),
  profile_id   uuid not null,
  community_id uuid not null,
  period_month date not null,              -- sempre dia 1 do mês, NO FUSO oficial da comunidade (ver Seção 1)
  source       text not null,
  source_id    uuid not null,              -- id da linha de origem (posts.id, post_comments.id, etc.)
  points       integer not null,
  created_at   timestamptz not null default now(),
  -- Correção pós-auditoria (estorno) — NUNCA apagamos a linha para
  -- "desfazer" pontos: preenchido = estornado (não conta mais na soma
  -- nem no limite diário), mas a linha e seu created_at/points originais
  -- ficam para sempre — histórico e rastreabilidade auditável completos.
  reversed_at  timestamptz,
  constraint garden_monthly_points_pkey primary key (id),
  constraint garden_monthly_points_source_check check (
    source = any (array[
      'post'::text, 'comment'::text, 'reaction'::text, 'circle_join'::text,
      'event_rsvp'::text, 'garden_day'::text, 'garden_share'::text, 'mood_checkin'::text
    ])
  ),
  constraint garden_monthly_points_points_check check (points > 0),
  constraint garden_monthly_points_profile_id_fkey foreign key (profile_id)
    references public.profiles (id) on delete cascade,
  constraint garden_monthly_points_community_id_fkey foreign key (community_id)
    references public.communities (id) on delete cascade,
  -- Idempotência da CONCESSÃO: o MESMO evento de origem nunca concede
  -- pontos 2x, mesmo se o gatilho for reprocessado. (A idempotência do
  -- ESTORNO/RESTAURAÇÃO usa `reversed_at IS [NOT] NULL` nas funções
  -- abaixo, não esta constraint.)
  constraint garden_monthly_points_source_unique unique (source, source_id, profile_id)
);

create index if not exists garden_monthly_points_profile_period_idx
  on public.garden_monthly_points using btree (profile_id, community_id, period_month);
create index if not exists garden_monthly_points_community_period_idx
  on public.garden_monthly_points using btree (community_id, period_month);

create table if not exists public.garden_monthly_completions (
  id           uuid not null default gen_random_uuid(),
  profile_id   uuid not null,
  community_id uuid not null,
  period_month date not null,
  -- Correção pós-auditoria (total desatualizado) — este valor agora é
  -- mantido em sincronia pelo _garden_recompute_completion() sempre que
  -- pontos são concedidos/estornados/restaurados NESTE período, mesmo
  -- depois da conclusão já ter acontecido. `completed_at`, abaixo,
  -- continua congelado no instante em que a meta foi atingida PELA
  -- PRIMEIRA VEZ — a linha em si NUNCA é apagada por uma mudança de
  -- total (conquista permanente do ciclo).
  total_points integer not null,
  completed_at timestamptz not null default now(),
  constraint garden_monthly_completions_pkey primary key (id),
  constraint garden_monthly_completions_profile_id_fkey foreign key (profile_id)
    references public.profiles (id) on delete cascade,
  constraint garden_monthly_completions_community_id_fkey foreign key (community_id)
    references public.communities (id) on delete cascade,
  constraint garden_monthly_completions_unique unique (profile_id, community_id, period_month)
);

create index if not exists garden_monthly_completions_profile_idx
  on public.garden_monthly_completions using btree (profile_id, community_id);
create index if not exists garden_monthly_completions_community_period_idx
  on public.garden_monthly_completions using btree (community_id, period_month);

-- ---- RLS — só leitura para o cliente; escrita só via gatilho ---------
alter table public.garden_monthly_points enable row level security;

drop policy if exists "garden_monthly_points_select" on public.garden_monthly_points;
create policy "garden_monthly_points_select"
  on public.garden_monthly_points for select to authenticated
  using (profile_id = auth.uid() or public.owns_community(community_id));

alter table public.garden_monthly_completions enable row level security;

drop policy if exists "garden_monthly_completions_select" on public.garden_monthly_completions;
create policy "garden_monthly_completions_select"
  on public.garden_monthly_completions for select to authenticated
  using (profile_id = auth.uid() or public.owns_community(community_id));

-- ---- GRANT (correção pós-auditoria — achado mais grave) --------------
-- Mesmo "gotcha" de infra já documentado no projeto (tabela criada por
-- migration não recebe GRANT automático — ver 20260831120000/
-- 20260831150000): sem isto, `authenticated` não lê NADA aqui, mesmo
-- com a policy de SELECT acima liberando — e a v1 deste arquivo não
-- tinha nenhum GRANT. Só SELECT para `authenticated` — nunca INSERT/
-- UPDATE/DELETE (resolve também o pedido de defesa em profundidade:
-- não há nada para revogar porque nunca foi concedido). `service_role`
-- recebe tudo, mesmo padrão de toda outra tabela do projeto.
grant select on table public.garden_monthly_points to authenticated;
grant select, insert, update, delete on table public.garden_monthly_points to service_role;

grant select on table public.garden_monthly_completions to authenticated;
grant select, insert, update, delete on table public.garden_monthly_completions to service_role;

-- =====================================================================
-- SEÇÃO 3 — recálculo central da conclusão mensal
-- =====================================================================
-- Único lugar que decide se/como garden_monthly_completions reflete o
-- total corrente — chamado tanto pela concessão (Seção 4) quanto pelo
-- estorno/restauração (Seção 5), nunca duplicado entre os dois
-- caminhos. Correção pós-auditoria (C): NUNCA apaga uma linha de
-- conclusão já existente (conquista permanente do ciclo) — só
-- atualiza `total_points` para refletir a soma real corrente (ativa,
-- isto é, sem contar linhas estornadas). `completed_at` só é gravado na
-- primeira vez (INSERT); o ON CONFLICT DO UPDATE toca só total_points.
create or replace function public._garden_recompute_completion(
  p_profile_id   uuid,
  p_community_id uuid,
  p_period       date
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_total integer;
begin
  -- Correção pós-auditoria (B) — serializa o recálculo contra qualquer
  -- outra concessão/estorno/restauração do MESMO perfil+comunidade+mês
  -- (quem chamou já pode ter travado a mesma chave — reentrância de
  -- advisory lock na mesma transação é segura em Postgres, só soma ao
  -- contador de posse, nunca autobloqueia).
  perform pg_advisory_xact_lock(
    hashtextextended(p_profile_id::text || ':' || p_community_id::text || ':' || p_period::text, 0)
  );

  select coalesce(sum(points), 0) into v_total
  from public.garden_monthly_points
  where profile_id = p_profile_id
    and community_id = p_community_id
    and period_month = p_period
    and reversed_at is null;

  if v_total >= public.garden_monthly_points_goal() then
    insert into public.garden_monthly_completions
      (profile_id, community_id, period_month, total_points)
    values
      (p_profile_id, p_community_id, p_period, v_total)
    on conflict (profile_id, community_id, period_month)
    do update set total_points = excluded.total_points;
  else
    -- Ainda não bateu a meta AGORA — mas se já tinha uma conclusão de
    -- antes (um estorno reduziu o total depois de já ter concluído),
    -- a linha continua existindo (conquista permanente); só o número
    -- exibido de total_points acompanha a realidade.
    update public.garden_monthly_completions
      set total_points = v_total
      where profile_id = p_profile_id
        and community_id = p_community_id
        and period_month = p_period;
  end if;
end;
$function$;

-- =====================================================================
-- SEÇÃO 4 — concessão de pontos (gatilhos de origem, 8 fontes)
-- =====================================================================
-- Correção pós-auditoria (D) — `period_month` e a janela do limite
-- diário agora são calculados no FUSO OFICIAL da comunidade (Seção 1),
-- nunca em UTC cru nem na hora do servidor. Correção (B) — trava
-- advisory ANTES de ler a contagem do limite diário, serializando
-- concessões concorrentes do mesmo perfil+comunidade+mês (duas
-- requisições simultâneas nunca mais passam as duas pela mesma
-- contagem "antiga").
create or replace function public._garden_award_points(
  p_profile_id   uuid,
  p_community_id uuid,
  p_source       text,
  p_source_id    uuid,
  p_points       integer,
  p_daily_cap    integer default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tz          text := public.garden_community_timezone(p_community_id);
  -- Idioma padrão do Postgres para "meia-noite local, como timestamptz
  -- comparável a created_at (UTC)": converte para hora local (naive),
  -- trunca nesse domínio local, converte de volta interpretando o
  -- resultado COMO sendo daquele fuso. Lida com qualquer fuso,
  -- inclusive com horário de verão, sem cálculo manual de offset.
  v_period      date := (date_trunc('month', now() at time zone v_tz))::date;
  v_day_start   timestamptz := (date_trunc('day', now() at time zone v_tz)) at time zone v_tz;
  v_day_end     timestamptz := v_day_start + interval '1 day';
  v_today_count integer;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(p_profile_id::text || ':' || p_community_id::text || ':' || v_period::text, 0)
  );

  if p_daily_cap is not null then
    select count(*) into v_today_count
    from public.garden_monthly_points
    where profile_id = p_profile_id
      and community_id = p_community_id
      and source = p_source
      and reversed_at is null
      and created_at >= v_day_start
      and created_at < v_day_end;

    if v_today_count >= p_daily_cap then
      return; -- limite diário atingido: a ação em si continua valendo, só não pontua
    end if;
  end if;

  insert into public.garden_monthly_points
    (profile_id, community_id, period_month, source, source_id, points)
  values
    (p_profile_id, p_community_id, v_period, p_source, p_source_id, p_points)
  on conflict (source, source_id, profile_id) do nothing;

  perform public._garden_recompute_completion(p_profile_id, p_community_id, v_period);
end;
$function$;

-- ---- 8 gatilhos de origem (um por fonte), AFTER INSERT ---------------
-- Inalterados da v1 — só chamam _garden_award_points, que já carrega
-- todas as correções acima. SECURITY DEFINER, à prova de exceção
-- (nunca bloqueia a ação original), mesmo padrão de notify_on_*.

create or replace function public._garden_points_on_post()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  begin
    perform public._garden_award_points(new.author_id, new.community_id, 'post', new.id, 5, 1);
  exception when others then null;
  end;
  return new;
end;
$function$;

drop trigger if exists trg_garden_points_on_post on public.posts;
create trigger trg_garden_points_on_post
  after insert on public.posts
  for each row execute function public._garden_points_on_post();

create or replace function public._garden_points_on_comment()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  v_community_id uuid;
begin
  begin
    select community_id into v_community_id from public.posts where id = new.post_id;
    if v_community_id is not null then
      perform public._garden_award_points(new.author_id, v_community_id, 'comment', new.id, 2, 3);
    end if;
  exception when others then null;
  end;
  return new;
end;
$function$;

drop trigger if exists trg_garden_points_on_comment on public.post_comments;
create trigger trg_garden_points_on_comment
  after insert on public.post_comments
  for each row execute function public._garden_points_on_comment();

create or replace function public._garden_points_on_reaction()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  v_community_id uuid;
begin
  begin
    select community_id into v_community_id from public.posts where id = new.post_id;
    if v_community_id is not null then
      perform public._garden_award_points(new.profile_id, v_community_id, 'reaction', new.id, 1, 5);
    end if;
  exception when others then null;
  end;
  return new;
end;
$function$;

drop trigger if exists trg_garden_points_on_reaction on public.post_reactions;
create trigger trg_garden_points_on_reaction
  after insert on public.post_reactions
  for each row execute function public._garden_points_on_reaction();

create or replace function public._garden_points_on_circle_join()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  v_community_id uuid;
begin
  begin
    select community_id into v_community_id from public.community_circles where id = new.circle_id;
    if v_community_id is not null then
      perform public._garden_award_points(new.profile_id, v_community_id, 'circle_join', new.id, 10);
    end if;
  exception when others then null;
  end;
  return new;
end;
$function$;

drop trigger if exists trg_garden_points_on_circle_join on public.circle_members;
create trigger trg_garden_points_on_circle_join
  after insert on public.circle_members
  for each row execute function public._garden_points_on_circle_join();

create or replace function public._garden_points_on_event_rsvp()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  v_community_id uuid;
begin
  begin
    select community_id into v_community_id from public.community_events where id = new.event_id;
    if v_community_id is not null then
      perform public._garden_award_points(new.profile_id, v_community_id, 'event_rsvp', new.id, 8);
    end if;
  exception when others then null;
  end;
  return new;
end;
$function$;

drop trigger if exists trg_garden_points_on_event_rsvp on public.event_participants;
create trigger trg_garden_points_on_event_rsvp
  after insert on public.event_participants
  for each row execute function public._garden_points_on_event_rsvp();

create or replace function public._garden_points_on_garden_day()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  v_community_id uuid;
begin
  begin
    select community_id into v_community_id from public.garden_challenges where id = new.challenge_id;
    if v_community_id is not null then
      perform public._garden_award_points(new.profile_id, v_community_id, 'garden_day', new.id, 6);
    end if;
  exception when others then null;
  end;
  return new;
end;
$function$;

drop trigger if exists trg_garden_points_on_garden_day on public.garden_completions;
create trigger trg_garden_points_on_garden_day
  after insert on public.garden_completions
  for each row execute function public._garden_points_on_garden_day();

create or replace function public._garden_points_on_garden_share()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  v_community_id uuid;
begin
  begin
    select community_id into v_community_id from public.garden_challenges where id = new.challenge_id;
    if v_community_id is not null then
      perform public._garden_award_points(new.profile_id, v_community_id, 'garden_share', new.id, 4);
    end if;
  exception when others then null;
  end;
  return new;
end;
$function$;

drop trigger if exists trg_garden_points_on_garden_share on public.garden_shares;
create trigger trg_garden_points_on_garden_share
  after insert on public.garden_shares
  for each row execute function public._garden_points_on_garden_share();

create or replace function public._garden_points_on_mood_checkin()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  begin
    perform public._garden_award_points(new.profile_id, new.community_id, 'mood_checkin', new.id, 3);
  exception when others then null;
  end;
  return new;
end;
$function$;

drop trigger if exists trg_garden_points_on_mood_checkin on public.daily_mood_entries;
create trigger trg_garden_points_on_mood_checkin
  after insert on public.daily_mood_entries
  for each row execute function public._garden_points_on_mood_checkin();

-- =====================================================================
-- SEÇÃO 5 — estorno e restauração (correção pós-auditoria, achado A)
-- =====================================================================
-- Nunca apaga a linha do ledger — só marca `reversed_at`. Idempotente
-- por construção: a cláusula WHERE só casa linhas no estado oposto ao
-- que se quer alcançar, então chamar duas vezes seguidas na mesma linha
-- só tem efeito na primeira. "Não estornar o que não pontuou" também é
-- automático: se não existe linha (ex.: a ação bateu no limite diário e
-- nunca chegou a ser inserida), o UPDATE casa zero linhas e não há
-- recálculo de conclusão para disparar.
create or replace function public._garden_reverse_points(p_source text, p_source_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_profile_id   uuid;
  v_community_id uuid;
  v_period       date;
begin
  update public.garden_monthly_points
    set reversed_at = now()
    where source = p_source and source_id = p_source_id and reversed_at is null
    returning profile_id, community_id, period_month into v_profile_id, v_community_id, v_period;

  if v_profile_id is not null then
    perform public._garden_recompute_completion(v_profile_id, v_community_id, v_period);
  end if;
end;
$function$;

comment on function public._garden_reverse_points(text, uuid) is
  'Etapa 6 (correção pós-auditoria, achado A): estorna (reversed_at = now()) os pontos de UMA atividade excluída/invalidada, sem apagar a linha do ledger. Idempotente — chamar de novo numa linha já estornada não faz nada.';

-- Restauração — usada hoje só pelo trigger de moderação de posts
-- (reocultar/desocultar, abaixo). "Comportamento consistente, sem
-- duplicar pontos": reativa a MESMA linha original (mesmo created_at,
-- mesmos points) em vez de inserir uma nova — nunca inventa pontos
-- novos nem duplica a concessão original.
create or replace function public._garden_restore_points(p_source text, p_source_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_profile_id   uuid;
  v_community_id uuid;
  v_period       date;
begin
  update public.garden_monthly_points
    set reversed_at = null
    where source = p_source and source_id = p_source_id and reversed_at is not null
    returning profile_id, community_id, period_month into v_profile_id, v_community_id, v_period;

  if v_profile_id is not null then
    perform public._garden_recompute_completion(v_profile_id, v_community_id, v_period);
  end if;
end;
$function$;

comment on function public._garden_restore_points(text, uuid) is
  'Etapa 6 (correção pós-auditoria, achado A): restaura (reversed_at = NULL) a MESMA linha do ledger estornada antes, sem criar nem duplicar pontos. Idempotente — chamar de novo numa linha já ativa não faz nada.';

-- ---- gatilho genérico de estorno por exclusão (8 fontes) -------------
-- UMA função parametrizada por TG_ARGV (nome da fonte), em vez de 8
-- quase-idênticas — menos risco de erro de digitação entre elas, mesmo
-- efeito de 8 funções dedicadas. AFTER DELETE em cada uma das 8 tabelas
-- de origem; cobre tanto exclusão direta (ex.: sair de um Círculo,
-- cancelar presença em evento, remover reação) quanto exclusão em
-- cascata (ex.: `moderate_post(..., 'remove')` apaga o post, e o
-- CASCADE já existente apaga post_comments/post_reactions daquele post
-- — cada DELETE em cascata dispara este mesmo gatilho na tabela filha,
-- estornando os pontos de quem comentou/reagiu também).
create or replace function public._garden_points_on_source_delete()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  begin
    perform public._garden_reverse_points(TG_ARGV[0], old.id);
  exception when others then null;
  end;
  return old;
end;
$function$;

drop trigger if exists trg_garden_points_reverse_on_post_delete on public.posts;
create trigger trg_garden_points_reverse_on_post_delete
  after delete on public.posts
  for each row execute function public._garden_points_on_source_delete('post');

drop trigger if exists trg_garden_points_reverse_on_comment_delete on public.post_comments;
create trigger trg_garden_points_reverse_on_comment_delete
  after delete on public.post_comments
  for each row execute function public._garden_points_on_source_delete('comment');

drop trigger if exists trg_garden_points_reverse_on_reaction_delete on public.post_reactions;
create trigger trg_garden_points_reverse_on_reaction_delete
  after delete on public.post_reactions
  for each row execute function public._garden_points_on_source_delete('reaction');

drop trigger if exists trg_garden_points_reverse_on_circle_leave on public.circle_members;
create trigger trg_garden_points_reverse_on_circle_leave
  after delete on public.circle_members
  for each row execute function public._garden_points_on_source_delete('circle_join');

drop trigger if exists trg_garden_points_reverse_on_event_cancel on public.event_participants;
create trigger trg_garden_points_reverse_on_event_cancel
  after delete on public.event_participants
  for each row execute function public._garden_points_on_source_delete('event_rsvp');

drop trigger if exists trg_garden_points_reverse_on_garden_day_delete on public.garden_completions;
create trigger trg_garden_points_reverse_on_garden_day_delete
  after delete on public.garden_completions
  for each row execute function public._garden_points_on_source_delete('garden_day');

drop trigger if exists trg_garden_points_reverse_on_garden_share_delete on public.garden_shares;
create trigger trg_garden_points_reverse_on_garden_share_delete
  after delete on public.garden_shares
  for each row execute function public._garden_points_on_source_delete('garden_share');

drop trigger if exists trg_garden_points_reverse_on_mood_delete on public.daily_mood_entries;
create trigger trg_garden_points_reverse_on_mood_delete
  after delete on public.daily_mood_entries
  for each row execute function public._garden_points_on_source_delete('mood_checkin');

-- ---- gatilho de moderação de posts (ocultar/desocultar) --------------
-- `posts.hidden_at` é moderação REVERSÍVEL (moderate_post 'hide'/
-- 'unhide', ver 20260905120000_professional_panel.sql) — diferente da
-- exclusão (`'remove'`, hard DELETE, já coberta pelo gatilho acima).
-- Ocultar invalida os pontos de "publicar um post" (estorna);
-- desocultar os restaura — nunca mexe nos pontos de quem comentou/
-- reagiu naquele post (ações independentes de outras pessoas, que
-- continuam válidas mesmo que o post em si seja ocultado depois).
create or replace function public._garden_points_on_post_moderation()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  begin
    if old.hidden_at is null and new.hidden_at is not null then
      perform public._garden_reverse_points('post', new.id);
    elsif old.hidden_at is not null and new.hidden_at is null then
      perform public._garden_restore_points('post', new.id);
    end if;
  exception when others then null;
  end;
  return new;
end;
$function$;

drop trigger if exists trg_garden_points_on_post_moderation on public.posts;
create trigger trg_garden_points_on_post_moderation
  after update of hidden_at on public.posts
  for each row execute function public._garden_points_on_post_moderation();

commit;

-- =====================================================================
-- Reversão (referência):
--
-- begin;
-- drop trigger if exists trg_garden_points_on_post_moderation on public.posts;
-- drop trigger if exists trg_garden_points_reverse_on_mood_delete on public.daily_mood_entries;
-- drop trigger if exists trg_garden_points_reverse_on_garden_share_delete on public.garden_shares;
-- drop trigger if exists trg_garden_points_reverse_on_garden_day_delete on public.garden_completions;
-- drop trigger if exists trg_garden_points_reverse_on_event_cancel on public.event_participants;
-- drop trigger if exists trg_garden_points_reverse_on_circle_leave on public.circle_members;
-- drop trigger if exists trg_garden_points_reverse_on_reaction_delete on public.post_reactions;
-- drop trigger if exists trg_garden_points_reverse_on_comment_delete on public.post_comments;
-- drop trigger if exists trg_garden_points_reverse_on_post_delete on public.posts;
-- drop function if exists public._garden_points_on_post_moderation();
-- drop function if exists public._garden_points_on_source_delete();
-- drop function if exists public._garden_restore_points(text, uuid);
-- drop function if exists public._garden_reverse_points(text, uuid);
-- drop trigger if exists trg_garden_points_on_mood_checkin on public.daily_mood_entries;
-- drop trigger if exists trg_garden_points_on_garden_share on public.garden_shares;
-- drop trigger if exists trg_garden_points_on_garden_day on public.garden_completions;
-- drop trigger if exists trg_garden_points_on_event_rsvp on public.event_participants;
-- drop trigger if exists trg_garden_points_on_circle_join on public.circle_members;
-- drop trigger if exists trg_garden_points_on_reaction on public.post_reactions;
-- drop trigger if exists trg_garden_points_on_comment on public.post_comments;
-- drop trigger if exists trg_garden_points_on_post on public.posts;
-- drop function if exists public._garden_points_on_mood_checkin();
-- drop function if exists public._garden_points_on_garden_share();
-- drop function if exists public._garden_points_on_garden_day();
-- drop function if exists public._garden_points_on_event_rsvp();
-- drop function if exists public._garden_points_on_circle_join();
-- drop function if exists public._garden_points_on_reaction();
-- drop function if exists public._garden_points_on_comment();
-- drop function if exists public._garden_points_on_post();
-- drop function if exists public._garden_award_points(uuid,uuid,text,uuid,integer,integer);
-- drop function if exists public._garden_recompute_completion(uuid,uuid,date);
-- revoke select on table public.garden_monthly_completions from authenticated, service_role;
-- revoke select on table public.garden_monthly_points from authenticated, service_role;
-- drop table if exists public.garden_monthly_completions;
-- drop table if exists public.garden_monthly_points;
-- drop function if exists public.garden_annual_cycle_bounds(timestamptz, text);
-- drop function if exists public.garden_monthly_points_goal();
-- drop function if exists public.garden_community_timezone(uuid);
-- alter table public.communities drop column if exists timezone;
-- commit;
-- =====================================================================
