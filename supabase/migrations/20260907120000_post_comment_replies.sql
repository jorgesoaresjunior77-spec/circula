-- =====================================================================
-- FEED DE CONVERSA — respostas a comentários (1 nível)
-- =====================================================================
-- Objetivo: permitir que um comentário do feed receba RESPOSTAS, que
-- ficam agrupadas abaixo dele. Mudança pequena, aditiva e reversível.
--
-- (1) post_comments.parent_comment_id — nulo => comentário-raiz;
--     preenchido => resposta a um comentário-raiz DO MESMO post.
--     FK auto-referente com ON DELETE CASCADE: apagar um comentário-raiz
--     (ou o post) leva junto as respostas. O cascade de posts ->
--     post_comments já existente continua limpando tudo.
--
-- (2) Índices para: (a) montar a árvore de um post em uma consulta
--     (post_id, parent_comment_id, created_at) e (b) varrer/contar
--     respostas por comentário (parent_comment_id, created_at).
--
-- (3) post_comments_insert: mesma regra de hoje
--     (author_id = auth.uid() AND can_participate_in_post(post_id)) MAIS,
--     quando parent_comment_id não é nulo, exigir que o pai:
--       • exista,
--       • pertença AO MESMO post (isolamento — impede "responder" um
--         comentário de outro post/outra comunidade usando o id),
--       • seja ele próprio um comentário-raiz (profundidade travada em 1).
--     `can_participate_in_post` já garante hidden_at IS NULL + vínculo
--     com a comunidade -> nada de interação com post oculto, isolamento
--     por comunidade intacto. Nenhuma outra policy é tocada. O acesso do
--     Master não é ampliado (Master não participa de post — nunca teve
--     ramo em can_participate_in_post).
--
-- Sem tabela nova. Sem função nova. Sem RPC. Sem Realtime. Sem
-- notificação de resposta nesta etapa (fica para depois). Idempotente,
-- transacional, reversível.
-- =====================================================================

begin;

-- ---- 1) coluna auto-referente -----------------------------------
alter table public.post_comments
  add column if not exists parent_comment_id uuid;

alter table public.post_comments
  drop constraint if exists post_comments_parent_comment_id_fkey;
alter table public.post_comments
  add constraint post_comments_parent_comment_id_fkey
  foreign key (parent_comment_id) references public.post_comments (id) on delete cascade;

-- ---- 2) índices ------------------------------------------------
create index if not exists post_comments_post_parent_created_idx
  on public.post_comments using btree (post_id, parent_comment_id, created_at);
create index if not exists post_comments_parent_created_idx
  on public.post_comments using btree (parent_comment_id, created_at);

-- ---- 3) INSERT: valida a resposta sem ampliar nada ------------
drop policy if exists "post_comments_insert" on public.post_comments;
create policy "post_comments_insert" on public.post_comments for insert to public
  with check (
    (author_id = auth.uid())
    and public.can_participate_in_post(post_id)
    and (
      parent_comment_id is null
      or exists (
        select 1
        from public.post_comments parent
        where parent.id = post_comments.parent_comment_id
          and parent.post_id = post_comments.post_id
          and parent.parent_comment_id is null
      )
    )
  );

commit;

-- =====================================================================
-- Reversão (referência):
--   drop policy if exists "post_comments_insert" on public.post_comments;
--   create policy "post_comments_insert" on public.post_comments
--     for insert to public
--     with check ((author_id = auth.uid()) and public.can_participate_in_post(post_id));
--   drop index if exists public.post_comments_post_parent_created_idx;
--   drop index if exists public.post_comments_parent_created_idx;
--   alter table public.post_comments
--     drop constraint if exists post_comments_parent_comment_id_fkey;
--   alter table public.post_comments drop column if exists parent_comment_id;
-- =====================================================================
