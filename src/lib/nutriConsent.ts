// Termo de consentimento para o tratamento de dados de saúde (LGPD, art. 11).
// É um modelo de partida: a nutricionista deve revisá-lo com quem cuida da
// parte jurídica dela antes de usar com pacientes.

import { brDate } from './nutri'
import { esc, shell } from './nutriPrint'

export const CONSENT_VERSION = '2026-11'

export const CONSENT_PARAGRAPHS: string[] = [
  'Eu autorizo a nutricionista responsável a registrar e tratar meus dados pessoais e de saúde (histórico clínico, hábitos, medidas corporais, exames, planos alimentares e anotações das consultas) para a finalidade exclusiva de realizar o meu acompanhamento nutricional.',
  'Esses dados ficam guardados em ambiente protegido e só a nutricionista responsável tem acesso a eles. As demais participantes da comunidade e a equipe da plataforma não os visualizam. Eu só visualizo, no meu perfil, o que a nutricionista escolher compartilhar comigo.',
  'Os dados não serão vendidos nem usados para outra finalidade sem novo consentimento. Podem ser mantidos pelo tempo necessário ao acompanhamento e pelos prazos exigidos por lei e pelas normas da profissão.',
  'Eu posso, a qualquer momento, pedir uma cópia dos meus dados, a correção deles, a exclusão e revogar este consentimento, falando com a nutricionista.',
]

export function consentHtml(patient: string, nutri: string, when = brDate(new Date().toISOString())): string {
  const body = `<h2>Termo de consentimento para tratamento de dados de saúde</h2>
${CONSENT_PARAGRAPHS.map((p) => `<p>${esc(p)}</p>`).join('\n')}
<p style="margin-top:34px">Paciente: <strong>${esc(patient)}</strong></p>
<p style="margin-top:34px">_______________________________________ &nbsp; Data: ____/____/______</p>
<p class="sub">Assinatura da paciente</p>
<p style="margin-top:26px">Nutricionista: <strong>${esc(nutri || '—')}</strong></p>
<p class="sub">Versão do termo: ${CONSENT_VERSION}</p>`
  return shell('Consentimento (LGPD)', patient, nutri, body, when)
}
