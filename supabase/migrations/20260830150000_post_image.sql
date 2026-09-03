-- ============================================================
-- Fase 1 · item 2 — Foto no post do feed
--
-- Adiciona a coluna opcional image_url a posts: URL pública de
-- UMA imagem guardada no bucket "avatars" já existente, em
-- ${uid}/posts/... (a policy de insert do bucket já autoriza
-- esse caminho — foldername[1] = auth.uid(); a policy de select
-- pública já serve o getPublicUrl).
--
-- Coluna nullable, sem default: posts existentes ficam com NULL
-- e continuam renderizando sem imagem.
--
-- Sem alteração de RLS. Sem bucket novo. Sem policy nova.
-- ============================================================

alter table public.posts
  add column if not exists image_url text;
