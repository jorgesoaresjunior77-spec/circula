-- Rachei $ (R$ 4,90): serviço avulso, também no Premium (o preço do Premium não muda).
--  1) pacote e assinatura avulsa aceitam a chave 'rachei';
--  2) nova chave de imagem do card do menu: menu_rachei.
-- Aditiva e reversível (rollback no fim).
begin;

alter table public.member_package_access drop constraint if exists member_package_access_package_check;
alter table public.member_package_access add constraint member_package_access_package_check check (
  package in ('help_nutri','ebooks','total','respiracao','playlist','wellness','leitura','premium','magazine','receitas','minha_lista','meu_chef','lista_inteligente','exercicios','series_filmes','viagens','carro','financas','rachei')
);
alter table public.addon_subscriptions drop constraint if exists addon_subscriptions_plan_key_check;
alter table public.addon_subscriptions add constraint addon_subscriptions_plan_key_check check (plan_key in (
  'magazine','receitas','ebooks','help_nutri','respiracao','playlist','wellness','leitura','minha_lista','meu_chef','lista_inteligente','exercicios','series_filmes','viagens','carro','financas','rachei','premium','cesta'
));

alter table public.community_card_images drop constraint if exists community_card_images_card_key_check;
alter table public.community_card_images add constraint community_card_images_card_key_check check (
  card_key = any (array['hoje','desafios','eventos','comunidade','jornada','instagram','eventos_grande','jornada_grande','comunidade_grande','jardim','novo_circulo','revista_escritorio','ferramenta_calendario','ferramenta_agua','ferramenta_imc','menu_leitura','menu_respiracao','menu_planos','menu_playlist','loja_fundo','menu_wellness','menu_lista','banner_cardapio','banner_exercicios','banner_series','banner_diario','banner_planos','menu_series','menu_viagens','menu_rachei','banner_lista','banner_cidade','hero_1','hero_2','hero_3','hero_4','hero_5','hero_6']::text[])
);

commit;
-- rollback: recriar os três CHECKs sem 'rachei' / 'menu_rachei' (apagar antes linhas com essas chaves).
