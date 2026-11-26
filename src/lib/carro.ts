import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { productPrices } from './plansCatalog'

// Carro em Dia: perguntas e respostas para ajudar mulheres a cuidar dos seus carros.
// Avulso de R$ 4,50 por mês, também incluído no Círcula Premium.

export const CARRO_PLAN_KEY = 'carro'
export const CARRO_MONTHLY_CENTS = 450
export const CARRO_PRICES = productPrices(CARRO_MONTHLY_CENTS)

export interface CarroSettings {
  ativo: boolean
  titulo: string
  subtitulo: string
  icone: string
  ordem: number
  teaser: string
  tempo_resposta: string
  lembrete_dias: number
  imagem: string | null
  imagem_alt: string | null
}

export interface CarroCategoria {
  id: string
  nome: string
  icone: string
  cidade_categorias: string[]
}

export interface CarroHome {
  settings: CarroSettings
  acesso: boolean
  pode_responder: boolean
  categorias: CarroCategoria[]
  teaser: string[]
}

/** Dados da tela inicial do Carro em Dia (configurações, categorias, teaser e se a pessoa tem acesso). */
export function useCarroHome(enabled = true) {
  const [home, setHome] = useState<CarroHome | null>(null)
  const [error, setError] = useState(false)

  const reload = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc('car_home')
    if (rpcError) {
      setError(true)
      return
    }
    setError(false)
    setHome(data as CarroHome)
  }, [])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void supabase.rpc('car_home').then(({ data, error: rpcError }) => {
      if (cancelled) return
      if (rpcError) setError(true)
      else setHome(data as CarroHome)
    })
    return () => {
      cancelled = true
    }
  }, [enabled])

  return { home, error, reload }
}

// ---- ponte com "Na minha cidade" (sem rota nova: um recado em memória) ----
let pendingCityCategories: string[] | null = null
export function sendToCity(categoryIds: string[]) {
  pendingCityCategories = categoryIds
}
export function takeCityRequest(): string[] | null {
  const v = pendingCityCategories
  pendingCityCategories = null
  return v
}

/** O que cada lista de "Na minha cidade" mostra de volta: a categoria do card que combina. */
let pendingCarroCategory: string | null = null
export function sendToCarro(categoryId: string | null) {
  pendingCarroCategory = categoryId
}
export function takeCarroRequest(): string | null {
  const v = pendingCarroCategory
  pendingCarroCategory = null
  return v
}

/** Avisa quem digita para não colocar placa, telefone ou CPF (o servidor também remove). */
export function hasSensitiveData(text: string): boolean {
  return (
    /\b[A-Za-z]{3}-?(\d{4}|\d[A-Za-z]\d{2})\b/.test(text) ||
    /(\(?\d{2}\)?[\s.-]?)?9?\d{4}[\s.-]?\d{4}/.test(text) ||
    /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/.test(text)
  )
}
