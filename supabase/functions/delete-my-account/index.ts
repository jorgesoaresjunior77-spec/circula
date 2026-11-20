import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { asaasFetch } from '../_shared/asaas.ts'

// Exclusão da PRÓPRIA conta (participante). Passos:
//   1. confere a sessão e que o perfil é de participante (profissional e master
//      não se excluem por aqui);
//   2. cancela as cobranças recorrentes no Asaas (assinatura da comunidade e
//      planos avulsos), sem nunca falhar a exclusão por causa disso;
//   3. apaga os vínculos que impedem a exclusão (círculos, respostas);
//   4. apaga o usuário. Se o banco recusar (por exemplo, pedidos de compra que
//      precisam ser guardados), a conta é ANONIMIZADA e o login é bloqueado.

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const {
      data: { user },
    } = await supabaseUser.auth.getUser()
    if (!user) return json({ error: 'Sem sessão ativa.' }, 401)

    const body = await req.json().catch(() => ({}))
    if (body?.confirm !== 'EXCLUIR') return json({ error: 'Confirmação ausente.', code: 'NOT_CONFIRMED' }, 400)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (!profile || profile.role !== 'member') {
      return json({ error: 'Esta conta não pode ser excluída por aqui. Fale com a administração.', code: 'NOT_ALLOWED' }, 403)
    }

    // 2) cobranças recorrentes (melhor esforço)
    const asaasIds: string[] = []
    const { data: subs } = await admin.from('subscriptions').select('asaas_subscription_id').eq('profile_id', user.id)
    const { data: addons } = await admin.from('addon_subscriptions').select('asaas_subscription_id').eq('profile_id', user.id)
    for (const row of [...(subs ?? []), ...(addons ?? [])]) {
      const id = row.asaas_subscription_id as string | null
      if (id && !id.startsWith('__provisioning__')) asaasIds.push(id)
    }
    for (const id of asaasIds) {
      try {
        await asaasFetch(`/subscriptions/${id}`, { method: 'DELETE' })
      } catch (e) {
        console.error('delete-my-account: falha ao cancelar no Asaas (segue)', id, e)
      }
    }

    // 3) vínculos que travam a exclusão
    await admin.from('circle_members').delete().eq('profile_id', user.id)
    await admin.from('checkin_responses').delete().eq('profile_id', user.id)

    // 4) exclusão; se recusada, anonimiza e bloqueia o login
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
    if (!deleteError) return json({ ok: true, mode: 'deleted' })

    console.error('delete-my-account: exclusão recusada, anonimizando', deleteError)
    await admin
      .from('profiles')
      .update({ full_name: 'Conta excluída', bio: null, avatar_url: null, banner_url: null, city: null, birth_city: null, birth_date: null, interests: [], gallery_photos: [] })
      .eq('id', user.id)
    const { error: banError } = await admin.auth.admin.updateUserById(user.id, { ban_duration: '876000h' })
    if (banError) {
      console.error('delete-my-account: falha ao bloquear o login', banError)
      return json({ error: 'Não foi possível concluir a exclusão agora.' }, 500)
    }
    return json({ ok: true, mode: 'anonymized' })
  } catch (error) {
    console.error('delete-my-account: erro', error)
    return json({ error: 'Não foi possível excluir a conta agora.' }, 500)
  }
})
