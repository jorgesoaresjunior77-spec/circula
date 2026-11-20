-- =====================================================================
-- Assinaturas avulsas: permissões do service_role (as Edge Functions).
--
-- A migration que criou addon_subscriptions, member_package_access e
-- product_price_overrides não deu GRANT ao service_role, então as funções
-- asaas-create-addon-subscription, asaas-webhook e billing-daily-sweep
-- falhavam com "permission denied for table addon_subscriptions".
-- Só permissões; nenhum dado é alterado. Reversível (revoke abaixo).
-- =====================================================================

begin;

grant select, insert, update on table public.addon_subscriptions to service_role;
grant select, insert, update, delete on table public.member_package_access to service_role;
grant select on table public.product_price_overrides to service_role;

commit;

-- ROLLBACK:
--   revoke select, insert, update on table public.addon_subscriptions from service_role;
--   revoke select, insert, update, delete on table public.member_package_access from service_role;
--   revoke select on table public.product_price_overrides from service_role;
