import { describe, it, expect } from 'vitest'
import { layoutArticle, splitParagraphs } from './wellnessArticles'

describe('wellnessArticles', () => {
  it('separa parágrafos por linha em branco e ignora vazios', () => {
    expect(splitParagraphs('Um.\n\n\nDois.\n  \nTrês.')).toEqual(['Um.', 'Dois.', 'Três.'])
    expect(splitParagraphs(null)).toEqual([])
  })

  it('distribui as imagens ao longo do texto, sem perder nenhuma', () => {
    const blocks = layoutArticle(['a', 'b', 'c', 'd', 'e', 'f'], ['i1', 'i2', 'i3'])
    expect(blocks.filter((b) => b.type === 'image')).toHaveLength(3)
    expect(blocks.filter((b) => b.type === 'text')).toHaveLength(6)
    // a primeira imagem não abre a matéria: vem depois de texto
    expect(blocks[0].type).toBe('text')
    // a ordem das imagens é preservada
    expect(blocks.filter((b) => b.type === 'image').map((b) => (b as { path: string }).path)).toEqual(['i1', 'i2', 'i3'])
  })

  it('com mais imagens que parágrafos, sobra vai para o fim; sem texto, só imagens', () => {
    const blocks = layoutArticle(['a'], ['i1', 'i2', 'i3'])
    expect(blocks.map((b) => b.type)).toEqual(['text', 'image', 'image', 'image'])
    expect(layoutArticle([], ['i1']).map((b) => b.type)).toEqual(['image'])
  })
})
