import { useMemo, useState } from 'react'
import { useNutriOverview } from '../../hooks/useNutri'
import { ageFrom, brDate, isoToday, needsReturn, daysBetween } from '../../lib/nutri'
import type { Patient } from '../../lib/nutri'
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

export function NutriModule({ communityId }: { communityId: string }) {
  const ov = useNutriOverview(communityId)
  const [view, setView] = useState<View>({ name: 'home' })
  const [query, setQuery] = useState('')
  const today = isoToday()

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
      upcoming: upcoming.slice(0, 5),
      recent: [...ov.patients].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5),
    }
  }, [ov.patients, ov.consultations, ov.assessedIds, today])

  if (ov.loading) return <p className="home-muted">Carregando Gestão Nutricional…</p>

  if (view.name === 'new') {
    return (
      <section className="nutri-module">
        <PatientForm
          patient={null}
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
        <Stat value="—" label="Planos alimentares (em breve)" />
        <Stat value={stats.pending} label="Avaliações pendentes" tone={stats.pending ? 'warn' : undefined} />
      </div>

      <div className="nutri-shortcuts">
        <button type="button" className="water-primary" onClick={() => setView({ name: 'new' })}>
          Cadastrar paciente
        </button>
        <button type="button" className="water-primary" onClick={() => setView({ name: 'list', intent: 'avaliacao' })}>
          Nova avaliação nutricional
        </button>
        <button type="button" className="water-primary" disabled title="Chega na próxima etapa">
          Criar plano alimentar · em breve
        </button>
        <button type="button" className="water-primary" onClick={() => setView({ name: 'list', intent: null })}>
          Consultar pacientes
        </button>
        <button type="button" className="water-primary" onClick={() => setView({ name: 'list', intent: 'consultas' })}>
          Registrar evolução
        </button>
      </div>

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
