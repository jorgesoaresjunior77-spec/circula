import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// =====================================================================
// FASE 16.1 — Conectar a conta Asaas da Professional (verificação de
// titularidade via API Key TRANSITÓRIA)
// =====================================================================
// A Professional cola a API Key da PRÓPRIA conta Asaas. Esta função:
//
//   1. valida o JWT do chamador (anon client + getUser());
//   2. confere que o perfil é `role='professional'`;
//   3. exige que ela já tenha CPF/CNPJ em `billing_customer_data`
//      (cadastrado na Fase 15.2) — é a âncora do cruzamento de
//      titularidade;
//   4. usa a API Key da Professional SOMENTE EM MEMÓRIA, para 3
//      chamadas GET de leitura à Asaas:
//        - GET /wallets            -> walletId real (não confia em
//                                    valor digitado)
//        - GET /myAccount/commercialInfo -> nome + cpfCnpj do titular
//        - GET /myAccount/status  -> situação cadastral (best-effort)
//   5. CRUZA o `cpfCnpj` da conta Asaas com
//      `billing_customer_data.document_number` do próprio perfil. Se
//      não bater -> 422 DOC_MISMATCH, nada é salvo;
//   6. rejeita se o walletId for de uma conta emissora do Círcula
//      (`CIRCULA_WALLET_IDS`);
//   7. em caso de sucesso, faz upsert em `professional_billing_accounts`
//      gravando SÓ fatos derivados: `asaas_wallet_id`,
//      `payout_method='asaas_split'`, `verified_at`, nome/status da
//      conta, `verification_method='api_key'`.
//
// A API Key NUNCA é gravada, logada, devolvida na resposta ou
// persistida em qualquer lugar. Ela sai de escopo ao fim da função.
//
// SEGURANÇA:
//   - `service_role` só existe aqui dentro; nunca no frontend/bundle.
//   - Nenhuma credencial Asaas do Círcula é usada nesta função — as
//     chamadas usam a chave da própria Professional.
//   - Nenhuma RLS é alterada: a escrita privilegiada em
//     `professional_billing_accounts` (que não tem policy de
//     INSERT/UPDATE para `authenticated`) é isolada aqui.
//   - `ASAAS_BASE_URL` acompanha o mesmo env de Sandbox/Produção do
//     `_shared/asaas.ts` — o código é idêntico nos dois ambientes.
// =====================================================================

const ASAAS_BASE_URL = Deno.env.get('ASAAS_BASE_URL') ?? 'https://api-sandbox.asaas.com/v3'

// walletId(s) da(s) conta(s) emissora(s) do Círcula. Uma Professional
// nunca pode "conectar" uma dessas (quebraria o split / self-pay).
// Configurar como secret: CIRCULA_WALLET_IDS="<uuid>[,<uuid>...]".
const CIRCULA_WALLET_IDS = (Deno.env.get('CIRCULA_WALLET_IDS') ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter((s) => s.length > 0)

function maskWallet(id: string): string {
  return id.length <= 10 ? '••••' : `${id.slice(0, 4)}…${id.slice(-4)}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const {
      data: { user },
    } = await supabaseUser.auth.getUser()

    if (!user) {
      return json({ error: 'Sem sessão ativa.' }, 401)
    }

    // Entrada: SOMENTE a API Key da Professional. Nada mais é aceito.
    const payload = await req.json().catch(() => null)
    const apiKey = typeof payload?.asaas_api_key === 'string' ? payload.asaas_api_key.trim() : ''

    if (apiKey.length < 20) {
      return json({ error: 'Informe a chave de API da sua conta Asaas.', code: 'INVALID_API_KEY' }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 2) precisa ser uma conta profissional
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('connect-asaas-account: falha ao buscar profile', profileError.message)
      return json({ error: 'Erro ao verificar o perfil.' }, 500)
    }
    if (!profile || profile.role !== 'professional') {
      return json({ error: 'Apenas contas profissionais podem conectar uma conta Asaas.' }, 403)
    }

    // 3) CPF/CNPJ já cadastrado no Círcula (âncora do cruzamento)
    const { data: billing } = await admin
      .from('billing_customer_data')
      .select('document_type, document_number')
      .eq('profile_id', user.id)
      .maybeSingle()

    if (!billing) {
      return json(
        { error: 'Cadastre seu CPF/CNPJ no Círcula antes de conectar a conta Asaas.', code: 'MISSING_BILLING_DATA' },
        400,
      )
    }

    // ---- 4) chamadas de leitura à Asaas com a chave da Professional ----
    // A chave vive só nesta closure; nunca sai daqui.
    const asaasGet = async (path: string) => {
      const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
        headers: {
          'Content-Type': 'application/json',
          access_token: apiKey,
          'User-Agent': 'Circula/1.0',
        },
      })
      const body = await res.json().catch(() => ({}))
      return { ok: res.ok, status: res.status, body }
    }

    const wallets = await asaasGet('/wallets?limit=20')
    if (wallets.status === 401 || wallets.status === 403) {
      return json({ error: 'A chave de API não foi aceita pela Asaas. Verifique e tente de novo.', code: 'ASAAS_AUTH_FAILED' }, 400)
    }
    if (!wallets.ok) {
      console.error('connect-asaas-account: GET /wallets falhou', wallets.status)
      return json({ error: 'Não foi possível consultar a carteira na Asaas.', code: 'ASAAS_WALLETS_FAILED' }, 502)
    }

    const walletRows: Array<{ id?: string }> = Array.isArray(wallets.body?.data) ? wallets.body.data : []
    const firstWallet = walletRows[0]
    const walletId = firstWallet && typeof firstWallet.id === 'string' ? firstWallet.id : ''
    if (!walletId) {
      return json({ error: 'Nenhuma carteira encontrada nesta conta Asaas.', code: 'NO_WALLET' }, 422)
    }
    if (walletRows.length > 1) {
      console.warn('connect-asaas-account: conta com múltiplas carteiras; usando a primeira')
    }

    // 6) nunca a carteira emissora do Círcula
    if (CIRCULA_WALLET_IDS.includes(walletId.toLowerCase())) {
      return json({ error: 'Essa carteira pertence à conta emissora do Círcula.', code: 'ISSUER_WALLET' }, 422)
    }

    // 5) identidade do titular
    const info = await asaasGet('/myAccount/commercialInfo')
    if (!info.ok) {
      console.error('connect-asaas-account: GET /myAccount/commercialInfo falhou', info.status)
      return json({ error: 'Não foi possível ler os dados da conta Asaas.', code: 'ASAAS_INFO_FAILED' }, 502)
    }
    const accountDoc = String(info.body?.cpfCnpj ?? '').replace(/\D/g, '')
    const accountName =
      (typeof info.body?.companyName === 'string' && info.body.companyName) ||
      (typeof info.body?.name === 'string' && info.body.name) ||
      null

    // ---- 6) CRUZAMENTO DE TITULARIDADE ----
    if (!accountDoc || accountDoc !== billing.document_number) {
      return json(
        {
          error:
            'O CPF/CNPJ da conta Asaas não confere com o cadastrado no Círcula. ' +
            'Conecte uma conta Asaas registrada no mesmo documento.',
          code: 'DOC_MISMATCH',
        },
        422,
      )
    }

    // 7) situação cadastral (best-effort; em Sandbox não bloqueia)
    let accountStatus: string | null = null
    const status = await asaasGet('/myAccount/status')
    if (status.ok) {
      accountStatus =
        (typeof status.body?.general === 'string' && status.body.general) ||
        (typeof status.body?.accountStatus?.general === 'string' && status.body.accountStatus.general) ||
        null
    }

    // ---- 8) persiste SÓ fatos derivados. A apiKey sai de escopo aqui. ----
    const nowIso = new Date().toISOString()
    const { error: upsertError } = await admin.from('professional_billing_accounts').upsert(
      {
        profile_id: user.id,
        asaas_wallet_id: walletId,
        payout_method: 'asaas_split',
        verified_at: nowIso,
        asaas_account_name: accountName,
        asaas_account_status: accountStatus,
        verification_method: 'api_key',
        disconnected_at: null,
      },
      { onConflict: 'profile_id' },
    )

    if (upsertError) {
      console.error('connect-asaas-account: upsert falhou', upsertError.message)
      return json({ error: 'Não foi possível salvar a conexão agora.' }, 500)
    }

    return json(
      {
        connected: true,
        walletMasked: maskWallet(walletId),
        accountName,
        accountStatus,
      },
      200,
    )
  } catch (error) {
    console.error('connect-asaas-account: erro inesperado', (error as Error).message)
    return new Response(JSON.stringify({ error: 'Erro inesperado.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
