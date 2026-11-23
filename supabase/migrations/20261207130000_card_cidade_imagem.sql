-- Capa do card "Na minha cidade" na Home: nova chave de imagem (banner_cidade),
-- que a nutricionista cadastra em Painel > Imagens da comunidade. Aditiva.
begin;
alter table public.community_card_images drop constraint if exists community_card_images_card_key_check;
alter table public.community_card_images add constraint community_card_images_card_key_check check (
  card_key = any (array['hoje','desafios','eventos','comunidade','jornada','instagram','eventos_grande','jornada_grande','comunidade_grande','jardim','novo_circulo','revista_escritorio','ferramenta_calendario','ferramenta_agua','ferramenta_imc','menu_leitura','menu_respiracao','menu_planos','menu_playlist','loja_fundo','menu_wellness','menu_lista','banner_cardapio','banner_exercicios','banner_series','banner_diario','banner_planos','menu_series','menu_viagens','banner_lista','banner_cidade']::text[])
);
commit;
-- rollback: recriar o CHECK sem 'banner_cidade' (apagar antes qualquer linha com essa chave).
