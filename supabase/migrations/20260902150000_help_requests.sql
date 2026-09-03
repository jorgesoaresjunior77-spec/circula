-- =====================================================================
-- Fase 5 — PEDIDO DE AJUDA
-- =====================================================================
-- Estrutura própria, separada de posts/Feed, daily_mood, joy_moments e
-- check-in. Nenhuma tabela existente é alterada, EXCETO a ampliação
-- ADITIVA de social_notifications (Módulo 4), no mesmo molde já usado
-- para 'direct_message' no Módulo 5.
--
--   public.help_requests        — o pedido (dono = quem pediu)
--   public.help_request_replies — respostas da comunidade (visual de CommentList)
--
-- 'nutri'      -> o cliente também chama get_or_create_direct_conversation
--                (RPC já existente) e guarda o conversation_id aqui;
--                a conversa acontece no sistema de Mensagens atual.
-- 'community'  -> respostas próprias via help_request_replies.
--
-- SEM RPC nova. Gatilho de notificação segue o padrão dos 6 gatilhos
-- do Módulo 4 (AFTER INSERT, SECURITY DEFINER, à prova de exceção).
-- Idempotente. GRANT DML explícito para authenticated.
-- =====================================================================

begin;

-- ---- 1) help_requests --------------------------------------------
create table if not exists public.help_requests (
  id                      uuid not null default gen_random_uuid(),
  community_id            uuid not null,
  profile_id             uuid not null,                 -- quem pediu
  audience               text not null,                 -- 'nutri' | 'community'
  body                   text not null,
  status                 text not null default 'open',  -- 'open' | 'in_progress' | 'resolved'
  related_conversation_id uuid,                          -- só para audience='nutri'
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  resolved_at            timestamptz,
  resolved_by            uuid,
  constraint help_requests_pkey primary key (id),
  constraint help_requests_audience_check check (audience = any (array['nutri'::text,'community'::text])),
  constraint help_requests_status_check   check (status  = any (array['open'::text,'in_progress'::text,'resolved'::text])),
  constraint help_requests_body_check     check (char_length(btrim(body)) between 1 and 4000),
  constraint help_requests_community_id_fkey foreign key (community_id)
    references public.communities (id) on delete cascade,
  constraint help_requests_profile_id_fkey foreign key (profile_id)
    references public.profiles (id) on delete cascade,
  constraint help_requests_related_conversation_id_fkey foreign key (related_conversation_id)
    references public.conversations (id) on delete set null,
  constraint help_requests_resolved_by_fkey foreign key (resolved_by)
    references public.profiles (id) on delete set null
);

create index if not exists help_requests_community_status_idx
  on public.help_requests using btree (community_id, status, created_at desc);
create index if not exists help_requests_profile_idx
  on public.help_requests using btree (profile_id, created_at desc);

drop trigger if exists set_help_requests_updated_at on public.help_requests;
create trigger set_help_requests_updated_at
  before update on public.help_requests
  for each row execute function public.set_updated_at();

alter table public.help_requests enable row level security;

-- SELECT: master OU dona da comunidade OU (membro E (pedido para a
--   comunidade OU pedido meu)). Um membro NÃO vê o pedido "para a Nutri"
--   de outra participante — só o dela e os públicos da comunidade.
drop policy if exists "help_requests_select" on public.help_requests;
create policy "help_requests_select"
  on public.help_requests for select to authenticated
  using (
    public.is_master()
    or public.owns_community(community_id)
    or (
      public.is_community_member(community_id)
      and (audience = 'community' or profile_id = auth.uid())
    )
  );

-- INSERT: só para si, e só em comunidade da qual participa (a dona também).
drop policy if exists "help_requests_insert" on public.help_requests;
create policy "help_requests_insert"
  on public.help_requests for insert to authenticated
  with check (
    profile_id = auth.uid()
    and (public.is_community_member(community_id) or public.owns_community(community_id))
  );

-- UPDATE: a autora edita/gerencia o PRÓPRIO pedido; a dona/Master
--   movem o status na fila (novos/em andamento/respondidos).
drop policy if exists "help_requests_update" on public.help_requests;
create policy "help_requests_update"
  on public.help_requests for update to authenticated
  using  (profile_id = auth.uid() or public.owns_community(community_id) or public.is_master())
  with check (profile_id = auth.uid() or public.owns_community(community_id) or public.is_master());

-- DELETE: só a própria autora (regra 8). A Nutri não apaga — resolve.
drop policy if exists "help_requests_delete" on public.help_requests;
create policy "help_requests_delete"
  on public.help_requests for delete to authenticated
  using (profile_id = auth.uid());

grant select, insert, update, delete on table public.help_requests to authenticated;

-- ---- 2) help_request_replies -----------------------------------
create table if not exists public.help_request_replies (
  id              uuid not null default gen_random_uuid(),
  help_request_id uuid not null,
  profile_id      uuid not null,               -- autora da resposta
  body            text not null,
  created_at      timestamptz not null default now(),
  constraint help_request_replies_pkey primary key (id),
  constraint help_request_replies_body_check check (char_length(btrim(body)) between 1 and 4000),
  constraint help_request_replies_help_request_id_fkey foreign key (help_request_id)
    references public.help_requests (id) on delete cascade,
  constraint help_request_replies_profile_id_fkey foreign key (profile_id)
    references public.profiles (id) on delete cascade
);

create index if not exists help_request_replies_request_idx
  on public.help_request_replies using btree (help_request_id, created_at);

alter table public.help_request_replies enable row level security;

-- SELECT: quem enxerga o pedido pai enxerga as respostas (mesma predicada,
--   inlinada — sem função nova).
drop policy if exists "help_request_replies_select" on public.help_request_replies;
create policy "help_request_replies_select"
  on public.help_request_replies for select to authenticated
  using (
    exists (
      select 1 from public.help_requests hr
      where hr.id = help_request_replies.help_request_id
        and (
          public.is_master()
          or public.owns_community(hr.community_id)
          or (public.is_community_member(hr.community_id)
              and (hr.audience = 'community' or hr.profile_id = auth.uid()))
        )
    )
  );

-- INSERT: só para si, e só se enxerga o pedido pai.
drop policy if exists "help_request_replies_insert" on public.help_request_replies;
create policy "help_request_replies_insert"
  on public.help_request_replies for insert to authenticated
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from public.help_requests hr
      where hr.id = help_request_replies.help_request_id
        and (
          public.is_master()
          or public.owns_community(hr.community_id)
          or (public.is_community_member(hr.community_id)
              and (hr.audience = 'community' or hr.profile_id = auth.uid()))
        )
    )
  );

-- DELETE: só a própria resposta.
drop policy if exists "help_request_replies_delete" on public.help_request_replies;
create policy "help_request_replies_delete"
  on public.help_request_replies for delete to authenticated
  using (profile_id = auth.uid());

grant select, insert, delete on table public.help_request_replies to authenticated;

-- ---- 3) social_notifications: novo tipo + coluna (ADITIVO) ----
alter table public.social_notifications
  add column if not exists related_help_request_id uuid;

alter table public.social_notifications
  drop constraint if exists social_notifications_related_help_request_id_fkey;
alter table public.social_notifications
  add constraint social_notifications_related_help_request_id_fkey
  foreign key (related_help_request_id)
  references public.help_requests (id) on delete cascade;

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
      'direct_message'::text,
      'help_request'::text
    ])
  );

create index if not exists social_notifications_related_help_request_idx
  on public.social_notifications using btree (related_help_request_id);

-- ---- 4) gatilho: notifica a DONA da comunidade a cada pedido ----
create or replace function public.notify_on_help_request()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_owner        uuid;
  v_actor_name   text;
begin
  begin
    select owner_id into v_owner from public.communities where id = new.community_id;

    if v_owner is not null and v_owner <> new.profile_id then
      select full_name into v_actor_name from public.profiles where id = new.profile_id;
      insert into public.social_notifications
        (profile_id, actor_profile_id, type, title, body, related_help_request_id)
      values
        (v_owner, new.profile_id, 'help_request',
         coalesce(v_actor_name, 'Uma mulher do Círcula') || ' pediu ajuda',
         left(new.body, 140),
         new.id);
    end if;
  exception when others then
    null; -- nunca bloquear a criação do pedido
  end;

  return new;
end;
$function$;

create or replace trigger trg_notify_on_help_request
  after insert on public.help_requests
  for each row execute function public.notify_on_help_request();

commit;
