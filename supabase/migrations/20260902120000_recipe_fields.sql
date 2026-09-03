-- =====================================================================
-- Fase 2 — RECEITAS  (plano: M-D / recipe_fields)
-- =====================================================================
-- Decisão arquitetural já tomada: receitas são uma EXTENSÃO de
-- `community_content` (type = 'recipe'). NÃO existe tabela `recipes`
-- separada.
--
-- Esta migration é 100% ADITIVA:
--   · adiciona UMA coluna nova, `ingredients text`, nullable, sem default;
--   · não altera nenhuma linha existente (todas ficam com ingredients = NULL);
--   · não cria/remove tabela, índice, trigger, função;
--   · não altera RLS, policy ou GRANT.
--
-- Por que nenhuma mudança de RLS/GRANT é necessária:
--   `community_content` já tem, do módulo original (20260831130000):
--     grant select, insert, update, delete on public.community_content to authenticated;
--   e as 4 policies (`community_content_select/insert/update/delete`) decidem
--   acesso por `community_id` / `status` / `owns_community()` /
--   `is_community_member()` — nunca por coluna. Uma coluna nova nullable
--   entra automaticamente sob essas mesmas regras:
--     · Professional (dona): administra só receitas da própria comunidade
--       (`owns_community(community_id)` no insert/update/delete);
--     · Member: só vê receitas com `status = 'published'` das comunidades
--       de que participa;
--     · Master: `is_master()` no select (visão administrativa preservada);
--     · `anon`: sem GRANT de DML — sem acesso.
--
-- Categorias de receita (Café da manhã / Almoço / Jantar / Lanches /
-- Sobremesas / Bebidas / Outras) NÃO viram constraint: continuam texto
-- livre na coluna `category` já existente — são classificação de
-- interface (lista em src/types/content.ts), fácil de estender depois.
--
-- Idempotente (`add column if not exists`). Reversível com
-- `alter table public.community_content drop column ingredients;`.
-- =====================================================================

begin;

alter table public.community_content
  add column if not exists ingredients text;

commit;
