-- =====================================================================
-- Etapa "plataforma completa" — Módulo 2: CONTEÚDOS / BIBLIOTECA
-- =====================================================================
-- Biblioteca de conteúdos da comunidade (Seção 14 da especificação:
-- "Memória da Comunidade" — receitas, artigos, dicas, materiais,
-- pesquisável por texto/categoria, SEM IA).
--
-- DECISÃO DE ARQUITETURA: tabela nova e separada de `products`. A
-- biblioteca é conteúdo GRATUITO curado pela anfitriã; `products` é
-- catálogo PAGO com checkout/split/entitlements. Misturar os dois
-- sobrecarregaria o fluxo de pagamento já validado. Nenhuma tabela
-- existente é alterada.
--
--   public.community_content  — o item de biblioteca
--   public.content_likes      — curtida (1 linha por pessoa, toggle por
--                               DELETE, mesmo padrão de circle_members)
--
-- "Salvar" (área Salvos) virá no módulo 6 via `saved_items` polimórfico
-- — não faz parte desta migration.
--
-- Idempotente. GRANT DML explícito para authenticated.
-- =====================================================================

begin;

create table if not exists public.community_content (
  id              uuid not null default gen_random_uuid(),
  community_id    uuid not null,
  circle_id       uuid,
  created_by      uuid not null,
  type            text not null,
  title           text not null,
  summary         text,
  body            text,
  cover_image_url text,
  external_url    text,
  category        text,
  status          text not null default 'published',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint community_content_pkey primary key (id),
  constraint community_content_type_check check (
    type = any (array[
      'recipe'::text, 'article'::text, 'tip'::text,
      'material'::text, 'video'::text, 'educational'::text
    ])
  ),
  constraint community_content_status_check check (
    status = any (array['draft'::text, 'published'::text, 'archived'::text])
  ),
  constraint community_content_community_id_fkey foreign key (community_id)
    references public.communities (id) on delete cascade,
  constraint community_content_circle_id_fkey foreign key (circle_id)
    references public.community_circles (id) on delete set null,
  constraint community_content_created_by_fkey foreign key (created_by)
    references public.profiles (id) on delete cascade
);

create index if not exists community_content_community_id_type_idx
  on public.community_content using btree (community_id, type);
create index if not exists community_content_community_id_category_idx
  on public.community_content using btree (community_id, category);
create index if not exists community_content_circle_id_idx
  on public.community_content using btree (circle_id);

create or replace trigger set_community_content_updated_at
  before update on public.community_content
  for each row execute function public.set_updated_at();

create table if not exists public.content_likes (
  id         uuid not null default gen_random_uuid(),
  content_id uuid not null,
  profile_id uuid not null,
  created_at timestamptz not null default now(),
  constraint content_likes_pkey primary key (id),
  constraint content_likes_content_id_profile_id_key unique (content_id, profile_id),
  constraint content_likes_content_id_fkey foreign key (content_id)
    references public.community_content (id) on delete cascade,
  constraint content_likes_profile_id_fkey foreign key (profile_id)
    references public.profiles (id) on delete cascade
);

create index if not exists content_likes_content_id_idx
  on public.content_likes using btree (content_id);
create index if not exists content_likes_profile_id_idx
  on public.content_likes using btree (profile_id);

-- ---- funções de apoio (molde de can_view_circle / circle_member_count)
create or replace function public.can_view_content(p_content_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.community_content c
    where c.id = p_content_id
      and (
        public.is_master()
        or public.owns_community(c.community_id)
        or public.is_community_member(c.community_id)
      )
  );
$function$;

create or replace function public.content_like_count(p_content_id uuid)
 returns integer
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select count(*)::int from public.content_likes where content_id = p_content_id;
$function$;

-- ---- RLS: community_content --------------------------------
alter table public.community_content enable row level security;

drop policy if exists "community_content_select" on public.community_content;
create policy "community_content_select"
  on public.community_content for select to public
  using (
    public.is_master()
    or public.owns_community(community_id)
    or (public.is_community_member(community_id) and status = 'published'::text)
  );

drop policy if exists "community_content_insert" on public.community_content;
create policy "community_content_insert"
  on public.community_content for insert to public
  with check (
    public.owns_community(community_id)
    and created_by = auth.uid()
  );

drop policy if exists "community_content_update" on public.community_content;
create policy "community_content_update"
  on public.community_content for update to public
  using (public.owns_community(community_id))
  with check (public.owns_community(community_id));

drop policy if exists "community_content_delete" on public.community_content;
create policy "community_content_delete"
  on public.community_content for delete to public
  using (public.owns_community(community_id));

-- ---- RLS: content_likes -----------------------------------
alter table public.content_likes enable row level security;

drop policy if exists "content_likes_select" on public.content_likes;
create policy "content_likes_select"
  on public.content_likes for select to public
  using (public.can_view_content(content_id));

drop policy if exists "content_likes_insert" on public.content_likes;
create policy "content_likes_insert"
  on public.content_likes for insert to public
  with check (
    profile_id = auth.uid()
    and public.can_view_content(content_id)
  );

drop policy if exists "content_likes_delete" on public.content_likes;
create policy "content_likes_delete"
  on public.content_likes for delete to public
  using (profile_id = auth.uid());

-- ---- GRANT ------------------------------------------------
grant select, insert, update, delete on table public.community_content to authenticated;
grant select, insert, delete on table public.content_likes to authenticated;

commit;
