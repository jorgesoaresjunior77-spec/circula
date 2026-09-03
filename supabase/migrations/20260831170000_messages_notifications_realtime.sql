-- =====================================================================
-- Etapa "plataforma completa" — Módulo 5: MENSAGENS / DMs (parte 2/2)
-- =====================================================================
-- (1) Amplia public.social_notifications (Módulo 4) para o tipo
--     'direct_message' + coluna related_conversation_id. Alteração
--     ADITIVA numa tabela do próprio projeto: o CHECK só ganha um
--     valor novo, a coluna é nullable — linhas e gatilhos existentes
--     não são afetados.
-- (2) Gatilho AFTER INSERT em public.messages, SECURITY DEFINER e à
--     prova de exceção: atualiza conversations.last_message_at e cria
--     a notificação 'direct_message' para o outro participante. Se
--     qualquer parte falhar, o INSERT da mensagem segue normalmente.
-- (3) Realtime: adiciona public.messages à publicação supabase_realtime
--     (a RLS de messages_select continua valendo na entrega).
--
-- Idempotente.
-- =====================================================================

begin;

-- ---- (1) social_notifications: novo tipo + coluna ----------
alter table public.social_notifications
  add column if not exists related_conversation_id uuid;

alter table public.social_notifications
  drop constraint if exists social_notifications_related_conversation_id_fkey;
alter table public.social_notifications
  add constraint social_notifications_related_conversation_id_fkey
  foreign key (related_conversation_id)
  references public.conversations (id) on delete cascade;

alter table public.social_notifications
  drop constraint if exists social_notifications_type_check;
alter table public.social_notifications
  add constraint social_notifications_type_check check (
    type = any (array[
      'post_comment'::text,
      'post_reaction'::text,
      'circle_join'::text,
      'event_rsvp'::text,
      'challenge_comment'::text,
      'direct_message'::text
    ])
  );

create index if not exists social_notifications_related_conversation_idx
  on public.social_notifications using btree (related_conversation_id);

-- ---- (2) gatilho AFTER INSERT em messages ------------------
create or replace function public.on_message_insert()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_recipient   uuid;
  v_sender_name text;
begin
  begin
    update public.conversations
      set last_message_at = new.created_at
      where id = new.conversation_id;
  exception when others then
    null;
  end;

  begin
    select cp.profile_id into v_recipient
    from public.conversation_participants cp
    where cp.conversation_id = new.conversation_id
      and cp.profile_id <> new.sender_id
    limit 1;

    if v_recipient is not null then
      select full_name into v_sender_name from public.profiles where id = new.sender_id;
      insert into public.social_notifications
        (profile_id, actor_profile_id, type, title, body, related_conversation_id)
      values
        (v_recipient, new.sender_id, 'direct_message',
         coalesce(v_sender_name, 'Alguém') || ' enviou uma mensagem',
         left(coalesce(new.body, ''), 140),
         new.conversation_id);
    end if;
  exception when others then
    null;
  end;

  return new;
end;
$function$;

create or replace trigger trg_on_message_insert
  after insert on public.messages
  for each row execute function public.on_message_insert();

-- ---- (3) Realtime -----------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'messages'
     )
  then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end $$;

commit;
