-- ============================================================
-- Fase 2 · item 1 — Círculos como entidade navegável
--
-- Adiciona posts.circle_id: quando não nulo, o post pertence a um
-- círculo daquela comunidade.
--
-- Escopo (decisão do produto):
--   • LEITURA: posts de círculo continuam sujeitos à visibilidade
--     da comunidade — todos os membros da comunidade podem ver.
--     A policy "posts_select" NÃO é alterada (o post carrega o
--     community_id do círculo e o check de is_community_member já
--     cobre).
--   • INSERÇÃO: para criar um post COM circle_id, a autora precisa
--     ser membro daquele círculo. Post SEM circle_id mantém
--     exatamente a regra atual.
--
-- Não cria tabela nova. Não altera checkout/produtos/assinaturas/
-- desafios/check-ins/autenticação/comunidades. Não toca em
-- "posts_select". Altera "posts_insert" com a menor mudança
-- possível (uma cláusula AND que é no-op quando circle_id is null).
-- ============================================================

alter table public.posts
  add column if not exists circle_id uuid;

alter table public.posts
  drop constraint if exists posts_circle_id_fkey;
alter table public.posts
  add constraint posts_circle_id_fkey
  foreign key (circle_id) references public.community_circles (id) on delete set null;

create index if not exists posts_circle_id_idx
  on public.posts using btree (circle_id);

-- posts_insert: mesma regra de hoje + exigência de participação no
-- círculo quando circle_id não é nulo. circle_id nulo => comportamento
-- idêntico ao atual.
drop policy if exists "posts_insert" on public.posts;
create policy "posts_insert" on public.posts for insert to public
  with check (
    (author_id = auth.uid())
    and (owns_community(community_id) or is_community_member(community_id))
    and (
      circle_id is null
      or exists (
        select 1
        from public.circle_members cm
        where cm.circle_id = posts.circle_id
          and cm.profile_id = auth.uid()
      )
    )
  );
