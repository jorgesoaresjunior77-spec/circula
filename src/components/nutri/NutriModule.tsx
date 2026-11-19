import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useNutriOverview } from '../../hooks/useNutri'
import { LinkRequests } from './LinkRequests'
import { ageFrom, brDate, isoToday, needsReturn, daysBetween } from '../../lib/nutri'
import type { Patient } from '../../lib/nutri'
import { useNutriLibrary } from '../../hooks/useNutriPlan'
import { FoodsManager } from './FoodsManager'
import { RecipesManager } from './RecipesManager'
import { buildWhatsAppUrl, normalizeWhatsAppNumber } from '../../lib/phone'
import { PatientForm } from './PatientForm'
import { PatientRecord } from './PatientRecord'
import type { Tab } from './PatientRecord'

// Gestão Nutricional (área exclusiva da nutricionista): painel com
// indicadores e atalhos, lista de pacientes e prontuário. Os dados de saúde
// ficam só com ela (RLS por dona da comunidade).

type View =
  | { name: 'home' }
  | { name: 'list'; intent: Tab | null }
  | { name: 'new' }
  | { name: 'foods' }
  | { name: 'recipes' }
  | { name: 'record'; id: string; tab: Tab }

const NEW_DAYS = 30

function Stat({ value, label, tone }: { value: string | number; label: string; tone?: 'warn' }) {
  return (
    <div className={`nutri-stat${tone === 'warn' ? ' nutri-stat--warn' : ''}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

export function NutriModule({ communityId, nutriName }: { communityId: string; nutriName: string }) {
  const ov = useNutriOverview(communityId)
  const lib = useNutriLibrary(communityId)
  const [members, setMembers] = useState<{ id: string; full_name: string | null }[]>([])

  // Participantes da comunidade, para vincular uma paciente à área dela.
  useEffect(() => {
    let cancelled = false
    void supabase
      .from('community_members')
      .select('profile:profiles(id,full_name)')
      .eq('community_id', communityId)
      .eq('status', 'active')
      .limit(1000)
      .then(({ data }) => {
        if (cancelled) return
        const rows = (data as unknown as { profile: { id: string; full_name: string | null } | null }[] | null) ?? []
        setMembers(rows.map((r) => r.profile).filter((p): p is { id: string; full_name: string | null } => !!p).sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '', 'pt-BR')))
      })
    return () => {
      cancelled = true
    }
  }, [communityId])
  const [view, setView] = useState<View>({ name: 'home' })
  const [query, setQuery] = useState('')
  const today = isoToday()
  const tomorrow = isoToday(new Date(Date.now() + 86_400_000))

  const byId = useMemo(() => new Map(ov.patients.map((p) => [p.id, p])), [ov.patients])

  const stats = useMemo(() => {
    const active = ov.patients.filter((p) => p.status === 'ativo')
    const consultsOf = (id: string) => ov.consultations.filter((c) => c.patient_id === id)
    const upcoming = ov.consultations
      .filter((c) => c.status === 'agendada' && c.scheduled_on >= today)
      .sort((a, b) => a.scheduled_on.localeCompare(b.scheduled_on))
    return {
      total: ov.patients.length,
      active: active.length,
      fresh: ov.patients.filter((p) => daysBetween(p.created_at.slice(0, 10), today) <= NEW_DAYS).length,
      scheduled: upcoming.length,
      needReturn: active.filter((p) => needsReturn(consultsOf(p.id), today)).length,
      pending: active.filter((p) => !ov.assessedIds.has(p.id)).length,
      returns: active.filter((p) => needsReturn(consultsOf(p.id), today)),
      upcoming: upcoming.slice(0, 5),
      recent: [...ov.patients].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5),
    }
  }, [ov.patients, ov.consultations, ov.assessedIds, today])

  if (ov.loading) return <p className="home-muted">Carregando Gestão Nutricional…</p>

  if (view.name === 'foods') {
    return (
      <section className="nutri-module">
        <FoodsManager foods={lib.foods} onSave={lib.saveFood} onImport={lib.importFoods} onRemove={lib.removeFood} onBack={() => setView({ name: 'home' })} />
      </section>
    )
  }

  if (view.name === 'recipes') {
    return (
      <section className="nutri-module">
        <RecipesManager recipes={lib.recipes} foods={lib.foods} onSave={lib.saveRecipe} onRemove={lib.removeRecipe} onBack={() => setView({ name: 'home' })} />
      </section>
    )
  }

  if (view.name === 'new') {
    return (
      <section className="nutri-module">
        <PatientForm
          patient={null}
          members={members}
          onCancel={() => setView({ name: 'home' })}
          onSave={async (input) => {
            const r = await ov.savePatient(null, input)
            if (!r.error && r.id) setView({ name: 'record', id: r.id, tab: 'anamnese' })
            return r
          }}
        />
      </section>
    )
  }

  if (view.name === 'record') {
    const patient = byId.get(view.id)
    if (!patient) return <p className="home-muted">Paciente não encontrada.</p>
    return (
      <section className="nutri-module">
        <PatientRecord
          key={patient.id}
          patient={patient}
          communityId={communityId}
          initialTab={view.tab}
          foods={lib.foods}
          recipes={lib.recipes}
          nutriName={nutriName}
          members={members}
          otherPatients={ov.patients.filter((x) => x.id !== patient.id).map((x) => ({ id: x.id, full_name: x.full_name }))}
          onBack={() => setView({ name: 'list', intent: null })}
          onChanged={ov.reload}
          onSavePatient={async (input) => ov.savePatient(patient.id, input)}
        />
      </section>
    )
  }

  if (view.name === 'list') {
    const q = query.trim().toLowerCase()
    const list = ov.patients.filter((p) => !q || p.full_name.toLowerCase().includes(q))
    return (
      <section className="nutri-module">
        <button type="button" className="auth-link" onClick={() => setView({ name: 'home' })}>
          ‹ Gestão Nutricional
        </button>
        <h2>Pacientes</h2>
        <LinkRequests communityId={communityId} patients={ov.patients.map((p) => ({ id: p.id, full_name: p.full_name }))} onChanged={() => ov.reload?.()} />
        {view.intent && <p className="home-muted">Escolha a paciente para continuar.</p>}
        <input
          type="search"
          className="magazine-input"
          placeholder="Buscar pelo nome"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar paciente"
        />
        <button type="button" className="water-primary" onClick={() => setView({ name: 'new' })}>
          Cadastrar paciente
        </button>
        {list.length === 0 && <p className="home-muted">Nenhuma paciente encontrada.</p>}
        <ul className="nutri-list">
          {list.map((p) => (
            <PatientRow key={p.id} p={p} onOpen={() => setView({ name: 'record', id: p.id, tab: view.intent ?? 'resumo' })} />
          ))}
        </ul>
      </section>
    )
  }

  return (
    <section className="nutri-module">
      <h2>Gestão Nutricional</h2>
      <p className="home-muted">Pacientes, avaliações e retornos. Só você vê estas informações.</p>
      {ov.failed && <p className="auth-error">Não foi possível carregar tudo agora. Tente de novo em instantes.</p>}

      <div className="nutri-stats">
        <Stat value={stats.total} label="Pacientes" />
        <Stat value={stats.active} label="Ativas" />
        <Stat value={stats.fresh} label={`Novas (${NEW_DAYS} dias)`} />
        <Stat value={stats.scheduled} label="Consultas agendadas" />
        <Stat value={stats.needReturn} label="Precisam de retorno" tone={stats.needReturn ? 'warn' : undefined} />
        <Stat value={ov.activePlans} label="Planos alimentares ativos" />
        <Stat value={stats.pending} label="Avaliações pendentes" tone={stats.pending ? 'warn' : undefined} />
      </div>

      <div className="nutri-shortcuts">
        <button type="button" className="water-primary" onClick={() => setView({ name: 'new' })}>
          Cadastrar paciente
        </button>
        <button type="button" className="water-primary" onClick={() => setView({ name: 'list', intent: 'avaliacao' })}>
          Nova avaliação nutricional
        </button>
        <button type="button" className="water-primary" onClick={() => setView({ name: 'list', intent: 'plano' })}>
          Criar plano alimentar
        </button>
        <button type="button" className="water-primary" onClick={() => setView({ name: 'foods' })}>
          Banco de alimentos
        </button>
        <button type="button" className="water-primary" onClick={() => setView({ name: 'recipes' })}>
          Receitas
        </button>
        <button type="button" className="water-primary" onClick={() => setView({ name: 'list', intent: null })}>
          Consultar pacientes
        </button>
        <button type="button" className="water-primary" onClick={() => setView({ name: 'list', intent: 'consultas' })}>
          Registrar evolução
        </button>
      </div>

      <h3>Precisam de retorno</h3>
      {stats.returns.length === 0 ? (
        <p className="home-muted">Ninguém com retorno pendente.</p>
      ) : (
        <ul className="nutri-list">
          {stats.returns.map((p) => (
            <li key={p.id} className="nutri-row nutri-row--split">
              <button type="button" className="nutri-link" onClick={() => setView({ name: 'record', id: p.id, tab: 'consultas' })}>
                <strong>{p.full_name}</strong>
              </button>
              <ReminderButton patient={p} text={`Oi, ${p.full_name.split(' ')[0]}! Tudo bem? Já está na hora do seu retorno. Vamos marcar um horário? 💛`} />
            </li>
          ))}
        </ul>
      )}

      <h3>Pacientes recentes</h3>
      {stats.recent.length === 0 ? (
        <p className="home-muted">Nenhuma paciente cadastrada ainda.</p>
      ) : (
        <ul className="nutri-list">
          {stats.recent.map((p) => (
            <PatientRow key={p.id} p={p} onOpen={() => setView({ name: 'record', id: p.id, tab: 'resumo' })} />
          ))}
        </ul>
      )}

      <h3>Próximos retornos e consultas</h3>
      {stats.upcoming.length === 0 ? (
        <p className="home-muted">Nada agendado.</p>
      ) : (
        <ul className="nutri-list">
          {stats.upcoming.map((c) => {
            const p = byId.get(c.patient_id)
            return (
              <li key={c.id}>
                {p && c.scheduled_on <= tomorrow && (
                  <ReminderButton patient={p} text={`Oi, ${p.full_name.split(' ')[0]}! Passando para lembrar da sua ${c.kind === 'retorno' ? 'consulta de retorno' : 'consulta'} em ${brDate(c.scheduled_on)}${c.scheduled_time ? ` às ${c.scheduled_time}` : ''}. Te espero! 💛`} />
                )}
                <button type="button" className="nutri-row" onClick={() => p && setView({ name: 'record', id: p.id, tab: 'consultas' })}>
                  <strong>{p?.full_name ?? 'Paciente'}</strong>
                  <span>
                    {brDate(c.scheduled_on)}
                    {c.scheduled_time ? ` · ${c.scheduled_time}` : ''} · {c.kind === 'retorno' ? 'Retorno' : 'Consulta'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** Abre o WhatsApp com a mensagem pronta; quem envia é a nutricionista. */
function ReminderButton({ patient, text }: { patient: Patient; text: string }) {
  const number = normalizeWhatsAppNumber(patient.whatsapp || patient.phone || '')
  if (!number) return <span className="home-muted">sem WhatsApp</span>
  return (
    <button type="button" className="auth-link" onClick={() => window.open(buildWhatsAppUrl(number, text), '_blank', 'noopener,noreferrer')}>
      Lembrar pelo WhatsApp
    </button>
  )
}

function PatientRow({ p, onOpen }: { p: Patient; onOpen: () => void }) {
  const age = ageFrom(p.birth_date)
  return (
    <li>
      <button type="button" className="nutri-row" onClick={onOpen}>
        <strong>{p.full_name}</strong>
        <span>
          {age !== null ? `${age} anos` : 'Idade —'} · {p.status === 'ativo' ? 'Ativa' : 'Inativa'}
          {p.main_goal ? ` · ${p.main_goal}` : ''}
        </span>
      </button>
    </li>
  )
}
