// Convite pelo WhatsApp — três sugestões de mensagem, linguagem acolhedora,
// sem IA/serviço externo. Cada sugestão muda de estrutura (não só de
// palavras). Aplicar uma sugestão só preenche o campo de texto: a mensagem
// continua 100% editável e nada é enviado automaticamente.
//
// - `circleName`: convite feito de dentro de um Círculo ("Venha participar de
//   uma comunidade que fala sobre o que você gosta (Nome)").
// - `premiumBonus`: quem tem o Círcula Premium também avisa que a convidada
//   ganha o desconto do plano Premium + 10%.
export interface InviteMessageOptions {
  circleName?: string
  premiumBonus?: boolean
}

export const PREMIUM_BONUS_LINE =
  'Quem chega por este convite ganha mais 10% de desconto no plano Premium, além do desconto que o plano já tem.'

export function buildInviteMessageSuggestions(
  communityName: string,
  publicUrl: string,
  options: InviteMessageOptions = {},
): string[] {
  const name = communityName.trim() || 'Círcula'
  const circle = options.circleName?.trim()
  const bonus = options.premiumBonus ? `\n\n${PREMIUM_BONUS_LINE}` : ''

  const base = circle
    ? [
        `Venha participar de uma comunidade que fala sobre o que você gosta: ${circle}. 🌱\n\nÉ o círculo "${circle}" aqui no ${name}, um espaço de troca e acolhimento entre mulheres.${bonus}\n\n${publicUrl}`,
        `Oi! Estou no círculo "${circle}" do ${name} e lembrei de você. Venha participar de uma comunidade que fala sobre o que você gosta!${bonus}\n\n${publicUrl}`,
        `Separei um convite pra você: o círculo "${circle}", dentro do ${name}. Conversas, trocas e mulheres que gostam do mesmo assunto. Vem comigo?${bonus}\n\n${publicUrl}`,
      ]
    : [
        `Oi! Quero te convidar para conhecer o ${name}, um espaço de conexão, troca e crescimento entre mulheres. Um lugar para compartilhar experiências, descobrir novas possibilidades e florescer juntas. 🌱${bonus}\n\n${publicUrl}`,
        `Oi, tudo bem? Estou participando do ${name} e lembrei de você! É uma comunidade acolhedora, feita por e para mulheres — trocamos experiências, participamos de desafios e crescemos juntas. Vem conhecer?${bonus}\n\n${publicUrl}`,
        `Separei um convite especial pra você: o ${name} é um espaço pensado para o seu bem-estar, com conteúdos, encontros e uma comunidade inteira torcendo pelo seu crescimento. Bora se juntar a nós?${bonus}\n\n${publicUrl}`,
      ]
  return base
}
