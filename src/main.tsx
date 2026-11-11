import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { MotionRoot } from './lib/motionKit'
import { startUpdateWatcher } from './lib/appUpdate'

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
// Só no app publicado: confere se há versão nova e recarrega sozinho.
if (import.meta.env.PROD) startUpdateWatcher()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionRoot>
      <App />
    </MotionRoot>
  </StrictMode>,
)
