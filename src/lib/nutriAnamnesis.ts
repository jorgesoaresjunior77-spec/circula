// Anamnese nutricional: as perguntas ficam aqui, como dados, e a tela as
// desenha. Tudo é resposta livre ou escolha simples da nutricionista; o app
// não interpreta nada.

export type FieldKind = 'text' | 'textarea' | 'time' | 'number' | 'select' | 'multi'

export interface AnamnesisField {
  key: string
  label: string
  kind: FieldKind
  options?: string[]
  hint?: string
}

export interface AnamnesisSection {
  key: string
  title: string
  fields: AnamnesisField[]
}

const FREQ = ['Nunca', 'Raramente', 'Algumas vezes por semana', 'Diariamente', 'Mais de uma vez ao dia']
const LEVEL = ['Baixo', 'Moderado', 'Alto']

export const ANAMNESIS_SECTIONS: AnamnesisSection[] = [
  {
    key: 'clinico',
    title: 'Histórico clínico',
    fields: [
      { key: 'doencas', label: 'Doenças diagnosticadas', kind: 'textarea' },
      { key: 'doencas_familiares', label: 'Histórico de doenças familiares', kind: 'textarea' },
      { key: 'cirurgias', label: 'Cirurgias anteriores', kind: 'textarea' },
      { key: 'medicamentos', label: 'Medicamentos utilizados', kind: 'textarea' },
      { key: 'suplementos', label: 'Suplementos utilizados', kind: 'textarea' },
      { key: 'alergias', label: 'Alergias alimentares', kind: 'textarea' },
      { key: 'intolerancias', label: 'Intolerâncias alimentares', kind: 'textarea' },
      { key: 'peso_historico', label: 'Histórico de alterações de peso', kind: 'textarea' },
      { key: 'tratamentos', label: 'Histórico de tratamentos nutricionais', kind: 'textarea' },
      { key: 'exames', label: 'Exames laboratoriais (resumo)', kind: 'textarea', hint: 'Os arquivos ficam na aba Exames (próxima etapa).' },
      { key: 'obs_clinicas', label: 'Observações clínicas', kind: 'textarea' },
    ],
  },
  {
    key: 'rotina',
    title: 'Hábitos e rotina',
    fields: [
      { key: 'acorda', label: 'Horário em que acorda', kind: 'time' },
      { key: 'dorme', label: 'Horário em que dorme', kind: 'time' },
      { key: 'sono_qualidade', label: 'Qualidade do sono', kind: 'select', options: ['Ruim', 'Regular', 'Boa', 'Ótima'] },
      { key: 'sono_horas', label: 'Horas de sono por noite', kind: 'number' },
      { key: 'rotina_prof', label: 'Rotina profissional', kind: 'textarea' },
      { key: 'estresse', label: 'Nível de estresse', kind: 'select', options: LEVEL },
      { key: 'atividade', label: 'Atividade física', kind: 'select', options: ['Não pratica', 'Pratica'] },
      { key: 'exercicio_tipo', label: 'Tipo de exercício', kind: 'text' },
      { key: 'exercicio_freq', label: 'Frequência semanal (vezes)', kind: 'number' },
      { key: 'exercicio_duracao', label: 'Duração dos exercícios (minutos)', kind: 'number' },
      { key: 'agua_litros', label: 'Consumo diário de água (litros)', kind: 'number' },
      { key: 'intestino', label: 'Funcionamento intestinal', kind: 'textarea' },
      { key: 'evacuacao_freq', label: 'Frequência de evacuação', kind: 'text' },
    ],
  },
  {
    key: 'comportamento',
    title: 'Comportamento alimentar',
    fields: [
      { key: 'refeicoes_dia', label: 'Número de refeições por dia', kind: 'number' },
      { key: 'horarios_refeicoes', label: 'Horários habituais das refeições', kind: 'textarea' },
      { key: 'prefere', label: 'Alimentos preferidos', kind: 'textarea' },
      { key: 'nao_gosta', label: 'Alimentos que não gosta', kind: 'textarea' },
      { key: 'nao_consome', label: 'Alimentos que não consome', kind: 'textarea' },
      { key: 'frutas', label: 'Consumo de frutas', kind: 'select', options: FREQ },
      { key: 'verduras', label: 'Consumo de verduras', kind: 'select', options: FREQ },
      { key: 'legumes', label: 'Consumo de legumes', kind: 'select', options: FREQ },
      { key: 'doces', label: 'Consumo de doces', kind: 'select', options: FREQ },
      { key: 'refrigerantes', label: 'Consumo de refrigerantes', kind: 'select', options: FREQ },
      { key: 'alcool', label: 'Consumo de bebidas alcoólicas', kind: 'select', options: FREQ },
      { key: 'industrializados', label: 'Consumo de alimentos industrializados', kind: 'select', options: FREQ },
      { key: 'fora_casa', label: 'Frequência de refeições fora de casa', kind: 'select', options: FREQ },
      { key: 'compulsao', label: 'Episódios de compulsão alimentar', kind: 'textarea', hint: 'Se aplicável.' },
      { key: 'fome_emocional', label: 'Fome emocional', kind: 'textarea', hint: 'Se aplicável.' },
      { key: 'dificuldades', label: 'Dificuldades para seguir uma alimentação saudável', kind: 'textarea' },
      { key: 'obs_nutri', label: 'Observações da nutricionista', kind: 'textarea' },
    ],
  },
  {
    key: 'objetivos',
    title: 'Objetivos nutricionais',
    fields: [
      {
        key: 'objetivos',
        label: 'Objetivos',
        kind: 'multi',
        options: [
          'Emagrecimento',
          'Ganho de massa muscular',
          'Reeducação alimentar',
          'Melhora da saúde intestinal',
          'Melhora da qualidade de vida',
          'Desempenho esportivo',
          'Controle de condições clínicas',
        ],
      },
      { key: 'outros_objetivos', label: 'Outros objetivos', kind: 'textarea' },
    ],
  },
]

export type AnamnesisData = Record<string, string | string[]>

/** Quantos campos foram preenchidos / total (para a barra de progresso). */
export function anamnesisProgress(data: AnamnesisData): { filled: number; total: number } {
  let filled = 0
  let total = 0
  for (const s of ANAMNESIS_SECTIONS) {
    for (const f of s.fields) {
      total += 1
      const v = data[f.key]
      if (Array.isArray(v) ? v.length > 0 : typeof v === 'string' && v.trim() !== '') filled += 1
    }
  }
  return { filled, total }
}
