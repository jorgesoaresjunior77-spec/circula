import { describe, it, expect } from 'vitest'
import { circleRequestErrorMessage } from './circleRequest'

describe('circleRequestErrorMessage', () => {
  it('traduz a violação do índice único de pendência em aberto', () => {
    expect(
      circleRequestErrorMessage(
        'duplicate key value violates unique constraint "circle_requests_one_pending_per_member"',
      ),
    ).toBe('Você já tem uma solicitação em análise. Aguarde a resposta antes de enviar outra.')
  })

  it('cai no fallback genérico para qualquer outro erro', () => {
    expect(circleRequestErrorMessage('network error')).toBe(
      'Não foi possível enviar agora. Tente novamente.',
    )
  })

  it('cai no fallback para null/undefined', () => {
    expect(circleRequestErrorMessage(null)).toBe('Não foi possível enviar agora. Tente novamente.')
    expect(circleRequestErrorMessage(undefined)).toBe(
      'Não foi possível enviar agora. Tente novamente.',
    )
  })
})
