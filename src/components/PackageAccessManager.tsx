import { useState } from 'react'
import type { CommunityWithMembers } from '../types/community'
import { useCommunityPackages } from '../hooks/usePackageAccess'
import { PACKAGE_HINT, PACKAGE_KEYS, PACKAGE_LABEL } from '../lib/packages'
import type { PackageKey } from '../lib/packages'

// Painel da profissional: liberar ou retirar os pacotes pagos à parte de cada
// membro (Help Nutri, E-books, Plano completo). É manual porque a cobrança
// desses pacotes ainda não existe no sistema: a nutri marca aqui quem
// contratou. Sem marcação, a membro fica bloqueada.

interface Props {
  community: CommunityWithMembers
  /** Quem está liberando (a dona da comunidade). */
  profileId: string
}

export function PackageAccessManager({ community, profileId }: Props) {
  const { loading, error, has, setAccess } = useCommunityPackages(community.id)
  const [busy, setBusy] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const members = community.community_members
    .map((member) => member.profile)
    .filter((p): p is NonNullable<typeof p> => !!p && p.id !== community.owner_id)
    .sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '', 'pt-BR'))

  async function toggle(memberId: string, pkg: PackageKey, on: boolean) {
    setSaveError(null)
    setBusy(`${memberId}:${pkg}`)
    const r = await setAccess(memberId, pkg, on, profileId)
    setBusy(null)
    if (r.error) setSaveError(r.error)
  }

  return (
    <section className="package-manager">
      <h3>Pacotes das membros</h3>
      <p className="home-muted">
        Marque o que cada membro contratou. Sem marcação, ela não consegue enviar mensagem no Help Nutri
        nem ler os e-books da Loja. O plano completo vale pelos dois.
      </p>
      <ul className="package-legend">
        {PACKAGE_KEYS.map((pkg) => (
          <li key={pkg}>
            <strong>{PACKAGE_LABEL[pkg]}:</strong> {PACKAGE_HINT[pkg]}
          </li>
        ))}
      </ul>

      {loading && <p className="home-muted">Carregando…</p>}
      {error && <p className="auth-error">{error}</p>}
      {saveError && (
        <p className="auth-error" role="alert">
          {saveError}
        </p>
      )}
      {!loading && members.length === 0 && <p className="home-muted">Nenhuma membro na comunidade ainda.</p>}

      {!loading && members.length > 0 && (
        <ul className="package-list">
          {members.map((member) => (
            <li key={member.id} className="package-row">
              <span className="package-row-name">{member.full_name ?? 'Participante'}</span>
              <span className="package-row-options">
                {PACKAGE_KEYS.map((pkg) => {
                  const on = has(member.id, pkg)
                  return (
                    <label key={pkg} className={`package-chip${on ? ' package-chip--on' : ''}`}>
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={busy === `${member.id}:${pkg}`}
                        onChange={(e) => void toggle(member.id, pkg, e.target.checked)}
                      />
                      {PACKAGE_LABEL[pkg]}
                    </label>
                  )
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
