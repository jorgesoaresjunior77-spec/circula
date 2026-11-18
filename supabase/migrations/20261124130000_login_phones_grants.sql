-- Correção: a tabela login_phones ficou sem GRANT de leitura.
-- service_role (função login-with-phone) e authenticated (lê só a própria linha,
-- via RLS) precisam de SELECT. Visitantes/logados não precisam de TRUNCATE,
-- REFERENCES nem TRIGGER (TRUNCATE ignora RLS, então sai).
revoke all on table public.login_phones from anon, authenticated, service_role;
grant select on table public.login_phones to authenticated;
grant select on table public.login_phones to service_role;
