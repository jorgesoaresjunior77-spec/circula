// Áreas do app contadas nas Métricas (abertura de cada tela pelas participantes).
// O banco guarda um id fixo por área (item_views.kind = 'screen'); a ordem desta
// lista NÃO pode mudar — só acrescentar no fim.

export const TRACKED_SCREENS: { key: string; label: string }[] = [
  { key: 'inicio', label: 'Início' },
  { key: 'feed', label: 'Feed' },
  { key: 'circulos', label: 'Círculos' },
  { key: 'eventos', label: 'Eventos' },
  { key: 'receitas', label: 'Receitas' },
  { key: 'cardapio', label: 'Meu Chef' },
  { key: 'exercicios', label: 'Se exercite em casa' },
  { key: 'series', label: 'Séries e Filmes' },
  { key: 'viagens', label: 'Dicas de Viagem' },
  { key: 'diario', label: 'Diário da Gratidão' },
  { key: 'jardim', label: 'Meu Jardim' },
  { key: 'agenda', label: 'Agenda' },
  { key: 'agua', label: 'Água' },
  { key: 'imc', label: 'IMC' },
  { key: 'planos', label: 'Planos e assinaturas' },
  { key: 'convite', label: 'Convite' },
  { key: 'playlist', label: 'Playlist' },
  { key: 'tempo', label: 'Previsão do tempo' },
  { key: 'relogio', label: 'Relógio' },
  { key: 'leitura', label: 'Dicas de leitura' },
  { key: 'respiracao', label: 'Respiração' },
  { key: 'wellness', label: 'Wellness' },
  { key: 'lista', label: 'Lista de compras' },
  { key: 'loja', label: 'Loja' },
  { key: 'ajuda', label: 'Ajuda' },
  { key: 'mensagens', label: 'Mensagens' },
  { key: 'perfil', label: 'Meu perfil' },
  { key: 'nutri', label: 'Nutri' },
  { key: 'inspiracoes', label: 'Inspirações' },
  { key: 'antes-de-tudo', label: 'Antes de tudo' },
  { key: 'cidade', label: 'Na minha cidade' },
  { key: 'carro', label: 'Carro em Dia' },
  { key: 'financas', label: 'Finanças' },
]

function uuidFor(index: number): string {
  return '00000000-0000-4000-8000-' + (index + 1).toString(16).padStart(12, '0')
}

/** Id fixo da área, ou null se ela não é contada. */
export function screenId(key: string): string | null {
  const i = TRACKED_SCREENS.findIndex((s) => s.key === key)
  return i < 0 ? null : uuidFor(i)
}

export function screenLabelById(id: string): string | null {
  const i = TRACKED_SCREENS.findIndex((_, idx) => uuidFor(idx) === id)
  return i < 0 ? null : TRACKED_SCREENS[i].label
}
