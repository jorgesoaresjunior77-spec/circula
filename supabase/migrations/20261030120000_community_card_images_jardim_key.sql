-- =====================================================================
-- "Meu Jardim" — 1 nova chave em community_card_images
-- =====================================================================
-- NÃO APLICADA — preparada nesta etapa (evolução/experiência/
-- gamificação), aguardando autorização explícita do usuário antes de
-- rodar contra o banco remoto, por instrução direta (Etapa 10: "não
-- aplicar migrations remotamente nesta etapa").
--
-- Contexto: Etapa 3.2 pede um lugar no Painel para a Profissional
-- cadastrar a imagem do card "Meu Jardim" (faixa "Seu Círcula de hoje"
-- na Home, <HomeExperienceStrip>), com upload independente, prévia,
-- substituição e persistência — igual aos outros 5 cards da mesma
-- faixa (Meu Perfil/Help Nutri/Eventos/Loja/Receitas), que já usam
-- exatamente este mecanismo (`community_card_images` +
-- CommunityCardImagesManager.tsx + CoverImageInput). "Meu Jardim" não
-- tinha chave livre no CHECK da tabela quando a faixa foi criada
-- (comentário em HomeExperienceStrip.tsx: "as 6 que o CHECK do banco
-- aceita já estão todas em uso") — esta migration abre a 10ª chave,
-- mesmo padrão aditivo já usado por 20261029120000 (que abriu as 3
-- chaves `_grande`).
--
-- 100% aditivo, idempotente, transacional, reversível. Nenhuma linha
-- existente é tocada, nenhuma policy nova (as 4 policies de RLS já são
-- por community_id, não por card_key — continuam valendo para a chave
-- nova sem alteração). Não altera Auth/Billing/Asaas/Storage.
-- =====================================================================

begin;

alter table public.community_card_images
  drop constraint if exists community_card_images_card_key_check;

alter table public.community_card_images
  add constraint community_card_images_card_key_check check (
    card_key = any (array[
      'hoje'::text, 'desafios'::text, 'eventos'::text,
      'comunidade'::text, 'jornada'::text, 'instagram'::text,
      'eventos_grande'::text, 'jornada_grande'::text, 'comunidade_grande'::text,
      'jardim'::text
    ])
  );

commit;

-- ---- Rollback (manual) ------------------------------------------
-- begin;
-- delete from public.community_card_images where card_key = 'jardim';
-- alter table public.community_card_images
--   drop constraint if exists community_card_images_card_key_check;
-- alter table public.community_card_images
--   add constraint community_card_images_card_key_check check (
--     card_key = any (array[
--       'hoje'::text, 'desafios'::text, 'eventos'::text,
--       'comunidade'::text, 'jornada'::text, 'instagram'::text,
--       'eventos_grande'::text, 'jornada_grande'::text, 'comunidade_grande'::text
--     ])
--   );
-- commit;
