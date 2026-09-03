-- =====================================================================
-- Etapa "plataforma completa" — Módulo 5: MENSAGENS / DMs (parte 1/2)
-- =====================================================================
-- Conversas privadas 1:1. Três tabelas novas, nenhuma tabela existente
-- alterada nesta migration (a parte 2 amplia social_notifications e liga
-- o Realtime).
--
--   public.conversations           — a conversa (MVP: sempre 1:1)
--   public.conversation_participants — quem participa + last_read_at
--   public.messages                — as mensagens
--
-- Permissão de conversar = shares_active_community(outra) — a mesma
-- fronteira que a RLS de `profiles` já usa. Master fica de fora
-- (não participa de comunidade → shares_active_community = false).
--
-- Anti-recursão: is_conversation_participant(uuid) é SECURITY DEFINER
-- (mesmo padrão de is_community_member) — as policies de
-- conversation_participants não podem se auto-referenciar sem loop.
--
-- Criação de conversa e marcação de leitura só via RPC SECURITY
-- DEFINER — `authenticated` NÃO recebe INSERT em conversations nem em
-- conversation_participants.
--
-- Idempotente. GRANT DML explícito.
-- =====================================================================

begin;

-- ---- tabelas --------------------------------------------------
create table if not exists public.conversations (
  id              uuid not null default gen_random_uuid(),
  is_group        boolean not null default false,
  direct_key      text,                       -- 'uuidMenor:uuidMaior' (dedupe 1:1)
  created_by      uuid not null,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  constraint conversations_pkey primary key (id),
  constraint conversations_direct_key_key unique (direct_key),
  constraint conversations_created_by_fkey foreign key (created_by)
    references public.profiles (id) on delete cascade
);

create table if not exists public.conversation_participants (
  id              uuid not null default gen_random_uuid(),
  conversation_id uuid not null,
  profile_id      uuid not null,
  last_read_at    timestamptz,
  joined_at       timestamptz not null default now(),
  constraint conversation_participants_pkey primary key (id),
  constraint conversation_participants_conv_profile_key unique (conversation_id, profile_id),
  constraint conversation_participants_conversation_id_fkey foreign key (conversation_id)
    references public.conversations (id) on delete cascade,
  constraint conversation_participants_profile_id_fkey foreign key (profile_id)
    references public.profiles (id) on delete cascade
);

create table if not exists public.messages (
  id              uuid not null default gen_random_uuid(),
  conversation_id uuid not null,
  sender_id       uuid not null,
  body            text not null,
  created_at      timestamptz not null default now(),
  constraint messages_pkey primary key (id),
  constraint messages_body_len_check check (char_length(body) between 1 and 4000),
  constraint messages_conversation_id_fkey foreign key (conversation_id)
    references public.conversations (id) on delete cascade,
  constraint messages_sender_id_fkey foreign key (sender_id)
    references public.profiles (id) on delete cascade
);

-- ---- índices -------------------------------------------------
create index if not exists conversation_participants_profile_id_idx
  on public.conversation_participants using btree (profile_id);
create index if not exists conversation_participants_conversation_id_idx
  on public.conversation_participants using btree (conversation_id);
create index if not exists messages_conversation_created_idx
  on public.messages using btree (conversation_id, created_at desc);
create index if not exists conversations_last_message_at_idx
  on public.conversations using btree (last_message_at desc);

-- ---- helper anti-recursão (SECURITY DEFINER) ---------------
create or replace function public.is_conversation_participant(p_conversation_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id
      and profile_id = auth.uid()
  );
$function$;

-- ---- RPC: obter/criar conversa 1:1 -------------------------
create or replace function public.get_or_create_direct_conversation(p_other uuid)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me   uuid := auth.uid();
  v_key  text;
  v_conv uuid;
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;
  if p_other is null or p_other = v_me then
    raise exception 'invalid recipient';
  end if;
  if not public.shares_active_community(p_other) then
    raise exception 'not allowed to message this person';
  end if;

  v_key := least(v_me::text, p_other::text) || ':' || greatest(v_me::text, p_other::text);

  select id into v_conv from public.conversations where direct_key = v_key;
  if v_conv is not null then
    return v_conv;
  end if;

  -- corrida: se outra transação inseriu no meio, o DO UPDATE (no-op)
  -- ainda devolve o id da linha existente.
  insert into public.conversations (direct_key, created_by, is_group)
  values (v_key, v_me, false)
  on conflict (direct_key) do update set direct_key = excluded.direct_key
  returning id into v_conv;

  insert into public.conversation_participants (conversation_id, profile_id)
  values (v_conv, v_me), (v_conv, p_other)
  on conflict (conversation_id, profile_id) do nothing;

  return v_conv;
end;
$function$;

-- ---- RPC: marcar conversa como lida ------------------------
create or replace function public.mark_conversation_read(
  p_conversation_id uuid,
  p_at timestamptz default now()
)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'not authenticated';
  end if;
  update public.conversation_participants
    set last_read_at = greatest(coalesce(last_read_at, 'epoch'::timestamptz), p_at)
    where conversation_id = p_conversation_id
      and profile_id = v_me;
end;
$function$;

-- ---- RPC: visão geral das conversas da usuária -------------
create or replace function public.conversations_overview()
 returns table (
   conversation_id        uuid,
   other_profile_id       uuid,
   other_full_name        text,
   other_avatar_url       text,
   last_message_body      text,
   last_message_at        timestamptz,
   last_message_sender_id uuid,
   unread_count           integer
 )
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with me as (select auth.uid() as uid),
  my_convs as (
    select cp.conversation_id, cp.last_read_at
    from public.conversation_participants cp, me
    where cp.profile_id = me.uid
  )
  select
    c.id,
    op.profile_id,
    p.full_name,
    p.avatar_url,
    lm.body,
    c.last_message_at,
    lm.sender_id,
    (
      select count(*)::int from public.messages m
      where m.conversation_id = c.id
        and m.sender_id <> (select uid from me)
        and m.created_at > coalesce(mc.last_read_at, 'epoch'::timestamptz)
    )
  from my_convs mc
  join public.conversations c on c.id = mc.conversation_id
  join public.conversation_participants op
    on op.conversation_id = c.id and op.profile_id <> (select uid from me)
  left join public.profiles p on p.id = op.profile_id
  left join lateral (
    select body, sender_id, created_at
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) lm on true
  order by c.last_message_at desc;
$function$;

-- ---- RLS -----------------------------------------------------
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

drop policy if exists "conversations_select" on public.conversations;
create policy "conversations_select"
  on public.conversations for select to public
  using (public.is_conversation_participant(id));

drop policy if exists "conversation_participants_select" on public.conversation_participants;
create policy "conversation_participants_select"
  on public.conversation_participants for select to public
  using (public.is_conversation_participant(conversation_id));

-- só a própria linha, só para atualizar last_read_at
drop policy if exists "conversation_participants_update_own" on public.conversation_participants;
create policy "conversation_participants_update_own"
  on public.conversation_participants for update to public
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists "messages_select" on public.messages;
create policy "messages_select"
  on public.messages for select to public
  using (public.is_conversation_participant(conversation_id));

drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert"
  on public.messages for insert to public
  with check (
    sender_id = auth.uid()
    and public.is_conversation_participant(conversation_id)
  );

-- ---- GRANT -------------------------------------------------
grant select on table public.conversations to authenticated;
grant select, update on table public.conversation_participants to authenticated;
grant select, insert on table public.messages to authenticated;

grant execute on function public.is_conversation_participant(uuid) to authenticated;
grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;
grant execute on function public.mark_conversation_read(uuid, timestamptz) to authenticated;
grant execute on function public.conversations_overview() to authenticated;

commit;
