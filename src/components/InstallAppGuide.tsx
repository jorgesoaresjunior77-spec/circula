import { useEffect, useRef, useState } from 'react'
import circulaIcon from '../assets/circula-icon.png'
import { detectInstallPlatform, markInstallGuideSeen } from '../lib/installGuide'
import type { InstallPlatform } from '../lib/installGuide'

// Explica, passo a passo, como deixar o ícone do Círcula na tela do celular
// (Android e iPhone). Aparece uma vez por aparelho depois do onboarding e
// do tour, e pode ser reaberto pelo Perfil. Só texto: nenhum botão aqui
// instala nada — quem salva o ícone é a própria pessoa, pelo menu do
// navegador.
type Tab = 'android' | 'ios'

interface Step {
  text: string
  hint?: string
}

const STEPS: Record<Tab, Step[]> = {
  android: [
    { text: 'Abra o Círcula no Chrome.' },
    { text: 'Toque nos três pontinhos (⋮), no canto de cima da tela, à direita.' },
    {
      text: 'Toque em "Adicionar à tela inicial".',
      hint: 'Em alguns celulares o nome é "Instalar app". Os dois servem.',
    },
    {
      text: 'Confirme em "Adicionar".',
      hint: 'O ícone do Círcula aparece junto dos seus outros aplicativos.',
    },
  ],
  ios: [
    {
      text: 'Abra o Círcula no Safari.',
      hint: 'Se estiver em outro navegador, copie o endereço e cole no Safari.',
    },
    {
      text: 'Toque no botão Compartilhar: o quadradinho com uma seta para cima, na barra de baixo.',
    },
    { text: 'Role a lista e toque em "Adicionar à Tela de Início".' },
    {
      text: 'Toque em "Adicionar", no canto de cima, à direita.',
      hint: 'O ícone do Círcula aparece na sua tela de início.',
    },
  ],
}

const TAB_LABEL: Record<Tab, string> = { android: 'Android', ios: 'iPhone' }

function initialTab(platform: InstallPlatform): Tab {
  return platform === 'ios' ? 'ios' : 'android'
}

interface InstallAppGuideProps {
  onClose: () => void
}

export function InstallAppGuide({ onClose }: InstallAppGuideProps) {
  const [tab, setTab] = useState<Tab>(() => initialTab(detectInstallPlatform()))
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  function handleClose() {
    markInstallGuideSeen()
    onClose()
  }

  return (
    <div className="ig-modal-backdrop" role="presentation">
      <div
        ref={dialogRef}
        className="onboarding-modal install-guide"
        role="dialog"
        aria-modal="true"
        aria-label="Colocar o Círcula na tela do celular"
      >
        <img src={circulaIcon} alt="" className="install-guide-icon" width={56} height={56} />
        <h2 className="onboarding-title">Deixe o Círcula na tela do seu celular</h2>
        <p className="onboarding-text">
          Assim você abre com um toque, como qualquer aplicativo. Escolha o seu celular:
        </p>

        <div className="install-guide-tabs" role="tablist" aria-label="Tipo de celular">
          {(Object.keys(STEPS) as Tab[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`install-tab-${key}`}
              aria-selected={tab === key}
              aria-controls={`install-panel-${key}`}
              data-autofocus={tab === key ? true : undefined}
              className={`install-guide-tab${tab === key ? ' install-guide-tab--active' : ''}`}
              onClick={() => setTab(key)}
            >
              {TAB_LABEL[key]}
            </button>
          ))}
        </div>

        <ol
          className="install-guide-steps"
          role="tabpanel"
          id={`install-panel-${tab}`}
          aria-labelledby={`install-tab-${tab}`}
        >
          {STEPS[tab].map((step) => (
            <li key={step.text} className="install-guide-step">
              <span className="install-guide-step-text">{step.text}</span>
              {step.hint && <span className="install-guide-step-hint">{step.hint}</span>}
            </li>
          ))}
        </ol>

        <div className="install-guide-actions">
          <button type="button" className="onboarding-next" onClick={handleClose}>
            Entendi
          </button>
        </div>
      </div>
    </div>
  )
}
