import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  HEALTH_NOTE,
  MEETUP_ACTIVITIES,
  MEETUP_SAFETY_NOTE,
  PRICE_RANGES,
  findSimilarListing,
  healthTextProblem,
  instagramHandle,
} from '../lib/city'
import type { CityCategory, CityListing, CityListingType, CityTag } from '../lib/city'
import { findBlockedTerm, MODERATION_MESSAGE } from '../lib/moderation'
import { uploadCityPhoto } from '../hooks/useCity'
import type { ListingInput, Result } from '../hooks/useCity'
import { CityCategoryField } from './CityCategoryField'

// Um único formulário para os 4 tipos de cadastro (lugar, profissional,
// evento, convite). Só o que faz sentido para cada tipo aparece na tela.

interface CityListingFormProps {
  tipo: CityListingType
  uid: string
  cityName: string
  editing: CityListing | null
  listings: CityListing[]
  categories: CityCategory[]
  tags: CityTag[]
  onCreateCategory: (nome: string, grupo: string) => Promise<{ error: string | null; id: string | null; existing: boolean }>
  onSave: (input: ListingInput) => Promise<Result>
  onAlsoRecommend: (listing: CityListing) => void
  onClose: () => void
}

function toDateInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function toTimeInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

const TITLE_LABEL: Record<CityListingType, string> = {
  lugar: 'Nome do lugar',
  profissional: 'Nome da profissional ou do negócio',
  evento: 'Título do evento',
  convite: 'Título do convite',
}

export function CityListingForm({
  tipo,
  uid,
  cityName,
  editing,
  listings,
  categories,
  tags,
  onCreateCategory,
  onSave,
  onAlsoRecommend,
  onClose,
}: CityListingFormProps) {
  const [titulo, setTitulo] = useState(editing?.titulo ?? '')
  const [categoriaId, setCategoriaId] = useState<string | null>(editing?.categoria_id ?? null)
  const [descricao, setDescricao] = useState(editing?.descricao ?? '')
  const [bairro, setBairro] = useState(editing?.bairro ?? '')
  const [endereco, setEndereco] = useState(editing?.endereco ?? '')
  const [horario, setHorario] = useState(editing?.horario ?? '')
  const [contato, setContato] = useState(editing?.contato ?? '')
  const [instagram, setInstagram] = useState(editing?.instagram ?? '')
  const [faixa, setFaixa] = useState<CityListing['faixa_preco']>(editing?.faixa_preco ?? null)
  const [foto, setFoto] = useState<string | null>(editing?.foto ?? null)
  const [proprio, setProprio] = useState(editing?.e_proprio_negocio ?? false)
  const [todaCidade, setTodaCidade] = useState(editing?.atende_toda_cidade ?? false)
  const [data, setData] = useState(toDateInput(editing?.starts_at ?? null))
  const [hora, setHora] = useState(toTimeInput(editing?.starts_at ?? null))
  const [localNome, setLocalNome] = useState(editing?.local_nome ?? '')
  const [valorTipo, setValorTipo] = useState<'gratis' | 'pago'>(editing?.valor && editing.valor.toLowerCase() !== 'grátis' ? 'pago' : 'gratis')
  const [valor, setValor] = useState(editing?.valor && editing.valor.toLowerCase() !== 'grátis' ? editing.valor : '')
  const [link, setLink] = useState(editing?.link ?? '')
  const [atividade, setAtividade] = useState(editing?.atividade ?? '')
  const [vagas, setVagas] = useState(editing?.vagas ? String(editing.vagas) : '')
  const [nivel, setNivel] = useState<'iniciante' | 'todas'>(editing?.nivel ?? 'todas')
  const [tagIds, setTagIds] = useState<string[]>(editing?.tags ?? [])
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const category = categories.find((c) => c.id === categoriaId) ?? null
  const isHealth = category?.grupo === 'saude'
  const showHealthNote = category?.grupo === 'saude' || category?.grupo === 'beleza'
  const needsCategory = tipo !== 'convite'
  const isPlaceOrPro = tipo === 'lugar' || tipo === 'profissional'

  const visibleTags = useMemo(
    () => tags.filter((t) => t.tipo !== 'alimentacao' || category?.grupo === 'comer'),
    [tags, category],
  )
  const duplicate = useMemo(
    () => (!editing && isPlaceOrPro ? findSimilarListing(titulo, tipo, listings) : null),
    [editing, isPlaceOrPro, titulo, tipo, listings],
  )

  function toggleTag(id: string) {
    setTagIds((list) => (list.includes(id) ? list.filter((t) => t !== id) : [...list, id]))
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return
    setError(null)
    setUploading(true)
    const r = await uploadCityPhoto(uid, file)
    setUploading(false)
    if (r.error) setError(r.error)
    else setFoto(r.url)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (titulo.trim().length < 2) return setError('Escreva o título.')
    if (needsCategory && !categoriaId) return setError('Escolha a categoria.')
    let startsAt: string | null = null
    if (tipo === 'evento' || tipo === 'convite') {
      if (!data || !hora) return setError('Informe a data e o horário.')
      startsAt = new Date(`${data}T${hora}`).toISOString()
      if (!localNome.trim()) return setError(tipo === 'convite' ? 'Informe o ponto de encontro (um local público).' : 'Informe o local.')
    }
    if (tipo === 'convite') {
      if (!atividade) return setError('Escolha o tipo de atividade.')
      const n = Number(vagas)
      if (!Number.isInteger(n) || n < 1 || n > 500) return setError('Informe o número de vagas (de 1 a 500).')
    }
    const text = [titulo, descricao, bairro, localNome, valor, horario].join(' ')
    if (findBlockedTerm(text)) return setError(MODERATION_MESSAGE)
    if (isHealth) {
      const problem = healthTextProblem(text)
      if (problem) return setError(problem)
    }
    if (link.trim() && !/^https?:\/\//i.test(link.trim()) && !/^[\w.+-]+@[\w-]+\.[\w.]+$/.test(link.trim()) && !/[\d()+\s-]{8,}/.test(link.trim())) {
      return setError('Em "link ou contato", coloque um endereço (https://…), um e-mail ou um telefone.')
    }
    const nullable = (v: string) => (v.trim() ? v.trim() : null)
    const input: ListingInput = {
      tipo,
      categoria_id: needsCategory ? categoriaId : null,
      titulo: titulo.trim(),
      descricao: nullable(descricao),
      bairro: tipo === 'profissional' && todaCidade ? null : nullable(bairro),
      endereco: tipo === 'lugar' ? nullable(endereco) : null,
      contato: tipo === 'evento' || tipo === 'convite' ? null : nullable(contato),
      instagram: isPlaceOrPro ? nullable(instagramHandle(instagram) ?? '') : null,
      faixa_preco: isPlaceOrPro ? faixa : null,
      horario: tipo === 'lugar' ? nullable(horario) : null,
      foto: tipo === 'convite' ? null : foto,
      e_proprio_negocio: isPlaceOrPro ? proprio : false,
      atende_toda_cidade: tipo === 'profissional' ? todaCidade : false,
      starts_at: startsAt,
      local_nome: tipo === 'evento' || tipo === 'convite' ? nullable(localNome) : null,
      valor: tipo === 'evento' ? (valorTipo === 'gratis' ? 'Grátis' : nullable(valor)) : null,
      link: tipo === 'evento' ? nullable(link) : null,
      atividade: tipo === 'convite' ? atividade : null,
      vagas: tipo === 'convite' ? Number(vagas) : null,
      nivel: tipo === 'convite' ? nivel : null,
      tags: isPlaceOrPro ? tagIds : [],
    }
    setBusy(true)
    const r = await onSave(input)
    setBusy(false)
    if (r.error) setError(r.error)
    else onClose()
  }

  const heading = editing ? 'Editar cadastro' : tipo === 'lugar' ? 'Indicar um lugar' : tipo === 'profissional' ? 'Indicar ou divulgar uma profissional' : tipo === 'evento' ? 'Cadastrar um evento' : 'Convidar para algo'

  return (
    <form className="cty-form" onSubmit={(e) => void submit(e)}>
      <h3 className="cty-form-title">
        {heading} <span className="cty-form-city">· {cityName}</span>
      </h3>

      {tipo === 'convite' && (
        <label className="cty-field">
          <span className="cty-label">Tipo de atividade</span>
          <select value={atividade} onChange={(e) => setAtividade(e.target.value)}>
            <option value="">Escolha</option>
            {MEETUP_ACTIVITIES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="cty-field">
        <span className="cty-label">{tipo === 'convite' ? 'Título (ex.: Caminhada na orla)' : TITLE_LABEL[tipo]}</span>
        <input type="text" maxLength={120} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      </label>
      {duplicate && (
        <p className="cty-didyoumean">
          Já existe um cadastro parecido: <strong>{duplicate.titulo}</strong>. Em vez de criar outro,{' '}
          <button type="button" className="cty-link" onClick={() => { onAlsoRecommend(duplicate); onClose() }}>
            toque em “Também indico”
          </button>{' '}
          nele.
        </p>
      )}

      {needsCategory && <CityCategoryField categories={categories} value={categoriaId} onChange={setCategoriaId} onCreate={onCreateCategory} />}
      {showHealthNote && <p className="cty-note">{HEALTH_NOTE}</p>}
      {isHealth && <p className="cty-note">Em Saúde, não escreva promessa de cura, “antes e depois” nem preço de procedimento.</p>}

      {(tipo === 'evento' || tipo === 'convite') && (
        <div className="cty-row">
          <label className="cty-field">
            <span className="cty-label">Data</span>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <label className="cty-field">
            <span className="cty-label">Horário</span>
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </label>
        </div>
      )}

      {(tipo === 'evento' || tipo === 'convite') && (
        <label className="cty-field">
          <span className="cty-label">{tipo === 'convite' ? 'Ponto de encontro (sempre um local público)' : 'Local (nome do lugar)'}</span>
          <input type="text" maxLength={160} value={localNome} onChange={(e) => setLocalNome(e.target.value)} placeholder={tipo === 'convite' ? 'Ex.: Praça central, em frente ao coreto' : 'Ex.: Teatro Municipal'} />
        </label>
      )}
      {tipo === 'convite' && <p className="cty-note">{MEETUP_SAFETY_NOTE}</p>}

      {tipo === 'convite' && (
        <div className="cty-row">
          <label className="cty-field">
            <span className="cty-label">Vagas</span>
            <input type="number" min={1} max={500} inputMode="numeric" value={vagas} onChange={(e) => setVagas(e.target.value)} />
          </label>
          <label className="cty-field">
            <span className="cty-label">Nível</span>
            <select value={nivel} onChange={(e) => setNivel(e.target.value as 'iniciante' | 'todas')}>
              <option value="todas">Todas</option>
              <option value="iniciante">Iniciante</option>
            </select>
          </label>
        </div>
      )}

      {tipo === 'evento' && (
        <>
          <div className="cty-row">
            <label className="cty-field">
              <span className="cty-label">Valor</span>
              <select value={valorTipo} onChange={(e) => setValorTipo(e.target.value as 'gratis' | 'pago')}>
                <option value="gratis">Grátis</option>
                <option value="pago">Pago</option>
              </select>
            </label>
            {valorTipo === 'pago' && (
              <label className="cty-field">
                <span className="cty-label">Quanto</span>
                <input type="text" maxLength={60} value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ex.: R$ 30" />
              </label>
            )}
          </div>
          <label className="cty-field">
            <span className="cty-label">Link ou contato (opcional)</span>
            <input type="text" maxLength={300} value={link} onChange={(e) => setLink(e.target.value)} />
          </label>
        </>
      )}

      {isPlaceOrPro && (
        <>
          {tipo === 'profissional' && (
            <label className="cty-check">
              <input type="checkbox" checked={todaCidade} onChange={(e) => setTodaCidade(e.target.checked)} />
              <span>Atende em toda a cidade</span>
            </label>
          )}
          {!(tipo === 'profissional' && todaCidade) && (
            <label className="cty-field">
              <span className="cty-label">Bairro</span>
              <input type="text" maxLength={80} value={bairro} onChange={(e) => setBairro(e.target.value)} />
            </label>
          )}
          {tipo === 'lugar' && (
            <>
              <label className="cty-field">
                <span className="cty-label">Endereço (só de estabelecimento comercial, nunca de residência)</span>
                <input type="text" maxLength={200} value={endereco} onChange={(e) => setEndereco(e.target.value)} />
              </label>
              <label className="cty-field">
                <span className="cty-label">Horário de funcionamento</span>
                <input type="text" maxLength={120} value={horario} onChange={(e) => setHorario(e.target.value)} placeholder="Ex.: seg a sex, 8h às 18h" />
              </label>
            </>
          )}
          <label className="cty-field">
            <span className="cty-label">Contato (opcional — só aparece se você preencher)</span>
            <input type="text" maxLength={120} value={contato} onChange={(e) => setContato(e.target.value)} />
          </label>
          <label className="cty-field">
            <span className="cty-label">Instagram (opcional)</span>
            <input type="text" maxLength={80} value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@usuario" />
          </label>

          <div className="cty-field">
            <span className="cty-label">Faixa de preço (opcional)</span>
            <div className="cty-chips">
              {PRICE_RANGES.map((p) => (
                <button key={p} type="button" className={`cty-chip${faixa === p ? ' cty-chip--on' : ''}`} onClick={() => setFaixa(faixa === p ? null : p)}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="cty-field">
            <span className="cty-label">Tags (opcional)</span>
            <div className="cty-chips">
              {visibleTags.map((t) => (
                <button key={t.id} type="button" className={`cty-chip${tagIds.includes(t.id) ? ' cty-chip--on' : ''}`} onClick={() => toggleTag(t.id)}>
                  {t.nome}
                </button>
              ))}
            </div>
          </div>

          <label className="cty-check">
            <input type="checkbox" checked={proprio} onChange={(e) => setProprio(e.target.checked)} />
            <span>É o meu negócio / sou eu (aparece com o selo “Divulgação da própria membro”)</span>
          </label>
        </>
      )}

      <label className="cty-field">
        <span className="cty-label">
          {isPlaceOrPro ? (proprio ? 'O que eu faço' : 'Por que indico') : 'Descrição curta'}
        </span>
        <textarea rows={4} maxLength={1200} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </label>

      {tipo !== 'convite' && (
        <div className="cty-field">
          <span className="cty-label">Foto (opcional)</span>
          {foto && <img className="cty-form-photo" src={foto} alt="" />}
          <div className="cty-actions">
            <label className="cty-btn">
              {uploading ? 'Enviando…' : foto ? 'Trocar foto' : 'Escolher foto'}
              <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={uploading} onChange={(e) => void onPhoto(e.target.files?.[0])} />
            </label>
            {foto && (
              <button type="button" className="cty-btn" onClick={() => setFoto(null)}>
                Tirar foto
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      <div className="cty-actions">
        <button type="submit" className="cty-btn cty-btn--primary" disabled={busy || uploading}>
          {busy ? 'Salvando…' : editing ? 'Salvar alterações' : 'Publicar'}
        </button>
        <button type="button" className="cty-btn" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
