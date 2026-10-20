-- =====================================================================
-- Meu Jardim — desafios de duração configurável, atividades diárias,
-- participação, conclusão e compartilhamento visual no feed
-- =====================================================================
-- 100% ADITIVO. Nenhuma tabela/coluna/função existente é removida.
-- NÃO reconstrói o sistema antigo de Challenges/Points/Achievements
-- (removido definitivamente em 20261007120000 + 20261008120000) — este
-- é um módulo novo, com nomes e regras próprias (garden_*), sem pontos,
-- sem saldo, sem ranking, sem conquistas.
--
-- Tabelas novas: garden_challenges, garden_challenge_days,
-- garden_enrollments, garden_completions, garden_daily_posts,
-- garden_shares.
--
-- INTEGRIDADE / HISTÓRICO (requisito explícito):
--   • garden_challenge_days.challenge_id, garden_enrollments.challenge_id,
--     garden_completions.challenge_id/challenge_day_id/enrollment_id,
--     garden_daily_posts.challenge_id/challenge_day_id e
--     garden_shares.challenge_id/challenge_day_id/completion_id usam
--     ON DELETE RESTRICT — um desafio ou dia com qualquer histórico
--     dependente (inscrição, conclusão, publicação) NÃO PODE ser
--     excluído; só arquivado (status='archived', trigger abaixo impede
--     reverter). "Excluir desafio vazio" continua possível: RLS de
--     DELETE já exige status='draft', e um desafio draft nunca tem
--     histórico (não há como se inscrever/concluir/publicar incentivo
--     em desafio não publicado) — o RESTRICT é o cinto-e-suspensório.
--   • garden_completions e garden_shares NÃO têm policy de UPDATE/DELETE
--     — histórico de conclusão/publicação é imutável pelo cliente.
--   • Substituir uma mensagem de incentivo da profissional = publicar
--     uma NOVA linha em garden_daily_posts/posts; não há UPDATE nem
--     DELETE nessas tabelas — a publicação anterior nunca é apagada.
--
-- FUNÇÕES DE NEGÓCIO: SECURITY INVOKER (decisão explícita desta fase,
-- diferente do padrão SECURITY DEFINER usado no restante do projeto).
-- Cada INSERT/UPDATE que elas fazem roda com o papel de quem chamou e
-- passa pela RLS normalmente — a função só orquestra passos (gerar N
-- dias, congelar um snapshot, criar post + linha companheira na mesma
-- transação) e levanta exceções de negócio com mensagem clara antes de
-- tentar a escrita. A autorização "de verdade" mora nas policies.
-- `garden_can_enroll` é a única exceção: é um PREDICADO (só leitura,
-- nenhuma escrita) usado DENTRO de uma policy de RLS — mesma categoria
-- de is_community_member/owns_community já existentes, que também são
-- SECURITY DEFINER para evitar recursão de RLS entre tabelas. Não é
-- uma "função de negócio".
--
-- Liberação de atividade: activity_date <= current_date (fuso do
-- servidor/Postgres). Validado em garden_complete_day (não só no
-- cliente).
--
-- Cores pessoais: 2 colunas novas em `profiles` (não uma tabela nova —
-- é 1 valor por pessoa, mesmo padrão já usado por `bio`/`city`/
-- `gallery_photos` em profiles). `garden_shares` congela uma CÓPIA das
-- cores (e de título/dia/progresso) no momento da publicação — mudar a
-- cor do perfil depois, ou editar o desafio/dia, nunca altera uma
-- publicação já feita.
--
-- Transacional, reversível (rodapé). Idempotente onde faz sentido
-- (add column/create table/index IF NOT EXISTS, drop policy/constraint
-- if exists + create); CREATE TABLE sem IF NOT EXISTS porque são
-- tabelas 100% novas desta fase (confirmado: não existem no projeto de
-- teste).
-- =====================================================================

begin;

-- ======================================================================
-- 1) profiles — duas cores pessoais
-- ======================================================================
alter table public.profiles add column if not exists garden_color_one text;
alter table public.profiles add column if not exists garden_color_two text;

alter table public.profiles drop constraint if exists profiles_garden_colors_check;
alter table public.profiles add constraint profiles_garden_colors_check
  check (
    (garden_color_one is null or garden_color_one in
      ('sage','rose','peach','lavender','sky','sand','terracotta'))
    and (garden_color_two is null or garden_color_two in
      ('sage','rose','peach','lavender','sky','sand','terracotta'))
    and (garden_color_one is null or garden_color_two is null
      or garden_color_one <> garden_color_two)
  );
-- profiles já tem `grant select, update to authenticated` e a policy
-- `profiles_update` (id = auth.uid() OR is_master()) — colunas novas
-- entram sob essas mesmas regras, sem GRANT nem policy nova (mesma
-- análise já feita em 20261015120000_profile_gallery_photos.sql). A
-- trigger `prevent_role_escalation` só reage à coluna `role` — não
-- afeta nem é afetada por estas duas colunas novas.

-- ======================================================================
-- 2) posts.post_type — dois tipos novos
-- ======================================================================
alter table public.posts drop constraint if exists posts_post_type_check;
alter table public.posts add constraint posts_post_type_check
  check (post_type = any (array[
    'standard'::text,
    'daily_question'::text,
    'checkin_share'::text,
    'engagement_command'::text,
    'garden_daily'::text,
    'garden_share'::text
  ]));
-- `posts_insert` (author_id = auth.uid() AND (owns_community OR
-- is_community_member)) NÃO é alterada — mesma regra de hoje. A
-- garantia extra de "só a profissional publica garden_daily" /
-- "só quem completou pode publicar garden_share" mora nas funções de
-- negócio (seção 9) e nas policies de INSERT de garden_daily_posts /
-- garden_shares (sem linha companheira válida, o post fica sem o
-- card rico — mesmo comportamento de posts "órfãos" que o projeto já
-- tolera para daily_question/engagement_command).

-- ======================================================================
-- 3) garden_challenges
-- ======================================================================
create table public.garden_challenges (
  id                     uuid not null default gen_random_uuid(),
  community_id           uuid not null,
  created_by             uuid not null,
  title                  text not null,
  description            text,
  status                 text not null default 'draft',
  -- Teto de 90 dias: limite defensivo (não veio da especificação) —
  -- evita geração de milhares de linhas por engano. Fácil de ampliar
  -- depois se a produto precisar de desafios mais longos.
  duration_days          integer not null,
  starts_on              date not null,
  enrollment_opens_at    timestamptz,
  enrollment_closes_at   timestamptz,
  allow_late_enrollment  boolean not null default false,
  cover_image_url        text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  archived_at            timestamptz,
  constraint garden_challenges_pkey primary key (id),
  constraint garden_challenges_community_id_fkey foreign key (community_id)
    references public.communities (id) on delete cascade,
  constraint garden_challenges_created_by_fkey foreign key (created_by)
    references public.profiles (id),
  constraint garden_challenges_status_check
    check (status in ('draft', 'published', 'archived')),
  constraint garden_challenges_duration_days_check
    check (duration_days >= 1 and duration_days <= 90),
  constraint garden_challenges_enrollment_window_check
    check (enrollment_opens_at is null or enrollment_closes_at is null
      or enrollment_closes_at >= enrollment_opens_at)
);

create index garden_challenges_community_id_idx on public.garden_challenges (community_id);
create index garden_challenges_status_idx on public.garden_challenges (status);

alter table public.garden_challenges enable row level security;

-- SELECT: publicado + membro da comunidade; dona/Master veem sempre
-- (inclusive rascunho/arquivado, para gerir).
create policy "garden_challenges_select" on public.garden_challenges for select to public
  using (
    (status = 'published' and public.is_community_member(community_id))
    or public.owns_community(community_id)
    or public.is_master()
  );

create policy "garden_challenges_insert" on public.garden_challenges for insert to public
  with check (created_by = auth.uid() and public.owns_community(community_id));

-- USING roda sobre a linha ANTES do update: status <> 'archived' aqui
-- barra QUALQUER alteração (não só de status) depois de arquivado —
-- "arquivar" passa a congelar título/descrição/datas/capa também, não
-- só impedir voltar a draft/published (isso já é a trigger abaixo). A
-- própria transição draft/published -> archived continua permitida,
-- porque a linha ANTIGA ainda não está arquivada quando ela acontece.
create policy "garden_challenges_update" on public.garden_challenges for update to public
  using (public.owns_community(community_id) and status <> 'archived')
  with check (public.owns_community(community_id));

-- DELETE: só rascunho, só a dona. "Vazio" (sem dias/inscrições/
-- histórico) é garantido pelo RESTRICT das FKs que apontam para cá —
-- se houver qualquer garden_challenge_days, o DELETE falha com
-- foreign_key_violation (23503) antes de chegar a qualquer dependente
-- mais fundo.
create policy "garden_challenges_delete" on public.garden_challenges for delete to public
  using (public.owns_community(community_id) and status = 'draft');

grant select, insert, update, delete on table public.garden_challenges to authenticated;

-- updated_at automático (reaproveita a trigger genérica já existente).
create trigger trg_garden_challenges_updated_at
before update on public.garden_challenges
for each row execute function public.set_updated_at();

-- 'archived' é terminal: uma vez arquivado, não pode voltar a
-- draft/published. Arquivar continua possível a partir de qualquer
-- status (abandonar um rascunho também é uma forma de "arquivar em vez
-- de excluir" quando já existe algum histórico que bloquearia o
-- DELETE).
create or replace function public.garden_challenges_status_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'archived' and new.status <> 'archived' then
    raise exception 'challenge_archived_is_final' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger trg_garden_challenges_status_guard
before update of status on public.garden_challenges
for each row execute function public.garden_challenges_status_guard();

-- ======================================================================
-- 4) garden_challenge_days
-- ======================================================================
create table public.garden_challenge_days (
  id                     uuid not null default gen_random_uuid(),
  challenge_id           uuid not null,
  day_number             integer not null,
  activity_date          date not null,
  title                  text not null default '',
  instructions           text,
  icon                   text,
  encouragement_message  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint garden_challenge_days_pkey primary key (id),
  constraint garden_challenge_days_challenge_id_fkey foreign key (challenge_id)
    references public.garden_challenges (id) on delete restrict,
  constraint garden_challenge_days_day_number_check check (day_number >= 1),
  constraint garden_challenge_days_challenge_id_day_number_key
    unique (challenge_id, day_number),
  constraint garden_challenge_days_challenge_id_activity_date_key
    unique (challenge_id, activity_date)
);

create index garden_challenge_days_challenge_id_idx on public.garden_challenge_days (challenge_id);

alter table public.garden_challenge_days enable row level security;

create policy "garden_challenge_days_select" on public.garden_challenge_days for select to public
  using (
    exists (
      select 1 from public.garden_challenges c
      where c.id = garden_challenge_days.challenge_id
        and (
          (c.status = 'published' and public.is_community_member(c.community_id))
          or public.owns_community(c.community_id)
          or public.is_master()
        )
    )
  );

-- INSERT/UPDATE/DELETE exigem, além da dona, que o desafio NÃO esteja
-- arquivado — "edição individual" (inclusive depois de publicado)
-- continua liberada; depois de arquivado, os dias ficam tão congelados
-- quanto o próprio desafio (ver garden_challenges_update).
create policy "garden_challenge_days_insert" on public.garden_challenge_days for insert to public
  with check (
    exists (
      select 1 from public.garden_challenges c
      where c.id = garden_challenge_days.challenge_id
        and public.owns_community(c.community_id)
        and c.status <> 'archived'
    )
  );

-- WITH CHECK repete `status <> 'archived'` (não só ownership) para o
-- challenge_id da linha NOVA: sem isso, a dona de dois desafios
-- poderia reatribuir (mudar challenge_id) um dia de um desafio ainda
-- ativo para outro já arquivado, furando o congelamento que
-- garden_challenges_update garante para o desafio em si. A UPDATE
-- comum (só editar título/instruções/ícone/incentivo/data, sem tocar
-- em challenge_id) não muda esse valor — continua passando pelos dois
-- lados normalmente.
create policy "garden_challenge_days_update" on public.garden_challenge_days for update to public
  using (
    exists (
      select 1 from public.garden_challenges c
      where c.id = garden_challenge_days.challenge_id
        and public.owns_community(c.community_id)
        and c.status <> 'archived'
    )
  )
  with check (
    exists (
      select 1 from public.garden_challenges c
      where c.id = garden_challenge_days.challenge_id
        and public.owns_community(c.community_id)
        and c.status <> 'archived'
    )
  );

-- DELETE: mesma regra (dona, desafio não arquivado). RESTRICT em
-- garden_completions/garden_daily_posts já impede apagar um dia com
-- conclusão ou publicação registrada.
create policy "garden_challenge_days_delete" on public.garden_challenge_days for delete to public
  using (
    exists (
      select 1 from public.garden_challenges c
      where c.id = garden_challenge_days.challenge_id
        and public.owns_community(c.community_id)
        and c.status <> 'archived'
    )
  );

grant select, insert, update, delete on table public.garden_challenge_days to authenticated;

create trigger trg_garden_challenge_days_updated_at
before update on public.garden_challenge_days
for each row execute function public.set_updated_at();

-- ======================================================================
-- 5) garden_enrollments — participação do Member
-- ======================================================================
create table public.garden_enrollments (
  id            uuid not null default gen_random_uuid(),
  challenge_id  uuid not null,
  profile_id    uuid not null,
  enrolled_at   timestamptz not null default now(),
  constraint garden_enrollments_pkey primary key (id),
  constraint garden_enrollments_challenge_id_fkey foreign key (challenge_id)
    references public.garden_challenges (id) on delete restrict,
  constraint garden_enrollments_profile_id_fkey foreign key (profile_id)
    references public.profiles (id) on delete cascade,
  constraint garden_enrollments_challenge_id_profile_id_key
    unique (challenge_id, profile_id)
);

create index garden_enrollments_challenge_id_idx on public.garden_enrollments (challenge_id);
create index garden_enrollments_profile_id_idx on public.garden_enrollments (profile_id);

alter table public.garden_enrollments enable row level security;

-- A própria participante vê sua inscrição; dona/Master veem todas as
-- inscrições dos desafios que administram (lista de participantes).
create policy "garden_enrollments_select" on public.garden_enrollments for select to public
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.garden_challenges c
      where c.id = garden_enrollments.challenge_id
        and (public.owns_community(c.community_id) or public.is_master())
    )
  );

-- Predicado (SECURITY DEFINER, só leitura) usado pela policy de INSERT
-- abaixo: publicado + membro da comunidade + dentro da janela de
-- inscrição (ou inscrição tardia permitida, mas sempre depois da
-- abertura — "tardia" é depois do fechamento, nunca antes do início).
create or replace function public.garden_can_enroll(p_challenge_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.garden_challenges c
    where c.id = p_challenge_id
      and c.status = 'published'
      and public.is_community_member(c.community_id)
      and now() >= coalesce(c.enrollment_opens_at, '-infinity'::timestamptz)
      and (
        c.allow_late_enrollment
        or now() <= coalesce(c.enrollment_closes_at, 'infinity'::timestamptz)
      )
  );
$$;

grant execute on function public.garden_can_enroll(uuid) to authenticated;

-- INSERT direto do cliente (mesmo molde de useEvents.rsvp): sem RPC —
-- a policy JÁ valida tudo via garden_can_enroll. UNIQUE(challenge_id,
-- profile_id) evita duplicação; o hook trata "duplicate key" como
-- sucesso silencioso, igual a rsvp().
create policy "garden_enrollments_insert" on public.garden_enrollments for insert to public
  with check (profile_id = auth.uid() and public.garden_can_enroll(challenge_id));

-- Sem UPDATE/DELETE: não há "cancelar inscrição" nesta fase (não
-- pedido pela especificação); mantém o histórico de participação
-- estável para garden_completions/garden_shares.
grant select, insert on table public.garden_enrollments to authenticated;

-- ======================================================================
-- 6) garden_completions — conclusão de atividade
-- ======================================================================
create table public.garden_completions (
  id                uuid not null default gen_random_uuid(),
  challenge_id      uuid not null,
  challenge_day_id  uuid not null,
  enrollment_id     uuid not null,
  profile_id        uuid not null,
  completed_at      timestamptz not null default now(),
  constraint garden_completions_pkey primary key (id),
  constraint garden_completions_challenge_id_fkey foreign key (challenge_id)
    references public.garden_challenges (id) on delete restrict,
  constraint garden_completions_challenge_day_id_fkey foreign key (challenge_day_id)
    references public.garden_challenge_days (id) on delete restrict,
  constraint garden_completions_enrollment_id_fkey foreign key (enrollment_id)
    references public.garden_enrollments (id) on delete restrict,
  constraint garden_completions_profile_id_fkey foreign key (profile_id)
    references public.profiles (id) on delete cascade,
  constraint garden_completions_challenge_day_id_profile_id_key
    unique (challenge_day_id, profile_id)
);

create index garden_completions_challenge_id_idx on public.garden_completions (challenge_id);
create index garden_completions_challenge_day_id_idx on public.garden_completions (challenge_day_id);
create index garden_completions_profile_id_idx on public.garden_completions (profile_id);

alter table public.garden_completions enable row level security;

create policy "garden_completions_select" on public.garden_completions for select to public
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.garden_challenges c
      where c.id = garden_completions.challenge_id
        and (public.owns_community(c.community_id) or public.is_master())
    )
  );

-- INSERT: a policy É a autorização de verdade (não só a função) —
-- garden_complete_day é SECURITY INVOKER, então um INSERT direto na
-- tabela (sem passar pela função) teria que ser barrado AQUI, ou a
-- validação da função vira decoração. Confere na mesma consulta:
--   • o dia (challenge_day_id) pertence mesmo ao desafio informado;
--   • o desafio está publicado (não arquivado/rascunho);
--   • já passou a data de liberação (activity_date <= hoje);
--   • a inscrição (enrollment_id) é da PRÓPRIA pessoa, no MESMO
--     desafio — impede completar em nome de outra inscrição.
create policy "garden_completions_insert" on public.garden_completions for insert to public
  with check (
    profile_id = auth.uid()
    and exists (
      select 1
      from public.garden_challenge_days d
      join public.garden_challenges c on c.id = d.challenge_id
      join public.garden_enrollments e on e.challenge_id = c.id
      where d.id = garden_completions.challenge_day_id
        and c.id = garden_completions.challenge_id
        and e.id = garden_completions.enrollment_id
        and e.profile_id = garden_completions.profile_id
        and c.status = 'published'
        and d.activity_date <= current_date
    )
  );

-- Sem UPDATE/DELETE: histórico de conclusão é imutável pelo cliente.
grant select, insert on table public.garden_completions to authenticated;

-- completed_at: o DEFAULT now() só vale quando o cliente OMITE a
-- coluna — um INSERT direto (fora de garden_complete_day) ainda
-- poderia enviar um completed_at arbitrário (passado ou futuro), já
-- que isso não é algo que RLS valide (não é uma condição de
-- autorização, é um valor de dado). Trigger força now() SEMPRE, no
-- servidor, independente do que vier do cliente — mesma semântica que
-- created_at/updated_at já têm em toda tabela deste projeto (o
-- relógio do servidor é a fonte da verdade). Não muda nada para o
-- caminho legítimo: garden_complete_day nunca define completed_at
-- explicitamente, já contava com o DEFAULT.
create or replace function public.garden_completions_set_completed_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.completed_at := now();
  return new;
end;
$$;

create trigger trg_garden_completions_set_completed_at
before insert on public.garden_completions
for each row execute function public.garden_completions_set_completed_at();

-- ======================================================================
-- 7) garden_daily_posts — mensagem de incentivo da profissional no feed
-- ======================================================================
create table public.garden_daily_posts (
  id                uuid not null default gen_random_uuid(),
  challenge_id      uuid not null,
  challenge_day_id  uuid not null,
  post_id           uuid not null,
  created_by        uuid not null,
  message           text not null,
  created_at        timestamptz not null default now(),
  constraint garden_daily_posts_pkey primary key (id),
  constraint garden_daily_posts_challenge_id_fkey foreign key (challenge_id)
    references public.garden_challenges (id) on delete restrict,
  constraint garden_daily_posts_challenge_day_id_fkey foreign key (challenge_day_id)
    references public.garden_challenge_days (id) on delete restrict,
  constraint garden_daily_posts_post_id_fkey foreign key (post_id)
    references public.posts (id) on delete cascade,
  constraint garden_daily_posts_post_id_key unique (post_id),
  constraint garden_daily_posts_created_by_fkey foreign key (created_by)
    references public.profiles (id)
);

create index garden_daily_posts_challenge_id_idx on public.garden_daily_posts (challenge_id);
create index garden_daily_posts_challenge_day_id_idx on public.garden_daily_posts (challenge_day_id);

alter table public.garden_daily_posts enable row level security;

create policy "garden_daily_posts_select" on public.garden_daily_posts for select to public
  using (
    exists (
      select 1 from public.garden_challenges c
      where c.id = garden_daily_posts.challenge_id
        and (
          (c.status = 'published' and public.is_community_member(c.community_id))
          or public.owns_community(c.community_id)
          or public.is_master()
        )
    )
  );

-- status = 'published', o vínculo challenge_day_id -> challenge_id E a
-- coerência com o post (author_id/post_type/community_id) AQUI (não só
-- em garden_publish_daily_post): a função é SECURITY INVOKER — suas
-- checagens antes de inserir não são a autorização de verdade, são só
-- uma mensagem de erro melhor. Sem repetir a regra na própria policy,
-- um INSERT direto em garden_daily_posts (sem passar pela função)
-- poderia: (a) declarar um challenge_day_id de OUTRO desafio junto com
-- um challenge_id publicado qualquer; ou (b) apontar post_id para um
-- post qualquer já existente (de outro author_id, outro post_type ou
-- outra comunidade) em vez do post recém-criado para esta publicação.
-- A policy é o que realmente autoriza — o JOIN com posts garante que
-- post_id só pode ser um post da PRÓPRIA pessoa (author_id =
-- created_by), do tipo certo (post_type = 'garden_daily') e da MESMA
-- comunidade do desafio.
create policy "garden_daily_posts_insert" on public.garden_daily_posts for insert to public
  with check (
    created_by = auth.uid()
    and exists (
      select 1
      from public.garden_challenge_days d
      join public.garden_challenges c on c.id = d.challenge_id
      join public.posts p on p.id = garden_daily_posts.post_id
      where d.id = garden_daily_posts.challenge_day_id
        and c.id = garden_daily_posts.challenge_id
        and c.status = 'published'
        and public.owns_community(c.community_id)
        and p.author_id = garden_daily_posts.created_by
        and p.post_type = 'garden_daily'
        and p.community_id = c.community_id
    )
  );

-- Sem UPDATE/DELETE: "substituir não apaga a anterior" — cada
-- incentivo novo é uma linha (e um post) novos.
grant select, insert on table public.garden_daily_posts to authenticated;

-- ======================================================================
-- 8) garden_shares — compartilhamento de conclusão pelo Member
-- ======================================================================
-- Todas as colunas de snapshot (challenge_title/day_number/day_title/
-- days_completed/total_days/color_one/color_two) são preenchidas pela
-- função garden_share_completion (seção 9) a partir do estado NO
-- MOMENTO do compartilhamento — nunca recalculadas depois. Editar o
-- desafio/dia ou trocar as cores do perfil mais tarde NÃO altera uma
-- publicação já feita.
create table public.garden_shares (
  id                uuid not null default gen_random_uuid(),
  challenge_id      uuid not null,
  challenge_day_id  uuid not null,
  completion_id     uuid not null,
  profile_id        uuid not null,
  post_id           uuid not null,
  challenge_title   text not null,
  day_number        integer not null,
  day_title         text not null,
  days_completed    integer not null,
  total_days        integer not null,
  color_one         text,
  color_two         text,
  created_at        timestamptz not null default now(),
  constraint garden_shares_pkey primary key (id),
  constraint garden_shares_challenge_id_fkey foreign key (challenge_id)
    references public.garden_challenges (id) on delete restrict,
  constraint garden_shares_challenge_day_id_fkey foreign key (challenge_day_id)
    references public.garden_challenge_days (id) on delete restrict,
  constraint garden_shares_completion_id_fkey foreign key (completion_id)
    references public.garden_completions (id) on delete restrict,
  constraint garden_shares_completion_id_key unique (completion_id),
  constraint garden_shares_profile_id_fkey foreign key (profile_id)
    references public.profiles (id) on delete cascade,
  constraint garden_shares_post_id_fkey foreign key (post_id)
    references public.posts (id) on delete cascade,
  constraint garden_shares_post_id_key unique (post_id)
);

create index garden_shares_challenge_id_idx on public.garden_shares (challenge_id);
create index garden_shares_profile_id_idx on public.garden_shares (profile_id);

alter table public.garden_shares enable row level security;

-- Visível para toda a comunidade do desafio (é conteúdo de Feed) —
-- mesmo alcance de posts_select para a comunidade; dona/Master sempre.
create policy "garden_shares_select" on public.garden_shares for select to public
  using (
    exists (
      select 1 from public.garden_challenges c
      where c.id = garden_shares.challenge_id
        and (
          public.is_community_member(c.community_id)
          or public.owns_community(c.community_id)
          or public.is_master()
        )
    )
  );

-- INSERT: a policy é a autorização de verdade — cobre o VÍNCULO
-- (completion_id/challenge_id/challenge_day_id/post_id) e os campos de
-- snapshot que dá para validar SEM criar uma corrida contra uma edição
-- concorrente e legítima:
--   • completion_id é uma conclusão REAL, da PRÓPRIA pessoa, e
--     challenge_id/challenge_day_id batem com os da conclusão — sem
--     isso, um INSERT direto poderia referenciar a conclusão de outra
--     pessoa ou declarar um desafio/dia diferente do concluído;
--   • post_id aponta para um post da PRÓPRIA pessoa (author_id =
--     profile_id), do tipo certo (post_type = 'garden_share') e da
--     MESMA comunidade do desafio — mesmo raciocínio de
--     garden_daily_posts_insert; posts não tem UPDATE exposto ao
--     cliente, então esses 3 campos não mudam depois de criado — sem
--     corrida possível aqui;
--   • day_number precisa bater com o dia real (não é editável pela UI
--     e não há corrida prática);
--   • days_completed não pode ser MAIOR que a contagem real de
--     conclusões da pessoa nesse desafio agora (<=, não =): barra
--     inflar o progresso (a mentira que importa) sem rejeitar um
--     compartilhamento legítimo só porque a pessoa concluiu OUTRO dia
--     nos milissegundos entre a função calcular o valor e este INSERT
--     rodar — nesse caso o snapshot fica um pouco conservador, nunca
--     inflado, e a chamada legítima não quebra;
--   • color_one/color_two precisam bater com as cores do PRÓPRIO
--     perfil agora (IS NOT DISTINCT FROM — comparação segura com NULL).
-- challenge_title/day_title/total_days (duration_days) NÃO são
-- comparados contra o valor "ao vivo" aqui DE PROPÓSITO: são campos
-- editáveis pela profissional mesmo com o desafio publicado
-- (garden_challenges_update/garden_challenge_days_update não travam
-- isso) — exigir igualdade exata correria o risco real de rejeitar um
-- compartilhamento legítimo só porque a profissional editou o
-- título/duração do desafio ou o título do dia no instante exato entre
-- a função ler esses valores e este INSERT rodar (cada SELECT da
-- função roda sob seu próprio snapshot em READ COMMITTED). Uma pessoa
-- poder "mentir" sobre o TEXTO do título/dia exibido no seu próprio
-- post tem o mesmo nível de confiança que o `content` livre de
-- qualquer post já tem no projeto — não é uma falha de autorização.
-- UNIQUE(completion_id) e UNIQUE(post_id) (seção 8) continuam sendo o
-- backstop final contra duas publicações para a mesma conclusão/post,
-- independente de RLS.
create policy "garden_shares_insert" on public.garden_shares for insert to public
  with check (
    profile_id = auth.uid()
    and exists (
      select 1
      from public.garden_completions comp
      join public.garden_challenges ch on ch.id = comp.challenge_id
      join public.garden_challenge_days d on d.id = comp.challenge_day_id
      join public.posts p on p.id = garden_shares.post_id
      where comp.id = garden_shares.completion_id
        and comp.profile_id = garden_shares.profile_id
        and comp.challenge_id = garden_shares.challenge_id
        and comp.challenge_day_id = garden_shares.challenge_day_id
        and p.author_id = garden_shares.profile_id
        and p.post_type = 'garden_share'
        and p.community_id = ch.community_id
        and garden_shares.day_number = d.day_number
        and garden_shares.days_completed <= (
          select count(*) from public.garden_completions gc
          where gc.challenge_id = comp.challenge_id and gc.profile_id = garden_shares.profile_id
        )
        and garden_shares.color_one is not distinct from (
          select pr.garden_color_one from public.profiles pr where pr.id = garden_shares.profile_id
        )
        and garden_shares.color_two is not distinct from (
          select pr.garden_color_two from public.profiles pr where pr.id = garden_shares.profile_id
        )
    )
  );

-- Sem UPDATE/DELETE: publicação congelada é imutável pelo cliente.
grant select, insert on table public.garden_shares to authenticated;

-- ======================================================================
-- 9) Funções de negócio — SECURITY INVOKER (ver nota no topo do arquivo)
-- ======================================================================

-- ---- 9.1) garden_generate_challenge_days ------------------------------
-- Gera (substituindo) os dias 1..duration_days a partir de starts_on,
-- pulando sábado/domingo. Só em desafio ainda 'draft' (nunca há
-- histórico para perder nesse status — point reforçado pelo RESTRICT
-- das FKs de qualquer forma). Reexecutável enquanto durar o rascunho
-- (ex.: professional muda a duração/início e gera de novo).
create or replace function public.garden_generate_challenge_days(p_challenge_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_challenge public.garden_challenges;
  v_cursor date;
  v_day integer;
begin
  select * into v_challenge from public.garden_challenges where id = p_challenge_id;

  if v_challenge.id is null then
    raise exception 'challenge_not_found' using errcode = 'no_data_found';
  end if;

  if not public.owns_community(v_challenge.community_id) then
    raise exception 'not_authorized' using errcode = 'insufficient_privilege';
  end if;

  if v_challenge.status <> 'draft' then
    raise exception 'challenge_not_draft' using errcode = 'check_violation';
  end if;

  delete from public.garden_challenge_days where challenge_id = p_challenge_id;

  v_cursor := v_challenge.starts_on;
  while extract(dow from v_cursor) in (0, 6) loop
    v_cursor := v_cursor + 1;
  end loop;

  for v_day in 1..v_challenge.duration_days loop
    insert into public.garden_challenge_days (challenge_id, day_number, activity_date, title)
    values (p_challenge_id, v_day, v_cursor, 'Dia ' || v_day);

    v_cursor := v_cursor + 1;
    while extract(dow from v_cursor) in (0, 6) loop
      v_cursor := v_cursor + 1;
    end loop;
  end loop;
end;
$$;

grant execute on function public.garden_generate_challenge_days(uuid) to authenticated;

-- ---- 9.2) garden_publish_challenge ------------------------------------
-- draft -> published. Exige pelo menos 1 dia cadastrado.
create or replace function public.garden_publish_challenge(p_challenge_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_challenge public.garden_challenges;
  v_day_count integer;
begin
  select * into v_challenge from public.garden_challenges where id = p_challenge_id;

  if v_challenge.id is null then
    raise exception 'challenge_not_found' using errcode = 'no_data_found';
  end if;

  if not public.owns_community(v_challenge.community_id) then
    raise exception 'not_authorized' using errcode = 'insufficient_privilege';
  end if;

  if v_challenge.status <> 'draft' then
    raise exception 'challenge_not_draft' using errcode = 'check_violation';
  end if;

  select count(*) into v_day_count from public.garden_challenge_days where challenge_id = p_challenge_id;
  if v_day_count = 0 then
    raise exception 'challenge_has_no_days' using errcode = 'check_violation';
  end if;

  update public.garden_challenges set status = 'published' where id = p_challenge_id;
end;
$$;

grant execute on function public.garden_publish_challenge(uuid) to authenticated;

-- ---- 9.3) garden_complete_day ------------------------------------------
-- Marca a atividade do dia como concluída para quem chama. Valida (no
-- banco, não só no cliente): inscrita no desafio e dia já liberado
-- (activity_date <= current_date). Idempotente: se já concluído,
-- devolve a linha existente em vez de erro (evita duplicação sem
-- travar a UI) — tanto no caso comum (SELECT antes do INSERT) quanto
-- na CORRIDA genuína (duas chamadas concorrentes passam pelo SELECT
-- antes de qualquer uma commitar o INSERT): o bloco EXCEPTION abaixo
-- captura só unique_violation (23505) da UNIQUE(challenge_day_id,
-- profile_id) e devolve a linha que a chamada concorrente já inseriu,
-- em vez de propagar o erro bruto do Postgres para quem perdeu a
-- corrida. Qualquer outro tipo de erro continua subindo normalmente —
-- nada além de unique_violation é interceptado.
create or replace function public.garden_complete_day(p_challenge_day_id uuid)
returns public.garden_completions
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_challenge_id uuid;
  v_activity_date date;
  v_enrollment_id uuid;
  v_profile_id uuid := auth.uid();
  v_row public.garden_completions;
begin
  if v_profile_id is null then
    raise exception 'not_authenticated' using errcode = 'insufficient_privilege';
  end if;

  select challenge_id, activity_date into v_challenge_id, v_activity_date
  from public.garden_challenge_days
  where id = p_challenge_day_id;

  if v_challenge_id is null then
    raise exception 'day_not_found' using errcode = 'no_data_found';
  end if;

  if v_activity_date > current_date then
    raise exception 'day_not_released' using errcode = 'check_violation';
  end if;

  select id into v_enrollment_id
  from public.garden_enrollments
  where challenge_id = v_challenge_id and profile_id = v_profile_id;

  if v_enrollment_id is null then
    raise exception 'not_enrolled' using errcode = 'insufficient_privilege';
  end if;

  select * into v_row
  from public.garden_completions
  where challenge_day_id = p_challenge_day_id and profile_id = v_profile_id;

  if found then
    return v_row;
  end if;

  begin
    insert into public.garden_completions (challenge_id, challenge_day_id, enrollment_id, profile_id)
    values (v_challenge_id, p_challenge_day_id, v_enrollment_id, v_profile_id)
    returning * into v_row;
  exception
    when unique_violation then
      -- Corrida: outra chamada concorrente (duplo clique, retry de
      -- rede) inseriu a MESMA conclusão entre o SELECT acima e este
      -- INSERT. A única UNIQUE desta tabela é (challenge_day_id,
      -- profile_id) — exatamente o que acabamos de tentar inserir —
      -- então devolve a linha que já existe (idempotente). Se por
      -- algum motivo o SELECT não encontrar nada (não deveria
      -- acontecer), relança o erro original em vez de esconder um
      -- problema diferente atrás de um retorno vazio.
      select * into v_row
      from public.garden_completions
      where challenge_day_id = p_challenge_day_id and profile_id = v_profile_id;

      if not found then
        raise;
      end if;
  end;

  return v_row;
end;
$$;

grant execute on function public.garden_complete_day(uuid) to authenticated;

-- ---- 9.4) garden_publish_daily_post ------------------------------------
-- Só a dona da comunidade, só em desafio publicado. Cria o post (feed)
-- e a linha garden_daily_posts na mesma transação.
create or replace function public.garden_publish_daily_post(p_challenge_day_id uuid, p_message text)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_challenge record;
  v_profile_id uuid := auth.uid();
  v_post_id uuid;
  v_message text := nullif(btrim(p_message), '');
begin
  if v_profile_id is null then
    raise exception 'not_authenticated' using errcode = 'insufficient_privilege';
  end if;
  if v_message is null then
    raise exception 'message_required' using errcode = 'check_violation';
  end if;

  select c.id as challenge_id, c.community_id, c.status
  into v_challenge
  from public.garden_challenge_days d
  join public.garden_challenges c on c.id = d.challenge_id
  where d.id = p_challenge_day_id;

  if v_challenge.challenge_id is null then
    raise exception 'day_not_found' using errcode = 'no_data_found';
  end if;

  if not public.owns_community(v_challenge.community_id) then
    raise exception 'not_authorized' using errcode = 'insufficient_privilege';
  end if;

  if v_challenge.status <> 'published' then
    raise exception 'challenge_not_published' using errcode = 'check_violation';
  end if;

  insert into public.posts (community_id, author_id, content, post_type)
  values (v_challenge.community_id, v_profile_id, v_message, 'garden_daily')
  returning id into v_post_id;

  insert into public.garden_daily_posts (challenge_id, challenge_day_id, post_id, created_by, message)
  values (v_challenge.challenge_id, p_challenge_day_id, v_post_id, v_profile_id, v_message);

  return v_post_id;
end;
$$;

grant execute on function public.garden_publish_daily_post(uuid, text) to authenticated;

-- ---- 9.5) garden_share_completion ---------------------------------------
-- Só a dona da própria conclusão, uma vez por conclusão (UNIQUE em
-- garden_shares.completion_id). Congela título do desafio, número/
-- título do dia, progresso (dias concluídos/total) e as duas cores do
-- perfil NO MOMENTO da chamada — cria o post (feed) e a linha
-- garden_shares na mesma transação.
--
-- Corrida: o `exists` abaixo (pré-checagem "já compartilhado") cobre o
-- caso comum sem gastar um INSERT em posts à toa; o bloco EXCEPTION ao
-- redor do INSERT em garden_shares cobre a corrida genuína (duas
-- chamadas concorrentes passam pela pré-checagem antes de qualquer uma
-- commitar). Captura só unique_violation (23505) e relança como
-- 'already_shared' — a mesma mensagem de negócio da pré-checagem, não
-- um erro bruto do Postgres. Se o INSERT em garden_shares falhar, TODA
-- a transação desta chamada (inclusive o INSERT em posts feito
-- segundos antes) é desfeita automaticamente — nenhum post órfão fica
-- para trás.
create or replace function public.garden_share_completion(p_completion_id uuid, p_content text)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_completion public.garden_completions;
  v_challenge record;
  v_day record;
  v_profile_id uuid := auth.uid();
  v_post_id uuid;
  v_content text := coalesce(nullif(btrim(p_content), ''), '');
  v_days_completed integer;
  v_color_one text;
  v_color_two text;
begin
  if v_profile_id is null then
    raise exception 'not_authenticated' using errcode = 'insufficient_privilege';
  end if;

  select * into v_completion
  from public.garden_completions
  where id = p_completion_id;

  if v_completion.id is null then
    raise exception 'completion_not_found' using errcode = 'no_data_found';
  end if;

  if v_completion.profile_id <> v_profile_id then
    raise exception 'not_authorized' using errcode = 'insufficient_privilege';
  end if;

  if exists (select 1 from public.garden_shares where completion_id = p_completion_id) then
    raise exception 'already_shared' using errcode = 'unique_violation';
  end if;

  select id, community_id, title, duration_days into v_challenge
  from public.garden_challenges
  where id = v_completion.challenge_id;

  select day_number, title into v_day
  from public.garden_challenge_days
  where id = v_completion.challenge_day_id;

  select count(*) into v_days_completed
  from public.garden_completions
  where challenge_id = v_completion.challenge_id and profile_id = v_profile_id;

  select garden_color_one, garden_color_two into v_color_one, v_color_two
  from public.profiles
  where id = v_profile_id;

  insert into public.posts (community_id, author_id, content, post_type)
  values (v_challenge.community_id, v_profile_id, v_content, 'garden_share')
  returning id into v_post_id;

  begin
    insert into public.garden_shares (
      challenge_id, challenge_day_id, completion_id, profile_id, post_id,
      challenge_title, day_number, day_title, days_completed, total_days,
      color_one, color_two
    ) values (
      v_completion.challenge_id, v_completion.challenge_day_id, p_completion_id, v_profile_id, v_post_id,
      v_challenge.title, v_day.day_number, v_day.title, v_days_completed, v_challenge.duration_days,
      v_color_one, v_color_two
    );
  exception
    when unique_violation then
      raise exception 'already_shared' using errcode = 'unique_violation';
  end;

  return v_post_id;
end;
$$;

grant execute on function public.garden_share_completion(uuid, text) to authenticated;

commit;

-- =====================================================================
-- Reversão (manual, fora desta migration — DROP TABLE perde dados):
--   drop trigger trg_garden_completions_set_completed_at on public.garden_completions;
--   drop function public.garden_completions_set_completed_at();
--   drop trigger trg_garden_challenges_status_guard on public.garden_challenges;
--   drop trigger trg_garden_challenges_updated_at on public.garden_challenges;
--   drop trigger trg_garden_challenge_days_updated_at on public.garden_challenge_days;
--   drop function public.garden_share_completion(uuid, text);
--   drop function public.garden_publish_daily_post(uuid, text);
--   drop function public.garden_complete_day(uuid);
--   drop function public.garden_publish_challenge(uuid);
--   drop function public.garden_generate_challenge_days(uuid);
--   drop function public.garden_can_enroll(uuid);
--   drop function public.garden_challenges_status_guard();
--   drop table public.garden_shares;
--   drop table public.garden_daily_posts;
--   drop table public.garden_completions;
--   drop table public.garden_enrollments;
--   drop table public.garden_challenge_days;
--   drop table public.garden_challenges;
--   alter table public.posts drop constraint posts_post_type_check;
--   alter table public.posts add constraint posts_post_type_check
--     check (post_type = any (array['standard'::text,'daily_question'::text,
--       'checkin_share'::text,'engagement_command'::text]));
--   alter table public.profiles drop constraint profiles_garden_colors_check;
--   alter table public.profiles drop column garden_color_two;
--   alter table public.profiles drop column garden_color_one;
-- =====================================================================
