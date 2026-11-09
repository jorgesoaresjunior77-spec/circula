// Conteúdo da Central de Ajuda. Cada resposta descreve o que o app faz DE
// VERDADE hoje. Quando algo ainda não existe no app, a resposta diz isso com
// honestidade e indica o caminho (normalmente o Help Nutri).

export interface HelpItem {
  id: string
  q: string
  a: string
  /** Palavras extras para a busca (sinônimos). */
  k?: string
}

export interface HelpCategory {
  id: string
  title: string
  description: string
  items: HelpItem[]
}

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    id: 'primeiros-passos',
    title: 'Primeiros passos',
    description: 'Conheça o Círcula e comece a usar.',
    items: [
      {
        id: 'pp-1',
        q: 'O que é o Círcula?',
        a: 'O Círcula é o aplicativo da comunidade Fluir & Florescer, criado pela nutricionista Marluce Bassani Fernandes. É um espaço de cuidado e amizade entre mulheres, com comunidade, círculos de conversa, eventos, receitas, revista e ferramentas de bem-estar.',
        k: 'aplicativo app comunidade fluir florescer marluce',
      },
      {
        id: 'pp-2',
        q: 'Como funciona o aplicativo?',
        a: 'Ao entrar, você chega na página inicial (Início), que reúne a saudação, a agenda e as ferramentas do dia, os atalhos do Menu, os Círculos, a revista e os conteúdos. Pela barra de baixo você vai ao Feed (a comunidade) e ao seu Perfil. Os demais conteúdos abrem pelos cards da página inicial.',
        k: 'funciona usar começar inicio home',
      },
      {
        id: 'pp-3',
        q: 'Como criar minha conta?',
        a: 'A conta de participante é criada pelo link de convite que a nutricionista envia (por exemplo, no WhatsApp). Abra o link, preencha seus dados e crie a conta. Sem o link de convite, não é possível entrar numa comunidade; se perdeu o link, peça um novo a quem convidou você.',
        k: 'cadastro cadastrar convite link registrar',
      },
      {
        id: 'pp-4',
        q: 'Como acessar o aplicativo pela primeira vez?',
        a: 'Depois de criar a conta, entre com o seu e-mail e a sua senha. Na primeira vez, o app pode mostrar uma apresentação rápida de boas-vindas. Para abrir mais rápido nos próximos dias, instale o Círcula na tela inicial do celular, seguindo o guia que o app mostra.',
        k: 'entrar login acesso primeiro acesso instalar',
      },
      {
        id: 'pp-5',
        q: 'Como completar meu perfil?',
        a: 'Toque em Meu perfil na barra de baixo e depois em Editar perfil. Você pode preencher o nome, a cidade, o campo Sobre você e os seus interesses. Salve no final. Quanto mais completo, mais fácil as outras participantes conhecerem você.',
        k: 'perfil editar dados bio cidade interesses',
      },
      {
        id: 'pp-6',
        q: 'Como alterar minha foto?',
        a: 'Em Meu perfil, use o botão para trocar a foto. Escolha uma imagem do celular, ajuste o enquadramento e confirme. O mesmo vale para o banner do perfil e para as fotos da galeria.',
        k: 'foto avatar imagem trocar perfil banner galeria',
      },
      {
        id: 'pp-7',
        q: 'Como alterar meus dados pessoais?',
        a: 'Em Meu perfil, toque em Editar perfil e altere nome, cidade, texto Sobre você e interesses. Para mudar o e-mail da conta, fale com a nutricionista pelo Help Nutri, pois essa troca ainda não é feita dentro do app.',
        k: 'dados nome cidade atualizar editar email',
      },
      {
        id: 'pp-8',
        q: 'Como navegar pelo aplicativo?',
        a: 'Use a barra de baixo para ir ao Início, ao Feed e ao Perfil. Na página inicial, role para baixo e toque nos cards para abrir cada área. Nas telas internas há o botão Voltar no alto, que leva de volta ao Início.',
        k: 'menu navegação voltar barra',
      },
      {
        id: 'pp-9',
        q: 'Como encontrar as principais funcionalidades?',
        a: 'Na página inicial: Agenda e relógio, Antes de Tudo, Água e IMC (os três ícones), o Menu (Meu Perfil, Help Nutri, Eventos, Loja, Receitas e Meu Jardim), os Círculos, a revista, as vitrines de Eventos, Receitas e Loja, e o menu de Dicas de leitura, Respiração, Assinaturas e Playlist. No fim da página fica esta Ajuda.',
        k: 'onde encontrar funcionalidades recursos',
      },
    ],
  },
  {
    id: 'conta-acesso',
    title: 'Conta e acesso',
    description: 'Entrar, senha e segurança da conta.',
    items: [
      {
        id: 'ca-1',
        q: 'Esqueci minha senha. Como recuperar?',
        a: 'Na tela de entrada, toque em Esqueci minha senha, informe o e-mail da conta e envie. Você recebe um link por e-mail; abra o link e escolha uma nova senha. Se o e-mail não chegar, olhe também a caixa de spam e aguarde alguns minutos.',
        k: 'senha recuperar esqueci redefinir recuperação acesso',
      },
      {
        id: 'ca-2',
        q: 'Como alterar minha senha?',
        a: 'Hoje a troca de senha é feita pelo mesmo caminho da recuperação: na tela de entrada, toque em Esqueci minha senha, receba o link no e-mail e defina a nova senha.',
        k: 'senha trocar mudar alterar segurança',
      },
      {
        id: 'ca-3',
        q: 'Como alterar meu e-mail?',
        a: 'A troca de e-mail ainda não é feita dentro do aplicativo. Fale com a nutricionista pelo Help Nutri, informando o e-mail atual e o novo, para que ela providencie.',
        k: 'email e-mail trocar mudar alterar',
      },
      {
        id: 'ca-4',
        q: 'Como atualizar meus dados?',
        a: 'Nome, cidade, texto Sobre você, interesses e fotos ficam em Meu perfil, no botão Editar perfil. Dados de cobrança (como o CPF) são pedidos na página Planos, na hora de assinar.',
        k: 'dados atualizar perfil cpf',
      },
      {
        id: 'ca-5',
        q: 'Como sair da minha conta?',
        a: 'Toque em Sair, no topo da tela (no cabeçalho, ao lado do seu nome). Você volta para a tela de entrada.',
        k: 'sair logout desconectar',
      },
      {
        id: 'ca-6',
        q: 'Posso acessar o Círcula em outro celular?',
        a: 'Sim. Abra o endereço do Círcula no outro aparelho e entre com o mesmo e-mail e a mesma senha. Seus dados ficam na sua conta, não no celular.',
        k: 'outro celular aparelho dispositivo trocar de celular',
      },
      {
        id: 'ca-7',
        q: 'Como manter minha conta segura?',
        a: 'Use uma senha forte que você não usa em outros lugares, não compartilhe a senha com ninguém e saia da conta em aparelhos que não são seus. Se suspeitar de acesso indevido, use Esqueci minha senha para criar uma senha nova e avise a nutricionista.',
        k: 'segurança proteger senha forte',
      },
      {
        id: 'ca-8',
        q: 'O que fazer se não conseguir entrar?',
        a: 'Confira se o e-mail está escrito corretamente e use o olhinho para ver a senha digitada. Se não lembrar da senha, use Esqueci minha senha. Se o erro continuar, ou se a mensagem falar de assinatura ou acesso bloqueado, fale com a nutricionista pelo Help Nutri ou por outro canal que ela já usa com você.',
        k: 'não consigo entrar erro login acesso bloqueado problema',
      },
      {
        id: 'ca-9',
        q: 'Como excluir minha conta?',
        a: 'A exclusão da conta ainda não é feita dentro do aplicativo. Se quiser encerrar a conta e pedir a exclusão dos seus dados, fale com a nutricionista pelo Help Nutri; ela encaminha o pedido. Antes, se tiver uma assinatura ativa, cancele em Planos.',
        k: 'excluir apagar deletar conta encerrar cancelar cadastro lgpd',
      },
    ],
  },
  {
    id: 'assinaturas-pagamentos',
    title: 'Assinaturas e pagamentos',
    description: 'Planos, cobrança e validade.',
    items: [
      {
        id: 'ap-1',
        q: 'Quais são os planos disponíveis?',
        a: 'Na página Planos (card Assinaturas, no menu da página inicial) você vê o plano do Círcula nos ciclos mensal, semestral e anual, os conteúdos avulsos (Círcula Magazine, Receitas e E-books) e o superpacote Círcula completo. Os valores aparecem na própria página.',
        k: 'planos preços valores mensal semestral anual pacote',
      },
      {
        id: 'ap-2',
        q: 'Qual a diferença entre os planos?',
        a: 'A diferença é o período e o desconto: quanto maior o ciclo (semestral ou anual), menor o valor por mês. O superpacote reúne o Círcula e os três conteúdos avulsos por um preço menor do que comprar cada um separado. A página Planos mostra a economia de cada opção.',
        k: 'diferença planos economia desconto pacote',
      },
      {
        id: 'ap-3',
        q: 'Como assinar o Círcula?',
        a: 'Abra Planos pelo card Assinaturas. Se pedir, informe o seu CPF ou CNPJ para a cobrança e salve. Depois toque em Assinar; uma página de pagamento abre em outra aba para você concluir. Hoje a assinatura disponível para contratar é a mensal; semestral, anual e os pacotes aparecem como em breve.',
        k: 'assinar contratar pagar comprar assinatura',
      },
      {
        id: 'ap-4',
        q: 'Como funciona a cobrança mensal?',
        a: 'Na assinatura mensal você paga uma vez por mês. A cobrança é recorrente: ao fim de cada período, uma nova fatura é gerada. Você acompanha a situação e a próxima renovação na página Planos.',
        k: 'cobrança mensal fatura recorrente',
      },
      {
        id: 'ap-5',
        q: 'Como funciona a assinatura semestral?',
        a: 'No plano semestral você paga por seis meses de uma vez, com desconto em relação a seis mensalidades. Na página Planos você vê o valor e a economia. Esse ciclo ainda está sendo liberado para contratação.',
        k: 'semestral seis meses 6 meses',
      },
      {
        id: 'ap-6',
        q: 'Como funciona a assinatura anual?',
        a: 'No plano anual você paga por doze meses de uma vez e tem o maior desconto. Na página Planos você vê o valor e a economia. Esse ciclo ainda está sendo liberado para contratação.',
        k: 'anual doze meses 12 meses ano',
      },
      {
        id: 'ap-7',
        q: 'Como renovar minha assinatura?',
        a: 'A assinatura é renovada pela cobrança do próximo período. Se o pagamento ficar pendente, a página Planos mostra o botão Regularizar pagamento, que abre a fatura. Pague e o acesso volta a ficar em dia.',
        k: 'renovar renovação vencida pagar fatura',
      },
      {
        id: 'ap-8',
        q: 'Como consultar a validade do meu plano?',
        a: 'Abra Planos. No alto aparece a situação da assinatura (período de teste, ativa, renovando em breve, pagamento pendente etc.) e a mensagem com os dias que faltam para o fim do teste ou para a renovação.',
        k: 'validade vencimento prazo data plano teste',
      },
      {
        id: 'ap-9',
        q: 'Como atualizar meu pagamento?',
        a: 'Dentro do app, o pagamento é feito pela fatura que abre ao tocar em Assinar ou Regularizar pagamento, na página Planos. Para trocar a forma de pagamento ou o cartão, fale com a nutricionista pelo Help Nutri.',
        k: 'pagamento cartão atualizar trocar forma de pagamento',
      },
      {
        id: 'ap-10',
        q: 'O que acontece quando minha assinatura vence?',
        a: 'Primeiro a assinatura fica com pagamento pendente e há um prazo de tolerância. Se o pagamento não for confirmado, o acesso a algumas áreas é bloqueado, mas nenhum dado seu é apagado. Ao regularizar o pagamento, o acesso volta.',
        k: 'vence vencimento bloqueio acesso atraso pendente',
      },
      {
        id: 'ap-11',
        q: 'Como cancelar minha assinatura?',
        a: 'Em Planos, abaixo da situação da assinatura, toque em Cancelar assinatura. O acesso segue até o fim do período já pago. Se tiver dificuldade, fale com a nutricionista pelo Help Nutri.',
        k: 'cancelar encerrar assinatura parar de pagar',
      },
      {
        id: 'ap-12',
        q: 'Perdi acesso a uma funcionalidade. O que aconteceu?',
        a: 'O motivo mais comum é um pagamento pendente ou uma assinatura vencida. Abra Planos e veja a situação; regularizando, o acesso volta. Se estiver tudo em dia e mesmo assim faltar algo, fale com a nutricionista pelo Help Nutri.',
        k: 'perdi acesso sumiu bloqueado funcionalidade não aparece',
      },
    ],
  },
  {
    id: 'revista',
    title: 'Revista Levemente',
    description: 'A revista da comunidade.',
    items: [
      {
        id: 're-1',
        q: 'O que é a revista Levemente?',
        a: 'É a revista da comunidade (Círcula Magazine), em formato digital, com uma edição nova todo mês. Cada edição tem capa e páginas para ler no celular, com receitas, conteúdos e dicas de bem-estar.',
        k: 'revista magazine levemente edição',
      },
      {
        id: 're-2',
        q: 'Como acessar a revista?',
        a: 'Na página inicial, role até a seção Revista. As capas aparecem empilhadas; toque na capa da frente para ler. Você vira as páginas deslizando para a esquerda ou usando as setas.',
        k: 'acessar abrir ler revista capa',
      },
      {
        id: 're-3',
        q: 'Como navegar pelas edições?',
        a: 'Deslize a capa da frente para a esquerda para ver a próxima edição da pilha. Dentro do leitor, o botão Entrar no Escritório Editorial abre a banca com todas as edições nas prateleiras.',
        k: 'edições navegar pilha banca escritório prateleira',
      },
      {
        id: 're-4',
        q: 'Como abrir uma matéria?',
        a: 'A revista é lida página a página. Abra a edição, deslize para virar as páginas e use os botões + e − (ou dois toques) para ampliar uma página e ler com conforto. O botão Baixar salva a página que está na tela.',
        k: 'matéria página zoom ampliar baixar download',
      },
      {
        id: 're-5',
        q: 'Como encontrar edições anteriores?',
        a: 'Abra a revista e toque em Entrar no Escritório Editorial. Lá ficam as edições já lançadas, organizadas em prateleiras. Toque na capa desejada para ler.',
        k: 'anteriores antigas edições passadas escritório',
      },
      {
        id: 're-6',
        q: 'A revista está disponível para todos os membros?',
        a: 'Sim, para quem faz parte da comunidade. Cada edição só pode ser lida a partir da data de lançamento: antes disso a capa aparece com o selo Em breve e a data, e as páginas ficam bloqueadas.',
        k: 'disponível todos membros acesso lançamento em breve',
      },
      {
        id: 're-7',
        q: 'Como acessar novos conteúdos?',
        a: 'Uma nova edição é lançada todo mês, no dia 1. Quando chega a data, a capa deixa de mostrar Em breve e você já pode ler. Volte à página inicial e abra a revista.',
        k: 'novo conteúdo nova edição lançamento mês',
      },
    ],
  },
  {
    id: 'receitas',
    title: 'Receitas e alimentação',
    description: 'Receitas da nutricionista.',
    items: [
      {
        id: 'rc-1',
        q: 'Onde encontrar as receitas?',
        a: 'Toque em Receitas, no Menu da página inicial ou na vitrine de Receitas. As receitas ficam organizadas em categorias; escolha uma categoria e depois a receita.',
        k: 'receitas onde encontrar categorias',
      },
      {
        id: 'rc-2',
        q: 'Como pesquisar uma receita?',
        a: 'Ainda não há busca por palavra nas receitas. Navegue pelas categorias, que a nutricionista organiza por tema (por exemplo, sem glúten ou saladas), e abra a receita que quiser.',
        k: 'pesquisar buscar procurar receita',
      },
      {
        id: 'rc-3',
        q: 'Como visualizar os ingredientes?',
        a: 'Abra a receita. Ela mostra a foto, a descrição e a seção Ingredientes. Algumas receitas também têm o botão Ler em formato revista, com as páginas prontas, inclusive a lista de ingredientes.',
        k: 'ingredientes lista',
      },
      {
        id: 'rc-4',
        q: 'Como acompanhar o modo de preparo?',
        a: 'Na receita aberta, role até Modo de preparo. Se a receita tiver o formato revista, toque em Ler em formato revista e vire as páginas na ordem; use o zoom para ler os passos melhor.',
        k: 'modo de preparo passo a passo como fazer',
      },
      {
        id: 'rc-5',
        q: 'Como consultar as informações nutricionais?',
        a: 'Quando a nutricionista inclui, a informação nutricional aparece nas páginas do formato revista da receita (toque em Ler em formato revista). Nem toda receita tem essa página. Em caso de dúvida sobre a sua alimentação, converse com ela pelo Help Nutri.',
        k: 'informações nutricionais calorias nutrição tabela',
      },
      {
        id: 'rc-6',
        q: 'As receitas possuem opções sem glúten?',
        a: 'Sim, a nutricionista organiza receitas por categorias e pode haver uma categoria para opções sem glúten. Abra Receitas e veja as categorias disponíveis. Para orientação sobre restrições alimentares, fale com ela.',
        k: 'sem glúten gluten celíaca',
      },
      {
        id: 'rc-7',
        q: 'Existem receitas sem lactose?',
        a: 'Depende das categorias que a nutricionista cadastrou. Abra Receitas e confira. Se você precisa de opções sem lactose, peça no Help Nutri para ela indicar receitas adequadas ao seu caso.',
        k: 'sem lactose leite intolerância',
      },
      {
        id: 'rc-8',
        q: 'Existem receitas sem açúcar?',
        a: 'Depende das categorias cadastradas. Abra Receitas e veja as opções. Para orientação personalizada sobre açúcar na sua alimentação, converse com a nutricionista pelo Help Nutri.',
        k: 'sem açúcar diet zero açúcar',
      },
      {
        id: 'rc-9',
        q: 'Como salvar uma receita favorita?',
        a: 'O app ainda não tem a função de favoritos. Por enquanto, para voltar a uma receita, abra Receitas e escolha a categoria onde ela está. Se você instalou o Círcula na tela inicial, o caminho fica rápido.',
        k: 'favorita favoritos salvar guardar receita',
      },
    ],
  },
  {
    id: 'loja',
    title: 'Loja',
    description: 'Produtos e materiais.',
    items: [
      {
        id: 'lo-1',
        q: 'Como funciona a loja do Círcula?',
        a: 'A Loja reúne os produtos e materiais que a nutricionista oferece à comunidade, como e-books e conteúdos digitais. Você abre pela vitrine Loja ou pelo item Loja do Menu.',
        k: 'loja funciona produtos comprar',
      },
      {
        id: 'lo-2',
        q: 'Como encontrar produtos?',
        a: 'Abra a Loja. Os produtos publicados aparecem em lista, com foto e nome. Role para ver todos.',
        k: 'produtos encontrar procurar loja',
      },
      {
        id: 'lo-3',
        q: 'Como visualizar os detalhes de um produto?',
        a: 'Na Loja, toque no produto para ver a descrição, o valor e as informações do item.',
        k: 'detalhes produto descrição valor',
      },
      {
        id: 'lo-4',
        q: 'Como realizar uma compra?',
        a: 'Abra o produto na Loja e siga o botão de compra. A finalização do pagamento acontece em uma página segura que abre para você. Se algo não funcionar, fale com a nutricionista pelo Help Nutri.',
        k: 'comprar compra pagar pedido',
      },
      {
        id: 'lo-5',
        q: 'Como acompanhar um pedido?',
        a: 'Para saber a situação de um pedido, abra a Loja e confira o produto adquirido. Se não encontrar a informação ou tiver qualquer dúvida sobre o pedido, fale com a nutricionista pelo Help Nutri.',
        k: 'pedido acompanhar rastrear status',
      },
      {
        id: 'lo-6',
        q: 'Como acessar um produto adquirido?',
        a: 'Os produtos digitais comprados ficam disponíveis na própria Loja, no item que você adquiriu. Se não aparecer após a confirmação do pagamento, aguarde alguns minutos e atualize a página; persistindo, avise a nutricionista.',
        k: 'acessar produto comprado adquirido meus materiais',
      },
      {
        id: 'lo-7',
        q: 'Como funciona a entrega de produtos digitais?',
        a: 'Produtos digitais não têm frete: depois que o pagamento é confirmado, o acesso é liberado na Loja. Pode levar alguns minutos até a confirmação.',
        k: 'entrega digital frete e-book download',
      },
      {
        id: 'lo-8',
        q: 'Onde encontro meus materiais comprados?',
        a: 'Na Loja, nos produtos que você adquiriu. Se um material não aparecer, confira se o pagamento foi confirmado e, se continuar faltando, fale com a nutricionista pelo Help Nutri.',
        k: 'materiais comprados meus produtos biblioteca',
      },
    ],
  },
  {
    id: 'agenda',
    title: 'Agenda e calendário',
    description: 'Seus compromissos.',
    items: [
      {
        id: 'ag-1',
        q: 'Como utilizar minha agenda?',
        a: 'Toque no calendário da página inicial (o título Agenda) para abrir a agenda completa. Lá você vê a semana ou o mês, adiciona compromissos e escreve observações. É só seu: ninguém mais vê.',
        k: 'agenda usar calendário compromissos',
      },
      {
        id: 'ag-2',
        q: 'Como visualizar meus compromissos?',
        a: 'Na agenda, alterne entre Semana e Mês. Os dias com compromisso aparecem marcados; toque no dia para ver a lista e abrir cada item.',
        k: 'visualizar ver compromissos semana mês',
      },
      {
        id: 'ag-3',
        q: 'Como adicionar um evento?',
        a: 'Na agenda, toque no botão para adicionar um compromisso, escolha o dia, o horário e o título, escreva uma observação se quiser e salve. Você pode editar ou excluir depois.',
        k: 'adicionar criar novo evento compromisso lembrete',
      },
      {
        id: 'ag-4',
        q: 'Como consultar os próximos compromissos?',
        a: 'Abra a agenda e use as setas para avançar de semana ou de mês. Os dias com compromisso ficam marcados.',
        k: 'próximos compromissos futuro consultar',
      },
      {
        id: 'ag-5',
        q: 'Como organizar minha rotina?',
        a: 'Use a agenda para registrar seus compromissos e a ferramenta Antes de Tudo para criar pequenos hábitos diários. A calculadora de água ajuda a acompanhar a hidratação do dia.',
        k: 'rotina organizar hábitos dia a dia',
      },
      {
        id: 'ag-6',
        q: 'Como utilizar o calendário?',
        a: 'O calendário da página inicial mostra a semana atual, com o dia de hoje destacado. Use as setas para ver outras semanas e toque nele para abrir a agenda completa.',
        k: 'calendário semana hoje usar',
      },
    ],
  },
  {
    id: 'bem-estar',
    title: 'Bem-estar e autocuidado',
    description: 'Frase do dia, água, IMC e mais.',
    items: [
      {
        id: 'be-1',
        q: 'Como funciona a frase do dia?',
        a: 'Uma vez por dia, ao abrir o app, aparece uma frase em um balão ao lado da sua saudação. A frase é sorteada entre as cadastradas pela comunidade e é a mesma para todas no dia. Toque no balão para ler inteira e no X para fechar.',
        k: 'frase do dia mensagem balão inspiração',
      },
      {
        id: 'be-2',
        q: 'Como utilizar as dicas de leitura?',
        a: 'No menu vertical da página inicial, toque em Dicas de leitura. A nutricionista cadastra ali as indicações de livros e conteúdos para você.',
        k: 'dicas de leitura livros',
      },
      {
        id: 'be-3',
        q: 'Como acessar os exercícios de respiração?',
        a: 'No menu vertical da página inicial, toque em Respiração. Lá ficam as práticas de respiração e meditação cadastradas pela nutricionista.',
        k: 'respiração meditação exercícios',
      },
      {
        id: 'be-4',
        q: 'Como utilizar a playlist?',
        a: 'A Playlist está chegando. Por enquanto a tela avisa que ainda não há playlists publicadas; quando houver, elas aparecem ali.',
        k: 'playlist música',
      },
      {
        id: 'be-5',
        q: 'Como funciona o acompanhamento da água?',
        a: 'Toque em Água. Informe o seu peso para o app estimar uma meta diária, registre quanto bebeu (200, 300 ou 500 ml, ou outro valor) e veja a garrafa se encher. Há também o histórico por dia. Tudo é privado.',
        k: 'água hidratação meta garrafa copos',
      },
      {
        id: 'be-6',
        q: 'Como utilizar o card IMC?',
        a: 'Toque em IMC, informe a sua altura em centímetros e o seu peso em quilos e toque em Calcular. O app mostra o resultado, a faixa de referência, uma mensagem acolhedora e uma ilustração. A conta é feita no aparelho e nada é salvo.',
        k: 'imc calculadora peso altura',
      },
      {
        id: 'be-7',
        q: 'Como interpretar meu resultado de IMC?',
        a: 'O IMC é só uma conta entre peso e altura. Ele não é diagnóstico e não mostra composição corporal, massa muscular nem saúde como um todo. Use o resultado como um ponto de partida para conversar com a nutricionista.',
        k: 'interpretar resultado imc significa',
      },
      {
        id: 'be-8',
        q: 'O que significa estar dentro ou fora da faixa de referência?',
        a: 'As faixas seguem a referência da OMS para adultos: abaixo de 18,5, de 18,5 a 24,9, de 25 a 29,9 e a partir de 30. Estar fora da faixa não é uma sentença; é um sinal para conversar com um profissional e olhar o seu caso individualmente.',
        k: 'faixa de referência oms significa dentro fora',
      },
      {
        id: 'be-9',
        q: 'Como falar com a nutricionista?',
        a: 'Toque em Help Nutri no Menu da página inicial (ou em Falar com a nutri, na tela do IMC). Abre a conversa com a nutricionista da sua comunidade, onde você escreve a sua dúvida.',
        k: 'falar nutricionista help nutri mensagem conversa contato',
      },
    ],
  },
  {
    id: 'circulos',
    title: 'Círculos e comunidade',
    description: 'Grupos e convivência.',
    items: [
      {
        id: 'ci-1',
        q: 'O que são os Círculos?',
        a: 'Círculos são pequenos grupos dentro da comunidade, por tema ou interesse (como mães, viagem ou outros). São um espaço para criar conexões e compartilhar experiências.',
        k: 'círculos grupos o que são',
      },
      {
        id: 'ci-2',
        q: 'Como participar de um Círculo?',
        a: 'Na página inicial, na faixa Círculos, toque em um círculo para abrir a página dele. Lá você pode seguir o círculo para participar e deixar de seguir quando quiser.',
        k: 'participar entrar seguir círculo',
      },
      {
        id: 'ci-3',
        q: 'Como encontrar comunidades de interesse?',
        a: 'Os temas aparecem como Círculos na página inicial. Se não encontrar o seu tema, use o card Novo Círculo para sugerir um grupo à nutricionista.',
        k: 'encontrar comunidades interesse temas sugerir',
      },
      {
        id: 'ci-4',
        q: 'Como interagir com outras participantes?',
        a: 'No Feed você lê as publicações, reage e comenta, com respeito e carinho. Os comentários e respostas ficam fechados, vistos só por quem participa da comunidade. Dentro dos Círculos você também conversa com o grupo.',
        k: 'interagir comentar curtir feed conversar participantes',
      },
      {
        id: 'ci-5',
        q: 'Como acompanhar as novidades?',
        a: 'Fique de olho no sino de notificações no topo, nas bolinhas vermelhas dos cards e no Feed, onde as novas publicações aparecem. Os eventos e a revista também mostram o que há de novo.',
        k: 'novidades notificações avisos sino',
      },
      {
        id: 'ci-6',
        q: 'Como participar das atividades?',
        a: 'Abra Eventos, no Menu, para ver os encontros da comunidade. Também há o Meu Jardim, com atividades diárias. Toque no que quiser fazer e siga as orientações da tela.',
        k: 'atividades eventos encontros jardim desafios',
      },
      {
        id: 'ci-7',
        q: 'Como funciona a comunidade feminina?',
        a: 'A comunidade Fluir & Florescer é um espaço de cuidado e amizade entre mulheres. Só participam as pessoas convidadas. A nutricionista cuida do ambiente, e pedimos sempre respeito, acolhimento e sigilo sobre o que é compartilhado.',
        k: 'comunidade feminina regras convivência respeito',
      },
    ],
  },
  {
    id: 'privacidade',
    title: 'Privacidade e segurança',
    description: 'Seus dados e quem vê o quê.',
    items: [
      {
        id: 'pv-1',
        q: 'Quem pode visualizar meu perfil?',
        a: 'O seu perfil é visto apenas por quem participa da mesma comunidade que você e pela nutricionista responsável. Pessoas de fora da comunidade não veem o seu perfil.',
        k: 'quem vê perfil privacidade visualizar',
      },
      {
        id: 'pv-2',
        q: 'Meus dados estão protegidos?',
        a: 'Sim. O acesso aos dados é controlado por regras de segurança: cada pessoa só vê o que pode ver. Dados da agenda, da água e do IMC são pessoais. O IMC nem é guardado. Você pode ler a Política de Privacidade para mais detalhes.',
        k: 'dados protegidos segurança lgpd privacidade política',
      },
      {
        id: 'pv-3',
        q: 'Como alterar minhas configurações de privacidade?',
        a: 'O app não tem uma tela de opções de privacidade: o perfil já é visível só para a comunidade. Você escolhe o que escrever e quais fotos mostrar em Editar perfil. Se quiser que algo seja ocultado, fale com a nutricionista pelo Help Nutri.',
        k: 'configurações privacidade ocultar esconder perfil',
      },
      {
        id: 'pv-4',
        q: 'Como entrar em contato para solicitar suporte?',
        a: 'Use o Help Nutri, no Menu da página inicial, para falar com a nutricionista da comunidade. Para dúvidas de uso, procure primeiro nesta Central de Ajuda.',
        k: 'contato suporte ajuda falar atendimento',
      },
      {
        id: 'pv-5',
        q: 'Como solicitar a exclusão dos meus dados?',
        a: 'Peça à nutricionista pelo Help Nutri, informando o seu e-mail de cadastro. O tratamento dos dados segue a Política de Privacidade do Círcula.',
        k: 'excluir dados apagar lgpd remover informações',
      },
    ],
  },
  {
    id: 'tecnicos',
    title: 'Problemas técnicos',
    description: 'Quando algo não funciona.',
    items: [
      {
        id: 'te-1',
        q: 'O aplicativo não abre. O que fazer?',
        a: 'Confira a sua conexão com a internet. Feche o app por completo e abra de novo. Se estiver instalado na tela inicial, tente abrir pelo navegador. Se ainda assim não abrir, aguarde alguns minutos e tente outra vez.',
        k: 'não abre travou fecha não carrega',
      },
      {
        id: 'te-2',
        q: 'A tela está carregando e não aparece o conteúdo.',
        a: 'Verifique a internet e puxe a tela para atualizar ou feche e abra o app. Se for em uma área específica, volte ao Início e entre de novo. Persistindo, avise a nutricionista, dizendo qual tela é.',
        k: 'carregando branco vazio conteúdo não aparece tela',
      },
      {
        id: 'te-3',
        q: 'Não consigo visualizar a revista.',
        a: 'Veja se a edição já foi lançada: antes da data aparece Em breve e as páginas ficam bloqueadas. Se já foi lançada, atualize o app e confira a internet; as páginas são imagens e dependem de boa conexão.',
        k: 'revista não aparece não abre bloqueada',
      },
      {
        id: 'te-4',
        q: 'As imagens não aparecem.',
        a: 'Quase sempre é a conexão lenta. Aguarde um pouco, role a página e atualize o app. Se só algumas imagens faltam, pode ser que a nutricionista ainda não tenha enviado a foto daquele item.',
        k: 'imagens fotos não aparecem quebradas',
      },
      {
        id: 'te-5',
        q: 'Não consigo acessar uma funcionalidade.',
        a: 'Confira se a sua assinatura está em dia em Planos, pois a falta de pagamento pode bloquear áreas. Depois atualize o app. Se estiver tudo certo e o problema continuar, fale com a nutricionista pelo Help Nutri.',
        k: 'não consigo acessar funcionalidade bloqueada área',
      },
      {
        id: 'te-6',
        q: 'O aplicativo está lento.',
        a: 'Feche outros aplicativos, confira a conexão (Wi-Fi ou dados) e atualize o app. Muitas imagens pesadas podem demorar mais em conexões fracas.',
        k: 'lento devagar demora travando',
      },
      {
        id: 'te-7',
        q: 'O que fazer quando uma página apresenta erro?',
        a: 'Volte ao Início pelo botão Voltar ou pela barra de baixo e tente de novo. Se o erro se repetir, atualize o app. Anote a tela e a mensagem e envie à nutricionista pelo Help Nutri.',
        k: 'erro mensagem falha página problema bug',
      },
      {
        id: 'te-8',
        q: 'Como atualizar o aplicativo?',
        a: 'O Círcula se atualiza sozinho: ao fechar e abrir de novo, você já recebe a versão mais recente. Se continuar vendo a versão antiga, feche o app por completo e abra de novo; se estiver instalado na tela inicial, abra pelo navegador uma vez.',
        k: 'atualizar versão nova app atualização cache',
      },
      {
        id: 'te-9',
        q: 'Como entrar em contato quando um problema persiste?',
        a: 'Fale com a nutricionista pelo Help Nutri, descrevendo o que acontece, em qual tela e, se possível, enviando um print da tela. Assim fica mais fácil resolver.',
        k: 'contato problema persiste suporte falar ajuda',
      },
    ],
  },
]
