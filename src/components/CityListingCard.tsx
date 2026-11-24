import { useState } from 'react'
import { LISTING_TYPE_LABEL, formatMeetupDate, hoursSummary, instagramHandle, shareListingUrl } from '../lib/city'
import type { CityCategory, CityListing, CityTag } from '../lib/city'
import { formatRelativeTime } from '../lib/formatRelativeTime'
import { fetchAttendees } from '../hooks/useCity'
import type { Result } from '../hooks/useCity'
import { CityReviews, Stars } from './CityReviews'
import { CityClaim } from './CityClaim'

// Um cadastro da cidade. Mostra só foto e primeiro nome de quem criou. Quem
// criou vê "Editar" e "Excluir"; as demais veem "Denunciar"; a administração
// pode ocultar e excluir qualquer um.

interface CityListingCardProps {
  listing: CityListing
  category: CityCategory | null
  tags: CityTag[]
  uid: string
  isAdmin: boolean
  /** Modo leitura (cidade que não é a da participante): sem "Quero ir"/editar. */
  readOnly?: boolean
  onVote: (l: CityListing) => Promise<Result>
  onSave: (l: CityListing) => Promise<Result>
  onGo: (l: CityListing) => Promise<Result>
  onEdit: (l: CityListing) => void
  onDelete: (l: CityListing) => Promise<Result>
  onHide: (l: CityListing, hidden: boolean) => Promise<Result>
  onReport: (l: CityListing, motivo: string) => Promise<Result>
  /** Recarrega a lista (depois de reivindicar ou mexer no destaque). */
  onReload?: () => void
}

export function CityListingCard({
  listing: l,
  category,
  tags,
  uid,
  isAdmin,
  readOnly = false,
  onVote,
  onSave,
  onGo,
  onEdit,
  onDelete,
  onHide,
  onReport,
  onReload,
}: CityListingCardProps) {
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [reason, setReason] = useState('')
  const [reported, setReported] = useState(false)
  const [showReviews, setShowReviews] = useState(false)
  const [summary, setSummary] = useState({ media: l.media, total: l.avaliacoes })
  const [attendees, setAttendees] = useState<{ nome: string; avatar: string | null }[] | null>(null)

  const mine = l.criado_por === uid
  // a dona (reivindicação aprovada) também edita o cadastro
  const canEdit = mine || l.sou_dona
  const isMeetup = l.tipo === 'convite'
  const canVote = l.tipo === 'lugar' || l.tipo === 'profissional'
  const insta = instagramHandle(l.instagram)
  const tagNames = l.tags.map((id) => tags.find((t) => t.id === id)).filter((t): t is CityTag => !!t)
  const full = l.vagas != null && l.confirmadas >= l.vagas

  async function run(fn: () => Promise<Result>) {
    setBusy(true)
    setMsg(null)
    const r = await fn()
    setBusy(false)
    if (r.error) setMsg(r.error)
  }

  async function showAttendees() {
    setAttendees(await fetchAttendees(l.id))
  }

  async function sendReport() {
    setBusy(true)
    const r = await onReport(l, reason)
    setBusy(false)
    if (r.error) setMsg(r.error)
    else {
      setReported(true)
      setReporting(false)
      setMsg('Denúncia enviada. A equipe do Círculo vai analisar. Obrigada por cuidar da comunidade.')
    }
  }

  return (
    <article className={`cty-card${l.status === 'oculto' ? ' cty-card--hidden' : ''}`}>
      {l.foto && <img className="cty-card-photo" src={l.foto} alt="" loading="lazy" decoding="async" />}
      <div className="cty-card-body">
        {/* 1. Quem é: logo, nome e categoria */}
        <header className={`cty-card-head${l.logo ? ' cty-card-head--logo' : ''}`}>
          {l.logo && <img className="cty-card-logo" src={l.logo} alt="" loading="lazy" decoding="async" />}
          <div className="cty-card-headtext">
            <h3 className="cty-card-title">{l.titulo}</h3>
            <div className="cty-card-chips">
              <span className="cty-tag cty-tag--type">{LISTING_TYPE_LABEL[l.tipo]}</span>
              {isMeetup && l.atividade && <span className="cty-tag cty-tag--cat">{l.atividade}</span>}
              {category && <span className="cty-tag cty-tag--cat">{category.nome}</span>}
              {l.faixa_preco && <span className="cty-tag">{l.faixa_preco}</span>}
              {l.destaque && <span className="cty-tag cty-tag--highlight">★ Destaque</span>}
              {l.reivindicado && !l.e_proprio_negocio && <span className="cty-tag cty-tag--self">Negócio reivindicado</span>}
              {l.e_proprio_negocio && <span className="cty-tag cty-tag--self">Divulgação da própria membro</span>}
              {l.status === 'oculto' && <span className="cty-tag cty-tag--warn">Oculto</span>}
            </div>
          </div>
        </header>

        {/* 2. Avaliação */}
        {canVote && (
          <button type="button" className="cty-rating" aria-expanded={showReviews} onClick={() => setShowReviews((v) => !v)}>
            {summary.media !== null && summary.total > 0 ? (
              <>
                <strong>{summary.media.toFixed(1).replace('.', ',')}</strong> <Stars value={summary.media} size={17} /> <span>({summary.total} {summary.total === 1 ? 'avaliação' : 'avaliações'})</span>
              </>
            ) : (
              <span>☆☆☆☆☆ Seja a primeira a avaliar</span>
            )}
            <span className="cty-rating-more">{showReviews ? 'Fechar' : 'Avaliar e ver comentários'}</span>
          </button>
        )}
        {showReviews && canVote && (
          <CityReviews
            listingId={l.id}
            isAuthor={mine}
            isAdmin={isAdmin}
            readOnly={readOnly}
            onSummary={(media, total) => setSummary({ media, total })}
          />
        )}

        {/* 3. Sobre */}
        {l.descricao && <p className="cty-card-desc">{l.descricao}</p>}
        {tagNames.length > 0 && (
          <div className="cty-card-chips">
            {tagNames.map((t) => (
              <span key={t.id} className="cty-tag">
                {t.nome}
              </span>
            ))}
          </div>
        )}

        {/* 4. Informações em linhas organizadas */}
        {(((l.tipo === 'evento' || isMeetup) && l.starts_at) || l.local_nome || (l.tipo === 'evento' && l.valor) || isMeetup || l.bairro || l.atende_toda_cidade || l.endereco || hoursSummary(l.horarios) || l.horario || l.contato || insta || l.link) && (
          <dl className="cty-info">
            {(l.tipo === 'evento' || isMeetup) && l.starts_at && (
              <div className="cty-info-row">
                <dt>Quando</dt>
                <dd>{formatMeetupDate(l.starts_at)}</dd>
              </div>
            )}
            {l.local_nome && (
              <div className="cty-info-row">
                <dt>{isMeetup ? 'Encontro' : 'Local'}</dt>
                <dd>{l.local_nome}</dd>
              </div>
            )}
            {l.tipo === 'evento' && l.valor && (
              <div className="cty-info-row">
                <dt>Valor</dt>
                <dd>{l.valor}</dd>
              </div>
            )}
            {isMeetup && (
              <div className="cty-info-row">
                <dt>Vagas</dt>
                <dd>
                  {l.confirmadas} de {l.vagas ?? '?'} vagas preenchidas{l.nivel === 'iniciante' ? ' · para iniciantes' : ' · todas são bem-vindas'}
                </dd>
              </div>
            )}
            {(l.bairro || l.atende_toda_cidade || l.endereco) && (
              <div className="cty-info-row">
                <dt>Onde</dt>
                <dd>{[l.atende_toda_cidade ? 'Atende em toda a cidade' : l.bairro, l.endereco].filter(Boolean).join(' · ')}</dd>
              </div>
            )}
            {(hoursSummary(l.horarios) || l.horario) && (
              <div className="cty-info-row">
                <dt>Horário</dt>
                <dd>{[hoursSummary(l.horarios), l.horario].filter(Boolean).join(' · ')}</dd>
              </div>
            )}
            {(l.contato || insta || l.link) && (
              <div className="cty-info-row">
                <dt>Contato</dt>
                <dd className="cty-card-contact">
                  {l.contato && (l.contato.replace(/\D/g, '').length >= 8 ? <a href={`tel:+55${l.contato.replace(/\D/g, '')}`}>{l.contato}</a> : <span>{l.contato}</span>)}
                  {insta && (
                    <a href={`https://instagram.com/${insta}`} target="_blank" rel="noopener noreferrer">
                      @{insta}
                    </a>
                  )}
                  {l.link && (/^https?:\/\//i.test(l.link) ? (
                    <a href={l.link} target="_blank" rel="noopener noreferrer">
                      Saiba mais
                    </a>
                  ) : (
                    <span>{l.link}</span>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        )}

        <div className="cty-card-author">
          {l.autora_avatar ? (
            <img className="cty-avatar" src={l.autora_avatar} alt="" loading="lazy" />
          ) : (
            <span className="cty-avatar cty-avatar--ph" aria-hidden="true">
              {(l.autora_nome ?? 'P').charAt(0).toUpperCase()}
            </span>
          )}
          <span>
            {l.autora_nome ?? 'Participante'} · {formatRelativeTime(l.criado_em)}
          </span>
        </div>

        <div className="cty-card-actions">
          {canVote && (
            <button type="button" className={`cty-btn cty-btn--small${l.votei ? ' cty-btn--on' : ''}`} disabled={busy} aria-pressed={l.votei} onClick={() => void run(() => onVote(l))}>
              {l.votei ? '✓ Também indico' : 'Também indico'} · {l.votos}
            </button>
          )}
          {isMeetup && !mine && !readOnly && (
            <button type="button" className={`cty-btn cty-btn--small${l.vou ? ' cty-btn--on' : ' cty-btn--primary'}`} disabled={busy || (full && !l.vou)} aria-pressed={l.vou} onClick={() => void run(() => onGo(l))}>
              {l.vou ? '✓ Eu vou (cancelar)' : full ? 'Vagas esgotadas' : 'Quero ir'}
            </button>
          )}
          {isMeetup && (mine || isAdmin) && (
            <button type="button" className="cty-btn cty-btn--small" onClick={() => void showAttendees()}>
              Quem vai ({l.confirmadas})
            </button>
          )}
          <button type="button" className={`cty-btn cty-btn--small${l.salvei ? ' cty-btn--on' : ''}`} disabled={busy} aria-pressed={l.salvei} onClick={() => void run(() => onSave(l))}>
            {l.salvei ? '★ Salvo' : '☆ Salvar'}
          </button>
          <a className="cty-btn cty-btn--small" href={shareListingUrl(l)} target="_blank" rel="noopener noreferrer">
            Compartilhar
          </a>
        </div>

        {attendees && (
          <div className="cty-attendees">
            <p className="cty-label">Quem confirmou</p>
            {attendees.length === 0 ? <p className="home-muted">Ainda ninguém confirmou.</p> : <p>{attendees.map((a) => a.nome).join(', ')}</p>}
            <button type="button" className="cty-link" onClick={() => setAttendees(null)}>
              Fechar
            </button>
          </div>
        )}

        <div className="cty-card-manage">
          {canEdit && !readOnly && (
            <>
              <button type="button" className="cty-link" onClick={() => onEdit(l)}>
                Editar
              </button>
              {!mine ? null : !confirmDelete ? (
                <button type="button" className="cty-link cty-link--danger" onClick={() => setConfirmDelete(true)}>
                  Excluir
                </button>
              ) : (
                <span className="cty-confirm">
                  Excluir de vez?{' '}
                  <button type="button" className="cty-link cty-link--danger" disabled={busy} onClick={() => void run(() => onDelete(l))}>
                    Sim, excluir
                  </button>{' '}
                  <button type="button" className="cty-link" onClick={() => setConfirmDelete(false)}>
                    Não
                  </button>
                </span>
              )}
            </>
          )}
          {!mine && (
            <button type="button" className="cty-link" disabled={reported} onClick={() => setReporting((v) => !v)}>
              {reported ? 'Denunciado' : 'Denunciar'}
            </button>
          )}
          {isAdmin && (
            <>
              <button type="button" className="cty-link" disabled={busy} onClick={() => void run(() => onHide(l, l.status !== 'oculto'))}>
                {l.status === 'oculto' ? 'Mostrar de novo' : 'Ocultar (administração)'}
              </button>
              {!mine && (
                <button type="button" className="cty-link cty-link--danger" disabled={busy} onClick={() => { if (window.confirm('Excluir este cadastro de vez?')) void run(() => onDelete(l)) }}>
                  Excluir (administração)
                </button>
              )}
            </>
          )}
        </div>

        <CityClaim listing={l} readOnly={readOnly} onChanged={() => onReload?.()} />

        {reporting && (
          <div className="cty-report">
            <label className="cty-field">
              <span className="cty-label">O que está errado? (opcional)</span>
              <textarea rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            <div className="cty-actions">
              <button type="button" className="cty-btn cty-btn--small cty-btn--primary" disabled={busy} onClick={() => void sendReport()}>
                Enviar denúncia
              </button>
              <button type="button" className="cty-btn cty-btn--small" onClick={() => setReporting(false)}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {msg && (
          <p className="cty-msg" role="status">
            {msg}
          </p>
        )}
      </div>
    </article>
  )
}
