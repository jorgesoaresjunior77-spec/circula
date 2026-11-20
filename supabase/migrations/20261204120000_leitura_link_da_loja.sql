-- Dicas de leitura: a profissional pode informar o link (https) da loja onde o
-- livro é vendido; a membro vê o botão "Comprar o livro". Aditiva e reversível.
begin;

alter table public.reading_tips
  add column if not exists buy_url text
  check (buy_url is null or (buy_url ~* '^https://' and char_length(buy_url) <= 500));

commit;

-- ROLLBACK: alter table public.reading_tips drop column if exists buy_url;
