import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { MotionRoot } from './lib/motionKit'
import { startUpdateWatcher } from './lib/appUpdate'
import { initTheme } from './hooks/useTheme'

// Sem zoom por pinça (pedido do produto). O iPhone ignora user-scalable=no,
// então o gesto é barrado aqui também. O toque duplo já não dá zoom por causa
// do touch-action do body.
// O leitor da revista tem zoom próprio (botão), que não depende disso.
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false })
}
document.addEventListener(
  'touchmove',
  (e) => {
    if (e.touches.length > 1) e.preventDefault()
  },
  { passive: false },
)
initTheme()
// Trava em pe onde o navegador deixa (Android/PWA instalado). No iPhone, o aviso do index.html cobre a tela deitada.
try {
  void (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.('portrait').catch(() => {})
} catch {
  /* sem suporte: segue sem travar */
}
// Só no app publicado: confere se há versão nova e recarrega sozinho.
if (import.meta.env.PROD) startUpdateWatcher()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionRoot>
      <App />
    </MotionRoot>
  </StrictMode>,
)
