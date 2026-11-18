import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// =====================================================================
// Login por celular
// =====================================================================
// O Supabase Auth autentica por e-mail. Aqui o celular (DDD + 9 + 8 dígitos)
// vira o login: a função acha o e-mail da conta pelo celular (tabela privada
// login_phones, só legível com a service role), confere a senha com o próprio
// Supabase Auth e devolve a sessão. O e-mail continua sendo o da conta
// (cadastro e recuperação de senha).
//
// Duas ações (JSON no corpo):
//   { action: 'login', phone, password } -> { access_token, refresh_token }
//   { action: 'reset', phone }           -> { ok: true }  (manda o link de
//        recuperação para o e-mail da conta; resposta sempre igual, exista o
//        celular ou não, para não revelar quem tem conta)
//
// SEGURANÇA: verify_jwt = false (é a tela de login). Nenhuma resposta diz se o
// celular existe: erro de celular e erro de senha são idênticos. Só
// 'email_not_confirmed' é distinto, e o Supabase só o devolve depois de a
// senha estar certa.
// =====================================================================

const PHONE_RE = /^[1-9][0-9]9[0-9]{8}$/

function normalizePhone(input: unknown): string | null {
  if (typeof input !== 'string') return null
  let d = input.replace(/\D/g, '')
  if (d.length === 13 && d.startsWith('55')) d = d.slice(2)
  return PHONE_RE.test(d) ? d : null
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const INVALID = { error: 'Celular ou senha inválidos.', code: 'invalid_credentials' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Método não permitido.' })

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const action = body.action === 'reset' ? 'reset' : 'login'
    const phone = normalizePhone(body.phone)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    let email: string | null = null
    if (phone) {
      const { data: row } = await admin.from('login_phones').select('profile_id').eq('phone', phone).maybeSingle()
      if (row?.profile_id) {
        const { data: authUser } = await admin.auth.admin.getUserById(row.profile_id as string)
        email = authUser.user?.email ?? null
      }
    }

    // Cliente sem sessão guardada: só para falar com o Auth em nome da pessoa.
    const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })

    if (action === 'reset') {
      const appUrl = Deno.env.get('APP_URL') ?? ''
      if (email && appUrl) {
        const { error } = await anon.auth.resetPasswordForEmail(email, { redirectTo: appUrl })
        if (error) console.error('login-with-phone: reset falhou', error.message)
      }
      return json(200, { ok: true })
    }

    const password = typeof body.password === 'string' ? body.password : ''
    if (!email || !password) return json(401, INVALID)

    const { data, error } = await anon.auth.signInWithPassword({ email, password })
    if (error || !data.session) {
      if (error?.code === 'email_not_confirmed') {
        return json(401, { error: 'E-mail não confirmado.', code: 'email_not_confirmed' })
      }
      return json(401, INVALID)
    }

    return json(200, {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    })
  } catch (error) {
    console.error('login-with-phone: erro inesperado', (error as Error).message)
    return json(500, { error: 'Erro inesperado.' })
  }
})
