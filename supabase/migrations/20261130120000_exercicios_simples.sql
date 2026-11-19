-- =====================================================================
-- "Se exercite em casa" simplificado: a biblioteca de exercícios agora vive no
-- próprio app (com as ilustrações) e o treino é montado na hora. O banco só
-- guarda o que é da usuária: treinos salvos e treinos feitos.
--  • exercise_workouts passa a guardar os exercícios pelo nome-chave (slug) em
--    item_slugs (antes eram ids de uma tabela que deixou de ser usada).
--  • exercise_logs.item_id deixa de ser obrigatório (ganha slug).
-- Aditiva, transacional e reversível (rollback no fim). Não apaga nada.
-- =====================================================================
begin;

alter table public.exercise_workouts drop constraint if exists exercise_workouts_item_ids_check;
alter table public.exercise_workouts
  add column if not exists item_slugs text[] not null default '{}',
  add column if not exists minutes smallint check (minutes is null or minutes between 1 and 240);
alter table public.exercise_workouts
  drop constraint if exists exercise_workouts_item_slugs_check;
alter table public.exercise_workouts
  add constraint exercise_workouts_item_slugs_check check (coalesce(array_length(item_slugs, 1), 0) <= 60);

alter table public.exercise_logs alter column item_id drop not null;
alter table public.exercise_logs add column if not exists slug text check (slug is null or char_length(slug) <= 80);

commit;

-- ROLLBACK (manual):
--   alter table public.exercise_logs drop column if exists slug;
--   alter table public.exercise_workouts drop column if exists item_slugs, drop column if exists minutes;
