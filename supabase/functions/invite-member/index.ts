import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// =====================================================================
// FASE 14.2 — Convite de nova Member por e-mail
// =====================================================================
// A Professional dona de uma comunidade convida um e-mail. Esta função:
//
//   1. valida o JWT do chamador (anon client + getUser());
//   2. confere que ele é `owner_id` da `communityId` (senão HTTP 403 —
//      NADA é criado);
//   3. rate-limit simples por comunidade (entradas na última hora);
//   4. tenta `admin.auth.admin.inviteUserByEmail(email, { data, redirectTo })`:
//      - sucesso  → o trigger `handle_new_user` cria a linha em `profiles`
//                   (role='member' por default da coluna); a função insere
//                   `community_members { status:'active' }`; o Supabase
//                   envia o e-mail de convite (link de definição de senha).
//      - e-mail já existe → fallback: usa a RPC `find_member_by_email`
//                   (mesma do fluxo `addMember`) com o JWT da Professional;
//                   se achar um perfil `role='member'`, insere
//                   `community_members` direto, SEM enviar e-mail; senão,
//                   recusa com mensagem neutra.
//
// SEGURANÇA:
//   - `service_role` só existe aqui dentro (`SUPABASE_SERVICE_ROLE_KEY`);
//     nunca vai ao frontend / bundle / corpo de resposta.
//   - `redirectTo` é FIXO por env (`APP_URL`), nunca vem do corpo da
//     requisição — evita open-redirect / exfiltração de token.
//   - `role` do convidado nunca é passado no `data` do convite; fica no
//     default `'member'` de `profiles.role`, e o trigger
//     `prevent_role_escalation` bloqueia mudança posterior.
//   - Nenhuma RLS é alterada: a escrita privilegiada é isolada nesta
//     função.
// =====================================================================

const MAX_JOINS_PER_COMMUNITY_PER_HOUR = 20

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

    // 1) valida o JWT do chamador com um client anon (padrão das demais funções)
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

    // 3) entrada: só communityId, email, fullName opcional
    const payload = await req.json().catch(() => null)
    const communityId =
      typeof payload?.communityId === 'string' ? payload.communityId.trim() : ''
    const email =
      typeof payload?.email === 'string' ? payload.email.trim().toLowerCase() : ''
    const fullNameRaw =
      typeof payload?.fullName === 'string' ? payload.fullName.trim() : ''
    const fullName = fullNameRaw.length > 0 ? fullNameRaw.slice(0, 120) : null

    if (
      !communityId ||
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return json({ error: 'Dados inválidos.' }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 2 / 6) ownership: o chamador precisa ser a dona desta comunidade
    const { data: community, error: communityError } = await admin
      .from('communities')
      .select('id, owner_id')
      .eq('id', communityId)
      .maybeSingle()

    if (communityError) {
      console.error('invite-member: erro ao buscar comunidade', communityError)
      return json({ error: 'Erro ao verificar a comunidade.' }, 500)
    }
    if (!community || community.owner_id !== user.id) {
      // 7) não é owner → 403, nada é criado
      return json({ error: 'Você não é a responsável por esta comunidade.' }, 403)
    }

    // 11) rate-limit: nº de entradas na comunidade na última hora
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count: recentJoins } = await admin
      .from('community_members')
      .select('id', { count: 'exact' })
      .eq('community_id', communityId)
      .gte('joined_at', oneHourAgo)
      .limit(1)

    if ((recentJoins ?? 0) >= MAX_JOINS_PER_COMMUNITY_PER_HOUR) {
      return json(
        { error: 'Muitos convites em pouco tempo. Tente novamente daqui a pouco.' },
        429,
      )
    }

    const appUrl = Deno.env.get('APP_URL') ?? ''
    if (!appUrl) {
      console.error('invite-member: APP_URL não configurada')
      return json({ error: 'Configuração ausente no servidor.' }, 500)
    }

    // 4) tenta convidar (cria auth.users + dispara o e-mail do Supabase)
    const { data: invited, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(email, {
        data: fullName ? { full_name: fullName } : {},
        redirectTo: appUrl,
      })

    if (!inviteError && invited?.user) {
      // `handle_new_user` já criou o profiles (role='member' default).
      // 13) vínculo só depois de validado o ownership; 14) status='active'.
      const { error: linkError } = await admin.from('community_members').insert({
        community_id: communityId,
        profile_id: invited.user.id,
        status: 'active',
      })

      if (linkError && !linkError.message.includes('duplicate key')) {
        console.error('invite-member: falha ao vincular membership', linkError)
        return json(
          { error: 'Convite enviado, mas houve um problema ao vincular à comunidade.' },
          500,
        )
      }

      return json({ status: 'invited' }, 200)
    }

    // 12) fallback: e-mail já possui conta ------------------------------
    const alreadyRegistered =
      (inviteError as { code?: string } | null)?.code === 'email_exists' ||
      /already.*regist|email_exists/i.test(inviteError?.message ?? '')

    if (!alreadyRegistered) {
      console.error('invite-member: inviteUserByEmail falhou', inviteError)
      return json({ error: 'Não foi possível enviar o convite agora.' }, 500)
    }

    // Reutiliza a RPC do fluxo `addMember` — SECURITY DEFINER, com guard
    // de ownership por auth.uid(); chamada com o JWT da Professional.
    const { data: found, error: findError } = await supabaseUser.rpc(
      'find_member_by_email',
      { p_community_id: communityId, p_email: email },
    )

    if (findError) {
      console.error('invite-member: find_member_by_email falhou', findError)
      return json({ error: 'Não foi possível verificar o e-mail agora.' }, 500)
    }

    const match =
      (found as { id: string; full_name: string | null }[] | null)?.[0] ?? null

    if (!match) {
      // Tem conta, mas não é um perfil de participante (member) — recusa neutra.
      return json(
        { error: 'Esse e-mail não pode ser adicionado como participante.' },
        409,
      )
    }

    const { error: linkExistingError } = await admin
      .from('community_members')
      .insert({ community_id: communityId, profile_id: match.id, status: 'active' })

    if (linkExistingError) {
      if (linkExistingError.message.includes('duplicate key')) {
        return json({ status: 'already_member', fullName: match.full_name }, 200)
      }
      console.error('invite-member: falha ao vincular conta existente', linkExistingError)
      return json({ error: 'Não foi possível adicionar agora.' }, 500)
    }

    return json({ status: 'added_existing', fullName: match.full_name }, 200)
  } catch (error) {
    console.error('invite-member: erro inesperado', error)
    return new Response(
      JSON.stringify({ error: 'Erro inesperado.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
