-- Carrossel 3D de Planos na Home: três novas imagens de cartão cadastradas no Painel (frente, premium, mensal).
-- Aditiva e reversível (rollback no fim).
begin;
alter table public.community_card_images drop constraint if exists community_card_images_card_key_check;
alter table public.community_card_images add constraint community_card_images_card_key_check check (
  card_key = any (array['hoje','desafios','eventos','comunidade','jornada','instagram','eventos_grande','jornada_grande','comunidade_grande','jardim','novo_circulo','revista_escritorio','ferramenta_calendario','ferramenta_agua','ferramenta_imc','menu_leitura','menu_respiracao','menu_planos','menu_playlist','loja_fundo','menu_wellness','menu_lista','banner_cardapio','banner_exercicios','banner_series','banner_diario','banner_planos','menu_series','menu_viagens','menu_rachei','plano_frente','plano_premium','plano_mensal','banner_lista','banner_cidade','hero_1','hero_2','hero_3','hero_4','hero_5','hero_6']::text[])
);
commit;
-- rollback: recriar o CHECK sem plano_frente, plano_premium e plano_mensal (apagar antes linhas com essas chaves).
