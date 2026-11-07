-- =====================================================================
-- Mensagens do dia: frases só com o nome do autor
-- =====================================================================
-- Decisão do usuário (2026-11-07): aceitar frases atribuídas a um autor
-- SEM a obra (vindas de sites de frases), sempre como rascunho até a
-- profissional conferir e publicar.
--
-- Novo tipo kind = 'frase': exige AUTOR, a obra é opcional.
-- 'citacao' continua exigindo autor E obra; 'editorial' não muda.
-- Só amplia duas regras (CHECK). Idempotente, transacional, reversível.
-- =====================================================================

begin;

alter table public.daily_inspirations drop constraint if exists daily_inspirations_kind_check;
alter table public.daily_inspirations
  add constraint daily_inspirations_kind_check
  check (kind in ('citacao', 'editorial', 'frase'));

alter table public.daily_inspirations drop constraint if exists daily_inspirations_quote_has_source;
alter table public.daily_inspirations
  add constraint daily_inspirations_quote_has_source check (
    kind = 'editorial'
    or (kind = 'frase' and author is not null and char_length(btrim(author)) > 0)
    or (author is not null and char_length(btrim(author)) > 0
        and source is not null and char_length(btrim(source)) > 0)
  );

commit;

-- ---- Rollback (manual) ------------------------------------------
-- begin;
-- delete from public.daily_inspirations where kind = 'frase';
-- alter table public.daily_inspirations drop constraint daily_inspirations_kind_check;
-- alter table public.daily_inspirations add constraint daily_inspirations_kind_check check (kind in ('citacao','editorial'));
-- alter table public.daily_inspirations drop constraint daily_inspirations_quote_has_source;
-- alter table public.daily_inspirations add constraint daily_inspirations_quote_has_source check (
--   kind = 'editorial' or (author is not null and char_length(btrim(author)) > 0 and source is not null and char_length(btrim(source)) > 0));
-- commit;
