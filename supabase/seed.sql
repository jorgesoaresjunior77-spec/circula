-- =====================================================================
-- SEED — dados de configuração indispensáveis
-- Projeto Supabase: kdqtanqywjpwbnjedafn  (retrato de 2026-08-27)
-- =====================================================================
-- Aplicado por `supabase db reset` (config.toml -> [db.seed]).
-- NAO é aplicado por `supabase db push` e NAO deve ser executado
-- contra o remoto (o remoto já contém estas linhas).
--
-- Contém APENAS billing_plans: os triggers create_platform_trial /
-- create_community_trial dependem dos codes 'professional_monthly' e
-- 'member_monthly', e subscriptions.plan_id é NOT NULL. Sem estas
-- linhas, promover uma professional ou adicionar um membro falha.
--
-- IDs e valores são cópia fiel do remoto (para um rebuild bater 1:1).
--
-- platform_split_settings e revenue_split_rules NAO entram aqui porque
-- referenciam profiles(id) de um usuário real (Master). Ver bloco
-- comentado no fim deste arquivo e o relatório (item D).
-- =====================================================================

insert into public.billing_plans (id, subject, code, name, price_cents, billing_cycle, is_active, created_at, updated_at) values
  ('d904ad4c-8f71-477f-b743-66e3d49556cf', 'platform',  'professional_monthly',    'Professional — Mensal',    5990,  'MONTHLY',      true, '2026-08-26T00:48:48.363903+00:00', '2026-08-26T00:48:48.363903+00:00'),
  ('72eb3aac-14cc-46ca-bd04-700e99c0a1c9', 'platform',  'professional_semiannual', 'Professional — Semestral', 29990, 'SEMIANNUALLY', true, '2026-08-26T00:48:48.363903+00:00', '2026-08-26T00:48:48.363903+00:00'),
  ('1c804839-2299-4362-bbe2-c6321f91f7ec', 'platform',  'professional_annual',     'Professional — Anual',     49990, 'YEARLY',       true, '2026-08-26T00:48:48.363903+00:00', '2026-08-26T00:48:48.363903+00:00'),
  ('7162d0df-0e88-438c-96d2-f831bf9b6e1c', 'community', 'member_monthly',          'Member — Mensal',          1490,  'MONTHLY',      true, '2026-08-26T00:48:48.363903+00:00', '2026-08-26T00:48:48.363903+00:00'),
  ('66600c2f-26ab-47ef-bd0d-32277531c5bd', 'community', 'member_semiannual',       'Member — Semestral',       7490,  'SEMIANNUALLY', true, '2026-08-26T00:48:48.363903+00:00', '2026-08-26T00:48:48.363903+00:00'),
  ('20cd03f6-c0b0-4cd5-b895-5aa5e42cf1d8', 'community', 'member_annual',           'Member — Anual',           11990, 'YEARLY',       true, '2026-08-26T00:48:48.363903+00:00', '2026-08-26T00:48:48.363903+00:00')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- CONFIG ADICIONAL (NAO auto-seedável — FK para profiles do Master).
-- Restaurar manualmente após o profile Master existir, se necessário.
-- Valores fiéis ao remoto em 2026-08-27:
--
-- platform_split_settings:
--   professional_percent = 90.00 , circula_percent = 10.00
--   created_by = 18004064-4776-4c12-8f9f-b1bae6c390f5  (Master)
--
-- revenue_split_rules (3 faixas):
--   min 0        .. max 100000   -> circula_percent = 10.00
--   min 100001   .. max 500000   -> circula_percent = 8.00
--   min 500001   .. max NULL     -> circula_percent = 6.00
--   created_by = 18004064-4776-4c12-8f9f-b1bae6c390f5  (Master)
-- ---------------------------------------------------------------------
