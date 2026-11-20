import { useEffect, useState } from 'react'
import { progressPhotoUrl } from '../hooks/usePatientNutri'
import type { ProgressPhoto } from '../hooks/usePatientNutri'
import { brDate } from '../lib/nutri'

// Como tirar as fotos de evolução do jeito padronizado (as mesmas condições em
// toda foto, para a comparação ser justa) e comparar duas fotos lado a lado.
// O app NÃO calcula medidas nem faz diagnóstico pela foto: quem avalia é a
// nutricionista, olhando as fotos e as medidas de fita que a paciente anota.

export const PHOTO_GUIDE_STEPS: string[] = [
  'Use roupa justa e leve (top e short ou roupa de baixo), sem casaco nem peças largas.',
  'Fique de frente para uma parede lisa e clara, com boa luz de frente (sem contraluz e sem flash).',
  'Apoie o celular de pé, na altura do umbigo, a cerca de 2 metros de você, na vertical. Peça ajuda a alguém ou use um apoio; evite selfie.',
  'Fique em pé, com o corpo ereto, pés juntos e olhar para a frente, com os braços soltos e um pouco afastados do corpo.',
  'Tire 3 fotos, sempre na mesma ordem: de frente, de lado (braços cruzados à frente) e de costas.',
  'Repita sempre no mesmo lugar, no mesmo horário e com a mesma roupa, sem filtros. Prefira de manhã, em jejum.',
  'Para dar escala, cole uma folha A4 na parede, ao lado do seu corpo, em todas as fotos (opcional).',
]

export function photoInviteMessage(name: string, appUrl: string): string {
  return [
    `Oi, ${name.split(' ')[0] || ''}! Para acompanhar a sua evolução, envie fotos pelo Círcula: entre em ${appUrl}, toque em Nutri > Evolução e siga o passo a passo.`,
    '',
    'Como tirar as fotos:',
    ...PHOTO_GUIDE_STEPS.map((s, i) => `${i + 1}. ${s}`),
    '',
    'As fotos ficam guardadas em área privada: só você e eu vemos.',
  ].join('\n')
}

export function BodyPhotoGuide() {
  return (
    <details className="photo-guide card-lift">
      <summary>Como tirar as fotos (passo a passo)</summary>
      <ol>
        {PHOTO_GUIDE_STEPS.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      <p className="home-muted">Fotos comuns não dão medida exata. Elas servem para você e a sua nutricionista compararem a evolução com o olhar; as medidas vêm da fita métrica.</p>
    </details>
  )
}

function Thumb({ photo }: { photo: ProgressPhoto }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    void progressPhotoUrl(photo.file_path).then((u) => !cancelled && setUrl(u))
    return () => {
      cancelled = true
    }
  }, [photo.file_path])
  return url ? <img src={url} alt={`Foto de ${photo.view} em ${brDate(photo.taken_on)}`} loading="lazy" /> : <span className="pn-photo-ph" />
}

/** Compara duas fotos da mesma posição, lado a lado (ex.: a mais antiga e a mais recente). */
export function PhotoCompare({ photos }: { photos: ProgressPhoto[] }) {
  const [view, setView] = useState<'frente' | 'lado' | 'costas'>('frente')
  const list = photos.filter((p) => p.view === view).sort((a, b) => a.taken_on.localeCompare(b.taken_on))
  const [a, setA] = useState<string>('')
  const [b, setB] = useState<string>('')
  const first = list.find((p) => p.id === a) ?? list[0]
  const last = list.find((p) => p.id === b) ?? list[list.length - 1]
  return (
    <section className="photo-compare">
      <h4>Comparar fotos</h4>
      <div className="pn-tabs" role="tablist" aria-label="Posição">
        {(['frente', 'lado', 'costas'] as const).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? 'is-on' : ''} onClick={() => { setView(v); setA(''); setB('') }}>
            {v === 'frente' ? 'Frente' : v === 'lado' ? 'Lado' : 'Costas'}
          </button>
        ))}
      </div>
      {list.length < 2 ? (
        <p className="home-muted">São necessárias pelo menos duas fotos desta posição para comparar.</p>
      ) : (
        <>
          <div className="photo-compare-pick">
            <select value={first?.id} onChange={(e) => setA(e.target.value)} aria-label="Foto da esquerda">
              {list.map((p) => (
                <option key={p.id} value={p.id}>
                  {brDate(p.taken_on)}
                </option>
              ))}
            </select>
            <select value={last?.id} onChange={(e) => setB(e.target.value)} aria-label="Foto da direita">
              {list.map((p) => (
                <option key={p.id} value={p.id}>
                  {brDate(p.taken_on)}
                </option>
              ))}
            </select>
          </div>
          <div className="photo-compare-grid">
            {first && <Thumb photo={first} />}
            {last && <Thumb photo={last} />}
          </div>
        </>
      )}
    </section>
  )
}
