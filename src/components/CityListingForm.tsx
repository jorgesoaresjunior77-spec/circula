import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  HEALTH_NOTE,
  MEETUP_ACTIVITIES,
  MEETUP_SAFETY_NOTE,
  PRICE_RANGES,
  WEEK_DAYS,
  findSimilarListing,
  formatPhoneBR,
  healthTextProblem,
  instagramHandle,
  phoneDigits,
} from '../lib/city'
import type { CityCategory, CityListing, CityListingType, CityTag } from '../lib/city'
import { findBlockedTerm, MODERATION_MESSAGE } from '../lib/moderation'
import { uploadCityPhoto } from '../hooks/useCity'
import type { ListingInput, Result } from '../hooks/useCity'
import { CityCategoryField } from './CityCategoryField'
import type { CityGroup } from '../lib/city'

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
  onCreateCategory: (nome: string, grupo: string, grupoSugerido?: string) => Promise<{ error: string | null; id: string | null; existing: boolean }>
  groups?: CityGroup[]
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
  groups,
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
  const [dias, setDias] = useState<Record<string, string>>(editing?.horarios ?? {})
  const [contato, setContato] = useState(editing?.contato && /\d/.test(editing.contato) ? formatPhoneBR(editing.contato) : (editing?.contato ?? '( ) '))
  const [instagram, setInstagram] = useState(editing?.instagram ?? '')
  const [faixa, setFaixa] = useState<CityListing['faixa_preco']>(editing?.faixa_preco ?? null)
  const [foto, setFoto] = useState<string | null>(editing?.foto ?? null)
  const [logo, setLogo] = useState<string | null>(editing?.logo ?? null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
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

  function setDay(key: string, value: string) {
    setDias((d) => ({ ...d, [key]: value }))
  }
  function setDayTimes(key: string, from: string, to: string) {
    setDias((d) => ({ ...d, [key]: `${from}-${to}` }))
  }

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

  async function onLogo(file: File | undefined) {
    if (!file) return
    setError(null)
    setUploadingLogo(true)
    const r = await uploadCityPhoto(uid, file)
    setUploadingLogo(false)
    if (r.error) setError(r.error)
    else setLogo(r.url)
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
    if (tipo === 'lugar' || tipo === 'profissional') {
      // Cadastro novo de lugar/profissional: tudo preenchido, como numa ficha completa.
      if (tipo === 'lugar' && !bairro.trim()) return setError('Informe o bairro.')
      if (tipo === 'lugar' && !endereco.trim()) return setError('Informe o endereço do estabelecimento.')
      if (tipo === 'profissional' && !todaCidade && !bairro.trim()) return setError('Informe o bairro ou marque "Atende em toda a cidade".')
      if (phoneDigits(contato) < 10) return setError('Informe o contato com DDD, por exemplo (51) 99999-9999.')
      const comDias = Object.values(dias).some((v) => v && v !== '')
      if (tipo === 'lugar' && !comDias && !horario.trim()) return setError('Informe o horário de funcionamento (por dia) ou escreva como combinar.')
      if (descricao.trim().length < 10) return setError(proprio ? 'Conte o que você faz.' : 'Conte por que você indica.')
      if (!foto) return setError('Escolha a foto da fachada (ou outra foto do lugar).')
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
      contato: tipo === 'evento' || tipo === 'convite' ? null : phoneDigits(contato) > 0 ? contato.trim() : null,
      instagram: isPlaceOrPro ? nullable(instagramHandle(instagram) ?? '') : null,
      faixa_preco: isPlaceOrPro ? faixa : null,
      horario: isPlaceOrPro ? nullable(horario) : null,
      horarios: isPlaceOrPro ? (Object.fromEntries(Object.entries(dias).filter(([, v]) => v)) as Record<string, string>) : null,
      foto: tipo === 'convite' ? null : foto,
      logo: isPlaceOrPro ? logo : null,
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

      {needsCategory && <CityCategoryField groups={groups} categories={categories} value={categoriaId} onChange={setCategoriaId} onCreate={onCreateCategory} />}
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
            </>
          )}
          <fieldset className="cty-hours">
            <legend className="cty-label">Horário de funcionamento{tipo === 'lugar' ? '' : ' (opcional)'}</legend>
            {WEEK_DAYS.map((d) => {
              const v = dias[d.key] ?? ''
              const kind = v === '' ? '' : v === 'fechado' || v === '24h' ? v : 'aberto'
              const [from, to] = kind === 'aberto' ? v.split('-') : ['08:00', '18:00']
              return (
                <div key={d.key} className="cty-hours-row">
                  <span className="cty-hours-day">{d.label}</span>
                  <select
                    aria-label={`Horário de ${d.label}`}
                    value={kind}
                    onChange={(e) => {
                      const k = e.target.value
                      if (k === 'aberto') setDayTimes(d.key, '08:00', '18:00')
                      else setDay(d.key, k)
                    }}
                  >
                    <option value="">Escolha</option>
                    <option value="aberto">Aberto</option>
                    <option value="24h">24 horas</option>
                    <option value="fechado">Fechado</option>
                  </select>
                  {kind === 'aberto' && (
                    <span className="cty-hours-times">
                      <input type="time" aria-label={`Abre ${d.label}`} value={from} onChange={(e) => setDayTimes(d.key, e.target.value, to)} />
                      <span>às</span>
                      <input type="time" aria-label={`Fecha ${d.label}`} value={to} onChange={(e) => setDayTimes(d.key, from, e.target.value)} />
                    </span>
                  )}
                </div>
              )
            })}
            <label className="cty-field">
              <span className="cty-label">Outros horários, ou como combinar (serviço autônomo)</span>
              <input type="text" maxLength={300} value={horario} onChange={(e) => setHorario(e.target.value)} placeholder="Ex.: atendo com hora marcada, por mensagem" />
            </label>
          </fieldset>
          <label className="cty-field">
            <span className="cty-label">Contato com DDD (aparece no cadastro)</span>
            <input type="tel" inputMode="tel" maxLength={16} value={contato} onChange={(e) => setContato(formatPhoneBR(e.target.value))} onFocus={(e) => { if (!e.target.value) setContato('( ) ') }} />
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
        <div className="cty-photos">
          {isPlaceOrPro && (
            <div className="cty-field cty-photo-slot">
              <span className="cty-label">Logo (opcional)</span>
              {logo ? <img className="cty-form-logo" src={logo} alt="" /> : <span className="cty-photo-empty cty-photo-empty--logo">Sem logo</span>}
              <div className="cty-actions">
                <label className="cty-btn">
                  {uploadingLogo ? 'Enviando…' : logo ? 'Trocar logo' : 'Escolher logo'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={uploadingLogo} onChange={(e) => void onLogo(e.target.files?.[0])} />
                </label>
                {logo && (
                  <button type="button" className="cty-btn" onClick={() => setLogo(null)}>
                    Tirar
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="cty-field cty-photo-slot">
            <span className="cty-label">{isPlaceOrPro ? 'Fachada ou outra foto' : 'Foto (opcional)'}</span>
            {foto ? <img className="cty-form-photo" src={foto} alt="" /> : <span className="cty-photo-empty">Sem foto</span>}
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
