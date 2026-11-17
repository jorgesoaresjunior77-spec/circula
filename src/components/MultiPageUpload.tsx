import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { uploadCommunityMedia } from '../lib/communityMedia'

// Envio de VÁRIAS páginas de uma vez (revista, e-book, receita, prática).
// A profissional escolhe todas as imagens juntas; elas sobem uma por vez, na
// ordem do nome do arquivo (1, 2, 3… 10, 11), cada uma já reduzida para WebP
// (poupa espaço no Storage) e só então são gravadas em sequência de uma vez.

interface Props {
  communityId: string
  uid: string
  label?: string
  /** Recebe os caminhos já enviados, na ordem de leitura. Devolve a mensagem
   *  de erro, ou null quando salvou. */
  onUploaded: (paths: string[]) => Promise<string | null>
  disabled?: boolean
}

/** Ordem natural pelo nome: "pag2" antes de "pag10". */
export function sortByFileName(files: File[]): File[] {
  return [...files].sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' }),
  )
}

export function MultiPageUpload({
  communityId,
  uid,
  label = 'Enviar páginas (várias de uma vez)',
  onUploaded,
  disabled = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = sortByFileName(Array.from(event.target.files ?? []))
    event.target.value = ''
    if (files.length === 0) return
    setError(null)
    const paths: string[] = []
    let failed: string | null = null
    setProgress({ done: 0, total: files.length })
    for (const file of files) {
      const r = await uploadCommunityMedia(file, communityId, uid, 'covers')
      if (r.path) paths.push(r.path)
      else {
        failed = `"${file.name}": ${r.error ?? 'não foi possível enviar.'}`
        break // mantém a ordem: não pula uma página no meio
      }
      setProgress({ done: paths.length, total: files.length })
    }
    let saveError: string | null = null
    if (paths.length > 0) saveError = await onUploaded(paths)
    setProgress(null)
    if (saveError) setError(saveError)
    else if (failed) {
      setError(
        `${paths.length} de ${files.length} páginas foram salvas. Parou em ${failed} Envie as que faltam.`,
      )
    }
  }

  const busy = progress !== null
  return (
    <div className="multi-upload">
      <button
        type="button"
        className="cover-image-input-pick"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || busy}
      >
        {busy ? `Enviando ${progress.done}/${progress.total}…` : label}
      </button>
      <span className="card-images-hint">Escolha todas as imagens juntas; vão pela ordem do nome do arquivo.</span>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="cover-image-input-file"
        onChange={handleFiles}
        disabled={disabled || busy}
      />
    </div>
  )
}
