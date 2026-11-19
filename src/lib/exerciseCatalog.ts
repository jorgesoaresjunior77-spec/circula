// Biblioteca base de exercícios com o peso do próprio corpo (sem aparelhos).
//
// Estes textos são um PONTO DE PARTIDA: entram no app como RASCUNHO e só
// aparecem para as participantes depois que a nutricionista revisa e publica
// (Painel → Exercícios). Os movimentos são básicos e de baixo risco, descritos
// de forma geral; não são tratamento de doenças e não substituem a orientação
// de um profissional de educação física ou de saúde.

export const CATEGORIES = [
  'Corpo inteiro',
  'Pernas',
  'Glúteos',
  'Abdômen',
  'Braços',
  'Peito',
  'Costas',
  'Mobilidade',
  'Alongamento',
  'Equilíbrio',
  'Flexibilidade',
  'Condicionamento físico',
  'Baixo impacto',
  'Iniciantes',
  'Mulheres 40+',
  'Mulheres 50+',
  'Mulheres 60+',
] as const
export type Category = (typeof CATEGORIES)[number]

export const GOALS = ['Fortalecer', 'Mobilidade', 'Equilíbrio', 'Alongar', 'Condicionamento', 'Postura'] as const
export type Goal = (typeof GOALS)[number]

export const LEVELS = ['Iniciante', 'Intermediário'] as const
export type Level = (typeof LEVELS)[number]

export interface ExerciseBase {
  slug: string
  name: string
  categories: Category[]
  goals: Goal[]
  level: Level
  /** 'reps' = repetições; 'time' = segundos (cronômetro). */
  mode: 'reps' | 'time'
  /** Repetições por série (reps) ou segundos de duração (time). */
  target: number
  sets: number
  rest_sec: number
  /** Chaves de pose (src/lib/exercisePoses.ts): posição inicial e execução. */
  pose_start: string
  pose_end: string
  description: string
  steps: string[]
  muscles: string[]
  cautions: string
  mistakes: string[]
}

export const GENERAL_SAFETY =
  'Respeite os seus limites. Pare se sentir dor, tontura, falta de ar fora do normal ou qualquer sintoma que preocupe, e procure orientação profissional. Estes exercícios não tratam doenças. Se você tem alguma condição de saúde, está grávida ou voltou há pouco de uma lesão ou cirurgia, converse com o seu médico antes de começar.'

export const BASE_EXERCISES: ExerciseBase[] = [
  {
    slug: 'agachamento-livre',
    name: 'Agachamento livre',
    categories: ['Pernas', 'Glúteos', 'Corpo inteiro', 'Iniciantes', 'Mulheres 40+'],
    goals: ['Fortalecer'],
    level: 'Iniciante',
    mode: 'reps',
    target: 10,
    sets: 3,
    rest_sec: 45,
    pose_start: 'squat_start',
    pose_end: 'squat_down',
    description: 'Movimento básico de sentar e levantar que fortalece pernas e glúteos e treina um gesto do dia a dia.',
    steps: [
      'Fique em pé com os pés na largura dos ombros e as pontas levemente para fora.',
      'Leve o quadril para trás e para baixo, como se fosse sentar numa cadeira, e estenda os braços à frente.',
      'Desça até onde conseguir manter as costas firmes e os calcanhares no chão.',
      'Empurre o chão com os pés e volte para a posição inicial.',
    ],
    muscles: ['Quadríceps', 'Glúteos', 'Posterior da coxa'],
    cautions: 'Se sentir desconforto no joelho, diminua a descida. Os joelhos acompanham a direção dos pés.',
    mistakes: ['Joelhos caindo para dentro', 'Calcanhares saindo do chão', 'Costas muito arredondadas'],
  },
  {
    slug: 'afundo',
    name: 'Afundo',
    categories: ['Pernas', 'Glúteos', 'Equilíbrio', 'Corpo inteiro'],
    goals: ['Fortalecer', 'Equilíbrio'],
    level: 'Intermediário',
    mode: 'reps',
    target: 8,
    sets: 3,
    rest_sec: 45,
    pose_start: 'lunge_start',
    pose_end: 'lunge_down',
    description: 'Passo à frente com flexão das duas pernas: trabalha pernas e glúteos e pede equilíbrio.',
    steps: [
      'Fique em pé, com o corpo reto e os braços ao lado.',
      'Dê um passo largo à frente com uma perna.',
      'Dobre os dois joelhos até a perna da frente ficar em ângulo reto, sem encostar o joelho de trás no chão.',
      'Empurre o chão com o pé da frente e volte. Repita e troque de lado.',
    ],
    muscles: ['Quadríceps', 'Glúteos', 'Panturrilhas'],
    cautions: 'Apoie uma mão na parede se precisar de equilíbrio. Evite se houver dor no joelho.',
    mistakes: ['Passo curto demais', 'Joelho da frente passando muito da ponta do pé', 'Tronco inclinado para frente'],
  },
  {
    slug: 'elevacao-de-quadril',
    name: 'Elevação de quadril (ponte)',
    categories: ['Glúteos', 'Pernas', 'Costas', 'Baixo impacto', 'Iniciantes', 'Mulheres 50+', 'Mulheres 60+'],
    goals: ['Fortalecer', 'Postura'],
    level: 'Iniciante',
    mode: 'reps',
    target: 12,
    sets: 3,
    rest_sec: 40,
    pose_start: 'bridge_start',
    pose_end: 'bridge_up',
    description: 'Deitada, você levanta o quadril. Fortalece glúteos e a parte de trás das coxas com pouco impacto.',
    steps: [
      'Deite de barriga para cima, com os joelhos dobrados e os pés no chão, na largura do quadril.',
      'Deixe os braços ao lado do corpo.',
      'Apertando os glúteos, levante o quadril até o corpo formar uma linha do ombro ao joelho.',
      'Segure um instante e desça devagar.',
    ],
    muscles: ['Glúteos', 'Posterior da coxa', 'Lombar (apoio)'],
    cautions: 'Não force a lombar para cima. Suba só até onde o movimento vier dos glúteos.',
    mistakes: ['Arquear demais a lombar', 'Pés muito longe do quadril', 'Subir rápido demais'],
  },
  {
    slug: 'prancha',
    name: 'Prancha nos antebraços',
    categories: ['Abdômen', 'Corpo inteiro', 'Costas', 'Condicionamento físico'],
    goals: ['Fortalecer', 'Postura'],
    level: 'Intermediário',
    mode: 'time',
    target: 20,
    sets: 3,
    rest_sec: 40,
    pose_start: 'plank_start',
    pose_end: 'plank_hold',
    description: 'Manter o corpo em linha reta apoiada nos antebraços. Começa com os joelhos no chão e evolui para as pernas estendidas.',
    steps: [
      'Apoie os antebraços no chão, com os cotovelos abaixo dos ombros. Comece com os joelhos apoiados.',
      'Contraia o abdômen e mantenha o corpo em linha reta, da cabeça aos joelhos.',
      'Quando estiver firme, estenda as pernas e apoie as pontas dos pés.',
      'Respire normalmente durante o tempo indicado.',
    ],
    muscles: ['Abdômen', 'Ombros', 'Glúteos', 'Lombar (estabilização)'],
    cautions: 'Se a lombar incomodar, volte para a versão com joelhos ou reduza o tempo.',
    mistakes: ['Quadril caindo', 'Quadril muito alto', 'Prender a respiração'],
  },
  {
    slug: 'abdominal-curto',
    name: 'Abdominal curto',
    categories: ['Abdômen', 'Baixo impacto', 'Iniciantes'],
    goals: ['Fortalecer'],
    level: 'Iniciante',
    mode: 'reps',
    target: 10,
    sets: 3,
    rest_sec: 40,
    pose_start: 'crunch_start',
    pose_end: 'crunch_up',
    description: 'Elevação curta do tronco, deitada, trabalhando o abdômen com amplitude pequena.',
    steps: [
      'Deite de barriga para cima, com os joelhos dobrados e os pés no chão.',
      'Apoie as mãos de leve atrás da cabeça, sem puxar o pescoço.',
      'Levante só a parte de cima das costas, expirando.',
      'Desça devagar, sem relaxar totalmente.',
    ],
    muscles: ['Reto abdominal'],
    cautions: 'Olhe para o teto durante o movimento, para não forçar o pescoço.',
    mistakes: ['Puxar o pescoço com as mãos', 'Subir o tronco inteiro', 'Fazer rápido, no impulso'],
  },
  {
    slug: 'flexao-no-joelho',
    name: 'Flexão de braços apoiada nos joelhos',
    categories: ['Braços', 'Peito', 'Corpo inteiro'],
    goals: ['Fortalecer'],
    level: 'Intermediário',
    mode: 'reps',
    target: 8,
    sets: 3,
    rest_sec: 50,
    pose_start: 'pushknee_start',
    pose_end: 'pushknee_down',
    description: 'Versão mais leve da flexão: peito, ombros e braços trabalham com os joelhos no chão.',
    steps: [
      'Apoie as mãos no chão, um pouco mais abertas que os ombros, e os joelhos atrás.',
      'Mantenha o corpo em linha reta dos joelhos à cabeça.',
      'Dobre os cotovelos e leve o peito em direção ao chão.',
      'Empurre o chão e estenda os braços.',
    ],
    muscles: ['Peitoral', 'Tríceps', 'Ombros', 'Abdômen'],
    cautions: 'Se os punhos incomodarem, apoie os punhos em um pano dobrado ou use a flexão na parede.',
    mistakes: ['Quadril para cima ou caído', 'Cotovelos muito abertos', 'Descida curta demais'],
  },
  {
    slug: 'flexao-na-parede',
    name: 'Flexão de braços na parede',
    categories: ['Peito', 'Braços', 'Baixo impacto', 'Iniciantes', 'Mulheres 50+', 'Mulheres 60+'],
    goals: ['Fortalecer'],
    level: 'Iniciante',
    mode: 'reps',
    target: 10,
    sets: 3,
    rest_sec: 40,
    pose_start: 'wallpush_start',
    pose_end: 'wallpush_in',
    description: 'A forma mais suave da flexão: de pé, apoiada na parede.',
    steps: [
      'Fique de frente para a parede, a um passo dela, e apoie as mãos na altura dos ombros.',
      'Mantenha o corpo em linha reta, com os pés no chão.',
      'Dobre os cotovelos e aproxime o peito da parede.',
      'Empurre a parede e volte.',
    ],
    muscles: ['Peitoral', 'Tríceps', 'Ombros'],
    cautions: 'Quanto mais longe da parede, mais difícil. Comece perto.',
    mistakes: ['Quadril projetado para trás', 'Cabeça caindo para frente', 'Movimento muito rápido'],
  },
  {
    slug: 'marcha-no-lugar',
    name: 'Marcha no lugar',
    categories: ['Condicionamento físico', 'Baixo impacto', 'Corpo inteiro', 'Iniciantes', 'Mulheres 50+', 'Mulheres 60+'],
    goals: ['Condicionamento'],
    level: 'Iniciante',
    mode: 'time',
    target: 60,
    sets: 2,
    rest_sec: 30,
    pose_start: 'march_start',
    pose_end: 'march_up',
    description: 'Elevar os joelhos alternadamente, sem saltos. Aquece o corpo e trabalha o condicionamento com baixo impacto.',
    steps: [
      'Fique em pé, com o corpo alto e o abdômen levemente firme.',
      'Eleve um joelho à frente e balance o braço oposto.',
      'Troque de lado em um ritmo confortável, sem saltar.',
      'Aumente ou diminua o ritmo conforme a sua respiração.',
    ],
    muscles: ['Pernas', 'Abdômen', 'Coração e pulmões'],
    cautions: 'Você deve conseguir conversar durante o exercício. Se faltar o ar, desacelere.',
    mistakes: ['Inclinar o tronco para trás', 'Pisar com força', 'Ritmo rápido demais'],
  },
  {
    slug: 'elevacao-de-perna-quatro-apoios',
    name: 'Elevação de perna em quatro apoios',
    categories: ['Glúteos', 'Costas', 'Baixo impacto'],
    goals: ['Fortalecer', 'Postura'],
    level: 'Iniciante',
    mode: 'reps',
    target: 10,
    sets: 3,
    rest_sec: 40,
    pose_start: 'kick_start',
    pose_end: 'kick_up',
    description: 'De quatro apoios, você leva uma perna para trás e para cima. Trabalha os glúteos.',
    steps: [
      'Apoie as mãos no chão, abaixo dos ombros, e os joelhos abaixo do quadril.',
      'Mantenha as costas retas e o abdômen firme.',
      'Leve uma perna para trás e para cima, com o joelho dobrado e o pé para o teto.',
      'Volte sem encostar o joelho no chão e repita. Troque de lado.',
    ],
    muscles: ['Glúteos', 'Posterior da coxa'],
    cautions: 'Não arqueie a lombar para subir mais. Use um tapete macio sob os joelhos.',
    mistakes: ['Girar o quadril para o lado', 'Arquear a lombar', 'Impulso exagerado'],
  },
  {
    slug: 'superman',
    name: 'Superman (extensão de costas)',
    categories: ['Costas', 'Glúteos', 'Baixo impacto'],
    goals: ['Fortalecer', 'Postura'],
    level: 'Iniciante',
    mode: 'reps',
    target: 10,
    sets: 3,
    rest_sec: 40,
    pose_start: 'superman_start',
    pose_end: 'superman_up',
    description: 'Deitada de bruços, você levanta braços e pernas por poucos centímetros para fortalecer as costas.',
    steps: [
      'Deite de bruços, com os braços esticados à frente e as pernas estendidas.',
      'Olhe para o chão, mantendo o pescoço alinhado.',
      'Levante braços, peito e pernas poucos centímetros, sem forçar.',
      'Segure um instante e desça devagar.',
    ],
    muscles: ['Eretores da coluna', 'Glúteos', 'Ombros'],
    cautions: 'Suba pouco. Se sentir desconforto na lombar, levante só os braços ou só as pernas.',
    mistakes: ['Subir demais e comprimir a lombar', 'Levantar a cabeça', 'Prender a respiração'],
  },
  {
    slug: 'cachorro-passaro',
    name: 'Cachorro-pássaro',
    categories: ['Costas', 'Abdômen', 'Equilíbrio', 'Baixo impacto', 'Mulheres 40+', 'Mulheres 50+'],
    goals: ['Equilíbrio', 'Postura', 'Fortalecer'],
    level: 'Iniciante',
    mode: 'reps',
    target: 8,
    sets: 3,
    rest_sec: 40,
    pose_start: 'birddog_start',
    pose_end: 'birddog_ext',
    description: 'De quatro apoios, você estende um braço e a perna do lado oposto. Treina equilíbrio e estabilidade do tronco.',
    steps: [
      'Fique de quatro apoios, com as costas retas.',
      'Estenda um braço à frente e a perna oposta para trás, na altura do corpo.',
      'Mantenha o quadril parado e segure por dois segundos.',
      'Volte devagar e troque de lado.',
    ],
    muscles: ['Abdômen', 'Eretores da coluna', 'Glúteos', 'Ombros'],
    cautions: 'Movimento lento e controlado. Se perder o equilíbrio, estenda só a perna ou só o braço.',
    mistakes: ['Girar o quadril', 'Subir a perna acima do corpo', 'Afundar a barriga'],
  },
  {
    slug: 'sentar-e-levantar',
    name: 'Sentar e levantar da cadeira',
    categories: ['Pernas', 'Glúteos', 'Baixo impacto', 'Iniciantes', 'Mulheres 50+', 'Mulheres 60+'],
    goals: ['Fortalecer', 'Equilíbrio'],
    level: 'Iniciante',
    mode: 'reps',
    target: 10,
    sets: 3,
    rest_sec: 45,
    pose_start: 'chair_start',
    pose_end: 'chair_up',
    description: 'Um gesto do dia a dia vira exercício: você senta e levanta de uma cadeira firme, sem usar as mãos se possível.',
    steps: [
      'Sente na ponta de uma cadeira firme, com os pés no chão e na largura do quadril.',
      'Cruze os braços à frente do peito.',
      'Incline o tronco levemente e levante-se, empurrando o chão com os pés.',
      'Sente de novo, devagar, controlando a descida.',
    ],
    muscles: ['Quadríceps', 'Glúteos'],
    cautions: 'Use uma cadeira estável, encostada na parede. Se precisar, apoie as mãos nas coxas ou nos braços da cadeira.',
    mistakes: ['Deixar o corpo cair na cadeira', 'Joelhos para dentro', 'Levantar no impulso'],
  },
  {
    slug: 'gato-e-vaca',
    name: 'Gato e vaca',
    categories: ['Mobilidade', 'Costas', 'Flexibilidade', 'Baixo impacto', 'Iniciantes', 'Mulheres 40+', 'Mulheres 50+', 'Mulheres 60+'],
    goals: ['Mobilidade', 'Postura'],
    level: 'Iniciante',
    mode: 'reps',
    target: 8,
    sets: 2,
    rest_sec: 20,
    pose_start: 'cat',
    pose_end: 'cow',
    description: 'Movimento suave da coluna em quatro apoios, alternando arredondar e alongar as costas.',
    steps: [
      'Fique de quatro apoios, com as mãos abaixo dos ombros.',
      'Expire e arredonde as costas para cima, olhando para o umbigo (gato).',
      'Inspire e leve a barriga em direção ao chão, olhando à frente (vaca).',
      'Alterne devagar, no ritmo da respiração.',
    ],
    muscles: ['Coluna', 'Abdômen', 'Ombros'],
    cautions: 'Movimento pequeno e sem dor. Não force a amplitude.',
    mistakes: ['Ir rápido demais', 'Forçar o pescoço', 'Esquecer de respirar'],
  },
  {
    slug: 'alongamento-de-quadriceps',
    name: 'Alongamento da frente da coxa',
    categories: ['Alongamento', 'Flexibilidade', 'Pernas', 'Equilíbrio', 'Mulheres 40+'],
    goals: ['Alongar', 'Equilíbrio'],
    level: 'Iniciante',
    mode: 'time',
    target: 25,
    sets: 2,
    rest_sec: 15,
    pose_start: 'quad_start',
    pose_end: 'quad_stretch',
    description: 'Em pé, você leva o calcanhar em direção ao glúteo para alongar a frente da coxa.',
    steps: [
      'Fique em pé, apoiando uma mão na parede se precisar.',
      'Dobre um joelho e segure o pé com a mão do mesmo lado.',
      'Leve o calcanhar em direção ao glúteo, mantendo os joelhos próximos.',
      'Segure o tempo indicado, sem dor, e troque de lado.',
    ],
    muscles: ['Quadríceps'],
    cautions: 'Alongue até sentir tensão confortável, nunca dor. Evite se houver dor no joelho.',
    mistakes: ['Arquear a lombar', 'Puxar o pé com força', 'Prender a respiração'],
  },
  {
    slug: 'alongamento-posterior',
    name: 'Alongamento da parte de trás das pernas',
    categories: ['Alongamento', 'Flexibilidade', 'Pernas', 'Costas', 'Mulheres 40+', 'Mulheres 50+'],
    goals: ['Alongar'],
    level: 'Iniciante',
    mode: 'time',
    target: 25,
    sets: 2,
    rest_sec: 15,
    pose_start: 'hamstring_start',
    pose_end: 'hamstring_fold',
    description: 'Inclinando o tronco para a frente, você alonga a parte de trás das coxas.',
    steps: [
      'Fique em pé, com os pés na largura do quadril e os joelhos levemente dobrados.',
      'Incline o tronco para a frente, levando o quadril para trás.',
      'Deixe os braços e a cabeça soltos, indo até onde estiver confortável.',
      'Segure o tempo indicado e suba devagar, com as costas relaxadas.',
    ],
    muscles: ['Posterior da coxa', 'Lombar'],
    cautions: 'Mantenha um pequeno dobrado nos joelhos. Suba devagar para evitar tontura.',
    mistakes: ['Travar os joelhos', 'Forçar até doer', 'Subir rápido demais'],
  },
  {
    slug: 'equilibrio-em-uma-perna',
    name: 'Equilíbrio em uma perna',
    categories: ['Equilíbrio', 'Baixo impacto', 'Iniciantes', 'Mulheres 50+', 'Mulheres 60+'],
    goals: ['Equilíbrio'],
    level: 'Iniciante',
    mode: 'time',
    target: 20,
    sets: 3,
    rest_sec: 20,
    pose_start: 'balance_start',
    pose_end: 'balance_lift',
    description: 'Ficar sobre uma perna só treina o equilíbrio e a estabilidade do quadril e do tornozelo.',
    steps: [
      'Fique em pé perto de uma parede ou de uma cadeira firme, para poder se apoiar.',
      'Transfira o peso para uma perna e levante a outra poucos centímetros à frente.',
      'Mantenha o olhar fixo em um ponto à frente e o corpo alto.',
      'Segure o tempo indicado e troque de lado.',
    ],
    muscles: ['Quadril', 'Tornozelo', 'Abdômen'],
    cautions: 'Faça sempre ao lado de um apoio. Quem já teve quedas deve começar com a mão apoiada.',
    mistakes: ['Prender a respiração', 'Olhar para os pés', 'Apoiar-se muito na parede'],
  },
  {
    slug: 'elevacao-de-calcanhares',
    name: 'Elevação de calcanhares',
    categories: ['Pernas', 'Equilíbrio', 'Baixo impacto', 'Iniciantes', 'Mulheres 50+', 'Mulheres 60+'],
    goals: ['Fortalecer', 'Equilíbrio'],
    level: 'Iniciante',
    mode: 'reps',
    target: 12,
    sets: 3,
    rest_sec: 30,
    pose_start: 'calf_start',
    pose_end: 'calf_up',
    description: 'Subir na ponta dos pés fortalece as panturrilhas e ajuda no equilíbrio.',
    steps: [
      'Fique em pé, com os pés na largura do quadril, e apoie uma mão na parede se precisar.',
      'Suba devagar na ponta dos pés, o mais alto que conseguir com controle.',
      'Segure um segundo no alto.',
      'Desça devagar até os calcanhares tocarem o chão.',
    ],
    muscles: ['Panturrilhas'],
    cautions: 'Mantenha o apoio por perto. Evite se houver dor aguda no tornozelo.',
    mistakes: ['Pés abrindo ou fechando', 'Descer rápido', 'Inclinar o tronco para a frente'],
  },
  {
    slug: 'elevacao-de-bracos',
    name: 'Elevação de braços acima da cabeça',
    categories: ['Braços', 'Mobilidade', 'Costas', 'Baixo impacto', 'Iniciantes', 'Mulheres 40+', 'Mulheres 50+', 'Mulheres 60+'],
    goals: ['Mobilidade', 'Postura'],
    level: 'Iniciante',
    mode: 'reps',
    target: 10,
    sets: 2,
    rest_sec: 20,
    pose_start: 'armraise_start',
    pose_end: 'armraise_up',
    description: 'Levantar os braços até onde der, mantendo os ombros relaxados, para mobilidade dos ombros.',
    steps: [
      'Fique em pé, com o corpo alto e os braços ao lado.',
      'Levante os braços à frente e para cima, devagar, inspirando.',
      'Vá até onde não sentir dor nem arquear as costas.',
      'Desça os braços expirando.',
    ],
    muscles: ['Ombros', 'Parte alta das costas'],
    cautions: 'Pare no ponto em que o ombro começar a incomodar. Não force a amplitude.',
    mistakes: ['Subir os ombros até as orelhas', 'Arquear a lombar', 'Movimento brusco'],
  },
  {
    slug: 'posicao-da-crianca',
    name: 'Posição da criança',
    categories: ['Alongamento', 'Flexibilidade', 'Costas', 'Mobilidade', 'Baixo impacto', 'Mulheres 40+', 'Mulheres 50+'],
    goals: ['Alongar', 'Mobilidade'],
    level: 'Iniciante',
    mode: 'time',
    target: 30,
    sets: 2,
    rest_sec: 15,
    pose_start: 'child_start',
    pose_end: 'child_fold',
    description: 'Sentada sobre os calcanhares, você leva o tronco para a frente e alonga as costas e os quadris.',
    steps: [
      'Ajoelhe e sente sobre os calcanhares.',
      'Incline o tronco para a frente, estendendo os braços no chão.',
      'Deixe a testa descansar e respire fundo.',
      'Segure o tempo indicado e volte devagar.',
    ],
    muscles: ['Costas', 'Quadril', 'Ombros'],
    cautions: 'Se o joelho incomodar, coloque uma almofada entre as coxas e as panturrilhas ou evite o movimento.',
    mistakes: ['Forçar o quadril para baixo', 'Prender a respiração', 'Levantar rápido'],
  },
  {
    slug: 'abertura-de-peito',
    name: 'Abertura de peito',
    categories: ['Peito', 'Alongamento', 'Flexibilidade', 'Mobilidade', 'Baixo impacto', 'Mulheres 40+', 'Mulheres 50+', 'Mulheres 60+'],
    goals: ['Alongar', 'Postura'],
    level: 'Iniciante',
    mode: 'time',
    target: 20,
    sets: 2,
    rest_sec: 15,
    pose_start: 'chest_start',
    pose_end: 'chest_open',
    description: 'Levar os braços para trás e abrir o peito ajuda a compensar as horas sentada ou curvada.',
    steps: [
      'Fique em pé, com o corpo alto e os pés na largura do quadril.',
      'Leve os braços para trás, com as mãos juntas ou soltas.',
      'Abra o peito e olhe para a frente, sem inclinar a cabeça para trás.',
      'Segure o tempo indicado respirando fundo.',
    ],
    muscles: ['Peitoral', 'Ombros'],
    cautions: 'Vá só até sentir um alongamento leve. Evite se houver dor no ombro.',
    mistakes: ['Arquear demais a lombar', 'Levantar os ombros', 'Forçar os braços para trás'],
  },
]

// ---------------- Funções de filtro e de montagem de treino ----------------

export interface Filterable {
  name: string
  categories: string[]
  goals: string[]
  level: string
}

export interface ExerciseFilters {
  query?: string
  category?: string | null
  goal?: string | null
  level?: string | null
  favoritesOnly?: boolean
}

function plain(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function filterExercises<T extends Filterable & { id?: string }>(items: T[], f: ExerciseFilters, favorites: ReadonlySet<string> = new Set()): T[] {
  const q = plain(f.query ?? '').trim()
  return items.filter(
    (e) =>
      (!q || plain(e.name).includes(q)) &&
      (!f.category || e.categories.includes(f.category)) &&
      (!f.goal || e.goals.includes(f.goal)) &&
      (!f.level || e.level === f.level) &&
      (!f.favoritesOnly || (e.id !== undefined && favorites.has(e.id))),
  )
}

/** Duração aproximada (segundos) de um exercício, contando séries, descansos e um tempo por repetição. */
export function exerciseSeconds(e: { mode: 'reps' | 'time'; target: number; sets: number; rest_sec: number }): number {
  const work = e.mode === 'time' ? e.target : e.target * 4
  return e.sets * work + Math.max(0, e.sets - 1) * e.rest_sec
}

/**
 * Monta um treino rápido de aproximadamente `minutes` minutos, alternando as
 * regiões do corpo (quem tem baixo impacto entra primeiro) e fechando com um
 * alongamento. Devolve exercícios com o número de séries ajustado.
 */
export function buildQuickWorkout<T extends Filterable & { mode: 'reps' | 'time'; target: number; sets: number; rest_sec: number }>(
  pool: T[],
  minutes: number,
  opts: { lowImpactOnly?: boolean; beginner?: boolean } = {},
): T[] {
  const budget = minutes * 60
  let list = pool.filter((e) => !opts.beginner || e.level === 'Iniciante')
  if (opts.lowImpactOnly) list = list.filter((e) => e.categories.includes('Baixo impacto'))
  const stretch = list.filter((e) => e.categories.includes('Alongamento'))
  const active = list.filter((e) => !e.categories.includes('Alongamento'))
  const picked: T[] = []
  let used = 0
  const cooldown = stretch[0]
  const reserve = cooldown ? exerciseSeconds({ ...cooldown, sets: 1 }) : 0
  for (const e of active) {
    const one = { ...e, sets: Math.min(e.sets, minutes >= 20 ? e.sets : 2) }
    const sec = exerciseSeconds(one)
    if (used + sec + reserve > budget) continue
    picked.push(one)
    used += sec + 20 // transição entre exercícios
  }
  if (cooldown && used + reserve <= budget + 30) picked.push({ ...cooldown, sets: 1 })
  return picked
}

export const QUICK_MINUTES = [5, 10, 15, 20, 30] as const

export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] as const

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
