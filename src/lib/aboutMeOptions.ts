// Perfil (item 9) — "Um pouco sobre mim": lista fixa de itens que a
// própria mulher pode marcar no perfil. Reaproveita 100% a coluna
// `profiles.interests` (text[]) já existente — marcar/desmarcar aqui é
// exatamente o mesmo `add`/`remove` que a tag livre de "Interesses" já
// fazia, só que a partir de uma lista sugerida em vez de texto livre.
// Nenhuma tabela, coluna ou RLS nova: a visibilidade pra outras mulheres
// segue a mesma policy `profiles_select` que já libera `interests`.
export const ABOUT_ME_OPTIONS = [
  'Gosto de viajar',
  'Adoro cozinhar',
  'Gosto de ler',
  'Amo a natureza',
  'Gosto de animais',
  'Pratico atividade física',
  'Gosto de conhecer pessoas',
  'Busco novas amizades',
  'Gosto de compartilhar experiências',
  'Tenho interesse em bem-estar',
  'Gosto de aprender coisas novas',
  'Prefiro programas tranquilos',
  'Sou empreendedora',
  'Sou mãe',
  'Estou em uma nova fase da vida',
] as const
