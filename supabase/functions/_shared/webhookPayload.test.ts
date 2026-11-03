import { describe, expect, it } from 'vitest'
import { classifyWebhookPayload } from './webhookPayload.ts'

describe('classifyWebhookPayload', () => {
  it('evento de cobrança segue o fluxo normal', () => {
    expect(classifyWebhookPayload({ event: 'PAYMENT_RECEIVED', payment: { id: 'pay_1' } })).toEqual({
      kind: 'payment',
      event: 'PAYMENT_RECEIVED',
    })
  })

  it('SUBSCRIPTION_* (sem payment) é ignorado com 200, usando o id do evento', () => {
    const r = classifyWebhookPayload({
      id: 'evt_9',
      event: 'SUBSCRIPTION_DELETED',
      subscription: { id: 'sub_1' },
    })
    expect(r).toEqual({ kind: 'ignore', event: 'SUBSCRIPTION_DELETED', eventId: 'evt_9' })
  })

  it('evento sem id ganha um id derivado, único por recebimento', () => {
    const r = classifyWebhookPayload({ event: 'SUBSCRIPTION_INACTIVATED', subscription: { id: 'sub_1' } })
    expect(r.kind).toBe('ignore')
    if (r.kind === 'ignore') expect(r.eventId).toMatch(/^SUBSCRIPTION_INACTIVATED:sub_1:\d+$/)
  })

  it('corpo sem event, vazio ou que não é objeto é inválido (400)', () => {
    expect(classifyWebhookPayload({ payment: { id: 'x' } }).kind).toBe('invalid')
    expect(classifyWebhookPayload({ event: '' }).kind).toBe('invalid')
    expect(classifyWebhookPayload(null).kind).toBe('invalid')
    expect(classifyWebhookPayload('texto').kind).toBe('invalid')
  })
})
