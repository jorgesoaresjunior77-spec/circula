-- Foto do card "Lista de Compras" da roda de menu da Home (opcional).
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
      'loja_fundo'::text, 'menu_wellness'::text, 'menu_lista'::text
    ])
  );

commit;

-- Para desfazer: apagar linhas com card_key = 'menu_lista' e recriar a restrição sem esse valor.
