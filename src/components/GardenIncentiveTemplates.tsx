import { GARDEN_INCENTIVE_MESSAGE_LIBRARY, GARDEN_INCENTIVE_TEMPLATES_BY_KEY } from '../types/garden'
import type { GardenIncentiveTemplateKey } from '../types/garden'

interface GardenIncentiveCardProps {
  /** `null` = ainda sem estilo escolhido — mostra uma pré-visualização neutra (ver abaixo), nunca some por falta de template. */
  template: GardenIncentiveTemplateKey | null
  /** Título real da publicação (ex.: título do dia/desafio) — nunca gerado aqui. */
  title: string
  /** Mensagem real escrita pela profissional. */
  message: string
  /** Nome de quem assina, quando fizer sentido mostrar. */
  authorName?: string | null
}

/**
 * Card de um dos seis templates de incentivo (ver catálogo em
 * types/garden.ts), já preenchido com conteúdo real. Puramente
 * apresentacional — nunca chama Supabase, nunca publica nada, nunca
 * inventa conteúdo/métrica/depoimento. Mobile-first por padrão (sem
 * larguras fixas, flex em coluna) — funciona dentro de qualquer
 * contêiner responsivo existente.
 *
 * Usado como pré-visualização no composer de incentivo já existente em
 * GardenChallengeManager (aba "Publicar incentivo"), que continua
 * chamando `publishDailyPost(challengeDayId, message)` sem mudança
 * nenhuma de schema — o template escolhido é só uma ajuda visual de
 * composição no cliente, nunca persistido (ver nota no fim do arquivo).
 *
 * `template` nulo (Etapa P) renderiza a mesma pré-visualização sem a
 * cor/eyebrow de categoria — a profissional pode revisar o texto antes
 * de publicar mesmo sem ter escolhido um estilo ainda.
 */
export function GardenIncentiveCard({ template, title, message, authorName }: GardenIncentiveCardProps) {
  const meta = template ? GARDEN_INCENTIVE_TEMPLATES_BY_KEY[template] : null
  const trimmedMessage = message.trim()

  return (
    <div className={`garden-incentive-template${template ? ` garden-incentive-template--${template}` : ''}`}>
      <span className="garden-incentive-template-eyebrow">
        <span aria-hidden="true">{meta ? meta.emoji : '📝'}</span> {meta ? meta.eyebrow : 'Sem estilo'}
      </span>
      <p className="garden-incentive-template-title">{title}</p>
      {trimmedMessage && <p className="garden-incentive-template-message">{trimmedMessage}</p>}
      {authorName && (
        <p className="garden-incentive-template-author">
          <span aria-hidden="true">🪴</span> {authorName}
        </p>
      )}
    </div>
  )
}

interface GardenIncentiveMessageLibraryProps {
  template: GardenIncentiveTemplateKey
  /** Chamado só quando a profissional clica em "Usar esta sugestão" — nunca ao consultar/ler a lista. */
  onApply: (message: string) => void
}

/**
 * Lista de sugestões de mensagem (GARDEN_INCENTIVE_MESSAGE_LIBRARY, em
 * types/garden.ts) para a categoria já escolhida no seletor de estilo.
 * Puramente apresentacional: só lê o catálogo estático e delega a
 * decisão de aplicar (inclusive a confirmação quando já existe texto
 * digitado) para quem usa este componente — ver `applySuggestion` em
 * GardenChallengeManager.tsx. Escolher ou só ler uma sugestão aqui
 * nunca publica nada e nunca muda o texto por conta própria.
 */
export function GardenIncentiveMessageLibrary({ template, onApply }: GardenIncentiveMessageLibraryProps) {
  const meta = GARDEN_INCENTIVE_TEMPLATES_BY_KEY[template]
  const messages = GARDEN_INCENTIVE_MESSAGE_LIBRARY[template]

  return (
    <div className="garden-incentive-library">
      <p className="panel-content-label">Sugestões de mensagem — {meta.eyebrow}</p>
      <ul className="panel-content-list">
        {messages.map((message, index) => (
          <li key={index} className="panel-content-row">
            <p className="panel-content-row-text">{message}</p>
            <div className="panel-content-row-actions">
              <button type="button" className="panel-content-action" onClick={() => onApply(message)}>
                Usar esta sugestão
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// =====================================================================
// NOTA DE INTEGRAÇÃO (Etapa O — implementada em GardenChallengeManager.tsx,
// aba "Publicar incentivo"):
//
// Seletor dos 6 GARDEN_INCENTIVE_TEMPLATES + pré-visualização com
// <GardenIncentiveCard>, sem nenhuma mudança de schema: `publishDailyPost`
// continua enviando só o texto final (`message`) ao RPC
// `garden_publish_daily_post` existente — o template escolhido é apenas
// uma ajuda visual de composição no cliente, nunca persistido. Se no
// futuro for útil saber QUAL template foi usado (ex. analytics de que
// tom engaja mais), aí sim seria necessária uma coluna nova — fora deste
// ciclo.
//
// Etapa Q — `GardenIncentiveMessageLibrary` acima some sugestões da
// categoria escolhida; aplicar uma delas só chama `onApply(message)`,
// que em GardenChallengeManager.tsx (`applySuggestion`) decide se pede
// confirmação (`window.confirm`, mesmo mecanismo já usado em
// `handleGenerate`) antes de sobrescrever texto já digitado. Nada aqui
// publica ou muda o estilo selecionado.
// =====================================================================
