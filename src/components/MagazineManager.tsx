import { useState } from 'react'
import { useMagazines } from '../hooks/useMagazines'
import { useCommunityCardImages } from '../hooks/useCommunityCardImages'
import { suggestedReleaseDate, nextMagazineMessage } from '../lib/magazineSchedule'
import type { MagazineIssue } from '../types/magazine'
import { CoverImageInput } from './CoverImageInput'

// Painel → Imagens da comunidade → Revista Círcula Woman Magazine.
// Edições (capa + data de lançamento + páginas) e o fundo do Escritório
// Editorial. Só imagens enviadas pela dona — nada gerado por IA.

interface MagazineManagerProps {
  communityId: string
  profileId: string
}

function IssueEditor({
  issue,
  communityId,
  profileId,
  api,
}: {
  issue: MagazineIssue
  communityId: string
  profileId: string
  api: ReturnType<typeof useMagazines>
}) {
  const [error, setError] = useState<string | null>(null)
  const guard = async (op: Promise<{ error: string | null }>) => {
    setError(null)
    const r = await op
    if (r.error) setError('Não foi possível salvar agora. Tente novamente.')
  }

  return (
    <li className="card-images-row magazine-issue-row">
      <div className="card-images-info">
        <span className="card-images-name">{issue.title}</span>
        <label className="card-images-hint">
          Sai em{' '}
          <input
            type="date"
            value={issue.release_date}
            onChange={(e) =>
              e.target.value && void guard(api.updateIssue(issue.id, { release_date: e.target.value }))
            }
          />
        </label>
        <button
          type="button"
          className="auth-link"
          onClick={() => {
            if (window.confirm(`Excluir a edição "${issue.title}" e todas as páginas?`)) {
              void guard(api.deleteIssue(issue.id))
            }
          }}
        >
          Excluir edição
        </button>
      </div>

      <div className="card-images-field">
        <p className="card-images-guide">
          <span>Capa (retrato 3:4)</span>
        </p>
        <CoverImageInput
          value={issue.cover_path ?? ''}
          communityId={communityId}
          uid={profileId}
          label=""
          aspectRatio="3 / 4"
          recommendedSize="1200 × 1600 px"
          onChange={(path) => void guard(api.updateIssue(issue.id, { cover_path: path || null }))}
        />

        <p className="card-images-guide">
          <span>Páginas ({issue.pages.length}/12)</span>
        </p>
        <ol className="magazine-pages-list">
          {issue.pages.map((page, i) => (
            <li key={page.id}>
              <span className="magazine-page-num">Página {i + 1}</span>
              <CoverImageInput
                value={page.image_path}
                communityId={communityId}
                uid={profileId}
                label=""
                aspectRatio="3 / 4"
                recommendedSize="1200 × 1600 px"
                onChange={(path) =>
                  void guard(path ? api.replacePage(page.id, path) : api.removePage(page.id))
                }
              />
            </li>
          ))}
          {issue.pages.length < 12 && (
          <li>
            <span className="magazine-page-num">Nova página</span>
            <CoverImageInput
              key={`new-${issue.pages.length}`}
              value=""
              communityId={communityId}
              uid={profileId}
              label=""
              aspectRatio="3 / 4"
              recommendedSize="1200 × 1600 px"
              onChange={(path) => path && void guard(api.addPage(issue, path))}
            />
          </li>
          )}
        </ol>
        {error && (
          <p className="card-images-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </li>
  )
}

export function MagazineManager({ communityId, profileId }: MagazineManagerProps) {
  const api = useMagazines(communityId)
  const { images, setImage, clearImage } = useCommunityCardImages(communityId)
  const [title, setTitle] = useState('')
  const [release, setRelease] = useState(suggestedReleaseDate())
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    setError(null)
    if (!title.trim()) {
      setError('Dê um nome à edição.')
      return
    }
    const r = await api.createIssue({ title, release_date: release, created_by: profileId })
    if (r.error) {
      setError('Não foi possível criar a edição agora. Tente novamente.')
      return
    }
    setTitle('')
  }

  async function handleOffice(path: string) {
    setError(null)
    const r = path
      ? await setImage('revista_escritorio', path, profileId)
      : await clearImage('revista_escritorio')
    if (r.error) setError('Não foi possível salvar o fundo do escritório agora.')
  }

  return (
    <div className="card-images-manager">
      <header className="card-images-head">
        <h4 className="card-images-title">Revista Círcula Woman Magazine</h4>
        <p className="card-images-desc">
          Uma edição nova a cada 30 dias, no dia 01. A edição só aparece para as
          participantes na data de lançamento. {nextMagazineMessage()}
        </p>
      </header>

      <ul className="card-images-list">
        <li className="card-images-row">
          <div className="card-images-info">
            <span className="card-images-name">Escritório Editorial</span>
            <span className="card-images-hint">
              Fundo do escritório da revista (mesa, pessoas desfocadas). Paisagem 16:9 ou retrato,
              até 5 MB.
            </span>
          </div>
          <div className="card-images-field">
            <CoverImageInput
              value={images.revista_escritorio ?? ''}
              communityId={communityId}
              uid={profileId}
              label=""
              aspectRatio="16 / 9"
              recommendedSize="1920 × 1080 px"
              onChange={(path) => void handleOffice(path)}
            />
          </div>
        </li>

        {api.loading ? (
          <li className="home-muted">Carregando edições…</li>
        ) : (
          api.issues.map((issue) => (
            <IssueEditor
              key={issue.id}
              issue={issue}
              communityId={communityId}
              profileId={profileId}
              api={api}
            />
          ))
        )}

        <li className="card-images-row magazine-new-issue">
          <div className="card-images-info">
            <span className="card-images-name">Nova edição</span>
          </div>
          <div className="card-images-field">
            <input
              type="text"
              className="magazine-input"
              placeholder="Nome da edição (ex.: Dezembro)"
              value={title}
              maxLength={80}
              onChange={(e) => setTitle(e.target.value)}
            />
            <label className="card-images-hint">
              Sai em{' '}
              <input type="date" value={release} onChange={(e) => setRelease(e.target.value)} />
            </label>
            <button type="button" className="cover-image-input-pick" onClick={() => void handleCreate()}>
              Criar edição
            </button>
            {error && (
              <p className="card-images-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </li>
      </ul>
    </div>
  )
}
