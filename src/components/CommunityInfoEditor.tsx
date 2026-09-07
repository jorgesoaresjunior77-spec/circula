import { useState } from 'react'
import type { FormEvent } from 'react'
import { CoverImageInput } from './CoverImageInput'
import type { CommunityUpdateInput, CommunityWithMembers } from '../types/community'

// 16.2.3-G — edição inline das informações básicas da comunidade, a
// partir do bloco "Informações da comunidade" (16.2.3-A).
//
//   • escreve só em `communities` (nome, descrição, capa, is_discoverable);
//   • usa a policy `communities_update` já existente (dona/master) —
//     nenhuma RPC, migration ou RLS nova;
//   • `slug` é somente leitura;
//   • capa reutiliza o CoverImageInput já existente (upload -> PATH do
//     bucket community-media).
//
// Toggle "aberta para descoberta": ao ligar, a comunidade volta a
// aparecer na descoberta já existente e as auto-solicitações continuam
// entrando como `pending` (policy community_members_insert inalterada);
// ao desligar, apenas some da descoberta — membros e pendências
// existentes não são tocados.

interface CommunityInfoEditorProps {
  community: CommunityWithMembers
  /** auth.uid() da Professional — exigido pelo CoverImageInput. */
  profileId: string
  onSave: (patch: CommunityUpdateInput) => Promise<{ error: string | null }>
  onClose: () => void
}

export function CommunityInfoEditor({
  community,
  profileId,
  onSave,
  onClose,
}: CommunityInfoEditorProps) {
  const [name, setName] = useState(community.name)
  const [description, setDescription] = useState(community.description ?? '')
  const [coverPath, setCoverPath] = useState(community.cover_image_url ?? '')
  const [isDiscoverable, setIsDiscoverable] = useState(community.is_discoverable)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return

    setSaving(true)
    setMessage(null)

    const { error } = await onSave({
      name: name.trim(),
      description: description.trim() ? description.trim() : null,
      cover_image_url: coverPath ? coverPath : null,
      is_discoverable: isDiscoverable,
    })

    setSaving(false)

    if (error) {
      setMessage({
        type: 'error',
        text: 'Não foi possível salvar as alterações agora. Tente novamente.',
      })
      return
    }
    setMessage({ type: 'success', text: 'Informações da comunidade atualizadas.' })
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="community-info-name">Nome da comunidade</label>
      <input
        id="community-info-name"
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
      />

      <label htmlFor="community-info-description">Sobre a comunidade</label>
      <textarea
        id="community-info-description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        rows={3}
      />

      <CoverImageInput
        id={`community-info-cover-${community.id}`}
        label="Imagem de capa (opcional)"
        value={coverPath}
        onChange={(path) => setCoverPath(path)}
        communityId={community.id}
        uid={profileId}
        disabled={saving}
      />

      <label className="event-form-check">
        <input
          type="checkbox"
          checked={isDiscoverable}
          onChange={(event) => setIsDiscoverable(event.target.checked)}
        />
        Comunidade aberta para descoberta
      </label>

      <label htmlFor="community-info-slug">Endereço (slug) — não editável</label>
      <input id="community-info-slug" type="text" value={community.slug} readOnly />

      {message && (
        <p className={message.type === 'success' ? 'auth-success' : 'auth-error'}>{message.text}</p>
      )}

      <div className="question-item-actions">
        <button type="submit" disabled={saving || !name.trim()}>
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button type="button" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
