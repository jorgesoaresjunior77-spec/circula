-- Feed como rede: imagem em respostas e curtidas em comentarios.
-- Rollback manual: alter table post_comments drop column image_url; drop table comment_likes;
alter table public.post_comments add column if not exists image_url text;

create table if not exists public.comment_likes (
  comment_id uuid not null references public.post_comments(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, profile_id)
);
alter table public.comment_likes enable row level security;

drop policy if exists "comment_likes_select" on public.comment_likes;
create policy "comment_likes_select" on public.comment_likes for select to authenticated
  using (exists (select 1 from public.post_comments c where c.id = comment_id));
drop policy if exists "comment_likes_insert" on public.comment_likes;
create policy "comment_likes_insert" on public.comment_likes for insert to authenticated
  with check (profile_id = auth.uid() and exists (select 1 from public.post_comments c where c.id = comment_id));
drop policy if exists "comment_likes_delete" on public.comment_likes;
create policy "comment_likes_delete" on public.comment_likes for delete to authenticated
  using (profile_id = auth.uid());
grant select, insert, delete on table public.comment_likes to authenticated;
