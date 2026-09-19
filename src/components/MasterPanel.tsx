import { useState } from 'react'
import { usePlatformOverview } from '../hooks/usePlatformOverview'
import { MasterDashboard } from './MasterDashboard'
import { MasterCommunitiesPanel } from './MasterCommunitiesPanel'
import { MasterProfessionalsPanel } from './MasterProfessionalsPanel'
import { MasterPlatformPanel } from './MasterPlatformPanel'

type MasterTab = 'visao' | 'comunidades' | 'profissionais' | 'plataforma'

const TABS: { key: MasterTab; label: string }[] = [
  { key: 'visao', label: 'Visão Geral' },
  { key: 'comunidades', label: 'Comunidades' },
  { key: 'profissionais', label: 'Profissionais' },
  { key: 'plataforma', label: 'Plataforma' },
]

/**
 * Painel Master — visão administrativa/técnica da plataforma Círcula.
 * Só agregados: nunca conteúdo de comunidade, nunca dado individual de
 * usuária (humor, saldo, ledger, conversa). Os dados
 * vêm de 3 RPCs `SECURITY DEFINER` com guard `is_master()`
 * (platform_overview / platform_communities / platform_professionals) —
 * a Visão Geral e a aba Plataforma compartilham uma única chamada de
 * `platform_overview`.
 *
 * Redesign editorial (`redesign/editorial-avva`): tabs em `.master-tabs`/
 * `.master-tab`, escopadas e independentes de `.panel-tabs`/`.panel-tab`
 * (compartilhadas com ProfessionalPanel — não tocadas). `.panel-tab-content`
 * segue reutilizada (layout genérico, sem regra própria alterada).
 */
export function MasterPanel() {
  const [activeTab, setActiveTab] = useState<MasterTab>('visao')
  const { overview, loading, error } = usePlatformOverview()

  return (
    <section className="community-card community-card--quiet master-panel">
      <div className="master-head">
        <p className="master-eyebrow">Administração</p>
        <h3>Painel da plataforma — Círcula</h3>
      </div>

      <div className="master-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`master-tab${activeTab === tab.key ? ' master-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'visao' && (
        <div className="panel-tab-content">
          <MasterDashboard overview={overview} loading={loading} error={error} />
        </div>
      )}

      {activeTab === 'comunidades' && (
        <div className="panel-tab-content">
          <MasterCommunitiesPanel />
        </div>
      )}

      {activeTab === 'profissionais' && (
        <div className="panel-tab-content">
          <MasterProfessionalsPanel />
        </div>
      )}

      {activeTab === 'plataforma' && (
        <div className="panel-tab-content">
          <MasterPlatformPanel overview={overview} loading={loading} error={error} />
        </div>
      )}
    </section>
  )
}
