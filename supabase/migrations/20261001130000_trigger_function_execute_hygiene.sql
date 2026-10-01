-- Higiene de EXECUTE em funções SECURITY DEFINER exclusivas de trigger/event-trigger
-- (Grupo A da auditoria de 2026-10-01). Nenhuma destas 22 funções é chamada via
-- RPC/PostgREST, frontend ou Edge Function — todas são disparadas apenas pelo
-- mecanismo de trigger/event-trigger do Postgres, que ignora GRANT/REVOKE de
-- EXECUTE na função (chamada direta via SELECT já é recusada pelo próprio
-- Postgres fora do contexto de gatilho). Este REVOKE não concede EXECUTE a
-- nenhuma role em seguida — a função continua operando apenas como gatilho.
--
-- Não altera corpo, SECURITY DEFINER, search_path, triggers, policies ou tabelas.

revoke execute on function public._points_apply_balance() from public;
revoke execute on function public._points_on_challenge_completion() from public;
revoke execute on function public._points_on_challenge_day() from public;
revoke execute on function public._points_on_recurring_participation() from public;
revoke execute on function public.cleanup_saved_items() from public;
revoke execute on function public.create_community_trial() from public;
revoke execute on function public.create_default_community_billing_settings() from public;
revoke execute on function public.create_platform_trial() from public;
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.log_product_order_status_change() from public;
-- Esta também recebeu GRANT explícito a anon/authenticated/service_role no
-- baseline (20260829120000_product_orders_schema.sql), que REVOKE ... FROM
-- PUBLIC não alcança — precisa de REVOKE nominal por role.
revoke execute on function public.log_product_order_status_change() from anon;
revoke execute on function public.log_product_order_status_change() from authenticated;
revoke execute on function public.log_product_order_status_change() from service_role;
revoke execute on function public.log_subscription_status_change() from public;
revoke execute on function public.notify_on_challenge_comment() from public;
revoke execute on function public.notify_on_circle_join() from public;
revoke execute on function public.notify_on_event_rsvp() from public;
revoke execute on function public.notify_on_help_request() from public;
revoke execute on function public.notify_on_membership_request() from public;
revoke execute on function public.notify_on_post_comment() from public;
revoke execute on function public.notify_on_post_reaction() from public;
revoke execute on function public.on_message_insert() from public;
revoke execute on function public.prevent_role_escalation() from public;
revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.sync_membership_from_subscription() from public;
