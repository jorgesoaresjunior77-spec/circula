// Guia "colocar o Círcula na tela do celular": qual celular a pessoa usa,
// se o Círcula já está salvo na tela (aberto como app) e se ela já viu o
// guia neste aparelho. A marca de "já viu" fica só no aparelho
// (localStorage) porque salvar o ícone é uma coisa de cada celular, não da
// conta; sem localStorage (navegação privada) o guia só reaparece depois.

export type InstallPlatform = 'ios' | 'android' | 'other'

const SEEN_KEY = 'circula:install-guide-seen'

export function detectInstallPlatform(
  userAgent: string = navigator.userAgent,
  maxTouchPoints: number = navigator.maxTouchPoints ?? 0,
): InstallPlatform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios'
  // iPadOS 13+ se apresenta como Mac, mas tem tela de toque.
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return 'ios'
  if (/Android/i.test(userAgent)) return 'android'
  return 'other'
}

export function isRunningAsInstalledApp(): boolean {
  try {
    if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  } catch {
    // matchMedia indisponível: segue para a checagem do iOS
  }
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function hasSeenInstallGuide(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export function markInstallGuideSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    // sem storage: o guia pode reaparecer, sem prejuízo
  }
}

/** Mostra o guia sozinho só em celular (Android/iPhone), fora do app já instalado e uma vez por aparelho. */
export function shouldAutoShowInstallGuide(): boolean {
  return detectInstallPlatform() !== 'other' && !isRunningAsInstalledApp() && !hasSeenInstallGuide()
}
