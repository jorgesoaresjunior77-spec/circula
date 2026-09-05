import { useState } from 'react'
import { useJoyMoments } from '../hooks/useJoyMoments'
import { JoyMomentComposer } from './JoyMomentComposer'
import { JoyMomentCard } from './JoyMomentCard'

// Fase 4 — faixa "Momento de alegria" na Home.
//
// NÃO é o Feed: usa a tabela própria `joy_moments`, mostra só um punhado
// dos momentos mais recentes e traz o compositor logo acima. Sem rota
// nova, sem duplicar posts.

interface JoyMomentsSectionProps {
  communityId: string
  profileId: string
}

const PREVIEW_COUNT = 3

export function JoyMomentsSection({ communityId, profileId }: JoyMomentsSectionProps) {
  const { moments, loading, error, createMoment, updateMoment, deleteMoment } = useJoyMoments(
    communityId,
    profileId,
  )
  const [showAll, setShowAll] = useState(false)

  const visible = showAll ? moments : moments.slice(0, PREVIEW_COUNT)

  return (
    <section className="home-section joy-section">
      <div className="home-section-head">
        <h3 className="home-section-title">Momento de alegria</h3>
      </div>

      <JoyMomentComposer communityId={communityId} profileId={profileId} onSubmit={createMoment} />

      {loading && <p className="home-muted">Carregando momentos…</p>}
      {!loading && error && <p className="auth-error">{error}</p>}

      {!loading && !error && moments.length === 0 && (
        <p className="home-muted">
          Ainda não há momentos por aqui. Que tal você começar? 🌟
        </p>
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="joy-list">
          {visible.map((moment) => (
            <JoyMomentCard
              key={moment.id}
              communityId={communityId}
              moment={moment}
              isOwn={moment.profile_id === profileId}
              profileId={profileId}
              onUpdate={updateMoment}
              onDelete={deleteMoment}
            />
          ))}
        </div>
      )}

      {!loading && !error && moments.length > PREVIEW_COUNT && (
        <button
          type="button"
          className="home-section-link"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? 'Mostrar menos' : `Ver todos (${moments.length})`}
        </button>
      )}
    </section>
  )
}
