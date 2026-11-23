-- Mensagens do dia: mais frases fortes de mulheres, com autora e obra/ocasião.
-- Entram como 'auto' (sorteadas todo dia, como as demais) em todas as comunidades;
-- a profissional pode tirar qualquer uma. Idempotente: não repete uma frase já cadastrada.
-- As frases de língua estrangeira estão em português (tradução livre; a fonte indica a obra).
begin;

with frases(body, author, source) as (values
  ('Não se nasce mulher: torna-se mulher.', 'Simone de Beauvoir', 'O Segundo Sexo, 1949'),
  ('Uma mulher precisa ter dinheiro e um teto todo seu se quiser escrever ficção.', 'Virginia Woolf', 'Um teto todo seu, 1929'),
  ('Liberdade, essa palavra que o sonho humano alimenta: que não há ninguém que explique e ninguém que não entenda.', 'Cecília Meireles', 'Romanceiro da Inconfidência, 1953'),
  ('Recria tua vida, sempre, sempre. Remove pedras e planta roseiras e faz doces. Recomeça.', 'Cora Coralina', 'Aninha e suas pedras'),
  ('O lixo vai falar, e numa boa.', 'Lélia Gonzalez', 'Racismo e sexismo na cultura brasileira, 1984'),
  ('Não serei interrompida.', 'Marielle Franco', 'Discurso na Câmara Municipal do Rio de Janeiro, 8 de março de 2018'),
  ('Uma criança, um professor, um livro e uma caneta podem mudar o mundo.', 'Malala Yousafzai', 'Discurso na ONU, 2013'),
  ('Quando eles baixam o nível, nós elevamos.', 'Michelle Obama', 'Convenção Nacional Democrata, 2016'),
  ('Eu não sou livre enquanto qualquer mulher não for livre, mesmo quando as correntes dela forem muito diferentes das minhas.', 'Audre Lorde', 'Discurso de 1981'),
  ('Pés, para que os quero, se tenho asas para voar?', 'Frida Kahlo', 'O diário de Frida Kahlo'),
  ('Não desejo que as mulheres tenham poder sobre os homens, mas sobre si mesmas.', 'Mary Wollstonecraft', 'Reivindicação dos direitos da mulher, 1792'),
  ('Mas, ainda assim, como o pó, eu me levanto.', 'Maya Angelou', 'Still I Rise, 1978 (tradução livre)'),
  ('Aprendi ao longo dos anos que, quando a mente está decidida, o medo diminui.', 'Rosa Parks', 'Quiet Strength, 1994 (tradução livre)'),
  ('Você deve fazer aquilo que acha que não consegue fazer.', 'Eleanor Roosevelt', 'You Learn by Living, 1960 (tradução livre)'),
  ('Como é maravilhoso que ninguém precise esperar um só instante antes de começar a melhorar o mundo.', 'Anne Frank', 'O Diário de Anne Frank, 26 de março de 1944 (tradução livre)'),
  ('Lute pelas coisas com que você se importa, mas faça isso de um modo que leve os outros a se juntarem a você.', 'Ruth Bader Ginsburg', null),
  ('O que você faz faz a diferença, e você precisa decidir que tipo de diferença quer fazer.', 'Jane Goodall', null)
)
insert into public.daily_inspirations (community_id, kind, body, author, source, status, created_by)
select c.id, 'frase', f.body, f.author, f.source, 'auto', c.owner_id
from public.communities c
cross join frases f
where not exists (
  select 1 from public.daily_inspirations d where d.community_id = c.id and d.body = f.body
);

commit;
-- rollback: delete from public.daily_inspirations where kind = 'frase' and author in ('Simone de Beauvoir','Virginia Woolf','Cecília Meireles','Cora Coralina','Lélia Gonzalez','Marielle Franco','Malala Yousafzai','Michelle Obama','Audre Lorde','Frida Kahlo','Mary Wollstonecraft','Maya Angelou','Rosa Parks','Eleanor Roosevelt','Anne Frank','Ruth Bader Ginsburg','Jane Goodall') and created_at >= '2026-11-23';
