const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY') ?? ''
const ASAAS_BASE_URL = Deno.env.get('ASAAS_BASE_URL') ?? 'https://api-sandbox.asaas.com/v3'
const SANDBOX_KEY_PREFIX = '$aact_hmlg_'

export function assertSandboxKey() {
  if (!ASAAS_API_KEY.startsWith(SANDBOX_KEY_PREFIX)) {
    throw new Error(
      'ASAAS_API_KEY nao e uma chave de Sandbox valida (esperado prefixo ' +
        SANDBOX_KEY_PREFIX +
        '). Chamada bloqueada para evitar cobranca real.',
    )
  }
}

export async function asaasFetch(path: string, init: RequestInit = {}) {
  assertSandboxKey()

  const response = await fetch(`${ASAAS_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      access_token: ASAAS_API_KEY,
      'User-Agent': 'Circula/1.0 (sandbox)',
      ...init.headers,
    },
  })

  const body = await response.json()

  if (!response.ok) {
    throw new Error(`Asaas ${path} falhou (${response.status}): ${JSON.stringify(body)}`)
  }

  return body
}

export function addCycleMonths(from: Date, cycle: 'MONTHLY' | 'SEMIANNUALLY' | 'YEARLY') {
  const months = cycle === 'MONTHLY' ? 1 : cycle === 'SEMIANNUALLY' ? 6 : 12
  const result = new Date(from)
  result.setUTCMonth(result.getUTCMonth() + months)
  return result
}
