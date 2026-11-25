import { useState } from 'react'
import { RoboGuia } from './RoboGuia'

// A Livi recebe quem está se cadastrando. Respostas escritas pela equipe (nada gerado na hora):
// ela explica o Círcula, as vantagens e tira dúvidas do cadastro, sem tomar o lugar dos campos.

const PERGUNTAS: { id: string; pergunta: string; resposta: string }[] = [
  {
    id: 'o-que-e',
    pergunta: 'O que é o Círcula?',
    resposta: 'O Círcula é uma comunidade de bem-estar feita para mulheres: conteúdos, receitas, eventos, círculos de conversa e ferramentas para o dia a dia, tudo em um só lugar, no seu celular.',
  },
  {
    id: 'vantagens',
    pergunta: 'O que eu ganho participando?',
    resposta: 'Você acompanha a rotina da comunidade, faz parte dos círculos, recebe receitas, cardápios, dicas e eventos, e conta com ferramentas como água, IMC, finanças e muito mais. Tudo pensado com carinho para você.',
  },
  {
    id: 'cadastro',
    pergunta: 'Como preencho o cadastro?',
    resposta: 'É rápido: seu nome, telefone, e-mail e uma senha. Depois, é só aceitar os termos e criar o acesso. Se o e-mail pedir confirmação, é só abrir a mensagem que enviamos.',
  },
  {
    id: 'dados',
    pergunta: 'Meus dados ficam seguros?',
    resposta: 'Sim. Seus dados são usados só para o funcionamento do Círcula, e o que é pessoal, como as suas finanças, é visível apenas para você. Os Termos e a Privacidade explicam tudo.',
  },
]

export function LiviCadastro() {
  const [aberta, setAberta] = useState<string | null>(null)
  const atual = PERGUNTAS.find((p) => p.id === aberta)
  return (
    <aside className="livi-cadastro" aria-label="Livi, assistente do Círcula">
      <div className="livi-cadastro-topo">
        <RoboGuia cena="feliz" tamanho={56} mudo />
        <p className="livi-cadastro-fala">
          <strong>Oi, eu sou a Livi!</strong> Vou te acompanhar por aqui. Se tiver qualquer dúvida, é só tocar:
        </p>
      </div>
      <div className="livi-cadastro-chips" role="group" aria-label="Perguntas para a Livi">
        {PERGUNTAS.map((p) => (
          <button key={p.id} type="button" className={`livi-chip${aberta === p.id ? ' livi-chip--on' : ''}`} aria-pressed={aberta === p.id} onClick={() => setAberta(aberta === p.id ? null : p.id)}>
            {p.pergunta}
          </button>
        ))}
      </div>
      {atual && (
        <p className="livi-cadastro-resposta" role="status">
          {atual.resposta}
        </p>
      )}
    </aside>
  )
}
