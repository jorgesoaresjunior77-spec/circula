-- Meu Chef (R$ 8,90/mês) e Lista de compras inteligente (R$ 3,80/mês): duas novas
-- assinaturas avulsas, incluídas no Círcula Premium. Só amplia as listas de chaves
-- permitidas; não mexe em assinaturas já contratadas.
begin;

alter table public.member_package_access
  drop constraint if exists member_package_access_package_check;
alter table public.member_package_access
  add constraint member_package_access_package_check check (
    package in ('help_nutri', 'ebooks', 'total', 'respiracao', 'playlist', 'wellness', 'leitura', 'premium', 'magazine', 'receitas', 'minha_lista', 'meu_chef', 'lista_inteligente')
  );

alter table public.addon_subscriptions
  drop constraint if exists addon_subscriptions_plan_key_check;
alter table public.addon_subscriptions
  add constraint addon_subscriptions_plan_key_check check (plan_key in (
    'magazine', 'receitas', 'ebooks', 'help_nutri', 'respiracao', 'playlist', 'wellness', 'leitura', 'minha_lista', 'meu_chef', 'lista_inteligente', 'premium'
  ));

commit;
