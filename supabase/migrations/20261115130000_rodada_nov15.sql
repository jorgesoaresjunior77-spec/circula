-- =====================================================================
-- Rodada 2026-11-15 — pedidos do usuário (2ª lista do dia)
-- =====================================================================
--  1. community_circles.description — texto de apresentação do Círculo
--     (quem ainda não entrou vê a descrição, não as conversas).
--  2. Aviso no sininho para a membro quando o pedido de novo Círculo dela
--     é aprovado (novo tipo 'circle_request_approved' + trigger).
--  3. profile_photo_likes / profile_photo_comments — curtir e comentar as
--     fotos da galeria do perfil de outra participante.
--  4. post_polls / post_poll_votes — enquetes dentro das publicações
--     (Feed e Círculos), no estilo do WhatsApp.
--
-- Aditiva, idempotente e transacional. Não toca em cobrança nem em auth.
-- Rollback no rodapé.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Descrição do Círculo
-- ---------------------------------------------------------------------
alter table public.community_circles add column if not exists description text
  check (description is null or char_length(description) <= 600);

-- ---------------------------------------------------------------------
-- 2. Pedido de Círculo aprovado -> aviso para quem pediu
-- ---------------------------------------------------------------------
alter table public.social_notifications
  drop constraint if exists social_notifications_type_check;
alter table public.social_notifications
  add constraint social_notifications_type_check check (
    type = any (array[
      'post_comment', 'post_reaction', 'circle_join', 'event_rsvp',
      'direct_message', 'help_request', 'membership_requested',
      'membership_approved', 'membership_rejected', 'circle_request',
      'circle_request_approved'
    ])
  );

create or replace function public.notify_on_circle_request_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    if new.status = 'approved' and old.status is distinct from 'approved' then
      insert into public.social_notifications
        (profile_id, actor_profile_id, type, title, body, related_circle_request_id, related_community_id)
      values
        (new.profile_id, new.reviewed_by, 'circle_request_approved',
         'Seu Círculo foi criado',
         new.suggested_name,
         new.id, new.community_id);
    end if;
  exception when others then
    null; -- nunca bloquear a aprovação
  end;
  return new;
end;
$$;

revoke all on function public.notify_on_circle_request_approved() from public, anon, authenticated;

drop trigger if exists trg_notify_on_circle_request_approved on public.circle_requests;
create trigger trg_notify_on_circle_request_approved
  after update of status on public.circle_requests
  for each row execute function public.notify_on_circle_request_approved();

-- ---------------------------------------------------------------------
-- 3. Curtidas e comentários nas fotos do perfil
-- ---------------------------------------------------------------------
-- A foto é identificada pela URL guardada em profiles.gallery_photos.
-- Quem pode ver/curtir/comentar: quem já pode ver o perfil (a própria
-- pessoa, quem divide uma comunidade ativa com ela, ou a dona).
create table if not exists public.profile_photo_likes (
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  photo_url   text not null check (char_length(photo_url) between 1 and 600),
  profile_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (owner_id, photo_url, profile_id)
);

create table if not exists public.profile_photo_comments (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  photo_url   text not null check (char_length(photo_url) between 1 and 600),
  author_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  content     text not null check (char_length(btrim(content)) between 1 and 500),
  created_at  timestamptz not null default now()
);
create index if not exists profile_photo_comments_photo_idx
  on public.profile_photo_comments (owner_id, photo_url, created_at);

alter table public.profile_photo_likes enable row level security;
alter table public.profile_photo_comments enable row level security;

drop policy if exists "profile_photo_likes_select" on public.profile_photo_likes;
create policy "profile_photo_likes_select" on public.profile_photo_likes for select to authenticated
  using (owner_id = auth.uid() or public.shares_active_community(owner_id) or public.community_owner_of_profile(owner_id));

drop policy if exists "profile_photo_likes_insert" on public.profile_photo_likes;
create policy "profile_photo_likes_insert" on public.profile_photo_likes for insert to authenticated
  with check (
    profile_id = auth.uid()
    and (owner_id = auth.uid() or public.shares_active_community(owner_id) or public.community_owner_of_profile(owner_id))
  );

drop policy if exists "profile_photo_likes_delete" on public.profile_photo_likes;
create policy "profile_photo_likes_delete" on public.profile_photo_likes for delete to authenticated
  using (profile_id = auth.uid());

drop policy if exists "profile_photo_comments_select" on public.profile_photo_comments;
create policy "profile_photo_comments_select" on public.profile_photo_comments for select to authenticated
  using (owner_id = auth.uid() or public.shares_active_community(owner_id) or public.community_owner_of_profile(owner_id));

drop policy if exists "profile_photo_comments_insert" on public.profile_photo_comments;
create policy "profile_photo_comments_insert" on public.profile_photo_comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and (owner_id = auth.uid() or public.shares_active_community(owner_id) or public.community_owner_of_profile(owner_id))
  );

-- Apaga: quem escreveu ou a dona da foto.
drop policy if exists "profile_photo_comments_delete" on public.profile_photo_comments;
create policy "profile_photo_comments_delete" on public.profile_photo_comments for delete to authenticated
  using (author_id = auth.uid() or owner_id = auth.uid());

revoke all on table public.profile_photo_likes from public, anon;
revoke all on table public.profile_photo_comments from public, anon;
grant select, insert, delete on table public.profile_photo_likes to authenticated;
grant select, insert, delete on table public.profile_photo_comments to authenticated;

-- ---------------------------------------------------------------------
-- 4. Enquetes nas publicações
-- ---------------------------------------------------------------------
-- A pergunta é o texto da publicação; aqui ficam as opções e os votos.
-- Quem vê a publicação vê a enquete e pode votar (can_view_post).
create table if not exists public.post_polls (
  post_id         uuid primary key references public.posts (id) on delete cascade,
  options         text[] not null check (array_length(options, 1) between 2 and 8),
  allow_multiple  boolean not null default false,
  created_at      timestamptz not null default now()
);

create table if not exists public.post_poll_votes (
  post_id       uuid not null references public.post_polls (post_id) on delete cascade,
  profile_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  option_index  smallint not null check (option_index between 0 and 7),
  created_at    timestamptz not null default now(),
  primary key (post_id, profile_id, option_index)
);

alter table public.post_polls enable row level security;
alter table public.post_poll_votes enable row level security;

drop policy if exists "post_polls_select" on public.post_polls;
create policy "post_polls_select" on public.post_polls for select to authenticated
  using (public.can_view_post(post_id));

-- Só quem escreveu a publicação anexa a enquete a ela.
drop policy if exists "post_polls_insert" on public.post_polls;
create policy "post_polls_insert" on public.post_polls for insert to authenticated
  with check (
    exists (select 1 from public.posts p where p.id = post_polls.post_id and p.author_id = auth.uid())
  );

drop policy if exists "post_poll_votes_select" on public.post_poll_votes;
create policy "post_poll_votes_select" on public.post_poll_votes for select to authenticated
  using (public.can_view_post(post_id));

drop policy if exists "post_poll_votes_insert" on public.post_poll_votes;
create policy "post_poll_votes_insert" on public.post_poll_votes for insert to authenticated
  with check (profile_id = auth.uid() and public.can_view_post(post_id));

drop policy if exists "post_poll_votes_delete" on public.post_poll_votes;
create policy "post_poll_votes_delete" on public.post_poll_votes for delete to authenticated
  using (profile_id = auth.uid());

revoke all on table public.post_polls from public, anon;
revoke all on table public.post_poll_votes from public, anon;
grant select, insert on table public.post_polls to authenticated;
grant select, insert, delete on table public.post_poll_votes to authenticated;

commit;

-- ---- Rollback (manual) ------------------------------------------------
-- begin;
-- drop table if exists public.post_poll_votes;
-- drop table if exists public.post_polls;
-- drop table if exists public.profile_photo_comments;
-- drop table if exists public.profile_photo_likes;
-- drop trigger if exists trg_notify_on_circle_request_approved on public.circle_requests;
-- drop function if exists public.notify_on_circle_request_approved();
-- (recriar social_notifications_type_check sem 'circle_request_approved')
-- alter table public.community_circles drop column if exists description;
-- commit;
