// Carro em Dia: base de orientação automotiva (escrita uma vez, fixa e revisável). A Livi procura aqui pelas palavras da
// pergunta. Isto é orientação GERAL: não substitui a avaliação de um profissional, e cada resposta diz quando ela é necessária.

import { CARRO_EXTRA } from './carroConhecimentoExtra'

export type PrecisaProfissional = 'sim' | 'depende' | 'nao'

export interface CarroTopico {
  id: string
  tema: string
  pergunta: string
  resposta: string
  /** Possíveis causas, quando for um problema. */
  causas?: string[]
  passos: string[]
  profissional: PrecisaProfissional
  palavras: string[]
  /** Nomes de categorias de "Na minha cidade" que ajudam neste caso. */
  servicos?: string[]
}

export const TEMAS = [
  'Emergências na estrada',
  'Manutenção preventiva',
  'Óleo e filtros',
  'Pneus',
  'Freios e suspensão',
  'Bateria e parte elétrica',
  'Motor e câmbio',
  'Ar-condicionado',
  'Consumo',
  'Documentação e multas',
  'Segurança',
  'Compra e venda',
  'Lavagem e conservação',
  'Elétricos e híbridos',
] as const

const CARRO_BASE_ORIGINAL: CarroTopico[] = [
  // ---- manutenção preventiva ----
  {
    id: 'revisao-quando',
    tema: 'Manutenção preventiva',
    pergunta: 'Quando devo fazer a revisão do carro?',
    resposta: 'Siga o manual do proprietário: a maioria dos carros pede revisão a cada 10.000 km ou 12 meses, o que vier primeiro (alguns, a cada 5.000 km). Carros que rodam pouco também precisam: o tempo desgasta óleo, borrachas e fluidos.',
    passos: ['Procure no manual a tabela de revisões do seu modelo.', 'Agende na concessionária ou em oficina de confiança.', 'Peça a lista do que foi trocado e guarde a nota fiscal.'],
    profissional: 'sim',
    palavras: ['revisao', 'revisoes', 'manutencao', 'preventiva', 'quando fazer', 'km', 'quilometragem'],
    servicos: ['Mecânica', 'Centro automotivo'],
  },
  {
    id: 'checklist-mensal',
    tema: 'Manutenção preventiva',
    pergunta: 'O que posso conferir sozinha todo mês?',
    resposta: 'Em 10 minutos você confere o essencial: pressão dos pneus (a frio), nível do óleo, água do radiador e do limpador, funcionamento das luzes e buzina, e se há vazamentos no chão onde o carro dorme.',
    passos: ['Com o motor frio e o carro em piso plano, confira o nível do óleo na vareta.', 'Veja os reservatórios de água do radiador e do para-brisa.', 'Peça a alguém para acender faróis, lanternas, setas e luz de freio.', 'Calibre os pneus e olhe o desgaste.'],
    profissional: 'nao',
    palavras: ['conferir', 'checklist', 'cuidados', 'cuidar', 'verificar', 'mensal', 'dia a dia', 'nivel'],
  },
  {
    id: 'luz-painel',
    tema: 'Manutenção preventiva',
    pergunta: 'Acendeu uma luz no painel. E agora?',
    resposta: 'Luz vermelha é urgente: pare em local seguro e desligue o motor (óleo, temperatura, bateria, freio). Luz amarela/laranja é atenção: procure uma oficina em breve (injeção, ABS, airbag, pressão dos pneus).',
    causas: ['Vermelha de óleo: pressão baixa ou nível muito baixo.', 'Vermelha de temperatura: superaquecimento.', 'Amarela de injeção: sensor ou falha de combustão.', 'Amarela de ABS ou airbag: sistema de segurança com falha.'],
    passos: ['Anote qual luz acendeu (o manual mostra o desenho).', 'Se for vermelha, encoste com segurança e não ande mais com o carro.', 'Se for amarela, evite viagens longas e agende diagnóstico.', 'Chame o guincho se a luz vermelha persistir.'],
    profissional: 'sim',
    palavras: ['luz', 'painel', 'acendeu', 'aviso', 'injecao', 'abs', 'airbag', 'sinal', 'vermelha', 'amarela'],
    servicos: ['Mecânica', 'Auto elétrica', 'Guincho'],
  },
  // ---- óleo e filtros ----
  {
    id: 'troca-oleo',
    tema: 'Óleo e filtros',
    pergunta: 'De quanto em quanto tempo troco o óleo?',
    resposta: 'Depende do óleo e do uso. Em geral: sintético, a cada 10.000 km ou 1 ano; semissintético, em torno de 7.500 km ou 6 meses; mineral, perto de 5.000 km. Uso severo (trânsito pesado, poeira, trechos curtos) pede troca mais cedo. O manual manda.',
    passos: ['Veja no manual a especificação do óleo (viscosidade, ex.: 5W30).', 'Troque sempre o filtro de óleo junto.', 'Peça para anotar a data e a quilometragem.'],
    profissional: 'sim',
    palavras: ['oleo', 'trocar oleo', 'troca de oleo', 'sintetico', 'lubrificante', 'viscosidade'],
    servicos: ['Troca de óleo', 'Mecânica'],
  },
  {
    id: 'oleo-nivel',
    tema: 'Óleo e filtros',
    pergunta: 'Como vejo o nível do óleo?',
    resposta: 'Com o carro em piso plano e o motor frio (ou desligado há 10 minutos), puxe a vareta, limpe com um pano, reintroduza até o fim e puxe de novo. O óleo deve ficar entre as marcas mín. e máx.',
    passos: ['Estacione em piso plano.', 'Retire, limpe e reinsira a vareta.', 'Se estiver abaixo do mínimo, complete com o óleo indicado no manual.', 'Se o nível cai rápido, procure uma oficina: pode haver vazamento ou consumo anormal.'],
    profissional: 'depende',
    palavras: ['vareta', 'nivel do oleo', 'completar oleo', 'oleo baixo'],
  },
  {
    id: 'filtros',
    tema: 'Óleo e filtros',
    pergunta: 'Quais filtros o carro tem e quando trocar?',
    resposta: 'São quatro principais: óleo (a cada troca de óleo), ar do motor (em torno de 10 a 15 mil km), combustível (cerca de 20 mil km, varia) e ar-condicionado/cabine (a cada 10 mil km ou 1 ano). Poeira e trânsito pesado antecipam a troca.',
    passos: ['Consulte o manual do modelo.', 'Troque o filtro de cabine antes do verão para o ar-condicionado render.', 'Guarde a nota das peças.'],
    profissional: 'sim',
    palavras: ['filtro', 'filtros', 'filtro de ar', 'filtro de combustivel', 'filtro de cabine', 'polen'],
    servicos: ['Mecânica', 'Centro automotivo'],
  },
  // ---- pneus ----
  {
    id: 'calibragem',
    tema: 'Pneus',
    pergunta: 'Qual a pressão certa dos pneus?',
    resposta: 'A indicada pelo fabricante: está na etiqueta da coluna da porta do motorista ou na tampa do tanque, e no manual. Calibre com os pneus frios, a cada 15 dias, e confira o estepe. Pressão errada gasta mais combustível e desgasta o pneu.',
    passos: ['Leia a pressão na etiqueta (muda com a carga do carro).', 'Calibre a frio, antes de rodar.', 'Recoloque as tampinhas das válvulas.'],
    profissional: 'nao',
    palavras: ['calibragem', 'calibrar', 'pressao', 'pneu', 'libras', 'psi', 'estepe'],
  },
  {
    id: 'alinhamento-balanceamento',
    tema: 'Pneus',
    pergunta: 'Alinhamento e balanceamento: qual a diferença?',
    resposta: 'Alinhamento acerta o ângulo das rodas para o carro andar reto e o pneu gastar por igual. Balanceamento distribui o peso na roda para não vibrar. Faça os dois a cada 10.000 km, na troca de pneus ou após batidas fortes em buracos.',
    causas: ['Carro puxando para um lado: alinhamento.', 'Volante tremendo em velocidade (80 a 100 km/h): balanceamento.', 'Desgaste só em um lado do pneu: alinhamento ou suspensão.'],
    passos: ['Anote quando o sintoma aparece.', 'Leve a uma loja de pneus ou oficina com equipamento computadorizado.', 'Peça a conferência da suspensão se o problema voltar.'],
    profissional: 'sim',
    palavras: ['alinhamento', 'balanceamento', 'volante tremendo', 'puxando', 'vibrando', 'trepidando', 'vibracao'],
    servicos: ['Lojas de pneus', 'Borracharia', 'Centro automotivo'],
  },
  {
    id: 'pneu-careca',
    tema: 'Pneus',
    pergunta: 'Quando preciso trocar os pneus?',
    resposta: 'Quando o sulco chegar ao indicador de desgaste (TWI), que é um relevo dentro do sulco (limite legal de 1,6 mm), quando houver bolhas, cortes ou rachaduras, ou após cerca de 5 anos, mesmo com pouco uso. Pneu gasto aumenta a distância de frenagem, principalmente na chuva.',
    passos: ['Olhe o sulco na faixa toda do pneu, inclusive nas bordas.', 'Troque todos os pneus do mesmo eixo juntos.', 'Faça alinhamento e balanceamento após a troca.'],
    profissional: 'sim',
    palavras: ['pneu careca', 'trocar pneu', 'desgaste', 'sulco', 'bolha no pneu', 'pneu gasto', 'rodizio'],
    servicos: ['Lojas de pneus', 'Borracharia'],
  },
  {
    id: 'pneu-furado',
    tema: 'Pneus',
    pergunta: 'Furou o pneu. Como troco com segurança?',
    resposta: 'Pare em local plano e seguro, longe da pista, com pisca-alerta e triângulo. Se o local não for seguro ou você não tiver como trocar, chame o guincho ou o seguro: não precisa arriscar.',
    passos: ['Ligue o pisca-alerta, puxe o freio de mão e coloque o triângulo a uns 30 m.', 'Afrouxe os parafusos antes de levantar o carro com o macaco.', 'Levante, troque e aperte os parafusos em cruz.', 'Rode devagar até uma borracharia para conferir o estepe e consertar o pneu.'],
    profissional: 'depende',
    palavras: ['furou', 'pneu furado', 'trocar o pneu', 'macaco', 'estepe', 'pneu vazio', 'pneu murcho'],
    servicos: ['Borracharia', 'Guincho'],
  },
  // ---- freios e suspensão ----
  {
    id: 'freio-barulho',
    tema: 'Freios e suspensão',
    pergunta: 'O freio está fazendo barulho. O que pode ser?',
    resposta: 'Chiado agudo costuma indicar pastilhas no fim. Ruído de ferro raspando é urgente: o disco pode estar sendo danificado. Pedal baixo, mole ou carro puxando ao frear também pedem avaliação imediata.',
    causas: ['Pastilhas gastas.', 'Disco empenado ou riscado.', 'Pouco fluido de freio ou ar no sistema.', 'Sujeira ou umidade (some em poucas frenagens).'],
    passos: ['Evite andar muito rápido e aumente a distância do carro da frente.', 'Veja se a luz do freio acendeu no painel.', 'Leve o carro a uma oficina logo: freio não é item para adiar.'],
    profissional: 'sim',
    palavras: ['freio', 'freios', 'barulho no freio', 'chiado', 'pastilha', 'disco', 'pedal de freio', 'rangendo'],
    servicos: ['Mecânica', 'Centro automotivo'],
  },
  {
    id: 'suspensao-barulho',
    tema: 'Freios e suspensão',
    pergunta: 'Barulho de batida nas lombadas e buracos. O que é?',
    resposta: 'Costuma ser suspensão: amortecedores, buchas, pivôs ou terminais gastos. Além do barulho, o carro balança mais, desgasta pneus e perde estabilidade. Vale revisar, principalmente se o carro passou por buracos fortes.',
    causas: ['Amortecedor vazando ou gasto.', 'Buchas e coxins ressecados.', 'Terminal de direção ou pivô com folga.'],
    passos: ['Observe se o barulho é na frente ou atrás e em que situação.', 'Peça um teste de folga na suspensão.', 'Troque as peças em par (os dois lados do eixo).'],
    profissional: 'sim',
    palavras: ['suspensao', 'amortecedor', 'barulho lombada', 'batendo', 'toc toc', 'buraco', 'bucha', 'balanca'],
    servicos: ['Mecânica', 'Centro automotivo'],
  },
  // ---- bateria e elétrica ----
  {
    id: 'bateria-nao-pega',
    tema: 'Bateria e parte elétrica',
    pergunta: 'O carro não liga, só faz "tec tec". Será a bateria?',
    resposta: 'Muito provavelmente. Estalos rápidos ao girar a chave e luzes fracas indicam bateria descarregada. Se nada acontece e as luzes do painel nem acendem, pode ser bateria totalmente descarregada ou terminal solto.',
    causas: ['Bateria velha (duram, em média, de 2 a 4 anos).', 'Luz ou som deixado ligado.', 'Terminais sujos ou frouxos.', 'Alternador não carregando.'],
    passos: ['Confira se os terminais estão firmes e sem oxidação branca.', 'Tente a "chupeta" com um carro de bateria de mesma voltagem (positivo com positivo, negativo na massa).', 'Se ligar e voltar a falhar, leve para testar a bateria e o alternador.', 'Sem sucesso, chame um serviço de bateria ou o guincho.'],
    profissional: 'depende',
    palavras: ['bateria', 'nao liga', 'nao pega', 'tec tec', 'descarregada', 'partida', 'chupeta', 'carga'],
    servicos: ['Serviços de bateria', 'Auto elétrica', 'Guincho'],
  },
  {
    id: 'chupeta',
    tema: 'Bateria e parte elétrica',
    pergunta: 'Como dar carga na bateria (chupeta) sem estragar o carro?',
    resposta: 'Use cabos em bom estado e um carro com a mesma voltagem (12 V). A ordem importa: positivo da bateria boa no positivo da descarregada; negativo da boa em uma parte metálica (massa) do motor do carro com problema, nunca no polo negativo dele.',
    passos: ['Desligue os dois carros e as luzes.', 'Conecte o vermelho nos dois positivos.', 'Conecte o preto no negativo da bateria boa e na massa do carro com problema.', 'Ligue o carro que dá carga, espere uns 3 minutos e ligue o outro.', 'Desconecte na ordem inversa e rode por 30 minutos.'],
    profissional: 'depende',
    palavras: ['chupeta', 'cabos', 'dar carga', 'bateria descarregada', 'ajuda de outro carro'],
    servicos: ['Serviços de bateria', 'Guincho'],
  },
  {
    id: 'farois-luzes',
    tema: 'Bateria e parte elétrica',
    pergunta: 'Farol, lanterna ou seta queimou. Posso trocar?',
    resposta: 'Lâmpadas costumam ser simples de trocar em muitos carros, mas em outros exigem desmontar parte da carenagem. Dirigir com luz queimada é infração e perigoso: troque logo.',
    passos: ['Veja no manual o tipo de lâmpada.', 'Não toque no vidro da lâmpada com o dedo (halógena).', 'Se a lâmpada nova também queimar, procure a auto elétrica: pode haver problema no circuito.'],
    profissional: 'depende',
    palavras: ['farol', 'lampada', 'queimou', 'lanterna', 'seta', 'luz de freio', 'luz de re'],
    servicos: ['Auto elétrica', 'Peças e acessórios'],
  },
  // ---- motor e câmbio ----
  {
    id: 'superaquecimento',
    tema: 'Motor e câmbio',
    pergunta: 'O ponteiro de temperatura subiu. O que faço?',
    resposta: 'Pare em local seguro assim que possível e desligue o motor. Não abra a tampa do radiador quente: o líquido está sob pressão e pode queimar. Continuar rodando pode fundir o motor, um conserto muito caro.',
    causas: ['Pouca água/aditivo no radiador.', 'Vazamento em mangueira ou radiador.', 'Ventoinha ou válvula termostática com defeito.', 'Bomba d\'água falhando.'],
    passos: ['Ligue o pisca-alerta e encoste.', 'Desligue o motor e espere esfriar (mais de 30 minutos).', 'Só então confira o nível do reservatório.', 'Se faltar líquido, complete e vá devagar à oficina; se voltar a esquentar, chame o guincho.'],
    profissional: 'sim',
    palavras: ['esquentou', 'superaquecimento', 'temperatura', 'radiador', 'fumaca', 'vapor', 'ferveu', 'aquecendo'],
    servicos: ['Mecânica', 'Guincho'],
  },
  {
    id: 'motor-falhando',
    tema: 'Motor e câmbio',
    pergunta: 'O motor está falhando ou "morrendo". O que pode ser?',
    resposta: 'Falhas e engasgos têm várias origens. As mais comuns são velas, cabos ou bobina, filtro de combustível entupido, bicos injetores sujos ou combustível ruim. Avalie se começou após abastecer.',
    causas: ['Combustível adulterado ou com água.', 'Velas e bobinas desgastadas.', 'Filtros entupidos.', 'Sensor com defeito (luz de injeção acesa).'],
    passos: ['Lembre onde abasteceu da última vez e guarde o comprovante.', 'Evite acelerar forte.', 'Procure uma oficina para fazer o escaneamento eletrônico (diagnóstico).'],
    profissional: 'sim',
    palavras: ['falhando', 'engasgando', 'morrendo', 'morre', 'motor falha', 'sem forca', 'marcha lenta', 'trancos'],
    servicos: ['Mecânica', 'Auto elétrica'],
  },
  {
    id: 'cambio',
    tema: 'Motor e câmbio',
    pergunta: 'O câmbio está dando tranco ou demorando para engatar.',
    resposta: 'Em câmbio automático, trancos e demora para engatar podem indicar óleo vencido ou baixo, ou desgaste interno. No manual, a embreagem patinando (rotação sobe e o carro não acompanha) sugere desgaste. Quanto antes avaliar, menor o custo.',
    causas: ['Óleo do câmbio vencido ou com nível baixo.', 'Embreagem gasta (manual).', 'Sensor ou solenoide com defeito (automático).'],
    passos: ['Anote em que situação acontece (frio, quente, subida).', 'Verifique no manual quando trocar o óleo do câmbio.', 'Leve a um especialista em câmbio para diagnóstico.'],
    profissional: 'sim',
    palavras: ['cambio', 'tranco', 'engatar', 'embreagem', 'marcha', 'patinando', 'automatico', 'trocar marcha'],
    servicos: ['Mecânica'],
  },
  {
    id: 'fumaca',
    tema: 'Motor e câmbio',
    pergunta: 'Sai fumaça do escapamento. O que significa a cor?',
    resposta: 'Branca fina nos primeiros minutos é condensação, normal. Branca persistente e com cheiro doce: possível água no motor. Azulada: queima de óleo. Preta: mistura rica (excesso de combustível). Persistindo, procure uma oficina.',
    passos: ['Observe a cor e se acontece com o motor frio ou quente.', 'Confira o nível de óleo e o do radiador.', 'Evite viajar até o diagnóstico se a fumaça for branca persistente ou azulada.'],
    profissional: 'sim',
    palavras: ['fumaca', 'escapamento', 'fumaca branca', 'fumaca preta', 'fumaca azul', 'queimando oleo'],
    servicos: ['Mecânica'],
  },
  // ---- ar-condicionado ----
  {
    id: 'ar-nao-gela',
    tema: 'Ar-condicionado',
    pergunta: 'O ar-condicionado não está gelando.',
    resposta: 'Pode ser filtro de cabine sujo, falta de gás, compressor ou condensador com problema, ou ventoinha parada. Cheiro de mofo pede higienização.',
    causas: ['Filtro de cabine entupido.', 'Gás baixo (vazamento).', 'Compressor ou embreagem do compressor.', 'Ventoinha do condensador parada.'],
    passos: ['Troque o filtro de cabine se estiver vencido.', 'Veja se o compressor engata (um "clique" ao ligar o A/C).', 'Leve a uma oficina com equipamento para teste de pressão e vazamento.', 'Faça higienização uma vez por ano.'],
    profissional: 'sim',
    palavras: ['ar condicionado', 'ar-condicionado', 'nao gela', 'gas do ar', 'cheiro mofo', 'compressor', 'esquentando'],
    servicos: ['Ar-condicionado', 'Centro automotivo'],
  },
  // ---- consumo ----
  {
    id: 'economizar',
    tema: 'Consumo',
    pergunta: 'Como gastar menos combustível?',
    resposta: 'Pneus calibrados, aceleração e frenagem suaves, velocidade constante e menos peso no carro fazem diferença. Manutenção em dia (velas, filtros, óleo) também. Ar-condicionado e vidros abertos em alta velocidade aumentam o consumo.',
    passos: ['Calibre os pneus.', 'Troque de marcha na rotação certa e evite acelerar forte.', 'Tire o que não precisa do porta-malas.', 'Use o computador de bordo para acompanhar a média.'],
    profissional: 'nao',
    palavras: ['consumo', 'economizar', 'combustivel', 'gasolina', 'etanol', 'autonomia', 'gastando muito', 'km por litro'],
  },
  {
    id: 'etanol-gasolina',
    tema: 'Consumo',
    pergunta: 'Etanol ou gasolina: qual compensa?',
    resposta: 'Uma regra simples: se o preço do etanol for até cerca de 70% do preço da gasolina, o etanol costuma compensar (o carro faz menos km por litro com ele). Confira no seu carro: calcule o km/l com cada combustível.',
    passos: ['Divida o preço do etanol pelo da gasolina.', 'Abasteça o tanque cheio e zere o hodômetro parcial.', 'Compare o km/l real nos dois combustíveis.'],
    profissional: 'nao',
    palavras: ['etanol', 'alcool', 'gasolina', 'compensa', '70', 'flex'],
  },
  // ---- documentação ----
  {
    id: 'ipva-licenciamento',
    tema: 'Documentação e multas',
    pergunta: 'IPVA e licenciamento: o que são e quando pagar?',
    resposta: 'O IPVA é o imposto anual do veículo (estadual). O licenciamento é a taxa que autoriza o carro a circular (CRLV). Os prazos e descontos mudam por estado e pelo final da placa: consulte o site do Detran ou da Fazenda do seu estado.',
    passos: ['Consulte o calendário do seu estado (Detran).', 'Pague o IPVA e débitos antes do licenciamento.', 'Imprima ou baixe o CRLV digital no app do Detran/Carteira Digital de Trânsito.'],
    profissional: 'nao',
    palavras: ['ipva', 'licenciamento', 'crlv', 'detran', 'documento do carro', 'imposto', 'calendario'],
    servicos: ['Despachante'],
  },
  {
    id: 'multas',
    tema: 'Documentação e multas',
    pergunta: 'Recebi uma multa. O que faço?',
    resposta: 'Confira os dados da notificação (data, local, placa). Você pode pagar com desconto (quando houver) ou apresentar defesa dentro do prazo indicado na notificação. Se não for você quem dirigia, indique o condutor no prazo.',
    passos: ['Leia a notificação e anote o prazo.', 'Verifique no app do Detran se a multa consta.', 'Decida: pagar com desconto, apresentar defesa ou indicar condutor.', 'Em caso de dúvida ou valores altos, consulte um despachante ou advogado.'],
    profissional: 'depende',
    palavras: ['multa', 'multas', 'pontos', 'cnh', 'infracao', 'recurso', 'defesa', 'notificacao'],
    servicos: ['Despachante', 'Advocacia'],
  },
  {
    id: 'documentos',
    tema: 'Documentação e multas',
    pergunta: 'Quais documentos preciso levar ao dirigir?',
    resposta: 'A CNH (física ou digital) e o documento do veículo (CRLV, em papel ou digital). Mantenha o seguro obrigatório e o IPVA em dia. Ao comprar ou vender, a transferência precisa ser feita no prazo legal.',
    passos: ['Baixe a CNH Digital e o CRLV-e no celular.', 'Deixe uma cópia dos dados do seguro à mão.'],
    profissional: 'nao',
    palavras: ['documentos', 'cnh', 'crlv', 'documento obrigatorio', 'levar no carro', 'batida documento'],
    servicos: ['Despachante'],
  },
  // ---- segurança ----
  {
    id: 'seguranca-viagem',
    tema: 'Segurança',
    pergunta: 'Vou viajar de carro. O que conferir antes?',
    resposta: 'Pneus (incluindo o estepe), óleo, água, freios, luzes e limpador. Leve triângulo, macaco, chave de roda e carregador. Avise alguém do trajeto e programe paradas a cada 2 horas.',
    passos: ['Faça a revisão alguns dias antes.', 'Confira pneus e estepe.', 'Salve o telefone do seguro, do guincho e dos contatos de emergência.', 'Evite dirigir cansada ou à noite em estradas desconhecidas.'],
    profissional: 'depende',
    palavras: ['viagem', 'viajar', 'estrada', 'antes de viajar', 'rodovia', 'seguranca', 'cinto'],
    servicos: ['Mecânica', 'Seguros', 'Guincho'],
  },
  {
    id: 'carro-quebrou',
    tema: 'Segurança',
    pergunta: 'O carro quebrou na estrada. Como me proteger?',
    resposta: 'Sua segurança vem primeiro: saia do carro pelo lado oposto ao do trânsito, fique atrás do guard-rail e acione o guincho ou o seguro. Evite aceitar ajuda de desconhecidos se estiver sozinha.',
    passos: ['Encoste, ligue o pisca-alerta e coloque o triângulo.', 'Peça ajuda pelo número do seu seguro, do guincho ou da concessionária da rodovia.', 'Compartilhe sua localização com alguém de confiança.', 'Fique em local seguro até a ajuda chegar.'],
    profissional: 'sim',
    palavras: ['quebrou', 'pane', 'estrada', 'sozinha', 'ajuda', 'socorro', 'guincho', 'parou'],
    servicos: ['Guincho', 'Seguros'],
  },
  // ---- compra e venda ----
  {
    id: 'comprar-usado',
    tema: 'Compra e venda',
    pergunta: 'O que olhar ao comprar um carro usado?',
    resposta: 'Consulte o histórico (leilão, sinistro, multas, débitos e restrições), confira se o chassi e a documentação batem, veja a lataria e os pneus, faça test drive e leve a um mecânico de confiança para avaliar antes de pagar.',
    passos: ['Peça o CRLV e confira dono, chassi e placa.', 'Consulte débitos e restrições no Detran.', 'Faça um laudo cautelar (vistoria).', 'Só pague e transfira com recibo e dentro do prazo.'],
    profissional: 'sim',
    palavras: ['comprar carro', 'carro usado', 'seminovo', 'laudo', 'vistoria', 'comprar', 'leilao', 'test drive'],
    servicos: ['Lojas de veículos', 'Concessionárias', 'Mecânica', 'Despachante'],
  },
  {
    id: 'vender-carro',
    tema: 'Compra e venda',
    pergunta: 'Vou vender meu carro. Como me proteger?',
    resposta: 'Evite golpes: só entregue o carro depois de confirmar o pagamento na sua conta, nunca aceite comprovante de terceiros ou cheque. Comunique a venda ao Detran no prazo para não responder por multas do novo dono.',
    passos: ['Faça o Documento de Autorização (ATPV-e) pelo canal oficial.', 'Confirme o dinheiro na sua conta antes de entregar o carro e a documentação.', 'Comunique a venda ao Detran.', 'Guarde cópia de tudo.'],
    profissional: 'depende',
    palavras: ['vender carro', 'venda', 'transferencia', 'golpe', 'atpv', 'comunicar venda', 'vendi'],
    servicos: ['Despachante', 'Lojas de veículos'],
  },
  {
    id: 'seguro-auto',
    tema: 'Compra e venda',
    pergunta: 'Como escolher um seguro para o carro?',
    resposta: 'Compare coberturas, não só o preço: roubo e furto, colisão, terceiros, assistência 24h e carro reserva. Veja a franquia (valor que você paga em caso de sinistro) e peça cotações em mais de uma seguradora.',
    passos: ['Anote modelo, ano, CEP de pernoite e quem dirige.', 'Peça ao menos 3 cotações com as mesmas coberturas.', 'Leia o que NÃO está coberto e a franquia.'],
    profissional: 'depende',
    palavras: ['seguro', 'franquia', 'cobertura', 'seguradora', 'apolice', 'assistencia 24'],
    servicos: ['Seguros'],
  },
  {
    id: 'oficina-confianca',
    tema: 'Manutenção preventiva',
    pergunta: 'Como não ser enganada na oficina?',
    resposta: 'Peça orçamento por escrito antes do serviço, com peças e mão de obra separadas, e autorize só o que foi combinado. Peça de volta as peças trocadas e guarde a nota. Em serviços caros, vale um segundo orçamento.',
    passos: ['Descreva o sintoma com calma e peça o diagnóstico.', 'Receba o orçamento por escrito.', 'Pergunte o que é urgente e o que pode esperar.', 'Peça as peças antigas e a nota fiscal.'],
    profissional: 'sim',
    palavras: ['oficina', 'enganada', 'golpe', 'orcamento', 'mecanico', 'confianca', 'preco', 'nota'],
    servicos: ['Mecânica', 'Centro automotivo'],
  },
]

/** A base completa: os tópicos originais e as dúvidas frequentes ampliadas (2026-11-27). */
export const CARRO_BASE: CarroTopico[] = [...CARRO_BASE_ORIGINAL, ...CARRO_EXTRA]

/** Todos os serviços possíveis do Carro em Dia (nomes iguais aos de "Na minha cidade"). */
export const SERVICOS_AUTOMOTIVOS = [
  'Concessionárias',
  'Lojas de veículos',
  'Lojas de pneus',
  'Mecânica',
  'Centro automotivo',
  'Funilaria e pintura',
  'Auto elétrica',
  'Serviços de bateria',
  'Troca de óleo',
  'Lava-jato',
  'Estética automotiva',
  'Guincho',
  'Seguros',
  'Despachante',
  'Peças e acessórios',
] as const

const sem = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Procura os tópicos que mais combinam com a pergunta (palavras-chave, sem acento). Vazio se nada combinar. */
export function buscarNaBase(pergunta: string, max = 3): CarroTopico[] {
  const q = sem(pergunta)
  if (q.trim().length < 3) return []
  const palavras = q.split(/[^a-z0-9]+/).filter((w) => w.length > 2)
  const pontuados = CARRO_BASE.map((t) => {
    let pts = 0
    for (const k of t.palavras) {
      const kk = sem(k)
      if (q.includes(kk)) pts += kk.includes(' ') ? 4 : 3
      else if (palavras.some((w) => kk === w)) pts += 2
    }
    if (palavras.some((w) => sem(t.pergunta).includes(w))) pts += 0.5
    return { t, pts }
  })
    .filter((x) => x.pts >= 2)
    .sort((a, b) => b.pts - a.pts)
  return pontuados.slice(0, max).map((x) => x.t)
}

export const AVISO_PROFISSIONAL: Record<PrecisaProfissional, string> = {
  sim: 'Aqui, a avaliação presencial de um profissional é necessária. Não deixe para depois.',
  depende: 'Se o problema continuar ou você não tiver segurança, procure um profissional.',
  nao: 'Você mesma consegue conferir. Se algo parecer fora do normal, procure um profissional.',
}
