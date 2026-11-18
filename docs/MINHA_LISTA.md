# Minha Lista — arquitetura, regras comerciais e evolução

## O que existe

- **Card da Home**: "Lista de Compras" na roda de menu (`HomeMenuWheel`), mesmo componente dos outros cards; foto opcional pelo painel (chave `menu_lista`).
- **Rota**: `NavKey 'lista'` → `MinhaListaPage` (carregada sob demanda). Sem acesso e sem listas: página comercial (`MinhaListaCommercial`).
- **Painel**: saudação, listas em andamento, produtos pendentes e comprados, valor estimado, histórico, criar lista, montar com receitas.
- **Lista**: nome, descrição, data prevista, observações, status (`em_andamento`, `concluida`, `arquivada`), produtos por categoria (14), unidades (10), preço estimado e pago, totais e diferença, duplicar, compartilhar, concluir, arquivar, excluir.
- **Modo supermercado**: tela cheia para celular, toque grande, +/− de quantidade, preço pago, só o que falta, total da compra, adicionar produto. Tudo salva na hora.
- **Receitas**: botão **ADICIONAR INGREDIENTES À MINHA LISTA** em cada receita e **Montar lista com receitas** no painel. Lê o texto dos ingredientes (sem alterá-lo), ajusta porções, consolida o que é compatível e deixa marcar o que levar.
- **Compartilhamento**: com participantes da comunidade (só ver / ver e editar, a dona decide) e como texto para o WhatsApp (sem preços).
- **Nutricionista**: no plano alimentar, "Lista de compras na Minha Lista" cria uma lista dela a partir do plano e a compartilha (com permissão de editar) com a participante vinculada à paciente.

## Consolidação (regra de ouro)

Só soma o que é a mesma coisa na mesma grandeza: g com kg e ml com l somam; "2 ovos" e "200 g de ovo" **não** somam; medidas caseiras (xícara, colher...) ficam no nome ("arroz (xicara)") para nunca virarem peso por engano. Código: `src/lib/shopping.ts` (testes em `shopping.test.ts`).

## Banco (migrações `20261123120000` e `20261123130000`)

`shopping_lists`, `shopping_list_items`, `shopping_list_recipes`, `shopping_list_shares`, com chaves estrangeiras, índices e RLS:

- criar lista exige `has_minha_lista(community)`: pacote `minha_lista` ou `premium` em `member_package_access`, ou ser a dona da comunidade;
- ver/alterar: dona da lista; quem recebeu compartilhamento vê (ou edita, se `edit`);
- só se compartilha com participante ativa da mesma comunidade (gatilho `shopping_share_check`);
- quem deixa de assinar continua vendo e baixando o que criou, mas não cria novas listas.

Nada clínico entra nessas tabelas. A lista da nutricionista é dela; a paciente só recebe o compartilhamento.

## Preços (fonte: `src/lib/plansCatalog.ts`, espelho no servidor: `supabase/functions/_shared/addonPlans.ts`)

| Plano | Mensal | Semestral | Anual |
|---|---|---|---|
| Minha Lista | R$ 4,90 | R$ 24,70 | R$ 39,40 |
| Círcula Premium | R$ 59,80 | R$ 287,04 | R$ 466,44 |

- Descontos **preservados**: avulsos de preço aberto 16% (semestral) e 33% (anual); Premium 20% e 35%. Foram só recalculados sobre os novos valores; nenhum percentual novo foi criado.
- Soma "separado" do Premium agora é R$ 80,00 (inclui a Minha Lista).
- **Premium inclui a Minha Lista**: `canUseMinhaLista` aceita `minha_lista` **ou** `premium`; o servidor concede o pacote `premium` no pagamento. Assinante Premium não vê cobrança da Minha Lista como pendente (`AddonCheckout` mostra "você já tem").
- **Assinaturas já contratadas não mudam**: o preço fica gravado em `addon_subscriptions.price_cents` no momento da contratação e o webhook usa o valor gravado; a função de criação reaproveita assinatura viva em vez de recriar. Só novas contratações usam os novos valores. Nenhum registro financeiro foi alterado.
- Não existe cupom nem campanha de desconto no sistema hoje; quando existirem, devem partir dos preços do catálogo e não podem ser somados ao desconto de ciclo sem regra explícita.

## Para evoluir (não feito agora)

- Vincular uma lista a uma **orientação alimentar** específica (hoje só vai pelo plano) e lembrar a paciente da data prevista.
- Notificação quando uma lista compartilhada é alterada.
- Lista a partir do plano com **substituições** escolhidas pela paciente.
- Importar os ingredientes estruturados das receitas (hoje é texto livre, uma linha por item; o cadastro ganhou um campo opcional para isso).
- Gráficos de gasto por mês no histórico.
