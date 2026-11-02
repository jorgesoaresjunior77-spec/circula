// Etapa 8 (evolução/experiência/gamificação) — opções de resposta
// rápida do onboarding (Onboarding.tsx). Listas literais do pedido do
// usuário — fenotipicamente diferentes de ABOUT_ME_OPTIONS (que são
// autodescrições em 1a pessoa, usadas no Perfil), por isso não
// reaproveitadas dali: o PROPÓSITO é o mesmo (marcar interesses), mas a
// pergunta/fraseado é outro. O ARMAZENAMENTO, sim, é 100% reaproveitado
// — as escolhas de "Sobre seus interesses" somam no mesmo
// `profiles.interests` (text[]) que ABOUT_ME_OPTIONS já usa; nenhuma
// coluna nova. As demais perguntas (momento atual, participação) não
// têm lista "oficial" no pedido — fraseado direto das opções dadas.

export const ONBOARDING_CURRENT_MOMENT_OPTIONS = [
  'Começando algo novo',
  'Buscando equilíbrio',
  'Em transição',
  'Focada em crescimento pessoal',
  'Cuidando de mim',
] as const

export const ONBOARDING_INTEREST_TOPICS = [
  'Saúde e bem-estar',
  'Alimentação',
  'Atividade física',
  'Autoconhecimento',
  'Desenvolvimento pessoal',
  'Família',
  'Trabalho e empreendedorismo',
  'Beleza e autoestima',
  'Cultura e lazer',
  'Amizades e relacionamentos',
] as const

export const ONBOARDING_PARTICIPATION_OPTIONS = [
  'Gosto de conversar e interagir',
  'Prefiro acompanhar conteúdos',
  'Gosto de compartilhar experiências',
  'Quero aprender coisas novas',
  'Quero conhecer mulheres com interesses semelhantes',
] as const
