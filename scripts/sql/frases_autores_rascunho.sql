-- Frases dos autores indicados, em português, como RASCUNHO (kind = 'frase').
-- Fonte: pensador.com (frases enviadas por leitores; obra NÃO conferida).
-- A profissional confere e publica em "Mensagens do dia".
-- JÁ EXECUTADO em 2026-11-07 (depois da migration 20261107150000_inspiration_author_only.sql). Não rodar de novo: duplicaria as frases.
-- Ficaram de fora frases sobre sexo, religião, álcool, sombrias ou truncadas.

insert into public.daily_inspirations (community_id, kind, body, author, source, status, created_by)
select '077aeceb-7321-48ca-8c23-cb256823755a', 'frase', v.body, v.author, null, 'draft', '1c20d81a-1312-4bdd-9e40-390a81536fd1'
from (values
  -- Mel Robbins
  ($q$Pare de pensar que você precisa de um milagre. Perceba que você é um milagre.$q$, 'Mel Robbins'),
  ($q$Você não pode controlar o modo como se sente. Mas você sempre pode escolher como age.$q$, 'Mel Robbins'),
  ($q$Você está a uma decisão de distância de uma vida completamente diferente.$q$, 'Mel Robbins'),
  ($q$Comece antes de estar pronto. Não se prepare, comece.$q$, 'Mel Robbins'),
  ($q$Sempre haverá alguém que não consegue ver o seu valor. Não deixe que seja você.$q$, 'Mel Robbins'),
  ($q$A vida é dura e barulhenta e, de repente, é brilhante e surpreendente.$q$, 'Mel Robbins'),
  -- Joe Dispenza
  ($q$De fato, nos condicionamos a acreditar em todos os tipos de coisas que não são necessariamente verdadeiras - e muitas delas estão tendo um impacto negativo em nossa saúde e felicidade.$q$, 'Joe Dispenza'),
  ($q$Conhecimento é poder, mas conhecimento sobre si mesmo é auto-capacitação.$q$, 'Joe Dispenza'),
  ($q$O processo de mudança requer que você desaprenda. Requer que você rompa os hábitos do antigo "eu" e reinvente uma nova identidade.$q$, 'Joe Dispenza'),
  ($q$O privilégio de ser humano é que podemos fazer um pensamento parecer mais real do que qualquer outra coisa.$q$, 'Joe Dispenza'),
  ($q$Podemos moldar e transformar nosso cérebro prestando atenção. Se conseguimos nos apegar a uma idéia, começamos a conectar e moldar nosso cérebro.$q$, 'Joe Dispenza'),
  ($q$A vida é sobre a gestão da energia. Onde você coloca sua atenção é onde você coloca sua energia.$q$, 'Joe Dispenza'),
  -- Martha Beck
  ($q$A forma como as outras pessoas me julgam não é da minha conta.$q$, 'Martha Beck'),
  ($q$Imagine o que você faria se não importasse minimamente com o que as pessoas pensam de você. Imaginou? Bom. Então nunca volte atrás.$q$, 'Martha Beck'),
  ($q$Se você vê o fracasso como um monstro perseguindo você ou que já arruinou sua vida, olhe de novo. Aquele monstro pode se tornar um professor benevolente, abrindo sua mente para o sucesso que você não pode imaginar agora.$q$, 'Martha Beck'),
  -- Elizabeth Gilbert
  ($q$Liberte-se e veja as estrelas surgirem - do lado de fora e do lado de dentro.$q$, 'Elizabeth Gilbert'),
  ($q$Estou escolhendo a felicidade em lugar do sofrimento, eu sei que estou. Estou criando espaço para o futuro desconhecido encher minha vida com surpresas que ainda estão por vir.$q$, 'Elizabeth Gilbert'),
  ($q$Faça aquilo que o estimula. Siga suas fascinações, obsessões e compulsões. Confie nelas. Crie aquilo que faz seu coração bater mais forte.$q$, 'Elizabeth Gilbert'),
  ($q$Feito é melhor do que perfeito.$q$, 'Elizabeth Gilbert'),
  ($q$Algum dia você vai olhar para trás, para este momento da sua vida, e pensar que época deliciosa de luto foi. Vai ver que estava lamentando a sua perda, e que o seu coração estava despedaçado, mas que a sua vida estava mudando.$q$, 'Elizabeth Gilbert'),
  ($q$Você tem de ser muito gentil consigo mesmo quando estiver aprendendo uma coisa nova.$q$, 'Elizabeth Gilbert'),
  ($q$É preciso estar preparado para tumultuosas e intermináveis ondas de transformação.$q$, 'Elizabeth Gilbert'),
  ($q$Não se desculpe por chorar. Sem essa emoção, nós somos apenas robôs.$q$, 'Elizabeth Gilbert'),
  ($q$A vida foi-lhe dada; é seu dever (e também seu direito como um ser humano) encontrar algo de belo na vida, não importa o quão pequeno.$q$, 'Elizabeth Gilbert'),
  ($q$Em algum momento, você tem que se libertar e ficar quieto e permitir que o contentamento chegue até você.$q$, 'Elizabeth Gilbert'),
  ($q$Nós não percebemos que, em algum lugar dentro de todos nós, existe um eu supremo que está eternamente em paz.$q$, 'Elizabeth Gilbert'),
  ($q$A tristeza profunda é quase um local específico, uma coordenada em algum mapa do tempo. Quando você está nessa selva de tristeza, não consegue imaginar que um dia conseguirá encontrar a saída para um lugar melhor. Mas, se alguém lhe garante que também já esteve nesse mesmo lugar, e conseguiu sair dele, isso às vezes traz alento.$q$, 'Elizabeth Gilbert'),
  -- Clarissa Pinkola Estés
  ($q$A única confiança necessária é a de saber que, quando ocorre um final, vai surgir um novo começo.$q$, 'Clarissa Pinkola Estés'),
  ($q$Uso o ingrediente mais fácil e mais acessível para a cura: as histórias.$q$, 'Clarissa Pinkola Estés'),
  ($q$Às vezes não existem palavras que estimulem a coragem. Às vezes, é preciso, simplesmente, mergulhar.$q$, 'Clarissa Pinkola Estés'),
  ($q$Uma história é um medicamento que fortifica e recupera o indivíduo e a comunidade$q$, 'Clarissa Pinkola Estés'),
  ($q$Os fracassos são melhores mestres do que os sucessos.$q$, 'Clarissa Pinkola Estés'),
  ($q$A arte não foi feita para ser criada somente em momentos roubados.$q$, 'Clarissa Pinkola Estés'),
  -- Brené Brown
  ($q$É preciso coragem para ser imperfeito. Aceitar e abraçar as nossas fraquezas e amá-las. E deixar de lado a imagem da pessoa que devia ser, para aceitar a pessoa que realmente sou.$q$, 'Brené Brown'),
  ($q$Fale com você mesmo como falaria com alguém que ama.$q$, 'Brené Brown'),
  ($q$O que não precisamos no meio das nossas batalhas é sentir vergonha de sermos humanos.$q$, 'Brené Brown'),
  ($q$Abrir mão de nossas emoções por medo de que o custo seja muito alto significa nos afastarmos da única coisa que dá sentido e significado à vida.$q$, 'Brené Brown'),
  ($q$É muito importante o quanto nos conhecemos e compreendemos, mas existe algo que é ainda mais essencial para uma vida integral e plena: amar a nós mesmos.$q$, 'Brené Brown'),
  ($q$Devemos amar com todo nosso coração, mesmo que não haja garantias. Isso não nos torna vulneráveis, nos torna vivos.$q$, 'Brené Brown'),
  ($q$A vulnerabilidade é a nossa medida mais precisa de coragem.$q$, 'Brené Brown'),
  ($q$Eu não tenho que procurar momentos extraordinários para encontrar a felicidade - ela está na minha frente, se eu estiver prestando atenção e praticando a gratidão.$q$, 'Brené Brown'),
  ($q$Os momentos mais fortes de nossas vidas acontecem quando amarramos as pequenas luzinhas criadas pela coragem, pela compaixão e pelo vínculo, e as vemos brilhar na escuridão de nossas batalhas.$q$, 'Brené Brown'),
  ($q$A vergonha corrói aquela parte de nós que acredita que somos capazes de mudar.$q$, 'Brené Brown'),
  -- Ana Suy
  ($q$Além de ser impossível agradar a todos, também é absolutamente desnecessário.$q$, 'Ana Suy'),
  -- Ana Beatriz Barbosa Silva
  ($q$Não confunda transgressão com liberdade. Transgressão mora na mente e a liberdade habita a alma.$q$, 'Ana Beatriz Barbosa Silva'),
  ($q$Mudar a mente sem mudar o coração é como falar de amor sem amar.$q$, 'Ana Beatriz Barbosa Silva'),
  ($q$A maior tragédia da vida é não vivê-la na plenitude do aqui e agora.$q$, 'Ana Beatriz Barbosa Silva'),
  ($q$Somos o que fazemos e não o que falamos.$q$, 'Ana Beatriz Barbosa Silva'),
  ($q$As pessoas irão te julgar até mesmo pelo que você não fez, por isso siga em frente com a consciência limpa e o coração tranquilo.$q$, 'Ana Beatriz Barbosa Silva'),
  ($q$Coloque ética no seu caráter: faça o que é correto e não o que é mais fácil$q$, 'Ana Beatriz Barbosa Silva'),
  -- Monja Coen
  ($q$A sabedoria não vem do acerto, mas do aprendizado com os erros.$q$, 'Monja Coen'),
  ($q$Vou fazer o meu melhor hoje, procurar a excelência em mim mesma.$q$, 'Monja Coen'),
  ($q$Hoje é um dia excelente para que eu descubra meu potencial de vida e o use sem desperdício e sem excessos.$q$, 'Monja Coen'),
  ($q$Como é bom estar viva, respirar e apreciar cada instante, assim como eles são.$q$, 'Monja Coen'),
  ($q$Não desistam de vocês. Não percam o maravilhamento com a existência.$q$, 'Monja Coen'),
  ($q$Faça o bem, fale o bem, pense o bem.$q$, 'Monja Coen')
) as v(body, author)
returning id;
