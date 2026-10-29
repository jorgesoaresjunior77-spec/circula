-- =====================================================================
-- Banners editoriais grandes — 3 novas chaves em community_card_images
-- =====================================================================
-- NÃO APLICADA AINDA — escrita para a sessão de "Correções visuais e
-- melhorias no painel de imagens", aguardando autorização explícita do
-- usuário antes de rodar contra o banco remoto (ver relatório da
-- sessão).
--
-- Contexto: a Profissional pediu imagens PRÓPRIAS para os 3 banners
-- grandes de Receitas/Eventos/Loja na Home (<HomeEditorialCards>),
-- independentes das capas dos cards compactos de "Seu Círcula de hoje"
-- (<HomeExperienceStrip>). A tabela `community_card_images`
-- (20260924120000) já existe para exatamente este propósito (uma linha
-- por community_id+card_key, RLS por dona/membro/Master, bucket
-- `community-media` já isolado por comunidade) — mas o CHECK de
-- `card_key` só aceita 6 valores literais, 5 já em uso pelos cards
-- compactos (hoje/desafios/eventos/comunidade/jornada) e 1 livre mas
-- não suficiente sozinho (instagram, sem uso hoje). Faltam 3 chaves.
--
-- Alternativa avaliada e descartada: reusar `community_content` (como
-- o truque dos 6 espaços do Instagram) criaria 3 linhas sintéticas por
-- comunidade que apareceriam misturadas na lista geral da Profissional
-- em Painel -> Conteúdo (ContentManager.tsx não filtra por categoria) —
-- o MESMO problema que a migration original de `community_card_images`
-- explicitamente evitou ao criar esta tabela em vez de usar
-- `community_content` para as 5 chaves originais. Adicionar 3 valores
-- ao CHECK desta tabela já existente é a opção mais minimal e consistente
-- com o padrão já adotado.
--
-- 100% aditivo, idempotente, transacional, reversível. Nenhuma linha
-- existente é tocada, nenhuma policy nova (as 4 policies de RLS já são
-- por community_id, não por card_key — continuam valendo para as 3
-- chaves novas sem alteração). Não altera Auth/Billing/Asaas/Storage.
-- =====================================================================

begin;

alter table public.community_card_images
  drop constraint if exists community_card_images_card_key_check;

alter table public.community_card_images
  add constraint community_card_images_card_key_check check (
    card_key = any (array[
      'hoje'::text, 'desafios'::text, 'eventos'::text,
      'comunidade'::text, 'jornada'::text, 'instagram'::text,
      'eventos_grande'::text, 'jornada_grande'::text, 'comunidade_grande'::text
    ])
  );

commit;

-- ---- Rollback (manual) ------------------------------------------
-- begin;
-- delete from public.community_card_images
--   where card_key in ('eventos_grande', 'jornada_grande', 'comunidade_grande');
-- alter table public.community_card_images
--   drop constraint if exists community_card_images_card_key_check;
-- alter table public.community_card_images
--   add constraint community_card_images_card_key_check check (
--     card_key = any (array[
--       'hoje'::text, 'desafios'::text, 'eventos'::text,
--       'comunidade'::text, 'jornada'::text, 'instagram'::text
--     ])
--   );
-- commit;
