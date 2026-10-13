export type NannyPricingQuote = {
  formula: string
  price: string | number
  options: Record<string, number>
  calculationType: string
}

export type NannyPricingEnvelope = {
  status?: string
  message?: string | null
  data?: NannyPricingQuote | null
}

/**
 * Only a duration-aware server calculation may be shown as the booking quote.
 * The current template returns calculationType="incomplete" with duration=0;
 * fail closed until the backend implements the approved duration tariff.
 */
export function parseNannyPricingEnvelope(res: NannyPricingEnvelope): NannyPricingQuote {
  if (res.status !== 'success' || !res.data || !Number.isFinite(Number(res.data.price))) {
    throw new Error(res.message || 'Сервер не вернул предварительную цену.')
  }
  if (res.data.calculationType !== 'complete') {
    throw new Error('Сервер пока не поддерживает полный расчёт цены по длительности. Заказ не создан.')
  }
  return res.data
}
