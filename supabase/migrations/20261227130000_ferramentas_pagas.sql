-- Tudo no Círcula passa a ser cobrado (pedido de 2026-11-27): 11 ferramentas que só vinham com o plano básico
-- viram avulsos de R$ 4,90 por mês (também incluídos no Premium): Antes de Tudo, Água, IMC, Calculadora,
-- Agenda, Relógio do mundo, Previsão do tempo, Diário da Gratidão, Meu Jardim, Na minha cidade e Cotações.
-- Aditiva e reversível (rollback no fim): só amplia as listas de chaves aceitas.
begin;
alter table public.member_package_access drop constraint if exists member_package_access_package_check;
alter table public.member_package_access add constraint member_package_access_package_check check (
  package = any (array['help_nutri','ebooks','total','respiracao','playlist','wellness','leitura','premium','magazine','receitas','minha_lista','meu_chef','lista_inteligente','exercicios','series_filmes','viagens','carro','financas','rachei',
    'antes_de_tudo','agua','imc','calculadora','agenda','relogio','previsao','diario','jardim','cidade','cotacoes']::text[])
);
alter table public.addon_subscriptions drop constraint if exists addon_subscriptions_plan_key_check;
alter table public.addon_subscriptions add constraint addon_subscriptions_plan_key_check check (
  plan_key = any (array['magazine','receitas','ebooks','help_nutri','respiracao','playlist','wellness','leitura','minha_lista','meu_chef','lista_inteligente','exercicios','series_filmes','viagens','carro','financas','rachei','premium','cesta',
    'antes_de_tudo','agua','imc','calculadora','agenda','relogio','previsao','diario','jardim','cidade','cotacoes']::text[])
);
commit;
-- rollback: apagar linhas com as 11 chaves novas em member_package_access e addon_subscriptions (e tirá-las de
-- addon_subscriptions.bundle_keys) e recriar os dois CHECKs sem elas.
