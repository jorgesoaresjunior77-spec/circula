-- ============================================================
-- Fase 1 · item 1 — Fotos reais em comunidade e círculo
--
-- Adiciona a coluna opcional cover_image_url (URL da imagem de
-- capa) a communities e community_circles. Colunas nullable, sem
-- default: linhas existentes ficam com NULL e o app usa o
-- fallback botânico / pilha de avatares atual.
--
-- Não cria bucket nem policy de Storage. Nesta etapa a capa é uma
-- URL (mesmo padrão de products.cover_image_url). A RLS das duas
-- tabelas permanece inalterada.
-- ============================================================

alter table public.communities
  add column if not exists cover_image_url text;

alter table public.community_circles
  add column if not exists cover_image_url text;

-- A policy "communities_update" já existe e restringe a linha ao
-- dono (owner_id = auth.uid()) ou master. Faltava apenas o GRANT
-- de UPDATE ao role authenticated para a anfitriã conseguir
-- definir a capa da própria comunidade já existente. A RLS
-- continua contendo qualquer alteração fora da própria linha.
grant update on table public.communities to authenticated;

-- community_circles já tem "grant insert, select, update, delete
-- to authenticated" e a policy "community_circles_update"
-- (renameCircle já faz UPDATE hoje) — nada a alterar aqui.
