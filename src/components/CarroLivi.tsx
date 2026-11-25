import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { AVISO_PROFISSIONAL, CARRO_BASE, SERVICOS_AUTOMOTIVOS, TEMAS, buscarNaBase } from '../lib/carroConhecimento'
import type { CarroTopico } from '../lib/carroConhecimento'
import { RoboGuia } from './RoboGuia'

// "Pergunte à Livi": respostas já prontas da base de orientação (nada é inventado na hora).
// Sempre diz quando é preciso um profissional e leva aos serviços reais cadastrados em "Na minha cidade".

type CidadeCat = { id: string; nome: string }

function useCategoriasDaCidade() {
  const [cats, setCats] = useState<CidadeCat[]>([])
  useEffect(() => {
    let cancelled = false
    void supabase
      .from('city_categories')
      .select('id, nome')
      .in('nome', [...SERVICOS_AUTOMOTIVOS])
      .eq('status', 'ativa')
      .then(({ data }) => {
        if (!cancelled) setCats((data ?? []) as CidadeCat[])
      })
    return () => {
      cancelled = true
    }
  }, [])
  return cats
}

function Topico({ t, cats, onGoCity }: { t: CarroTopico; cats: CidadeCat[]; onGoCity: (ids: string[]) => void }) {
  const ids = (t.servicos ?? []).map((n) => cats.find((c) => c.nome === n)).filter((c): c is CidadeCat => !!c)
  return (
    <article className="car-livi-card">
      <h4>{t.pergunta}</h4>
      <p>{t.resposta}</p>
      {t.causas && (
        <>
          <strong>Possíveis causas</strong>
          <ul>
            {t.causas.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </>
      )}
      <strong>Próximos passos</strong>
      <ol>
        {t.passos.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ol>
      <p className={`car-livi-aviso car-livi-aviso--${t.profissional}`}>{AVISO_PROFISSIONAL[t.profissional]}</p>
      {ids.length > 0 && (
        <div className="car-livi-servicos">
          <span>Encontrar na minha cidade:</span>
          {ids.map((c) => (
            <button key={c.id} type="button" className="livi-chip" onClick={() => onGoCity([c.id])}>
              {c.nome}
            </button>
          ))}
        </div>
      )}
    </article>
  )
}

export function CarroLivi({ onGoCity }: { onGoCity: (ids: string[]) => void }) {
  const cats = useCategoriasDaCidade()
  const [texto, setTexto] = useState('')
  const [achados, setAchados] = useState<CarroTopico[] | null>(null)
  const [tema, setTema] = useState<string | null>(null)

  function perguntar(ev: FormEvent) {
    ev.preventDefault()
    setTema(null)
    setAchados(buscarNaBase(texto))
  }

  const doTema = tema ? CARRO_BASE.filter((t) => t.tema === tema) : []

  return (
    <div className="car-livi">
      <div className="livi-cadastro-topo">
        <RoboGuia cena="neutro" tamanho={56} mudo />
        <p className="livi-cadastro-fala">
          <strong>Oi, eu sou a Livi!</strong> Conte o que está acontecendo com o seu carro e eu te ajudo a entender o que pode ser e o que fazer.
        </p>
      </div>
      <form className="fin-campo" onSubmit={perguntar}>
        <span>Sua dúvida</span>
        <input type="text" maxLength={200} value={texto} onChange={(x) => setTexto(x.target.value)} placeholder="Ex.: o carro não liga e faz tec tec" />
        <button type="submit" className="water-primary">
          Perguntar à Livi
        </button>
      </form>

      {achados && achados.length === 0 && (
        <p className="home-muted" role="status">
          Não encontrei isso na minha base. Tente com outras palavras, escolha um assunto abaixo, ou use "Perguntar" para enviar à nossa equipe.
        </p>
      )}
      {achados && achados.map((t) => <Topico key={t.id} t={t} cats={cats} onGoCity={onGoCity} />)}

      <h3 className="fin-subtitulo">Assuntos</h3>
      <div className="livi-cadastro-chips" role="group" aria-label="Assuntos do Carro em Dia">
        {TEMAS.map((t) => (
          <button
            key={t}
            type="button"
            className={`livi-chip${tema === t ? ' livi-chip--on' : ''}`}
            aria-pressed={tema === t}
            onClick={() => {
              setAchados(null)
              setTema(tema === t ? null : t)
            }}
          >
            {t}
          </button>
        ))}
      </div>
      {doTema.map((t) => (
        <Topico key={t.id} t={t} cats={cats} onGoCity={onGoCity} />
      ))}

      <h3 className="fin-subtitulo">Encontre ajuda perto de você</h3>
      <p className="home-muted">Profissionais e lugares cadastrados no Círcula, por categoria. Mostramos só quem está realmente cadastrado.</p>
      <div className="livi-cadastro-chips">
        {SERVICOS_AUTOMOTIVOS.map((nome) => {
          const c = cats.find((x) => x.nome === nome)
          if (!c) return null
          return (
            <button key={nome} type="button" className="livi-chip" onClick={() => onGoCity([c.id])}>
              {nome}
            </button>
          )
        })}
      </div>
    </div>
  )
}

