-- =====================================================================
-- Dicas de Leitura e Respiração e Meditação — conteúdo da comunidade
-- =====================================================================
-- Duas tabelas novas, de CONTEÚDO cadastrado pela profissional dona da
-- comunidade. Nenhuma linha é criada aqui: não há livro, resumo, técnica
-- nem áudio de exemplo. O Círcula não gera esse conteúdo; ele é escrito
-- ou revisado por quem responde por ele (regra do produto).
--
--   reading_tips      — recomendações de livros, por tema.
--   wellness_sessions — respiração guiada, meditações curtas, áudios de
--                       relaxamento e pausas, com durações diferentes.
--
-- Quem lê: membro ativo da comunidade vê só o que está PUBLICADO; a dona
-- (e a master) vê também os rascunhos. Quem escreve: só a dona.
-- O áudio é um link https para um arquivo hospedado pela profissional
-- (sem bucket novo).
--
-- Idempotente e reversível (rodapé). Não altera tabela existente.
-- =====================================================================

begin;

create table if not exists public.reading_tips (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  theme text not null check (theme in (
    'longevidade', 'neurociencia', 'saude', 'desenvolvimento_pessoal',
    'inteligencia_emocional', 'habitos_comportamento', 'qualidade_de_vida'
  )),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  author text not null check (char_length(btrim(author)) between 1 and 160),
  summary text check (summary is null or char_length(summary) <= 2000),
  key_learnings text check (key_learnings is null or char_length(key_learnings) <= 3000),
  why_recommended text check (why_recommended is null or char_length(why_recommended) <= 1500),
  cover_image_url text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reading_tips_community_idx on public.reading_tips (community_id, status);

create table if not exists public.wellness_sessions (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  kind text not null check (kind in ('respiracao', 'meditacao', 'relaxamento', 'pausa')),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  instructions text check (instructions is null or char_length(instructions) <= 4000),
  duration_minutes int not null check (duration_minutes between 1 and 120),
  audio_url text check (audio_url is null or audio_url ~ '^https://'),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists wellness_sessions_community_idx on public.wellness_sessions (community_id, status);

create or replace function public.wellness_content_touch()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.wellness_content_touch() from public, anon, authenticated;

drop trigger if exists reading_tips_touch on public.reading_tips;
create trigger reading_tips_touch before update on public.reading_tips
  for each row execute function public.wellness_content_touch();
drop trigger if exists wellness_sessions_touch on public.wellness_sessions;
create trigger wellness_sessions_touch before update on public.wellness_sessions
  for each row execute function public.wellness_content_touch();

alter table public.reading_tips enable row level security;
alter table public.wellness_sessions enable row level security;

-- Leitura: publicado para quem é da comunidade; tudo para a dona e a master.
drop policy if exists "reading_tips_select" on public.reading_tips;
create policy "reading_tips_select" on public.reading_tips for select to authenticated
  using (
    public.is_master()
    or public.owns_community(community_id)
    or (status = 'published' and public.is_community_member(community_id))
  );
drop policy if exists "reading_tips_write" on public.reading_tips;
create policy "reading_tips_write" on public.reading_tips for all to authenticated
  using (public.owns_community(community_id))
  with check (public.owns_community(community_id));

drop policy if exists "wellness_sessions_select" on public.wellness_sessions;
create policy "wellness_sessions_select" on public.wellness_sessions for select to authenticated
  using (
    public.is_master()
    or public.owns_community(community_id)
    or (status = 'published' and public.is_community_member(community_id))
  );
drop policy if exists "wellness_sessions_write" on public.wellness_sessions;
create policy "wellness_sessions_write" on public.wellness_sessions for all to authenticated
  using (public.owns_community(community_id))
  with check (public.owns_community(community_id));

revoke all on table public.reading_tips from public, anon;
revoke all on table public.wellness_sessions from public, anon;
grant select, insert, update, delete on table public.reading_tips to authenticated;
grant select, insert, update, delete on table public.wellness_sessions to authenticated;

commit;

-- ---- Rollback (manual) ------------------------------------------
-- drop table if exists public.reading_tips cascade;
-- drop table if exists public.wellness_sessions cascade;
-- drop function if exists public.wellness_content_touch();
