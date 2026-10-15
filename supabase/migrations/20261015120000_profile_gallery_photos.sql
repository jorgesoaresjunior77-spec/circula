-- =====================================================================
-- Perfil — Galeria de fotos (item 10 dos ajustes visuais/perfil)
-- =====================================================================
-- Até 12 fotos por perfil, numa única coluna nova: molde idêntico ao já
-- usado por `interests` (text[], mesma tabela, mesma RLS). NENHUMA
-- tabela, policy, bucket ou trigger nova.
--
-- POR QUE UMA COLUNA (não uma tabela `profile_photos`): a galeria é
-- SEMPRE da própria dona do perfil, sem metadado por foto (legenda,
-- posição arbitrária, etc.) além da ordem — um array ordenado já cobre
-- "incluir/substituir/remover/reordenar implicitamente por índice", e
-- reaproveita 100% a policy `profiles_update` existente (id = auth.uid()
-- OR is_master()) sem precisar de nenhuma policy nova por linha.
--
-- SEGURANÇA / RISCO AVALIADO (mesma análise já feita para bio/city em
-- 20260831140000_profile_rich.sql, reconfirmada agora):
--   - `profiles` tem a trigger `profiles_prevent_role_escalation`
--     (função prevent_role_escalation()) — só reverte mudanças na
--     COLUNA `role` (`if new.role <> old.role ...`); confirmado lendo a
--     definição da função no banco antes desta migration. Uma coluna
--     nova não aciona nem é afetada por ela.
--   - `profiles` já tem `grant select, update to authenticated` e as
--     policies `profiles_select` / `profiles_update` (ambas
--     `id = auth.uid() OR is_master()` para update); o `updateProfile`
--     do app já faz `.update(input)` genérico — a coluna nova entra
--     sob essas mesmas regras, sem GRANT nem policy nova.
--   - Armazenamento: reaproveita o bucket `avatars` já existente e já
--     público para leitura. As policies de INSERT/UPDATE/DELETE em
--     `storage.objects` (`(storage.foldername(name))[1] = auth.uid()`)
--     autorizam QUALQUER caminho sob `<uid>/...` — confirmado ao vivo
--     no banco antes desta migration — então `<uid>/gallery/...`
--     (caminho usado pela galeria) já está coberto, sem policy nova.
--
-- CHECK adicional: array com no máximo 12 posições, reforçando no banco
-- o limite que a UI já aplica (nunca confiar só no cliente).
--
-- Idempotente (`add column if not exists`), aditiva, reversível
-- (rodapé). Não altera nenhuma linha existente (ADD COLUMN com default
-- '{}' preenche todas as linhas já existentes com array vazio).
-- =====================================================================

begin;

alter table public.profiles
  add column if not exists gallery_photos text[] not null default '{}'::text[];

alter table public.profiles
  drop constraint if exists profiles_gallery_photos_max12_check;

alter table public.profiles
  add constraint profiles_gallery_photos_max12_check
  check (array_length(gallery_photos, 1) is null or array_length(gallery_photos, 1) <= 12);

commit;

-- ---- Rollback (manual) ------------------------------------------
-- alter table public.profiles drop constraint if exists profiles_gallery_photos_max12_check;
-- alter table public.profiles drop column if exists gallery_photos;
