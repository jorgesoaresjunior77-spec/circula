import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useRobo } from '../hooks/useRobo'
import { webglDisponivel } from '../lib/scene3d'

const Robo3D = lazy(() => import('./Robo3D'))

// Robô mascote do Círcula (arte gerada com IA, por decisão do projeto). As imagens já têm
// rosto e expressão: aqui só se troca a cena. O texto do balão é o conteúdo; o robô é
// decorativo (aria-hidden).

export type RoboCena =
  | 'neutro'
  | 'neutro-piscando'
  | 'feliz'
  | 'piscadinha'
  | 'aponta-direita'
  | 'aponta-esquerda'
  | 'aponta-cima'
  | 'aponta-baixo'
  | 'pensando'
  | 'acena'
  | 'boas-vindas'
  | 'surpresa'
  | 'oops'
  | 'apresenta'
  | 'pedindo'
  | 'comemora'
  | 'coracao'

/** Cena -> arquivo em public/robo. Algumas cenas reaproveitam a imagem de outra (aponta-esquerda é a direita espelhada). */
const ARQUIVO: Record<RoboCena, { arquivo: string; espelho?: boolean }> = {
  neutro: { arquivo: 'neutro' },
  'neutro-piscando': { arquivo: 'neutro-piscando' },
  feliz: { arquivo: 'feliz' },
  piscadinha: { arquivo: 'piscadinha' },
  'aponta-direita': { arquivo: 'aponta-direita' },
  'aponta-esquerda': { arquivo: 'aponta-direita', espelho: true },
  'aponta-cima': { arquivo: 'aponta-cima' },
  'aponta-baixo': { arquivo: 'aponta-baixo' },
  pensando: { arquivo: 'pensando' },
  acena: { arquivo: 'acena' },
  'boas-vindas': { arquivo: 'boas-vindas' },
  surpresa: { arquivo: 'surpresa' },
  oops: { arquivo: 'oops' },
  apresenta: { arquivo: 'feliz' },
  pedindo: { arquivo: 'pedindo' },
  comemora: { arquivo: 'comemora' },
  coracao: { arquivo: 'coracao' },
}

export function roboUrl(cena: RoboCena): string {
  return `${import.meta.env.BASE_URL}robo/${ARQUIVO[cena].arquivo}.webp`
}

const jaPre = new Set<string>()
/** Pré-carrega as imagens das cenas (fica no cache do navegador). */
export function precarregarRobo(cenas: RoboCena[]) {
  if (typeof Image === 'undefined') return
  for (const c of cenas) {
    const url = roboUrl(c)
    if (jaPre.has(url)) continue
    jaPre.add(url)
    const img = new Image()
    img.decoding = 'async'
    img.src = url
  }
}

interface Props {
  cena: RoboCena
  /** Largura em px (a altura segue a proporção 9:16, reservada: sem salto de layout). */
  tamanho?: number
  /** Sem halo e ondas de som (versão compacta, sem falas automáticas). */
  mudo?: boolean
  /** Cenas extras para pré-carregar. */
  precarregar?: RoboCena[]
  className?: string
}

export function RoboGuia({ cena, tamanho = 120, mudo = false, precarregar = [], className }: Props) {
  const { falas } = useRobo()
  const falasInicial = useRef(falas)
  const [piscando, setPiscando] = useState(false)
  const [camadas, setCamadas] = useState(() => {
    const a = ARQUIVO[cena]
    return { url: [roboUrl(cena), ''], espelho: [!!a.espelho, false], ativa: 0 }
  })

  // Piscar sozinho: só na cena neutra (a imagem "feliz" já tem os olhos fechados em sorriso).
  useEffect(() => {
    if (cena !== 'neutro') return
    let volta = 0
    const id = window.setInterval(() => {
      setPiscando(true)
      volta = window.setTimeout(() => setPiscando(false), 120)
    }, 3200)
    return () => {
      window.clearInterval(id)
      window.clearTimeout(volta)
      setPiscando(false)
    }
  }, [cena])

  const visual: RoboCena = piscando && cena === 'neutro' ? 'neutro-piscando' : cena

  // Crossfade de ~120 ms entre duas imagens empilhadas.
  useEffect(() => {
    const info = ARQUIVO[visual]
    const url = roboUrl(visual)
    setCamadas((prev) => {
      const atual = prev.ativa
      if (prev.url[atual] === url && prev.espelho[atual] === !!info.espelho) return prev
      const outra = 1 - atual
      const nova = { url: [...prev.url], espelho: [...prev.espelho], ativa: outra }
      nova.url[outra] = url
      nova.espelho[outra] = !!info.espelho
      return nova
    })
  }, [visual])

  useEffect(() => {
    precarregarRobo(['neutro', 'neutro-piscando', cena, ...precarregar])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cena])

  const falou = !mudo && falas !== falasInicial.current
  // 3D: a Livi modelada assume o lugar das imagens quando o aparelho tem WebGL; sem ele, ficam as imagens.
  const [gl3d, setGl3d] = useState<'tentando' | 'pronto' | 'falhou'>(() => (webglDisponivel() ? 'tentando' : 'falhou'))

  return (
    <span className={`robo-guia${className ? ` ${className}` : ''}`} style={{ width: tamanho }} aria-hidden="true" data-cena={cena} data-gl={gl3d}>
      {falou && <span key={`h${falas}`} className="robo-guia-halo" />}
      <span className="robo-guia-flutua">
        {gl3d !== 'falhou' && (
          <Suspense fallback={null}>
            <Robo3D cena={cena} onReady={() => setGl3d('pronto')} onFail={() => setGl3d('falhou')} />
          </Suspense>
        )}
        {[0, 1].map((i) =>
          camadas.url[i] ? (
            <img
              key={i}
              className={`robo-guia-img${camadas.espelho[i] ? ' robo-guia-img--espelho' : ''}`}
              data-on={camadas.ativa === i ? 'true' : 'false'}
              src={camadas.url[i]}
              alt=""
              decoding="async"
              draggable={false}
            />
          ) : null,
        )}
      </span>
      {falou && (
        <span key={`o${falas}`} className="robo-guia-ondas">
          <span />
          <span />
          <span />
        </span>
      )}
    </span>
  )
}
