-- =====================================================================
-- Imagem de fundo da Loja (atrás das prateleiras)
-- =====================================================================
-- NÃO APLICADA — aguardando OK explícito do usuário.
--
-- community_card_images ganha 1 chave nova: 'loja_fundo'.
-- Só amplia o CHECK de card_key. Aditiva, idempotente, transacional,
-- reversível (ver rollback no fim).
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
      'jardim'::text,
      'novo_circulo'::text, 'revista_escritorio'::text,
      'ferramenta_calendario'::text, 'ferramenta_agua'::text, 'ferramenta_imc'::text,
      'menu_leitura'::text, 'menu_respiracao'::text, 'menu_planos'::text, 'menu_playlist'::text,
      'loja_fundo'::text
    ])
  );

commit;

-- Rollback:
-- begin;
-- delete from public.community_card_images where card_key = 'loja_fundo';
-- alter table public.community_card_images drop constraint if exists community_card_images_card_key_check;
-- alter table public.community_card_images add constraint community_card_images_card_key_check check (
--   card_key = any (array['hoje'::text,'desafios'::text,'eventos'::text,'comunidade'::text,'jornada'::text,'instagram'::text,
--     'eventos_grande'::text,'jornada_grande'::text,'comunidade_grande'::text,'jardim'::text,
--     'novo_circulo'::text,'revista_escritorio'::text,
--     'ferramenta_calendario'::text,'ferramenta_agua'::text,'ferramenta_imc'::text,
--     'menu_leitura'::text,'menu_respiracao'::text,'menu_planos'::text,'menu_playlist'::text]));
-- commit;
