-- Cesta: vários conteúdos avulsos assinados juntos, numa cobrança só.
begin;
alter table public.addon_subscriptions add column if not exists bundle_keys text[];
alter table public.addon_subscriptions drop constraint if exists addon_subscriptions_plan_key_check;
alter table public.addon_subscriptions add constraint addon_subscriptions_plan_key_check check (plan_key in (
  'magazine','receitas','ebooks','help_nutri','respiracao','playlist','wellness','leitura','minha_lista','meu_chef','lista_inteligente','exercicios','series_filmes','viagens','premium','cesta'
));
commit;
-- ROLLBACK (manual): cancelar as cestas e recriar o CHECK sem 'cesta'; alter table addon_subscriptions drop column bundle_keys;
