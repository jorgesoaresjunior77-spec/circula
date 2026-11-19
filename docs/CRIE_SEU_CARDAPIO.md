# Crie seu Cardápio — como funciona e o que falta de conteúdo

## O que foi construído
- **Banner na Home** (`HomeMenuBanner`): foto à esquerda (~42%), chamada à direita, banner inteiro clicável. A foto
  é cadastrada em Painel → Imagens da comunidade → "Crie seu Cardápio" (16:9). Sem foto, aparece um fundo suave.
- **Página em 5 etapas** (`MenuBuilderPage`): encontro, o que servir, estilo, restrições, personalização.
  Voltar não perde as respostas. O cardápio pronto aparece na tela, com foto, ingredientes ajustados ao número de
  convidados e modo de preparo.
- **Lista de compras em PDF** (`menuPrint.ts`): abre a tela de impressão do navegador ("Salvar como PDF"), como a
  Gestão Nutricional. Soma ingredientes repetidos entre as receitas.
- **Motor** (`lib/menuBuilder.ts`): determinístico, sem IA e sem sorteio. Só usa receitas **publicadas e com ficha**.
  Nunca inventa receita; quando falta, mostra o que falta e o que ajustar.

## Ficha do cardápio (tabela `recipe_menu_meta`)
A biblioteca continua sendo `community_content` (type = recipe). Cada receita ganha, no editor de receitas, uma
"Ficha do cardápio": tipo de prato, estilo, restrições atendidas, alergênicos, rendimento, tempo, dificuldade e
custo aproximado. **Receita sem ficha não entra nos cardápios.**

## Alergias (regra de segurança)
- Alergia informada é restrição obrigatória.
- Só entra receita com a caixa "Revisei os ingredientes e o risco de contaminação cruzada" marcada na ficha.
- Também sai a receita que declara o alergênico ou cita o termo nos ingredientes.
- O app avisa que não certifica ausência de alergênicos e pede conferir rótulos.

## Conteúdo necessário (meta de ~80 receitas)
Nenhuma receita foi cadastrada de enfeite. Para o motor funcionar bem, a nutricionista precisa publicar receitas
**e preencher a ficha** de cada uma. Distribuição sugerida:

| Tipo de prato | Receitas |
|---|---|
| Bebidas de boas-vindas | 8 |
| Entradas e aperitivos | 12 |
| Pratos principais | 18 |
| Acompanhamentos | 16 |
| Sobremesas | 14 |
| Bebidas para acompanhar | 6 |
| Cafés e finalizações | 6 |

Cobrir também os estilos (brasileira, italiana, mediterrânea, contemporânea, caseira, saudável, sofisticada,
prática) e, em cada tipo de prato, ao menos algumas opções sem glúten, sem lactose, vegetarianas e veganas.
Os ingredientes devem ter uma linha por item com quantidade ("200 g de frango"), pois é daí que sai a lista de
compras. O rendimento (porções) precisa estar na ficha para o app ajustar as quantidades.

## Meu Chef e Lista de compras inteligente (2026-11-19)
- O card passou a se chamar **Meu Chef** ("Receba bem"): 70% da largura, com a mesma borda dos outros cards.
- É uma assinatura avulsa de **R$ 8,90/mês** (`meu_chef`). Salvar a lista de compras em PDF é outra, de
  **R$ 3,80/mês** (`lista_inteligente`). O Círcula Premium inclui as duas.
- Ao terminar um cardápio, quem ainda não tem a Lista de compras inteligente vê o convite para assinar.
- A foto do card é cadastrada em Painel → Imagens da comunidade → "Meu Chef" (16:9, 1600 × 900 px).
