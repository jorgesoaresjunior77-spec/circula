import { Component, lazy, Suspense, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { WaterBottle } from './WaterBottle'
import { detectBottleEnv, shouldUse3D } from '../lib/waterBottle3d'

// Escolhe a garrafa da página de Água: 3D (Three.js) quando o aparelho dá conta
// e a pessoa não pediu menos movimento; senão, a garrafa SVG de sempre. O 3D é
// um arquivo separado, baixado só aqui; enquanto baixa (ou se falhar, ou se o
// WebGL cair), a garrafa SVG fica no lugar. O nível é o mesmo dado real nas duas.

const WaterBottle3D = lazy(() => import('./WaterBottle3D'))

interface Props {
  progress: number
  celebrating?: boolean
}

/** Se o arquivo 3D não carregar (sem internet, por exemplo), cai no fallback. */
class Bottle3DBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export function WaterBottleView({ progress, celebrating = false }: Props) {
  const use3D = useMemo(() => shouldUse3D(detectBottleEnv()), [])
  const [failed, setFailed] = useState(false)
  const svg = <WaterBottle progress={progress} celebrating={celebrating} />

  if (!use3D || failed) return svg
  return (
    <Bottle3DBoundary fallback={svg}>
      <Suspense fallback={svg}>
        <WaterBottle3D progress={progress} celebrating={celebrating} onFail={() => setFailed(true)} />
      </Suspense>
    </Bottle3DBoundary>
  )
}
