import { useState } from 'react'
import { m, inViewOnce, riseVariants } from '../lib/motionKit'
import { useSignedImageUrl } from '../hooks/useSignedImageUrl'
import faixa from '../assets/maternidade-faixa.webp'
import { BabyPlanIcon, MomPlanIcon } from './PlanIcons'
import type { NavKey } from './PrimaryNav'

// Maternidade: a faixa desenhada (cegonha, gestante, bebê e corações) no Início, de ponta a ponta.
// Tocar abre a página com os dois cards: Mom (tira-dúvidas do bebê de 0 a 2 anos) e Baby (a gestação
// semana a semana). Cada um abre a sua página, com o conteúdo pronto (public/maternidade/*.html).

export function HomeMaternidadeBanner({ onOpen }: { onOpen: () => void }) {
  return (
    <m.section className="home-mat" aria-label="Maternidade" {...inViewOnce} variants={riseVariants}>
      <button type="button" className="home-mat-btn" onClick={onOpen} aria-label="Maternidade: Mom e Baby">
        <img className="home-mat-art" src={faixa} alt="" width={1696} height={631} decoding="async" draggable={false} />
        <span className="home-mat-label">Mom &amp; Baby</span>
      </button>
    </m.section>
  )
}

function MatCard({
  title,
  copy,
  image,
  Icon,
  onOpen,
  tone,
}: {
  title: string
  copy: string
  image: string | null
  Icon: (p: { size?: number }) => React.ReactElement
  onOpen: () => void
  tone: 'mom' | 'baby'
}) {
  return (
    <button type="button" className={`mat-card mat-card--${tone}`} onClick={onOpen}>
      <span className="mat-card-media">
        {image ? <img src={image} alt="" loading="lazy" decoding="async" /> : <Icon size={54} />}
      </span>
      <span className="mat-card-title">{title}</span>
      <span className="mat-card-copy">{copy}</span>
    </button>
  )
}

export function MaternidadePage({ onNavigate, momImage, babyImage }: { onNavigate: (k: NavKey) => void; momImage?: string | null; babyImage?: string | null }) {
  const { url: mom } = useSignedImageUrl(momImage ?? null)
  const { url: baby } = useSignedImageUrl(babyImage ?? null)
  return (
    <section className="mat-page">
      <img className="mat-page-art" src={faixa} alt="" decoding="async" draggable={false} />
      <h2 className="mat-page-title">Mom &amp; Baby</h2>
      <p className="mat-page-lead">Da gestação aos primeiros anos do bebê, com informação clara e cuidado.</p>
      <div className="mat-cards">
        <MatCard tone="mom" title="Mom" copy="Tira-dúvidas do bebê de 0 a 2 anos" image={mom} Icon={MomPlanIcon} onOpen={() => onNavigate('mom')} />
        <MatCard tone="baby" title="Baby" copy="A gestação semana a semana" image={baby} Icon={BabyPlanIcon} onOpen={() => onNavigate('baby')} />
      </div>
      <p className="mat-page-note">Conteúdo educativo. Não substitui o pré-natal nem a consulta com o pediatra.</p>
    </section>
  )
}

/** Página de Mom ou de Baby: o conteúdo pronto, ocupando a tela. */
export function MaternidadeContentPage({ kind }: { kind: 'mom' | 'baby' }) {
  const [loaded, setLoaded] = useState(false)
  const src = `${import.meta.env.BASE_URL}maternidade/${kind}.html`
  return (
    <section className={`mat-frame-wrap${loaded ? ' is-loaded' : ''}`}>
      {!loaded && <p className="home-muted">Carregando…</p>}
      <iframe
        className="mat-frame"
        src={src}
        title={kind === 'mom' ? 'Mom: tira-dúvidas do bebê' : 'Baby: a gestação semana a semana'}
        onLoad={() => setLoaded(true)}
      />
    </section>
  )
}
