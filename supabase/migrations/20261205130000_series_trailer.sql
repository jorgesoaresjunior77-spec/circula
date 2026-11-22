-- Dicas de séries/filmes: link do trailer (opcional, só https).
begin;
alter table public.series_picks
  add column if not exists trailer_url text
  check (trailer_url is null or (trailer_url ~* '^https://' and char_length(trailer_url) <= 500));
commit;
-- rollback: alter table public.series_picks drop column if exists trailer_url;
