-- =====================================================================
-- Fase 4 — MOMENTO DE ALEGRIA
-- =====================================================================
-- Espaço leve para a mulher registrar e compartilhar coisas boas do dia,
-- SEPARADO do Feed principal (não usa `posts` nem `post_type`). Nenhuma
-- tabela existente é alterada. Não é RPC — SELECT direto com embed do
-- autor, no mesmo molde de `posts`.
--
--   public.joy_moments — 1 linha por momento de alegria compartilhado.
--
-- Foto: coluna `image_url` opcional, preenchida pelo mesmo fluxo de
-- upload já usado em Receitas/Eventos/Círculos (bucket público `avatars`,
-- caminho `${auth.uid()}/covers/...`). NENHUM bucket ou policy de Storage
-- nova — decisão estrutural já tomada em fases anteriores.
--
-- RLS:
--   · SELECT: master OU dona OU membro da MESMA comunidade — isolamento
--     por comunidade (uma comunidade não vê a alegria de outra).
--   · INSERT: só para si (`profile_id = auth.uid()`) e só em comunidade
--     da qual participa (membro ou dona).
--   · UPDATE/DELETE: só o próprio autor (`profile_id = auth.uid()`).
--
-- Idempotente. GRANT DML explícito para authenticated (tabela criada
-- fora do Studio não recebe GRANT automático).
-- =====================================================================

begin;

create table if not exists public.joy_moments (
  id           uuid not null default gen_random_uuid(),
  community_id uuid not null,
  profile_id   uuid not null,
  body         text not null,
  image_url    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint joy_moments_pkey primary key (id),
  constraint joy_moments_body_check check (char_length(btrim(body)) between 1 and 2000),
  constraint joy_moments_community_id_fkey foreign key (community_id)
    references public.communities (id) on delete cascade,
  constraint joy_moments_profile_id_fkey foreign key (profile_id)
    references public.profiles (id) on delete cascade
);

create index if not exists joy_moments_community_created_idx
  on public.joy_moments using btree (community_id, created_at desc);
create index if not exists joy_moments_profile_idx
  on public.joy_moments using btree (profile_id);

drop trigger if exists set_joy_moments_updated_at on public.joy_moments;
create trigger set_joy_moments_updated_at
  before update on public.joy_moments
  for each row execute function public.set_updated_at();

alter table public.joy_moments enable row level security;

drop policy if exists "joy_moments_select" on public.joy_moments;
create policy "joy_moments_select"
  on public.joy_moments for select to authenticated
  using (
    public.is_master()
    or public.owns_community(community_id)
    or public.is_community_member(community_id)
  );

drop policy if exists "joy_moments_insert" on public.joy_moments;
create policy "joy_moments_insert"
  on public.joy_moments for insert to authenticated
  with check (
    profile_id = auth.uid()
    and (public.is_community_member(community_id) or public.owns_community(community_id))
  );

drop policy if exists "joy_moments_update" on public.joy_moments;
create policy "joy_moments_update"
  on public.joy_moments for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists "joy_moments_delete" on public.joy_moments;
create policy "joy_moments_delete"
  on public.joy_moments for delete to authenticated
  using (profile_id = auth.uid());

grant select, insert, update, delete on table public.joy_moments to authenticated;

commit;
