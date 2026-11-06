-- =====================================================================
-- Pop-up diário de inspiração — mensagens cadastradas pela profissional
-- =====================================================================
-- Uma tabela nova de CONTEÚDO. Nenhuma linha é criada aqui: o Círcula não
-- gera nem inventa frases (regra do produto). Quem cadastra é a
-- profissional dona da comunidade, que responde pela fonte.
--
--   kind = 'citacao'   → exige AUTOR e OBRA (citação verificada, com fonte).
--   kind = 'editorial' → texto original, identificado no app como
--                        "texto editorial do Círcula".
--
-- Quem lê: membro ativo vê só o PUBLICADO; a dona (e a master) vê também
-- os rascunhos. Quem escreve: só a dona, na própria comunidade.
--
-- Idempotente e reversível (rodapé). Não altera tabela existente.
-- =====================================================================

begin;

create table if not exists public.daily_inspirations (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  kind text not null check (kind in ('citacao', 'editorial')),
  body text not null check (char_length(btrim(body)) between 1 and 600),
  author text check (author is null or char_length(author) <= 160),
  source text check (source is null or char_length(source) <= 200),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Citação só vale com autor e obra: nada de frase solta atribuída a alguém.
  constraint daily_inspirations_quote_has_source check (
    kind = 'editorial'
    or (author is not null and char_length(btrim(author)) > 0
        and source is not null and char_length(btrim(source)) > 0)
  )
);
create index if not exists daily_inspirations_community_idx
  on public.daily_inspirations (community_id, status);

create or replace function public.daily_inspirations_touch()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.daily_inspirations_touch() from public, anon, authenticated;

drop trigger if exists daily_inspirations_touch on public.daily_inspirations;
create trigger daily_inspirations_touch before update on public.daily_inspirations
  for each row execute function public.daily_inspirations_touch();

alter table public.daily_inspirations enable row level security;

drop policy if exists "daily_inspirations_select" on public.daily_inspirations;
create policy "daily_inspirations_select" on public.daily_inspirations for select to authenticated
  using (
    public.is_master()
    or public.owns_community(community_id)
    or (status = 'published' and public.is_community_member(community_id))
  );
drop policy if exists "daily_inspirations_write" on public.daily_inspirations;
create policy "daily_inspirations_write" on public.daily_inspirations for all to authenticated
  using (public.owns_community(community_id))
  with check (public.owns_community(community_id));

revoke all on table public.daily_inspirations from public, anon;
grant select, insert, update, delete on table public.daily_inspirations to authenticated;

commit;

-- ---- Rollback (manual) ------------------------------------------
-- drop table if exists public.daily_inspirations cascade;
-- drop function if exists public.daily_inspirations_touch();
