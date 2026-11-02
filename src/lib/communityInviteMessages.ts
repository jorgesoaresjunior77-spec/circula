// Convite da comunidade pelo WhatsApp (Etapa 4, evolução/gamificação) —
// três sugestões de mensagem, linguagem acolhedora/convidativa/natural,
// no mesmo espírito do exemplo dado pelo usuário. Puramente estático
// (sem IA/serviço externo), mesmo critério editorial já usado em
// GARDEN_INCENTIVE_MESSAGE_LIBRARY (types/garden.ts): nunca afirma que
// a mulher convidada já fez algo, nenhuma promessa comercial, cada
// sugestão muda de estrutura (não só de palavras). Aplicar uma sugestão
// só preenche o campo de texto já existente — a mensagem continua 100%
// editável, e nada é enviado automaticamente por aqui (ver
// CommunityInviteWhatsApp.tsx).
export function buildInviteMessageSuggestions(communityName: string, publicUrl: string): string[] {
  const name = communityName.trim() || 'Círcula'
  return [
    `Oi! Quero te convidar para conhecer o ${name}, um espaço de conexão, troca e crescimento entre mulheres. Um lugar para compartilhar experiências, descobrir novas possibilidades e florescer juntas. 🌱\n\n${publicUrl}`,
    `Oi, tudo bem? Estou participando do ${name} e lembrei de você! É uma comunidade acolhedora, feita por e para mulheres — trocamos experiências, participamos de desafios e crescemos juntas. Vem conhecer?\n\n${publicUrl}`,
    `Separei um convite especial pra você: o ${name} é um espaço pensado para o seu bem-estar, com conteúdos, encontros e uma comunidade inteira torcendo pelo seu crescimento. Bora se juntar a nós?\n\n${publicUrl}`,
  ]
}
