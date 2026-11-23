import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { ImageCropper } from './ImageCropper'
import { clearLoginBackground, fetchLoginBackground, saveLoginBackground } from '../hooks/useLoginBackground'

// Painel → Imagens: foto de fundo da tela de login, vertical 9:16 (1080 × 1920 px).
// Vale para o app todo (a tela de login é vista antes de entrar em qualquer comunidade).

export function LoginBackgroundManager({ profileId }: { profileId: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void fetchLoginBackground().then((u) => {
      if (!active) return
      setUrl(u)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) {
      setError(null)
      setPending(file)
    }
  }

  async function onCropped(file: File) {
    setPending(null)
    setBusy(true)
    const r = await saveLoginBackground(profileId, file)
    setBusy(false)
    if (r.error) setError(r.error)
    else setUrl(r.url)
  }

  async function remove() {
    setBusy(true)
    const err = await clearLoginBackground()
    setBusy(false)
    if (err) setError(err)
    else setUrl(null)
  }

  return (
    <div className="card-images-manager">
      <header className="card-images-head">
        <h4 className="card-images-title">Fundo da tela de login</h4>
        <p className="card-images-desc">
          Foto que cobre toda a tela de entrada do Círcula, atrás do card de login. Vale para o app todo. Sem foto, a tela usa um degradê nos tons do app.
        </p>
        <p className="card-images-format">Tamanho exato: 1080 × 1920 px (vertical 9:16). JPG, PNG ou WebP, até 5 MB. Escolha uma foto sem texto e com luz suave, porque o card de login fica sobre ela.</p>
      </header>

      {loading ? (
        <p className="home-muted">Carregando…</p>
      ) : (
        <div className="cover-image-input">
          <div className="cover-image-input-frame" data-empty={url ? undefined : 'true'} style={{ aspectRatio: '9 / 16', maxWidth: 220 }}>
            {url ? (
              <img src={url} alt="" className="cover-image-input-preview" />
            ) : (
              <span className="cover-image-input-placeholder">
                Nenhuma imagem selecionada
                <span className="cover-image-input-size-hint">1080 × 1920 px</span>
              </span>
            )}
            {busy && <span className="cover-image-input-status">Enviando…</span>}
          </div>
          <div className="cover-image-input-actions">
            <button type="button" className="cover-image-input-pick" disabled={busy} onClick={() => inputRef.current?.click()}>
              {url ? 'Trocar imagem' : 'Selecionar imagem'}
            </button>
            {url && !busy && (
              <button type="button" className="auth-link" onClick={() => void remove()}>
                Remover
              </button>
            )}
          </div>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onFile} />
          {pending && <ImageCropper file={pending} aspect={9 / 16} outputWidth={1080} title="Ajustar o fundo do login" onCancel={() => setPending(null)} onDone={(f) => void onCropped(f)} />}
        </div>
      )}
    </div>
  )
}
