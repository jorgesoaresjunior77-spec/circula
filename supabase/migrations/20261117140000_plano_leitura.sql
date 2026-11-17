-- Plano avulso "Dicas de Leitura" (R$ 4,50): novo pacote e novo plano de
-- assinatura avulsa. Só amplia dois CHECKs. Aditiva, idempotente e reversível.
begin;

alter table public.member_package_access
  drop constraint if exists member_package_access_package_check;
alter table public.member_package_access
  add constraint member_package_access_package_check check (
    package in ('help_nutri', 'ebooks', 'total', 'respiracao', 'playlist', 'wellness', 'leitura', 'premium')
  );

alter table public.addon_subscriptions
  drop constraint if exists addon_subscriptions_plan_key_check;
alter table public.addon_subscriptions
  add constraint addon_subscriptions_plan_key_check check (plan_key in (
    'magazine', 'receitas', 'ebooks', 'help_nutri', 'respiracao', 'playlist', 'wellness', 'leitura', 'premium'
  ));

commit;

-- Rollback: recriar os dois CHECKs sem 'leitura' (apagar antes as linhas com 'leitura').
