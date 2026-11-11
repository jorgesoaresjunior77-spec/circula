import { Component, lazy, Suspense, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { HabitWoman } from './HabitWoman'
import { ImcAvatar } from './ImcAvatar'
import { detectBottleEnv, shouldUse3D } from '../lib/waterBottle3d'
import type { ImcBand } from '../lib/imc'

// Escolhe a ilustração da boneca: 3D animada (Three.js) quando o aparelho dá
// conta e a pessoa não pediu menos movimento; senão, a ilustração em SVG de
// sempre. O 3D é um arquivo separado, baixado só nestas páginas; enquanto
// baixa, se falhar ou se o WebGL cair, o SVG fica no lugar. Mesmo critério da
// garrafa de água (ver lib/waterBottle3d).

const Doll3D = lazy(() => import('./Doll3D'))

class Doll3DBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function useDoll3D(): boolean {
  return useMemo(() => shouldUse3D(detectBottleEnv()), [])
}

/** Antes de Tudo: a mulher do ritual, que ganha cor e adereços com os hábitos do dia. */
export function HabitWomanView({ done, checked }: { done: number; checked: ReadonlySet<string> }) {
  const use3D = useDoll3D()
  const [failed, setFailed] = useState(false)
  const svg = <HabitWoman done={done} checked={checked} />
  if (!use3D || failed) return svg
  return (
    <Doll3DBoundary fallback={svg}>
      <Suspense fallback={svg}>
        <Doll3D
          mode="habits"
          done={done}
          checked={checked}
          ariaLabel={`Ilustração: ${done} de 7 hábitos de hoje concluídos`}
          onFail={() => setFailed(true)}
        />
      </Suspense>
    </Doll3DBoundary>
  )
}

/** IMC: silhueta ilustrativa, com a cintura e o quadril acompanhando a faixa. */
export function ImcAvatarView({ band }: { band: ImcBand }) {
  const use3D = useDoll3D()
  const [failed, setFailed] = useState(false)
  const svg = <ImcAvatar band={band} />
  if (!use3D || failed) return svg
  return (
    <Doll3DBoundary fallback={svg}>
      <Suspense fallback={svg}>
        <Doll3D mode="imc" band={band} ariaLabel="Ilustração feminina representativa" onFail={() => setFailed(true)} />
      </Suspense>
    </Doll3DBoundary>
  )
}
