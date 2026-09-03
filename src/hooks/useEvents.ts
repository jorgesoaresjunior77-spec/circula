import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type {
  EventInput,
  EventResult,
  EventWithParticipants,
  RsvpResult,
} from '../types/event'

// Módulo EVENTOS. Mesmo molde de useCircles: um SELECT constante com os
// participantes aninhados, fetch em useCallback, atualização local
// otimista onde é seguro e refetch quando a contagem/lista muda.
//
// useEvents(null) NÃO faz fetch (destino inativo) — igual a useCircles.

const PERSON = 'id,full_name,avatar_url'
const EVENT_SELECT =
  `id,community_id,circle_id,created_by,title,description,cover_image_url,` +
  `starts_at,ends_at,is_online,location,online_url,capacity,status,created_at,updated_at,` +
  `participants:event_participants(id,event_id,profile_id,joined_at,profile:profiles(${PERSON}))`

function cleanText(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim()
  return trimmed ? trimmed : null
}

export function useEvents(communityId: string | null) {
  const [events, setEvents] = useState<EventWithParticipants[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEvents = useCallback(async () => {
    if (!communityId) {
      setEvents([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('community_events')
      .select(EVENT_SELECT)
      .eq('community_id', communityId)
      .order('starts_at', { ascending: true })

    if (fetchError) {
      setError(fetchError.message)
      setEvents([])
      setLoading(false)
      return
    }

    setEvents((data as unknown as EventWithParticipants[] | null) ?? [])
    setLoading(false)
  }, [communityId])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  async function createEvent(createdBy: string, input: EventInput): Promise<EventResult> {
    if (!communityId) return { error: 'Sem comunidade selecionada.' }

    const { error: insertError } = await supabase.from('community_events').insert({
      community_id: communityId,
      created_by: createdBy,
      title: input.title.trim(),
      description: cleanText(input.description),
      cover_image_url: cleanText(input.cover_image_url),
      starts_at: input.starts_at,
      ends_at: input.ends_at || null,
      is_online: input.is_online,
      location: input.is_online ? null : cleanText(input.location),
      online_url: input.is_online ? cleanText(input.online_url) : null,
      capacity: input.capacity && input.capacity > 0 ? input.capacity : null,
      circle_id: input.circle_id || null,
      status: input.status ?? 'published',
    })

    if (insertError) return { error: insertError.message }

    await fetchEvents()
    return { error: null }
  }

  async function updateEvent(eventId: string, input: EventInput): Promise<EventResult> {
    const { error: updateError } = await supabase
      .from('community_events')
      .update({
        title: input.title.trim(),
        description: cleanText(input.description),
        cover_image_url: cleanText(input.cover_image_url),
        starts_at: input.starts_at,
        ends_at: input.ends_at || null,
        is_online: input.is_online,
        location: input.is_online ? null : cleanText(input.location),
        online_url: input.is_online ? cleanText(input.online_url) : null,
        capacity: input.capacity && input.capacity > 0 ? input.capacity : null,
        circle_id: input.circle_id || null,
        status: input.status ?? 'published',
      })
      .eq('id', eventId)

    if (updateError) return { error: updateError.message }

    await fetchEvents()
    return { error: null }
  }

  async function deleteEvent(eventId: string): Promise<EventResult> {
    const { error: deleteError } = await supabase
      .from('community_events')
      .delete()
      .eq('id', eventId)

    if (deleteError) return { error: deleteError.message }

    setEvents((prev) => prev.filter((event) => event.id !== eventId))
    return { error: null }
  }

  async function rsvp(eventId: string, profileId: string): Promise<RsvpResult> {
    const { error: insertError } = await supabase
      .from('event_participants')
      .insert({ event_id: eventId, profile_id: profileId })

    if (insertError && !insertError.message.includes('duplicate key')) {
      return { error: insertError.message }
    }

    await fetchEvents()
    return { error: null }
  }

  async function cancelRsvp(eventId: string, profileId: string): Promise<RsvpResult> {
    const { error: deleteError } = await supabase
      .from('event_participants')
      .delete()
      .eq('event_id', eventId)
      .eq('profile_id', profileId)

    if (deleteError) return { error: deleteError.message }

    await fetchEvents()
    return { error: null }
  }

  return {
    events,
    loading,
    error,
    createEvent,
    updateEvent,
    deleteEvent,
    rsvp,
    cancelRsvp,
    refresh: fetchEvents,
  }
}
