-- =====================================================================
-- Fase 7 — SISTEMA DE PONTOS
-- =====================================================================
-- Pontos por comunidade, com saldo, historico append-only auditavel e
-- preparacao para descontos futuros na loja (RESGATE NAO faz parte desta
-- fase — nenhum checkout/produto/desconto e tocado).
--
--   point_accounts   — saldo (cache O(1)), 1 linha por (comunidade, usuaria)
--   point_ledger     — historico append-only; a coluna `dedupe_key UNIQUE`
--                      e a unica garantia de idempotencia (1 lancamento por
--                      acao real do mundo)
--   communities.recurring_points_per_day — config da Nutri; 0 = desligado
--
-- Concessao:
--   * _award_points(...)        interna, SECURITY DEFINER, sem GRANT publico
--   * award_points_manual(...)  RPC da Nutri (owns_community; nunca para si;
--                               alvo membro ativo; 1..1000)
--   * points_community_summary  agregado p/ Nutri e Master (Master so numeros)
--
-- Fontes desta fase (nenhuma outra):
--   1. conclusao de um dia de desafio  -> trigger em challenge_progress
--   2. conclusao de um desafio         -> trigger em challenge_completions
--   3. participacao recorrente         -> trigger em daily_mood_entries
--
-- Regras: nenhum estorno automatico (concede uma unica vez); nenhum
-- backfill (comeca a pontuar na implantacao); Master nunca ve ledger/saldo
-- individual; historico do point_ledger sem UPDATE/DELETE (nem policy, nem
-- GRANT). Gatilhos AFTER INSERT SECURITY DEFINER a prova de excecao — nunca
-- bloqueiam a acao de origem. search_path fixo em 'public' em toda funcao.
-- 100% aditivo, transacional, idempotente, reversivel. Nenhuma linha
-- existente alterada. Sem RPC de resgate. Sem alterar Fase 6.
-- =====================================================================

begin;

-- ---- 1) communities: valor da participacao recorrente (aditivo) ----
alter table public.communities
  add column if not exists recurring_points_per_day integer not null default 0;

alter table public.communities
  drop constraint if exists communities_recurring_points_per_day_check;
alter table public.communities
  add constraint communities_recurring_points_per_day_check
  check (recurring_points_per_day >= 0 and recurring_points_per_day <= 1000);

-- ---- 2) point_accounts (saldo por comunidade) --------------------
create table if not exists public.point_accounts (
  id           uuid not null default gen_random_uuid(),
  community_id uuid not null,
  profile_id   uuid not null,
  balance      integer not null default 0,
  updated_at   timestamptz not null default now(),
  constraint point_accounts_pkey primary key (id),
  constraint point_accounts_community_id_profile_id_key unique (community_id, profile_id),
  constraint point_accounts_balance_check check (balance >= 0),
  constraint point_accounts_community_id_fkey foreign key (community_id)
    references public.communities (id) on delete cascade,
  constraint point_accounts_profile_id_fkey foreign key (profile_id)
    references public.profiles (id) on delete cascade
);

create index if not exists point_accounts_profile_id_idx
  on public.point_accounts using btree (profile_id);
create index if not exists point_accounts_community_balance_idx
  on public.point_accounts using btree (community_id, balance desc);

-- ---- 3) point_ledger (historico append-only) --------------------
create table if not exists public.point_ledger (
  id           uuid not null default gen_random_uuid(),
  community_id uuid not null,
  profile_id   uuid not null,
  amount       integer not null,
  reason       text not null,
  source_type  text,
  source_id    uuid,
  dedupe_key   text not null,
  note         text,
  awarded_by   uuid,
  created_at   timestamptz not null default now(),
  constraint point_ledger_pkey primary key (id),
  constraint point_ledger_dedupe_key_key unique (dedupe_key),
  constraint point_ledger_amount_check check (amount > 0),
  constraint point_ledger_reason_check check (reason = any (array[
    'challenge_day'::text,
    'challenge_completion'::text,
    'recurring_participation'::text,
    'manual'::text
  ])),
  constraint point_ledger_community_id_fkey foreign key (community_id)
    references public.communities (id) on delete cascade,
  constraint point_ledger_profile_id_fkey foreign key (profile_id)
    references public.profiles (id) on delete cascade,
  constraint point_ledger_awarded_by_fkey foreign key (awarded_by)
    references public.profiles (id) on delete set null
);

create index if not exists point_ledger_community_profile_created_idx
  on public.point_ledger using btree (community_id, profile_id, created_at desc);
create index if not exists point_ledger_profile_created_idx
  on public.point_ledger using btree (profile_id, created_at desc);

-- ---- 4) _award_points (interna, idempotente) -------------------
-- Um unico lancamento por `dedupe_key`. Reexecucao / duplo disparo /
-- desmarcar+remarcar -> no-op (devolve o lancamento existente, sem novo
-- credito). NAO mexe em point_accounts: o saldo e mantido pelo trigger
-- _points_apply_balance, num unico lugar.
create or replace function public._award_points(
  p_community_id uuid,
  p_profile_id   uuid,
  p_amount       integer,
  p_reason       text,
  p_source_type  text,
  p_source_id    uuid,
  p_dedupe_key   text,
  p_note         text,
  p_awarded_by   uuid
) returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  if p_community_id is null or p_profile_id is null or p_dedupe_key is null then
    raise exception '_award_points: parametros obrigatorios ausentes'
      using errcode = 'null_value_not_allowed';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception '_award_points: amount invalido (%)', p_amount
      using errcode = 'check_violation';
  end if;

  insert into public.point_ledger
    (community_id, profile_id, amount, reason, source_type, source_id, dedupe_key, note, awarded_by)
  values
    (p_community_id, p_profile_id, p_amount, p_reason, p_source_type, p_source_id, p_dedupe_key, p_note, p_awarded_by)
  on conflict (dedupe_key) do nothing
  returning id into v_id;

  if v_id is null then
    -- acao ja pontuada -> devolve o lancamento existente, sem creditar de novo
    select id into v_id from public.point_ledger where dedupe_key = p_dedupe_key;
  end if;

  return v_id;
end;
$function$;

revoke all on function public._award_points(uuid,uuid,integer,text,text,uuid,text,text,uuid) from public;

-- ---- 5) _points_apply_balance (mantem o saldo) ---------------
-- AFTER INSERT em point_ledger. `on conflict do update` toma trava de
-- linha -> concessoes concorrentes a mesma conta serializam, sem lost
-- update. Saldo so cresce (amount > 0, sem estorno nesta fase).
create or replace function public._points_apply_balance()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  insert into public.point_accounts (community_id, profile_id, balance)
  values (new.community_id, new.profile_id, new.amount)
  on conflict (community_id, profile_id)
  do update set balance = point_accounts.balance + excluded.balance,
                updated_at = now();
  return null;
end;
$function$;

drop trigger if exists trg_points_apply_balance on public.point_ledger;
create trigger trg_points_apply_balance
  after insert on public.point_ledger
  for each row execute function public._points_apply_balance();

-- ---- 6) fonte 1: conclusao de um dia de desafio -------------
create or replace function public._points_on_challenge_day()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_community_id uuid;
  v_points       integer;
begin
  begin
    select cc.community_id, cc.per_day_points
      into v_community_id, v_points
    from public.community_challenges cc
    where cc.id = new.challenge_id;

    if v_community_id is not null and v_points is not null and v_points > 0 then
      perform public._award_points(
        v_community_id, new.profile_id, v_points,
        'challenge_day', 'challenge_progress', new.id,
        'cday:' || new.challenge_id::text || ':' || new.profile_id::text || ':' || new.day_number::text,
        null, null
      );
    end if;
  exception when others then
    null; -- pontos nunca bloqueiam a conclusao do dia (Fase 6)
  end;
  return null;
end;
$function$;

drop trigger if exists trg_points_on_challenge_day on public.challenge_progress;
create trigger trg_points_on_challenge_day
  after insert on public.challenge_progress
  for each row execute function public._points_on_challenge_day();

-- ---- 7) fonte 2: conclusao de um desafio -------------------
create or replace function public._points_on_challenge_completion()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_community_id uuid;
  v_points       integer;
begin
  begin
    select cc.community_id, cc.completion_points
      into v_community_id, v_points
    from public.community_challenges cc
    where cc.id = new.challenge_id;

    if v_community_id is not null and v_points is not null and v_points > 0 then
      perform public._award_points(
        v_community_id, new.profile_id, v_points,
        'challenge_completion', 'challenge_completions', new.id,
        'cdone:' || new.challenge_id::text || ':' || new.profile_id::text,
        null, null
      );
    end if;
  exception when others then
    null;
  end;
  return null;
end;
$function$;

drop trigger if exists trg_points_on_challenge_completion on public.challenge_completions;
create trigger trg_points_on_challenge_completion
  after insert on public.challenge_completions
  for each row execute function public._points_on_challenge_completion();

-- ---- 8) fonte 3: participacao recorrente (humor diario) ----
-- daily_mood_entries e escrito por upsert no cliente. AFTER INSERT so
-- dispara na criacao real do registro do dia; editar o humor depois e
-- UPDATE (sem trigger) -> nao reconcede. A dedupe_key por (comunidade,
-- usuaria, entry_date) e a rede de seguranca final.
create or replace function public._points_on_recurring_participation()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_points integer;
begin
  begin
    select c.recurring_points_per_day
      into v_points
    from public.communities c
    where c.id = new.community_id;

    if v_points is not null and v_points > 0 then
      perform public._award_points(
        new.community_id, new.profile_id, v_points,
        'recurring_participation', 'daily_mood_entries', new.id,
        'recur:' || new.community_id::text || ':' || new.profile_id::text || ':' || new.entry_date::text,
        null, null
      );
    end if;
  exception when others then
    null;
  end;
  return null;
end;
$function$;

drop trigger if exists trg_points_on_recurring_participation on public.daily_mood_entries;
create trigger trg_points_on_recurring_participation
  after insert on public.daily_mood_entries
  for each row execute function public._points_on_recurring_participation();

-- ---- 9) award_points_manual (RPC da Nutri) -----------------
-- Concessao manual 1..1000, so pela DONA da comunidade, nunca para si,
-- alvo tem de ser membro ativo. Cada concessao manual e um ato deliberado
-- -> dedupe_key com uuid fresco (nao deduplicado entre si).
create or replace function public.award_points_manual(
  p_community_id uuid,
  p_profile_id   uuid,
  p_amount       integer,
  p_note         text default null
) returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  if p_community_id is null or p_profile_id is null then
    raise exception 'award_points_manual: parametros obrigatorios ausentes'
      using errcode = 'null_value_not_allowed';
  end if;

  if not public.owns_community(p_community_id) then
    raise exception 'not_authorized' using errcode = 'insufficient_privilege';
  end if;

  if p_profile_id = auth.uid() then
    raise exception 'cannot_grant_to_self' using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.community_members m
    where m.community_id = p_community_id
      and m.profile_id   = p_profile_id
      and m.status = 'active'
  ) then
    raise exception 'target_not_member' using errcode = 'check_violation';
  end if;

  if p_amount is null or p_amount < 1 or p_amount > 1000 then
    raise exception 'amount_out_of_range' using errcode = 'check_violation';
  end if;

  v_id := public._award_points(
    p_community_id, p_profile_id, p_amount,
    'manual', 'manual', null,
    'manual:' || gen_random_uuid()::text,
    nullif(btrim(coalesce(p_note, '')), ''),
    auth.uid()
  );
  return v_id;
end;
$function$;

grant execute on function public.award_points_manual(uuid,uuid,integer,text) to authenticated;

-- ---- 10) points_community_summary (agregado) --------------
-- Nutri (owns_community) e Master (is_master). SO agregados. A lista
-- nominal de pontuadoras e devolvida APENAS para a dona; o Master recebe
-- somente numeros (nunca historico/saldo individual).
create or replace function public.points_community_summary(
  p_community_id uuid,
  p_period_days  integer default 30
) returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_is_owner     boolean;
  v_period_start timestamptz;
  v_days         integer;
  v_total_all    integer;
  v_total_period integer;
  v_by_reason    jsonb;
  v_earners      integer;
  v_top          jsonb;
begin
  v_is_owner := public.owns_community(p_community_id);
  if not (public.is_master() or v_is_owner) then
    raise exception 'not_authorized' using errcode = 'insufficient_privilege';
  end if;

  v_days := greatest(coalesce(p_period_days, 30), 1);
  v_period_start := now() - (v_days || ' days')::interval;

  select coalesce(sum(amount), 0) into v_total_all
  from public.point_ledger where community_id = p_community_id;

  select coalesce(sum(amount), 0) into v_total_period
  from public.point_ledger
  where community_id = p_community_id and created_at >= v_period_start;

  select coalesce(jsonb_object_agg(reason, s), '{}'::jsonb) into v_by_reason
  from (
    select reason, sum(amount) as s
    from public.point_ledger
    where community_id = p_community_id
    group by reason
  ) t;

  select count(*) into v_earners
  from public.point_accounts
  where community_id = p_community_id and balance > 0;

  if v_is_owner then
    select coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'profile_id', q.profile_id,
                 'full_name',  q.full_name,
                 'avatar_url', q.avatar_url,
                 'balance',    q.balance
               )
               order by q.balance desc, q.full_name asc nulls last
             ),
             '[]'::jsonb
           )
      into v_top
    from (
      select pa.profile_id, pr.full_name, pr.avatar_url, pa.balance
      from public.point_accounts pa
      join public.profiles pr on pr.id = pa.profile_id
      where pa.community_id = p_community_id and pa.balance > 0
      order by pa.balance desc, pr.full_name asc nulls last
      limit 10
    ) q;
  else
    v_top := null;
  end if;

  return jsonb_build_object(
    'total_points_all_time', v_total_all,
    'total_points_period',   v_total_period,
    'period_days',           v_days,
    'by_reason',             v_by_reason,
    'earners_count',         v_earners,
    'top_earners',           v_top
  );
end;
$function$;

grant execute on function public.points_community_summary(uuid,integer) to authenticated;

-- ---- 11) RLS: point_accounts / point_ledger --------------
-- Leitura: a propria usuaria OU a dona da comunidade. SEM is_master()
-- (Master so ve agregado via points_community_summary). Sem policy de
-- INSERT/UPDATE/DELETE em nenhuma das duas: os unicos escritores sao as
-- funcoes SECURITY DEFINER acima. point_ledger e, portanto, append-only
-- por RLS, nao so por convencao.
alter table public.point_accounts enable row level security;
alter table public.point_ledger   enable row level security;

drop policy if exists "point_accounts_select" on public.point_accounts;
create policy "point_accounts_select"
  on public.point_accounts for select to authenticated
  using (profile_id = auth.uid() or public.owns_community(community_id));

drop policy if exists "point_ledger_select" on public.point_ledger;
create policy "point_ledger_select"
  on public.point_ledger for select to authenticated
  using (profile_id = auth.uid() or public.owns_community(community_id));

-- GRANT: apenas SELECT para authenticated. Nenhum INSERT/UPDATE/DELETE.
grant select on table public.point_accounts to authenticated;
grant select on table public.point_ledger   to authenticated;

commit;
