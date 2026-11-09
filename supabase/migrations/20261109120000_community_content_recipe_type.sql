-- =====================================================================
-- Receitas: devolve 'recipe' ao CHECK de community_content.type
-- =====================================================================
-- NÃO APLICADA — aguardando OK explícito do usuário.
--
-- A migration 20260917120000_desniche_core recriou o CHECK
-- `community_content_type_check` SEM 'recipe' e converteu as receitas
-- antigas em 'material'. Depois, a tela de Receitas (biblioteca por
-- categorias) voltou a gravar `type = 'recipe'` (useRecipes.saveRecipe),
-- e as páginas em revista (recipe_pages) dependem dessas receitas.
-- Resultado no banco atual: salvar uma receita falha com
-- "violates check constraint community_content_type_check".
--
-- Esta migration só amplia o conjunto aceito (não altera nenhuma linha).
-- Idempotente, transacional e reversível (rodapé).
-- =====================================================================

begin;

alter table public.community_content
  drop constraint if exists community_content_type_check;

alter table public.community_content
  add constraint community_content_type_check check (
    type = any (array[
      'recipe'::text, 'article'::text, 'tip'::text,
      'material'::text, 'video'::text, 'educational'::text
    ])
  );

commit;

-- ---- Rollback (manual) ------------------------------------------
-- (só é seguro se não houver linhas com type = 'recipe')
-- begin;
-- alter table public.community_content drop constraint if exists community_content_type_check;
-- alter table public.community_content add constraint community_content_type_check check (
--   type = any (array['article'::text,'tip'::text,'material'::text,'video'::text,'educational'::text])
-- );
-- commit;
