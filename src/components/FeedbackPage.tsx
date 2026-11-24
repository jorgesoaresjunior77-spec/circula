import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'

// "Encontrou algum problema? Me notifique": a participante escreve o que está errado ou uma
// sugestão. A profissional recebe no sino e vê a lista no Painel.

type Tipo = 'problema' | 'sugestao'

export function FeedbackPage({ onDone }: { onDone?: () => void }) {
  const [tipo, setTipo] = useState<Tipo>('problema')
  const [texto, setTexto] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (texto.trim().length < 5) return setError('Conte um pouco mais, com pelo menos 5 letras.')
    setBusy(true)
    const { error: rpcError } = await supabase.rpc('feedback_send', { p_tipo: tipo, p_texto: texto.trim() })
    setBusy(false)
    if (rpcError) return setError('Não foi possível enviar agora. Tente de novo em instantes.')
    setSent(true)
    setTexto('')
  }

  if (sent) {
    return (
      <section className="feedback-page">
        <h2>Recebemos o seu aviso</h2>
        <p className="home-muted">Obrigada por ajudar a cuidar do Círcula. A nutricionista foi avisada e vai olhar com carinho.</p>
        <div className="cty-actions">
          <button type="button" className="water-primary" onClick={() => setSent(false)}>
            Enviar outro aviso
          </button>
          {onDone && (
            <button type="button" className="cty-btn" onClick={onDone}>
              Voltar ao início
            </button>
          )}
        </div>
      </section>
    )
  }

  return (
    <section className="feedback-page">
      <h2>Encontrou algum problema?</h2>
      <p className="home-muted">Conte o que está acontecendo de errado ou deixe uma sugestão. A nutricionista recebe o seu aviso na hora.</p>
      <form className="feedback-form" onSubmit={(e) => void submit(e)}>
        <div className="cty-chips" role="radiogroup" aria-label="Tipo de aviso">
          <button type="button" role="radio" aria-checked={tipo === 'problema'} className={`cty-chip${tipo === 'problema' ? ' cty-chip--on' : ''}`} onClick={() => setTipo('problema')}>
            Algo deu errado
          </button>
          <button type="button" role="radio" aria-checked={tipo === 'sugestao'} className={`cty-chip${tipo === 'sugestao' ? ' cty-chip--on' : ''}`} onClick={() => setTipo('sugestao')}>
            Tenho uma sugestão
          </button>
        </div>
        <label className="cty-field">
          <span className="cty-label">{tipo === 'problema' ? 'O que está acontecendo?' : 'Qual é a sua sugestão?'}</span>
          <textarea
            rows={7}
            maxLength={2000}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={tipo === 'problema' ? 'Ex.: ao tocar em Salvar na cidade, a tela fica parada. Aconteceu no celular, na tela Na minha cidade.' : 'Ex.: seria bom ter um lembrete de água a cada duas horas.'}
          />
        </label>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="water-primary" disabled={busy || texto.trim().length < 5}>
          {busy ? 'Enviando…' : 'Enviar'}
        </button>
      </form>
    </section>
  )
}
