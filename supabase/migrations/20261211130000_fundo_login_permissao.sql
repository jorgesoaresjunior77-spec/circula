-- A tela de login é vista SEM conta: o fundo cadastrado no Painel precisa poder ser lido pela chave pública (anon).
-- (Tabela criada por migration não recebe GRANT automático.)
grant select on table public.app_public_settings to anon, authenticated;
grant all on table public.app_public_settings to service_role;
