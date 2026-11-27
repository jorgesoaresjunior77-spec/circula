// O Círcula é só para mulheres (regra do produto, 2026-11-27). No cadastro, o primeiro nome (e, sem nome
// reconhecido, o começo do e-mail) é comparado com duas listas:
//  - MASCULINOS: nome claramente masculino -> o cadastro é recusado;
//  - AMBIGUOS: nome usado pelos dois -> o cadastro entra, mas a entrada na comunidade fica esperando a
//    aprovação da profissional.
// A MESMA lista está no banco (função public.gender_hint, migration 20261227140000): o servidor é quem
// barra de verdade; aqui só damos a mensagem clara antes de enviar. Se mudar uma, mude a outra.

export const MASCULINOS = [
  'abel', 'abner', 'adao', 'ademir', 'adilson', 'adriano', 'adolfo', 'afonso', 'agostinho', 'alberto', 'alcides', 'aldo', 'alexandre',
  'alfredo', 'almir', 'aloisio', 'alvaro', 'amadeu', 'amauri', 'americo', 'anderson', 'andre', 'anibal', 'anselmo', 'anthony', 'antonio',
  'armando', 'arnaldo', 'arthur', 'artur', 'augusto', 'aurelio', 'benedito', 'benjamin', 'bento', 'bernardo', 'breno', 'bruno', 'caetano',
  'caio', 'carlos', 'cassio', 'cauan', 'caua', 'celso', 'cesar', 'cicero', 'claudio', 'cleber', 'cleiton', 'cristiano', 'cristovao',
  'daniel', 'danilo', 'davi', 'david', 'denis', 'diego', 'diogo', 'domingos', 'douglas', 'edgar', 'edilson', 'edmilson', 'edson',
  'eduardo', 'edvaldo', 'elias', 'elton', 'emanuel', 'emerson', 'enrico', 'enzo', 'erick', 'eric', 'ernesto', 'evandro', 'everton',
  'ezequiel', 'fabiano', 'fabio', 'fabricio', 'felipe', 'fernando', 'flavio', 'francisco', 'frederico', 'gabriel', 'gael', 'geraldo',
  'gerson', 'gilberto', 'gilmar', 'gilson', 'giovanni', 'gustavo', 'heitor', 'helio', 'henrique', 'hugo', 'humberto', 'igor', 'ismael',
  'isaac', 'ivan', 'jair', 'jairo', 'jefferson', 'jeferson', 'joao', 'joaquim', 'joel', 'jonas', 'jonathan', 'jorge', 'jose', 'josue',
  'juliano', 'julio', 'junior', 'jurandir', 'kaique', 'kaua', 'kauan', 'kevin', 'lauro', 'leandro', 'leonardo', 'lorenzo', 'luan',
  'lucas', 'luciano', 'lucio', 'luis', 'luiz', 'manoel', 'manuel', 'marcelo', 'marcio', 'marco', 'marcos', 'mario', 'mateus', 'matheus',
  'mauricio', 'mauro', 'miguel', 'milton', 'moises', 'murilo', 'natan', 'nathan', 'nelson', 'nicolas', 'nilton', 'orlando', 'osvaldo',
  'oswaldo', 'otavio', 'otto', 'pablo', 'patrick', 'paulo', 'pedro', 'pietro', 'rafael', 'raphael', 'raimundo', 'raul', 'reginaldo',
  'reinaldo', 'renan', 'renato', 'ricardo', 'roberto', 'robson', 'rodolfo', 'rodrigo', 'rogerio', 'romario', 'ronaldo', 'ruan', 'rubens',
  'rui', 'samuel', 'sandro', 'saulo', 'sebastiao', 'sergio', 'severino', 'sidnei', 'sidney', 'silvio', 'tadeu', 'thales', 'tales',
  'theo', 'thiago', 'tiago', 'thomas', 'tomas', 'ulisses', 'vagner', 'valdemar', 'valdir', 'valter', 'vanderlei', 'vicente', 'vinicius',
  'vitor', 'victor', 'wagner', 'waldir', 'walter', 'wanderley', 'washington', 'wellington', 'wesley', 'william', 'willian', 'wilson', 'yuri',
]

export const AMBIGUOS = [
  'alex', 'altair', 'ariel', 'cris', 'dagmar', 'dani', 'darci', 'darcy', 'edir', 'eli', 'francis', 'gil', 'jaci', 'jean', 'joaci',
  'juraci', 'kim', 'nadir', 'neri', 'noa', 'rene', 'sasha', 'valdeci',
]

export type GenderHint = 'male' | 'ambiguous' | null

/** Minúsculas e sem acento: "João" -> "joao". */
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** Primeira palavra do nome ("Maria Clara" -> "maria"). */
function firstWord(name: string): string {
  return normalize(name).trim().split(/[^a-z]+/).filter(Boolean)[0] ?? ''
}

/** Começo do e-mail ("joao.silva82@..." -> "joao"). */
function emailWord(email: string): string {
  return normalize(email.split('@')[0] ?? '').split(/[^a-z]+/).filter(Boolean)[0] ?? ''
}

/** Mesma regra do banco: nome masculino recusa; nome ambíguo, ou nome que não é da lista com e-mail masculino, vai para revisão. */
export function genderHint(fullName: string, email = ''): GenderHint {
  const first = firstWord(fullName)
  if (MASCULINOS.includes(first)) return 'male'
  if (AMBIGUOS.includes(first)) return 'ambiguous'
  const fromEmail = emailWord(email)
  if (fromEmail && MASCULINOS.includes(fromEmail)) return 'ambiguous'
  return null
}

export const SO_MULHERES_MESSAGE =
  'O Círcula é uma comunidade só para mulheres, e não conseguimos aceitar este cadastro. Se você é mulher e o seu nome foi recusado por engano, fale com quem te convidou.'
