-- =====================================================================
-- Parceiros da comunidade — logos na faixa em movimento da Home
-- =====================================================================
-- NÃO APLICADA — aguardando OK explícito do usuário.
--
-- Tabela nova de CONTEÚDO, cadastrada pela profissional dona da comunidade.
-- O logo é um arquivo no bucket privado `community-media` (só o PATH é
-- guardado aqui). Link é opcional e só aceita https.
--
-- Quem lê: membro ativo vê só o PUBLICADO; a dona (e a master) vê também os
-- rascunhos. Quem escreve: só a dona, na própria comunidade.
-- Idempotente, transacional e reversível (rodapé).
-- =====================================================================

begin;

create table if not exists public.community_partners (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  logo_path text not null check (char_length(btrim(logo_path)) > 0),
  link_url text check (link_url is null or (link_url ~ '^https://' and char_length(link_url) <= 500)),
  position integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists community_partners_community_idx
  on public.community_partners (community_id, status, position);

create or replace function public.community_partners_touch()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.community_partners_touch() from public, anon, authenticated;

drop trigger if exists community_partners_touch on public.community_partners;
create trigger community_partners_touch before update on public.community_partners
  for each row execute function public.community_partners_touch();

alter table public.community_partners enable row level security;

drop policy if exists "community_partners_select" on public.community_partners;
create policy "community_partners_select" on public.community_partners for select to authenticated
  using (
    public.is_master()
    or public.owns_community(community_id)
    or (status = 'published' and public.is_community_member(community_id))
  );
drop policy if exists "community_partners_write" on public.community_partners;
create policy "community_partners_write" on public.community_partners for all to authenticated
  using (public.owns_community(community_id))
  with check (public.owns_community(community_id));

revoke all on table public.community_partners from public, anon;
grant select, insert, update, delete on table public.community_partners to authenticated;

commit;

-- ---- Rollback (manual) ------------------------------------------
-- drop table if exists public.community_partners cascade;
-- drop function if exists public.community_partners_touch();
