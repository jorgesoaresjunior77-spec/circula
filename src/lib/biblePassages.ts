import type { Prayer } from './gratitude'

// Passagens da Bíblia muito conhecidas, na redação tradicional de João Ferreira
// de Almeida (a versão antiga, de uso comum), curtas e de gratidão, confiança e
// paz. Entram no mesmo sorteio da Palavra do Dia, junto das orações.

const p = (n: number, title: string, body: string): Prayer => ({ id: `bib-${n}`, title, body, status: 'published', position: 100 + n })

export const BIBLE_PASSAGES: Prayer[] = [
  p(1, 'João 3:16', 'Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna.'),
  p(2, 'Salmo 23:1-3', 'O Senhor é o meu pastor, nada me faltará. Deitar-me faz em verdes pastos, guia-me mansamente a águas tranquilas. Refrigera a minha alma; guia-me pelas veredas da justiça, por amor do seu nome.'),
  p(3, 'Filipenses 4:6-7', 'Não andeis ansiosos por coisa alguma; antes as vossas petições sejam em tudo conhecidas diante de Deus pela oração e súplicas, com ação de graças. E a paz de Deus, que excede todo o entendimento, guardará os vossos corações e os vossos pensamentos em Cristo Jesus.'),
  p(4, '1 Tessalonicenses 5:16-18', 'Regozijai-vos sempre. Orai sem cessar. Em tudo dai graças, porque esta é a vontade de Deus em Cristo Jesus para convosco.'),
  p(5, 'Salmo 118:24', 'Este é o dia que fez o Senhor; regozijemo-nos e alegremo-nos nele.'),
  p(6, 'Salmo 107:1', 'Louvai ao Senhor, porque ele é bom, porque a sua benignidade dura para sempre.'),
  p(7, 'Salmo 100:4-5', 'Entrai pelas suas portas com ação de graças e em seus átrios com louvor; louvai-o e bendizei o seu nome. Porque o Senhor é bom, e a sua benignidade dura para sempre, e a sua verdade de geração em geração.'),
  p(8, 'Isaías 41:10', 'Não temas, porque eu sou contigo; não te assombres, porque eu sou o teu Deus; eu te fortaleço, e te ajudo, e te sustento com a destra da minha justiça.'),
  p(9, 'Josué 1:9', 'Não to mandei eu? Esforça-te, e tem bom ânimo; não pasmes, nem te espantes, porque o Senhor teu Deus é contigo, por onde quer que andares.'),
  p(10, 'Provérbios 3:5-6', 'Confia no Senhor de todo o teu coração, e não te estribes no teu próprio entendimento. Reconhece-o em todos os teus caminhos, e ele endireitará as tuas veredas.'),
  p(11, 'Jeremias 29:11', 'Porque eu bem sei os pensamentos que penso de vós, diz o Senhor; pensamentos de paz, e não de mal, para vos dar o fim que esperais.'),
  p(12, 'Mateus 11:28', 'Vinde a mim, todos os que estais cansados e oprimidos, e eu vos aliviarei.'),
  p(13, 'Romanos 8:28', 'Sabemos que todas as coisas contribuem juntamente para o bem daqueles que amam a Deus, daqueles que são chamados segundo o seu propósito.'),
  p(14, 'Salmo 46:1', 'Deus é o nosso refúgio e fortaleza, socorro bem presente na angústia.'),
  p(15, 'Salmo 121:1-2', 'Levantarei os meus olhos para os montes, de onde vem o meu socorro. O meu socorro vem do Senhor, que fez o céu e a terra.'),
  p(16, 'Mateus 6:33', 'Mas buscai primeiro o reino de Deus, e a sua justiça, e todas essas coisas vos serão acrescentadas.'),
  p(17, 'Lamentações 3:22-23', 'As misericórdias do Senhor são a causa de não sermos consumidos, porque as suas misericórdias não têm fim; novas são cada manhã; grande é a tua fidelidade.'),
  p(18, 'Filipenses 4:13', 'Posso todas as coisas em Cristo que me fortalece.'),
  p(19, 'Salmo 91:1-2', 'Aquele que habita no esconderijo do Altíssimo, à sombra do Onipotente descansará. Direi do Senhor: Ele é o meu Deus, o meu refúgio, a minha fortaleza, e nele confiarei.'),
  p(20, 'Colossenses 3:15', 'E a paz de Deus, para a qual também fostes chamados em um corpo, domine em vossos corações; e sede agradecidos.'),
]

export const isBiblePassage = (id: string): boolean => id.startsWith('bib-')
