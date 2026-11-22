-- Métricas de tudo: item_views passa a aceitar a abertura de cada área do app
-- ('screen', com um id fixo por área) e a abertura de destinos de viagem,
-- séries/filmes e dicas de leitura. Só amplia o CHECK; nada é apagado.
begin;
alter table public.item_views drop constraint if exists item_views_kind_check;
alter table public.item_views add constraint item_views_kind_check
  check (kind in ('magazine','ebook','recipe','partner_click','screen','travel','series','reading'));
commit;
-- rollback: recriar o CHECK só com ('magazine','ebook','recipe','partner_click') depois de apagar as linhas novas.
