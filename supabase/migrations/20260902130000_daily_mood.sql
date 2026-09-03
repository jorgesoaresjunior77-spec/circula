-- =====================================================================
-- Fase 3 — "COMO VOCÊ ESTÁ HOJE?" (humor diário)
-- =====================================================================
-- Recurso PRÓPRIO, totalmente separado do check-in publicado pela Nutri.
-- `checkin_responses` NÃO é tocada. Nenhuma tabela existente é alterada.
--
-- Objetos novos:
--   public.daily_mood_entries     — 1 registro por (usuária, comunidade, dia).
--                                   Dado PRIVADO: só a própria usuária lê.
--   public.community_mood_messages — override opcional, pela Nutri, das
--                                   mensagens acolhedoras (1 por humor).
--   public.community_mood_overview — VIEW agregada para a aba Métricas:
--                                   contagens por humor/dia, SEM expor
--                                   quem respondeu. Não é RPC.
--
-- PRIVACIDADE (requisito da fase):
--   · daily_mood_entries: SELECT só onde profile_id = auth.uid().
--     NÃO há policy para owns_community()/is_master() nessa tabela —
--     a Nutri e o Master NÃO conseguem ler o humor individual de ninguém.
--   · A Nutri obtém apenas números agregados através da view
--     community_mood_overview, cujo próprio WHERE exige
--     owns_community(community_id) OR is_master(). A view roda com os
--     direitos do dono (security_invoker = false, padrão no PG15) para
--     poder agregar linhas que a RLS esconderia da Nutri; o resultado
--     nunca inclui profile_id.
--
-- 5 níveis de humor: very_sad / sad / neutral / happy / very_happy
-- (escala própria — diferente do great/good/okay/hard do check-in).
--
-- Idempotente. GRANT DML explícito para authenticated (tabela criada
-- fora do Studio não recebe GRANT automático).
-- =====================================================================

begin;

-- ---- 1) daily_mood_entries -----------------------------------------
create table if not exists public.daily_mood_entries (
  id           uuid not null default gen_random_uuid(),
  profile_id   uuid not null,
  community_id uuid not null,
  mood         text not null,
  note         text,
  entry_date   date not null default (now() at time zone 'utc')::date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint daily_mood_entries_pkey primary key (id),
  constraint daily_mood_entries_mood_check check (
    mood = any (array['very_sad'::text, 'sad'::text, 'neutral'::text, 'happy'::text, 'very_happy'::text])
  ),
  constraint daily_mood_entries_one_per_day unique (profile_id, community_id, entry_date),
  constraint daily_mood_entries_profile_id_fkey foreign key (profile_id)
    references public.profiles (id) on delete cascade,
  constraint daily_mood_entries_community_id_fkey foreign key (community_id)
    references public.communities (id) on delete cascade
);

create index if not exists daily_mood_entries_profile_date_idx
  on public.daily_mood_entries using btree (profile_id, entry_date desc);
create index if not exists daily_mood_entries_community_date_idx
  on public.daily_mood_entries using btree (community_id, entry_date);

drop trigger if exists set_daily_mood_entries_updated_at on public.daily_mood_entries;
create trigger set_daily_mood_entries_updated_at
  before update on public.daily_mood_entries
  for each row execute function public.set_updated_at();

alter table public.daily_mood_entries enable row level security;

-- SELECT: só o próprio registro. Sem exceção para Nutri/Master.
drop policy if exists "daily_mood_entries_select" on public.daily_mood_entries;
create policy "daily_mood_entries_select"
  on public.daily_mood_entries for select to authenticated
  using (profile_id = auth.uid());

-- INSERT: só para si mesma, e só em comunidade da qual participa
-- (a Nutri também tem linha em community_members da própria comunidade;
-- owns_community cobre qualquer borda).
drop policy if exists "daily_mood_entries_insert" on public.daily_mood_entries;
create policy "daily_mood_entries_insert"
  on public.daily_mood_entries for insert to authenticated
  with check (
    profile_id = auth.uid()
    and (public.is_community_member(community_id) or public.owns_community(community_id))
  );

-- UPDATE: trocar o humor/nota do próprio dia.
drop policy if exists "daily_mood_entries_update" on public.daily_mood_entries;
create policy "daily_mood_entries_update"
  on public.daily_mood_entries for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- DELETE: a usuária pode remover o próprio registro.
drop policy if exists "daily_mood_entries_delete" on public.daily_mood_entries;
create policy "daily_mood_entries_delete"
  on public.daily_mood_entries for delete to authenticated
  using (profile_id = auth.uid());

grant select, insert, update, delete on table public.daily_mood_entries to authenticated;

-- ---- 2) community_mood_messages -----------------------------------
create table if not exists public.community_mood_messages (
  id           uuid not null default gen_random_uuid(),
  community_id uuid not null,
  mood         text not null,
  message      text not null,
  is_active    boolean not null default true,
  created_by   uuid not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint community_mood_messages_pkey primary key (id),
  constraint community_mood_messages_mood_check check (
    mood = any (array['very_sad'::text, 'sad'::text, 'neutral'::text, 'happy'::text, 'very_happy'::text])
  ),
  constraint community_mood_messages_one_per_mood unique (community_id, mood),
  constraint community_mood_messages_community_id_fkey foreign key (community_id)
    references public.communities (id) on delete cascade,
  constraint community_mood_messages_created_by_fkey foreign key (created_by)
    references public.profiles (id) on delete cascade
);

create index if not exists community_mood_messages_community_idx
  on public.community_mood_messages using btree (community_id);

drop trigger if exists set_community_mood_messages_updated_at on public.community_mood_messages;
create trigger set_community_mood_messages_updated_at
  before update on public.community_mood_messages
  for each row execute function public.set_updated_at();

alter table public.community_mood_messages enable row level security;

-- SELECT: membros leem para exibir a mensagem (não é dado sensível).
drop policy if exists "community_mood_messages_select" on public.community_mood_messages;
create policy "community_mood_messages_select"
  on public.community_mood_messages for select to authenticated
  using (
    public.is_master()
    or public.owns_community(community_id)
    or public.is_community_member(community_id)
  );

drop policy if exists "community_mood_messages_insert" on public.community_mood_messages;
create policy "community_mood_messages_insert"
  on public.community_mood_messages for insert to authenticated
  with check (public.owns_community(community_id) and created_by = auth.uid());

drop policy if exists "community_mood_messages_update" on public.community_mood_messages;
create policy "community_mood_messages_update"
  on public.community_mood_messages for update to authenticated
  using (public.owns_community(community_id))
  with check (public.owns_community(community_id));

drop policy if exists "community_mood_messages_delete" on public.community_mood_messages;
create policy "community_mood_messages_delete"
  on public.community_mood_messages for delete to authenticated
  using (public.owns_community(community_id));

grant select, insert, update, delete on table public.community_mood_messages to authenticated;

-- ---- 3) community_mood_overview (VIEW agregada, sem PII) ----------
-- Roda com os direitos do dono (security_invoker = false) para poder
-- agregar linhas que a RLS de daily_mood_entries esconde da Nutri.
-- O acesso é limitado pelo próprio WHERE: só a dona da comunidade
-- (ou o Master) enxerga as contagens da comunidade. Sem profile_id
-- no resultado — impossível saber quem respondeu cada humor.
drop view if exists public.community_mood_overview;
create view public.community_mood_overview
  with (security_invoker = false)
as
  select
    e.community_id,
    e.mood,
    e.entry_date,
    count(*)::int as entries
  from public.daily_mood_entries e
  where public.owns_community(e.community_id) or public.is_master()
  group by e.community_id, e.mood, e.entry_date;

grant select on public.community_mood_overview to authenticated;

commit;
