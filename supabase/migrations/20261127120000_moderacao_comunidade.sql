-- =====================================================================
-- Moderação da comunidade (NÃO APLICADA no banco remoto — aguarda ok).
--
--  1) blocked_terms: lista de termos bloqueados (global = community_id nulo,
--     só o Master mantém; por comunidade, a dona mantém). A checagem do
--     servidor repete a do app (src/lib/moderation.ts), palavra por palavra.
--  2) Trigger de bloqueio em posts e post_comments (insert e update).
--  3) A autora edita e apaga o PRÓPRIO post/comentário (RLS + trigger que
--     impede trocar autora, comunidade ou post). `edited_at` marca a edição.
--  4) moderation_log: quem removeu o quê e quando.
--  5) moderate_comment(): a dona da comunidade remove comentário de membro
--     (com registro). moderate_post() passa a registrar também.
-- Aditiva, transacional e reversível (rollback no fim).
-- =====================================================================
begin;

-- ---- 1) termos bloqueados --------------------------------------------
create table if not exists public.blocked_terms (
  id uuid primary key default gen_random_uuid(),
  community_id uuid references public.communities (id) on delete cascade,
  term text not null check (char_length(term) between 2 and 60),
  normalized text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (community_id, normalized)
);
create unique index if not exists blocked_terms_global_uidx on public.blocked_terms (normalized) where community_id is null;
alter table public.blocked_terms enable row level security;

-- minúsculas, sem acento, números/símbolos viram letras, sem sinais, sem letras repetidas
create or replace function public.normalize_term(p text)
returns text language sql immutable set search_path to 'public' as $$
  select regexp_replace(
    regexp_replace(
      translate(lower(coalesce(p, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ013457@$!', 'aaaaaeeeeiiiiooooouuuucnoieastasi'),
      '[^a-z]', '', 'g'),
    '(.)\1+', '\1', 'g')
$$;

create or replace function public.blocked_terms_fill()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  new.normalized := public.normalize_term(new.term);
  if new.normalized = '' then raise exception 'termo_invalido'; end if;
  new.created_by := coalesce(new.created_by, auth.uid());
  return new;
end $$;
drop trigger if exists blocked_terms_fill on public.blocked_terms;
create trigger blocked_terms_fill before insert or update on public.blocked_terms
  for each row execute function public.blocked_terms_fill();

drop policy if exists "blocked_terms_select" on public.blocked_terms;
create policy "blocked_terms_select" on public.blocked_terms for select to authenticated
  using (community_id is null or public.owns_community(community_id) or public.is_community_member(community_id) or public.is_master());
drop policy if exists "blocked_terms_write" on public.blocked_terms;
create policy "blocked_terms_write" on public.blocked_terms for all to authenticated
  using ((community_id is null and public.is_master()) or (community_id is not null and public.owns_community(community_id)))
  with check ((community_id is null and public.is_master()) or (community_id is not null and public.owns_community(community_id)));

insert into public.blocked_terms (term)
select t from unnest(array['merda','bosta','porra','caralho','puta','puto','foder','fodase','cu','buceta','piroca','viado','viada','arrombado','arrombada','cuzao','idiota','imbecil','retardado','retardada','babaca','otario','otaria','vagabunda','vagabundo','piranha','desgraca','desgracada','desgracado','nojenta','nojento','vadia','corno','cretina','cretino']) as t
on conflict do nothing;

create or replace function public.text_has_blocked_term(p_text text, p_community uuid)
returns boolean language plpgsql stable security definer set search_path to 'public' as $$
declare w text;
begin
  for w in
    select public.normalize_term(x) from regexp_split_to_table(coalesce(p_text, ''), '\s+') as x
  loop
    continue when w = '';
    if exists (
      select 1 from public.blocked_terms b
      where (b.community_id is null or b.community_id = p_community)
        and (b.normalized = w or (length(w) > 3 and b.normalized = regexp_replace(w, 's$', '')))
    ) then return true; end if;
  end loop;
  return false;
end $$;

create or replace function public.block_offensive_text()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_community uuid;
begin
  if tg_table_name = 'posts' then
    v_community := new.community_id;
    if public.text_has_blocked_term(coalesce(new.content, '') || ' ' || coalesce(new.title, ''), v_community) then
      raise exception 'conteudo_bloqueado' using errcode = 'check_violation';
    end if;
  else
    select community_id into v_community from public.posts where id = new.post_id;
    if public.text_has_blocked_term(new.content, v_community) then
      raise exception 'conteudo_bloqueado' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists posts_block_offensive on public.posts;
create trigger posts_block_offensive before insert or update of content, title on public.posts
  for each row execute function public.block_offensive_text();
drop trigger if exists post_comments_block_offensive on public.post_comments;
create trigger post_comments_block_offensive before insert or update of content on public.post_comments
  for each row execute function public.block_offensive_text();

-- ---- 3) autora edita e apaga o que é dela ---------------------------
alter table public.posts add column if not exists edited_at timestamptz;
alter table public.post_comments add column if not exists edited_at timestamptz;

create or replace function public.guard_own_edit()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if new.author_id is distinct from old.author_id then raise exception 'author_immutable'; end if;
  if tg_table_name = 'posts' and new.community_id is distinct from old.community_id then raise exception 'community_immutable'; end if;
  if tg_table_name = 'post_comments' and new.post_id is distinct from old.post_id then raise exception 'post_immutable'; end if;
  if new.content is distinct from old.content then new.edited_at := now(); end if;
  return new;
end $$;
drop trigger if exists posts_guard_edit on public.posts;
create trigger posts_guard_edit before update on public.posts for each row execute function public.guard_own_edit();
drop trigger if exists post_comments_guard_edit on public.post_comments;
create trigger post_comments_guard_edit before update on public.post_comments for each row execute function public.guard_own_edit();

drop policy if exists "posts_update_own" on public.posts;
create policy "posts_update_own" on public.posts for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists "posts_delete_own" on public.posts;
create policy "posts_delete_own" on public.posts for delete to authenticated using (author_id = auth.uid());
drop policy if exists "post_comments_update_own" on public.post_comments;
create policy "post_comments_update_own" on public.post_comments for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists "post_comments_delete_own" on public.post_comments;
create policy "post_comments_delete_own" on public.post_comments for delete to authenticated using (author_id = auth.uid());

-- ---- 4) registro de moderação ---------------------------------------
create table if not exists public.moderation_log (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in ('hide_post','unhide_post','remove_post','remove_comment')),
  target_id uuid not null,
  target_author_id uuid,
  excerpt text,
  created_at timestamptz not null default now()
);
alter table public.moderation_log enable row level security;
drop policy if exists "moderation_log_select" on public.moderation_log;
create policy "moderation_log_select" on public.moderation_log for select to authenticated
  using (public.owns_community(community_id) or public.is_master());
-- sem policy de escrita: só as funções abaixo gravam.

-- ---- 5) remoção de comentário pela dona da comunidade ---------------
create or replace function public.moderate_comment(p_comment_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_community uuid; v_author uuid; v_text text;
begin
  select p.community_id, c.author_id, left(c.content, 160)
    into v_community, v_author, v_text
    from public.post_comments c join public.posts p on p.id = c.post_id
   where c.id = p_comment_id;
  if v_community is null then raise exception 'comment_not_found' using errcode = 'no_data_found'; end if;
  if not public.owns_community(v_community) then raise exception 'not_authorized' using errcode = 'insufficient_privilege'; end if;
  delete from public.post_comments where id = p_comment_id;
  insert into public.moderation_log (community_id, actor_id, action, target_id, target_author_id, excerpt)
  values (v_community, auth.uid(), 'remove_comment', p_comment_id, v_author, v_text);
end $$;
revoke all on function public.moderate_comment(uuid) from public, anon;
grant execute on function public.moderate_comment(uuid) to authenticated;

create or replace function public.moderate_post(p_post_id uuid, p_action text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_community uuid; v_author uuid; v_text text;
begin
  if p_post_id is null then raise exception 'moderate_post: p_post_id ausente' using errcode = 'null_value_not_allowed'; end if;
  if p_action is null or p_action not in ('hide', 'unhide', 'remove') then
    raise exception 'moderate_post: acao invalida (%)', p_action using errcode = 'check_violation';
  end if;
  select community_id, author_id, left(content, 160) into v_community, v_author, v_text from public.posts where id = p_post_id;
  if v_community is null then raise exception 'post_not_found' using errcode = 'no_data_found'; end if;
  if not public.owns_community(v_community) then raise exception 'not_authorized' using errcode = 'insufficient_privilege'; end if;
  if p_action = 'hide' then
    update public.posts set hidden_at = now(), updated_at = now() where id = p_post_id and hidden_at is null;
  elsif p_action = 'unhide' then
    update public.posts set hidden_at = null, updated_at = now() where id = p_post_id and hidden_at is not null;
  else
    delete from public.posts where id = p_post_id;
  end if;
  insert into public.moderation_log (community_id, actor_id, action, target_id, target_author_id, excerpt)
  values (v_community, auth.uid(), p_action || '_post', p_post_id, v_author, v_text);
end $$;
grant execute on function public.moderate_post(uuid, text) to authenticated;

commit;

-- ROLLBACK (manual):
--   drop trigger posts_block_offensive on public.posts; drop trigger post_comments_block_offensive on public.post_comments;
--   drop trigger posts_guard_edit on public.posts; drop trigger post_comments_guard_edit on public.post_comments;
--   drop policy posts_update_own on public.posts; drop policy posts_delete_own on public.posts;
--   drop policy post_comments_update_own on public.post_comments; drop policy post_comments_delete_own on public.post_comments;
--   drop function moderate_comment(uuid), block_offensive_text(), text_has_blocked_term(text,uuid), guard_own_edit();
--   drop table moderation_log, blocked_terms;
