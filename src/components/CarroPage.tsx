import { useEffect, useState } from 'react'
import { CarroDuvidas, CarroLivi } from './CarroLivi'
import { CARRO_BASE } from '../lib/carroConhecimento'
import { CARRO_PLAN_KEY, CARRO_PRICES, sendToCity, takeCarroRequest, useCarroHome } from '../lib/carro'
import { AddonCheckout } from './AddonCheckout'
import { CarIcon } from './CarIcon'

// Carro em Dia: as dúvidas mais comuns sobre carro, com resposta, próximos passos e quando procurar um profissional
// (base reunida a partir de guias de manutenção, segurança e documentação: lib/carroConhecimento*). A profissional não
// escreve perguntas nem respostas aqui (pedido de 2026-11-27). Quem não liberou o avulso vê só alguns títulos.

function Aviso() {
  return (
    <p className="car-aviso" role="note">
      Orientações gerais, que não substituem a avaliação presencial de um mecânico. Em freio, direção, pneu ou superaquecimento, procure um profissional. Em emergência, ligue 190 (polícia), 192 (SAMU) ou 193 (bombeiros).
    </p>
  )
}

export function CarroPage({ communityId, profileId, onOpenCity }: { communityId: string | null; profileId: string; onOpenCity: () => void }) {
  const { home, error, reload } = useCarroHome()
  const [tab, setTab] = useState<'duvidas' | 'livi'>('duvidas')
  // pedido antigo de abrir numa categoria (vindo de outra tela): só descarta; a lista já abre por assunto
  useEffect(() => {
    takeCarroRequest()
  }, [])

  if (error) {
    return (
      <p className="auth-error" role="alert">
        Não foi possível carregar o Carro em Dia agora. Confira a internet e tente de novo.
      </p>
    )
  }
  if (!home) return <p className="home-muted">Carregando…</p>
  const s = home.settings

  return (
    <section className="car-page">
      <header className="car-head">
        {s.imagem && <img className="car-hero" src={s.imagem} alt={s.imagem_alt ?? ''} loading="lazy" />}
        <h2>
          <CarIcon name={s.icone} size={30} /> {s.titulo}
        </h2>
        <p className="home-muted">{s.subtitulo}</p>
      </header>

      {!home.acesso ? (
        <div className="car-locked">
          <p className="plans-text">{s.teaser}</p>
          <ul className="car-teaser" aria-label="Algumas perguntas">
            {CARRO_BASE.slice(0, 6).map((t) => (
              <li key={t.id}>{t.pergunta}</li>
            ))}
            <li>… e mais {CARRO_BASE.length - 6} dúvidas respondidas</li>
          </ul>
          <p className="car-price">
            Carro em Dia · <strong>R$ 4,50</strong> por mês · também no Círcula Premium
          </p>
          <AddonCheckout planKey={CARRO_PLAN_KEY} communityId={communityId} prices={CARRO_PRICES} owned={false} profileId={profileId} onCheckoutStarted={() => undefined} />
          <button type="button" className="water-link" onClick={() => void reload()}>
            Já paguei: atualizar
          </button>
          <Aviso />
        </div>
      ) : (
        <>
          <div className="cty-tabs" role="tablist" aria-label="Carro em Dia">
            {(
              [
                ['duvidas', 'Dúvidas e respostas'],
                ['livi', 'Pergunte à Livi'],
              ] as const
            ).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} className={`cty-tab${tab === k ? ' cty-tab--on' : ''}`} onClick={() => setTab(k)}>
                {label}
              </button>
            ))}
          </div>
          {tab === 'duvidas' && (
            <CarroDuvidas
              onGoCity={(ids) => {
                sendToCity(ids)
                onOpenCity()
              }}
            />
          )}
          {tab === 'livi' && (
            <CarroLivi
              onGoCity={(ids) => {
                sendToCity(ids)
                onOpenCity()
              }}
            />
          )}
          <Aviso />
        </>
      )}
    </section>
  )
}
