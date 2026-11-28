-- Fim da página do Início: uma segunda imagem (temas ao longo do ano) e a escolha de qual usar.
--  • nova chave de imagem do Painel: banner_fim_2 (a 1ª continua sendo banner_series);
--  • home_decor.end_image: 1 = imagem 1 (tom areia), 2 = imagem 2 (cores originais).
begin;

alter table public.community_card_images drop constraint if exists community_card_images_card_key_check;
alter table public.community_card_images add constraint community_card_images_card_key_check check (
  card_key = any (array['hoje','desafios','eventos','comunidade','jornada','instagram','eventos_grande','jornada_grande','comunidade_grande','jardim','novo_circulo','revista_escritorio','ferramenta_calendario','ferramenta_agua','ferramenta_imc','menu_leitura','menu_respiracao','menu_planos','menu_playlist','loja_fundo','menu_wellness','menu_lista','banner_cardapio','banner_exercicios','banner_series','banner_diario','banner_planos','menu_series','menu_viagens','menu_rachei','plano_frente','plano_premium','plano_mensal','plano_semestre','plano_anual','banner_lista','banner_cidade','hero_1','hero_2','hero_3','hero_4','hero_5','hero_6',
    'casamento_capa','card_mom','card_baby','banner_fim_2']::text[])
);

alter table public.home_decor add column if not exists end_image smallint not null default 1;
alter table public.home_decor drop constraint if exists home_decor_end_image_check;
alter table public.home_decor add constraint home_decor_end_image_check check (end_image in (1, 2));

commit;
-- ROLLBACK (manual): delete from community_card_images where card_key = 'banner_fim_2';
--   recriar o CHECK sem 'banner_fim_2'; alter table home_decor drop column end_image;
