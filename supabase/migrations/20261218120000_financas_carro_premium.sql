-- Finanças (R$ 9,90) vira avulso e Carro em Dia (R$ 4,50) passa a fazer parte do Círcula Premium.
--  1) pacote e assinatura avulsa aceitam a chave nova 'financas';
--  2) quem tem o Premium também lê as respostas do Carro em Dia.
-- Aditiva e reversível (rollback no fim). Preços ficam no catálogo do servidor (addonPlans.ts).
begin;

alter table public.member_package_access drop constraint if exists member_package_access_package_check;
alter table public.member_package_access add constraint member_package_access_package_check check (
  package in ('help_nutri','ebooks','total','respiracao','playlist','wellness','leitura','premium','magazine','receitas','minha_lista','meu_chef','lista_inteligente','exercicios','series_filmes','viagens','carro','financas')
);
alter table public.addon_subscriptions drop constraint if exists addon_subscriptions_plan_key_check;
alter table public.addon_subscriptions add constraint addon_subscriptions_plan_key_check check (plan_key in (
  'magazine','receitas','ebooks','help_nutri','respiracao','playlist','wellness','leitura','minha_lista','meu_chef','lista_inteligente','exercicios','series_filmes','viagens','carro','financas','premium','cesta'
));

create or replace function public.car_has_access()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.is_city_admin()
      or public.car_can_answer()
      or exists (select 1 from public.member_package_access where profile_id = auth.uid() and package in ('carro','premium'));
$$;
revoke all on function public.car_has_access() from public, anon;
grant execute on function public.car_has_access() to authenticated;

commit;
-- rollback: recriar os CHECKs sem 'financas' (apagar antes linhas com essa chave) e car_has_access só com package = 'carro'.
