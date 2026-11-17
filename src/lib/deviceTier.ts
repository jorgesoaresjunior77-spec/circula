// Aparelhos mais fracos (pouca memória ou poucos núcleos) desenham o 3D com
// menos pixels: quase não muda a aparência e poupa bateria e travadas.
export function maxPixelRatio(): number {
  const nav = typeof navigator === 'undefined' ? null : (navigator as Navigator & { deviceMemory?: number })
  const weak = !!nav && ((nav.deviceMemory ?? 8) <= 4 || (nav.hardwareConcurrency ?? 8) <= 4)
  return weak ? 1.5 : 2
}
