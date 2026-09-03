-- =====================================================================
-- Etapa "plataforma completa" — Módulo 4: NOTIFICAÇÕES SOCIAIS
-- =====================================================================
-- Tabela NOVA e separada. A tabela `public.notifications` (billing,
-- escrita pela Edge Function billing-daily-sweep) NÃO é tocada.
--
-- Schema real verificado antes desta migration:
--   post_comments(id, post_id, author_id, content, created_at)
--   post_reactions(id, post_id, profile_id, created_at) unique(post_id,profile_id)
--   circle_members(id, circle_id, profile_id, joined_at)
--   event_participants(id, event_id, profile_id, joined_at)
--   challenge_comments(id, challenge_id, author_id, content, created_at)
--   posts.author_id / community_circles.created_by /
--   community_events.created_by / community_challenges.created_by  -> destinatárias
--   Nenhum gatilho pré-existente em nenhuma das 5 tabelas-fonte.
--
-- INSERT fica restrito aos gatilhos SECURITY DEFINER (rodam como owner,
-- ignoram RLS) e ao service_role. `authenticated` só recebe SELECT +
-- UPDATE (marcar read_at da própria linha) — nenhuma usuária consegue
-- forjar notificação para outra.
--
-- Todos os gatilhos são AFTER INSERT + SECURITY DEFINER + à prova de
-- exceção (BEGIN...EXCEPTION WHEN OTHERS THEN NULL): se a notificação
-- falhar, a operação principal (comentar/reagir/entrar/confirmar) segue
-- normalmente.
--
-- Idempotente: create table if not exists / create index if not exists /
-- create or replace function / create or replace trigger (PG17).
-- =====================================================================

begin;

-- ---- tabela ------------------------------------------------------
create table if not exists public.social_notifications (
  id                   uuid not null default gen_random_uuid(),
  profile_id           uuid not null,           -- destinatária
  actor_profile_id     uuid,                    -- quem realizou a ação
  type                 text not null,
  title                text not null,
  body                 text,
  related_post_id      uuid,
  related_comment_id   uuid,                    -- post_comments.id OU challenge_comments.id (sem FK: origem dupla)
  related_circle_id    uuid,
  related_event_id     uuid,
  related_challenge_id uuid,
  read_at              timestamptz,
  created_at           timestamptz not null default now(),
  constraint social_notifications_pkey primary key (id),
  constraint social_notifications_type_check check (
    type = any (array[
      'post_comment'::text,
      'post_reaction'::text,
      'circle_join'::text,
      'event_rsvp'::text,
      'challenge_comment'::text
    ])
  ),
  constraint social_notifications_profile_id_fkey foreign key (profile_id)
    references public.profiles (id) on delete cascade,
  constraint social_notifications_actor_profile_id_fkey foreign key (actor_profile_id)
    references public.profiles (id) on delete set null,
  constraint social_notifications_related_post_id_fkey foreign key (related_post_id)
    references public.posts (id) on delete cascade,
  constraint social_notifications_related_circle_id_fkey foreign key (related_circle_id)
    references public.community_circles (id) on delete cascade,
  constraint social_notifications_related_event_id_fkey foreign key (related_event_id)
    references public.community_events (id) on delete cascade,
  constraint social_notifications_related_challenge_id_fkey foreign key (related_challenge_id)
    references public.community_challenges (id) on delete cascade
);

-- ---- índices ---------------------------------------------------
create index if not exists social_notifications_profile_created_idx
  on public.social_notifications using btree (profile_id, created_at desc);
create index if not exists social_notifications_profile_unread_idx
  on public.social_notifications using btree (profile_id, read_at);
create index if not exists social_notifications_related_post_idx
  on public.social_notifications using btree (related_post_id);
create index if not exists social_notifications_related_circle_idx
  on public.social_notifications using btree (related_circle_id);
create index if not exists social_notifications_related_event_idx
  on public.social_notifications using btree (related_event_id);
create index if not exists social_notifications_related_challenge_idx
  on public.social_notifications using btree (related_challenge_id);

-- ---- RLS -----------------------------------------------------
alter table public.social_notifications enable row level security;

drop policy if exists "social_notifications_select" on public.social_notifications;
create policy "social_notifications_select"
  on public.social_notifications for select to public
  using (profile_id = auth.uid());

drop policy if exists "social_notifications_update_own" on public.social_notifications;
create policy "social_notifications_update_own"
  on public.social_notifications for update to public
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Sem policy de INSERT/DELETE para authenticated: só gatilhos DEFINER
-- e service_role escrevem.

-- ---- GRANT --------------------------------------------------
grant select, update on table public.social_notifications to authenticated;
grant select, insert, update, delete on table public.social_notifications to service_role;

-- ---- funções de gatilho (SECURITY DEFINER, à prova de exceção) ----

-- A) POST_COMMENTS -> autora do post
create or replace function public.notify_on_post_comment()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_post_author uuid;
begin
  begin
    select author_id into v_post_author from public.posts where id = new.post_id;
    if v_post_author is not null and v_post_author <> new.author_id then
      insert into public.social_notifications
        (profile_id, actor_profile_id, type, title, body,
         related_post_id, related_comment_id)
      values
        (v_post_author, new.author_id, 'post_comment',
         'Novo comentário na sua publicação',
         left(coalesce(new.content, ''), 140),
         new.post_id, new.id);
    end if;
  exception when others then
    null; -- nunca bloquear o comentário
  end;
  return new;
end;
$function$;

create or replace trigger trg_notify_on_post_comment
  after insert on public.post_comments
  for each row execute function public.notify_on_post_comment();

-- B) POST_REACTIONS -> autora do post (com dedup: não recria se já há
--    uma notificação de reação NÃO LIDA da mesma pessoa para o mesmo post)
create or replace function public.notify_on_post_reaction()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_post_author uuid;
begin
  begin
    select author_id into v_post_author from public.posts where id = new.post_id;
    if v_post_author is not null and v_post_author <> new.profile_id then
      if not exists (
        select 1 from public.social_notifications
        where profile_id = v_post_author
          and actor_profile_id = new.profile_id
          and type = 'post_reaction'
          and related_post_id = new.post_id
          and read_at is null
      ) then
        insert into public.social_notifications
          (profile_id, actor_profile_id, type, title, body, related_post_id)
        values
          (v_post_author, new.profile_id, 'post_reaction',
           'Alguém reagiu à sua publicação', null, new.post_id);
      end if;
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$function$;

create or replace trigger trg_notify_on_post_reaction
  after insert on public.post_reactions
  for each row execute function public.notify_on_post_reaction();

-- C) CIRCLE_MEMBERS -> quem criou o círculo (community_circles.created_by)
create or replace function public.notify_on_circle_join()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_circle_admin uuid;
  v_circle_name  text;
begin
  begin
    select created_by, name into v_circle_admin, v_circle_name
    from public.community_circles where id = new.circle_id;
    if v_circle_admin is not null and v_circle_admin <> new.profile_id then
      insert into public.social_notifications
        (profile_id, actor_profile_id, type, title, body, related_circle_id)
      values
        (v_circle_admin, new.profile_id, 'circle_join',
         'Nova participante no seu círculo',
         v_circle_name, new.circle_id);
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$function$;

create or replace trigger trg_notify_on_circle_join
  after insert on public.circle_members
  for each row execute function public.notify_on_circle_join();

-- D) EVENT_PARTICIPANTS -> quem criou o evento (community_events.created_by)
create or replace function public.notify_on_event_rsvp()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_event_host  uuid;
  v_event_title text;
begin
  begin
    select created_by, title into v_event_host, v_event_title
    from public.community_events where id = new.event_id;
    if v_event_host is not null and v_event_host <> new.profile_id then
      insert into public.social_notifications
        (profile_id, actor_profile_id, type, title, body, related_event_id)
      values
        (v_event_host, new.profile_id, 'event_rsvp',
         'Nova presença confirmada no seu evento',
         v_event_title, new.event_id);
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$function$;

create or replace trigger trg_notify_on_event_rsvp
  after insert on public.event_participants
  for each row execute function public.notify_on_event_rsvp();

-- E) CHALLENGE_COMMENTS -> quem criou o desafio (community_challenges.created_by)
create or replace function public.notify_on_challenge_comment()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_challenge_owner uuid;
  v_challenge_title text;
begin
  begin
    select created_by, title into v_challenge_owner, v_challenge_title
    from public.community_challenges where id = new.challenge_id;
    if v_challenge_owner is not null and v_challenge_owner <> new.author_id then
      insert into public.social_notifications
        (profile_id, actor_profile_id, type, title, body,
         related_challenge_id, related_comment_id)
      values
        (v_challenge_owner, new.author_id, 'challenge_comment',
         'Novo comentário no seu desafio',
         left(coalesce(new.content, ''), 140),
         new.challenge_id, new.id);
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$function$;

create or replace trigger trg_notify_on_challenge_comment
  after insert on public.challenge_comments
  for each row execute function public.notify_on_challenge_comment();

commit;
