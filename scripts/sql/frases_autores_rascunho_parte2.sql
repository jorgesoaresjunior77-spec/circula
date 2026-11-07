-- JÁ EXECUTADO em 2026-11-07. Não rodar de novo: duplicaria as frases.
-- Parte 2: Wim Hof, Gabor Maté e Monja Coen (pensador.com), como RASCUNHO.
-- Com obra indicada pela página -> kind 'citacao'; sem obra -> kind 'frase'.

insert into public.daily_inspirations (community_id, kind, body, author, source, status, created_by)
select '077aeceb-7321-48ca-8c23-cb256823755a', v.kind, v.body, v.author, v.source, 'draft', '1c20d81a-1312-4bdd-9e40-390a81536fd1'
from (values
  -- Wim Hof (sem obra)
  ('frase', $q$Se você aprender a usar sua mente, tudo é possível.$q$, 'Wim Hof', null),
  ('frase', $q$É como sempre digo: podemos fazer mais do que pensamos. Nesses momentos em que encontro um desafio, torno-me extremamente consciente das camadas mais profundas da minha alma.$q$, 'Wim Hof', null),
  ('frase', $q$A confiança surge quando você tem o controle de seu próprio cérebro.$q$, 'Wim Hof', null),
  ('frase', $q$A menos que esteja disposto a experimentar coisas novas, você nunca vai realizar todo o seu potencial.$q$, 'Wim Hof', null),
  -- Gabor Maté (com obra)
  ('citacao', $q$O que chamamos de personalidade é muitas vezes uma junção de traços genuínos e estilos copiados que não refletem nosso verdadeiro eu, mas a perda dele.$q$, 'Gabor Maté', 'Vício: o reino dos fantasmas famintos (2009)'),
  ('citacao', $q$Nosso conceito de bem-estar precisa passar do individual para o global em todos os sentidos da palavra.$q$, 'Gabor Maté', 'O mito do normal (Sextante, 2023)'),
  ('citacao', $q$Saúde e doença não são estados aleatórios num corpo específico ou numa parte específica do corpo. Elas são, isso sim, expressão de uma vida inteira vivida, vida esta que, por sua vez, não pode ser compreendida isoladamente: ela é influenciada por, ou melhor, decorre de toda uma teia de circunstâncias, relacionamentos, acontecimentos e experiências.$q$, 'Gabor Maté', 'O mito do normal (Sextante, 2023)'),
  -- Monja Coen (com obra)
  ('citacao', $q$Nossa capacidade de compreender a realidade, de observar em profundidade fica comprometida se não nos questionarmos.$q$, 'Monja Coen', 'Verdade? (BestSeller, 2019)'),
  ('citacao', $q$A vida é um eterno procurar, pesquisar, encontrar, perder, remeter e avançar.$q$, 'Monja Coen', 'Em cada instante nascemos e morremos bilhões de vezes (Planeta do Brasil, 2024)'),
  ('citacao', $q$Envelhecer não é apenas tempo de se lamentar, de relembrar, mas também de criar causas e condições para atingir o que ainda não foi atingido, individual e coletivamente.$q$, 'Monja Coen', 'Em cada instante nascemos e morremos bilhões de vezes (Planeta do Brasil, 2024)'),
  ('citacao', $q$Estamos sempre nos despedindo de nós mesmos. Sem medo e sem pressa. Apenas indo. Chegamos e continuamos a ir.$q$, 'Monja Coen', 'Em cada instante nascemos e morremos bilhões de vezes (Planeta do Brasil, 2024)'),
  ('citacao', $q$Já não sou quem fui há um instante. Li um livro, ouvi um pensamento diferente dos meus e morri para quem eu era. Renasci para um novo eu, que também não dura mais do que alguns milionésimos de segundo. Logo já sou outra, e nunca a mesma.$q$, 'Monja Coen', 'Em cada instante nascemos e morremos bilhões de vezes (Planeta do Brasil, 2024)'),
  ('citacao', $q$É hora de despertar. Já não estamos mais no casulo que foi tão importante para nos gestar. Podemos abrir as asas e voar, livres e interdependentes, sendo o ar e a vida.$q$, 'Monja Coen', 'Que sementes você está regando? (Academia, 2022)'),
  ('citacao', $q$Podemos fazer de nossa vida uma semente de ternura, de inclusão, de cuidado e sabedoria, de compaixão e gratidão, e não de maldade, do fel amargo da inveja, do rancor, do ódio e terror.$q$, 'Monja Coen', 'Que sementes você está regando? (Academia, 2022)'),
  ('citacao', $q$Há tantas possibilidades de ser feliz. Há tantos instantes de bem-estar: encontrar uma rua, uma pessoa, descobrir ensinamentos, conhecer a si mesmo. Talvez este último seja o verdadeiro estado de satisfação, esta a maior alegria – o autoconhecimento.$q$, 'Monja Coen', 'O bom contágio (BestSeller, 2020)'),
  ('citacao', $q$Cada vez que percebemos nossos descuidos, erros, faltas, não podemos voltar e apagar o que aconteceu. Mas podemos nos comprometer a não repetir o erro.$q$, 'Monja Coen', 'O bom contágio (BestSeller, 2020)'),
  ('citacao', $q$Se não formos capazes de apreciar este instante, não seremos capazes de apreciar nenhum outro momento.$q$, 'Monja Coen', 'A monja e o poeta (Sextante, 2021, com Allan Dias Castro)'),
  -- Monja Coen (sem obra)
  ('frase', $q$Quando você abre as mãos, nelas cabe todo o universo.$q$, 'Monja Coen', null),
  ('frase', $q$Nossas escolhas vão provocar respostas que sempre voltam para nós.$q$, 'Monja Coen', null),
  ('frase', $q$Chega de reclamar. Se há espaço reservado ao fracasso, há outro aberto ao sucesso. Abra o coração. Ajude os outros. Confie, pois é amando que se é amado.$q$, 'Monja Coen', null),
  ('frase', $q$Ser zen não é ficar numa boa o tempo todo, de papo para o ar, achando tudo lindo sem fazer nada. Ser zen é ser ativo. É estar forte e decidido. É caminhar com leveza, mas com certeza. É auxiliar a quem precisa, no que precisa e não no que se idealiza.$q$, 'Monja Coen', null)
) as v(kind, body, author, source)
returning id;
