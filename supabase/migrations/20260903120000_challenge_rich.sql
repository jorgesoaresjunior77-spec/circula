-- =====================================================================
-- Fase 6 — DESAFIOS ENRIQUECIDOS
-- =====================================================================
-- 100% ADITIVO. Nenhuma linha existente e apagada; nenhuma tabela ou
-- coluna e removida.
--
--   community_challenges  +cover_image_url +starts_on +ends_on
--                         +completion_points +per_day_points
--   challenge_progress    +points_awarded             (reservado Fase 7)
--   challenge_completions  (NOVA) — 1 conclusao por (desafio, participante),
--                          protegida contra duplicacao por UNIQUE
--   challenge_current_day  CREATE OR REPLACE — a base passa de created_at
--                          para starts_on; piso 0 = "ainda nao comecou".
--                          Mesma assinatura, mesmo retorno. NAO e RPC nova.
--
-- PONTOS: esta migration cria SO A ESTRUTURA (colunas com default 0).
-- Nenhum calculo, concessao, soma, saldo ou ledger de pontos — isso e
-- exclusivo da Fase 7.
--
-- Sem RPC nova. Sem trigger novo. GRANT DML explicito para authenticated
-- na tabela nova (tabela criada fora do Studio nao recebe GRANT
-- automatico — mesmo "infra gotcha" ja registrado no projeto).
--
-- Idempotente (add column / create table / create index IF NOT EXISTS;
-- drop policy if exists + create; create or replace). Transacional.
-- Reversivel.
-- =====================================================================

begin;

-- ---- 1) community_challenges: colunas novas (aditivas) -----------
alter table public.community_challenges
  add column if not exists cover_image_url   text;

alter table public.community_challenges
  add column if not exists starts_on         date;

alter table public.community_challenges
  add column if not exists ends_on           date;

alter table public.community_challenges
  add column if not exists completion_points integer not null default 0;

alter table public.community_challenges
  add column if not exists per_day_points    integer not null default 0;

-- Backfill: desafios ja existentes passam a ter inicio = dia de criacao.
-- created_at esta sempre no passado, entao challenge_current_day continua
-- retornando >= 1 para esses desafios — sem regressao de comportamento.
update public.community_challenges
  set starts_on = created_at::date
  where starts_on is null;

alter table public.community_challenges
  alter column starts_on set not null;

-- Backfill: fim = inicio + (numero de dias - 1). Sem atividades => 1 dia.
update public.community_challenges c
  set ends_on = c.starts_on + (
    greatest(
      coalesce(
        (select max(day_number) from public.challenge_activities where challenge_id = c.id),
        1
      ),
      1
    ) - 1
  )
  where ends_on is null;

alter table public.community_challenges
  drop constraint if exists community_challenges_period_check;
alter table public.community_challenges
  add constraint community_challenges_period_check
  check (ends_on is null or ends_on >= starts_on);

alter table public.community_challenges
  drop constraint if exists community_challenges_completion_points_check;
alter table public.community_challenges
  add constraint community_challenges_completion_points_check
  check (completion_points >= 0);

alter table public.community_challenges
  drop constraint if exists community_challenges_per_day_points_check;
alter table public.community_challenges
  add constraint community_challenges_per_day_points_check
  check (per_day_points >= 0);

-- ---- 2) challenge_progress: coluna reservada Fase 7 -------------
-- So estrutura. A Fase 7 preenche este valor ao conceder pontos por dia.
alter table public.challenge_progress
  add column if not exists points_awarded integer not null default 0;

-- ---- 3) challenge_completions (NOVA) ---------------------------
-- Registra a conclusao do desafio por participante. UNIQUE(challenge_id,
-- profile_id) impede duplicacao. points_awarded fica reservado para a
-- Fase 7 (nenhum ponto e gravado nesta fase).
create table if not exists public.challenge_completions (
  id             uuid not null default gen_random_uuid(),
  challenge_id   uuid not null,
  profile_id     uuid not null,
  completed_at   timestamptz not null default now(),
  points_awarded integer not null default 0,
  constraint challenge_completions_pkey primary key (id),
  constraint challenge_completions_challenge_id_profile_id_key
    unique (challenge_id, profile_id),
  constraint challenge_completions_challenge_id_fkey foreign key (challenge_id)
    references public.community_challenges (id) on delete cascade,
  constraint challenge_completions_profile_id_fkey foreign key (profile_id)
    references public.profiles (id) on delete cascade
);

create index if not exists challenge_completions_challenge_id_idx
  on public.challenge_completions using btree (challenge_id);
create index if not exists challenge_completions_profile_id_idx
  on public.challenge_completions using btree (profile_id);

alter table public.challenge_completions enable row level security;

-- SELECT: a propria participante ve a sua conclusao; a dona da comunidade
--   e o Master veem todas as conclusoes dos seus desafios (visao
--   administrativa, mesmo molde de challenge_progress_select).
drop policy if exists "challenge_completions_select" on public.challenge_completions;
create policy "challenge_completions_select"
  on public.challenge_completions for select to public
  using (
    (profile_id = auth.uid())
    or (exists (
      select 1 from public.community_challenges c
      where c.id = challenge_completions.challenge_id
        and (public.owns_community(c.community_id) or public.is_master())
    ))
  );

-- INSERT: so para si, e so em desafio de que a pessoa pode participar
--   (reaproveita can_participate_in_challenge — nenhuma funcao nova).
drop policy if exists "challenge_completions_insert" on public.challenge_completions;
create policy "challenge_completions_insert"
  on public.challenge_completions for insert to public
  with check (
    (profile_id = auth.uid())
    and public.can_participate_in_challenge(challenge_id)
  );

-- DELETE: so a propria linha — permite reverter a conclusao se a
--   participante desmarcar um dia depois.
drop policy if exists "challenge_completions_delete" on public.challenge_completions;
create policy "challenge_completions_delete"
  on public.challenge_completions for delete to public
  using (profile_id = auth.uid());

grant select, insert, delete on table public.challenge_completions to authenticated;

-- ---- 4) challenge_current_day: base = starts_on ---------------
-- Antes: Dia 1 = created_at, janela de 24h a partir da hora de criacao.
-- Agora: Dia 1 = starts_on, contado em dias de calendario.
--   * antes de starts_on  -> 0  ("ainda nao comecou"; a policy de INSERT
--     de challenge_progress ja exige day_number <= challenge_current_day,
--     entao nenhum dia pode ser marcado antes do inicio);
--   * no dia de starts_on  -> 1;
--   * depois               -> cresce ate o teto = numero de atividades.
-- Assinatura, retorno, volatilidade e search_path inalterados.
create or replace function public.challenge_current_day(p_challenge_id uuid)
 returns integer
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select least(
    coalesce(
      (select max(day_number) from public.challenge_activities where challenge_id = p_challenge_id),
      1
    ),
    greatest(
      0,
      (current_date - (select starts_on from public.community_challenges where id = p_challenge_id)) + 1
    )
  );
$function$;

commit;
