import { useSyncExternalStore } from 'react'
import { gravarMudo, lerMudo, liberarAudio, tocarSom } from '../lib/roboSom'
import type { RoboSom } from '../lib/roboSom'
import type { RoboCena } from '../components/RoboGuia'

// Estado único do robô (mudo e "falas"), compartilhado por tour, Ajuda e Planos:
// um só botão de mudo vale para todos. Sem provider: é um pequeno store de módulo.

interface Estado {
  mudo: boolean
  /** Sobe a cada vez que o robô toca um som (dispara o halo e as ondas). */
  falas: number
  /** Última cena pedida em falar() (quem quiser pode usar; o RoboGuia recebe a cena por prop). */
  cena: RoboCena | null
}

let estado: Estado = { mudo: lerMudo(), falas: 0, cena: null }
const ouvintes = new Set<() => void>()
let desbloqueioInstalado = false

function mudar(parcial: Partial<Estado>) {
  estado = { ...estado, ...parcial }
  ouvintes.forEach((o) => o())
}

function instalarDesbloqueio() {
  if (desbloqueioInstalado || typeof window === 'undefined') return
  desbloqueioInstalado = true
  // iOS: o áudio só liga dentro de um toque. No primeiro toque em qualquer lugar, deixa pronto.
  window.addEventListener('pointerdown', liberarAudio, { once: true, passive: true })
}

function assinar(ouvinte: () => void) {
  instalarDesbloqueio()
  ouvintes.add(ouvinte)
  return () => ouvintes.delete(ouvinte)
}

export function falar(cena?: RoboCena, som?: RoboSom) {
  const tocou = som ? tocarSom(som, estado.mudo) : false
  mudar({ cena: cena ?? estado.cena, falas: tocou ? estado.falas + 1 : estado.falas })
}

export function alternarMudo() {
  const mudo = !estado.mudo
  gravarMudo(mudo)
  mudar({ mudo })
}

/** Só para testes: volta o estado ao início. */
export function reiniciarRoboParaTeste() {
  estado = { mudo: lerMudo(), falas: 0, cena: null }
  ouvintes.forEach((o) => o())
}

export function useRobo() {
  const e = useSyncExternalStore(assinar, () => estado, () => estado)
  return { mudo: e.mudo, falas: e.falas, cena: e.cena, falar, alternarMudo }
}
