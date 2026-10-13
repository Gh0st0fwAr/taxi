declare const describe: (name: string, fn: () => void) => void
declare const test: (name: string, fn: () => void) => void
declare const expect: (actual: unknown) => any

import { buildNannyQuotePayload } from './nannyPricingPayload'
import { parseNannyPricingEnvelope } from './nannyPricingApi'

describe('nanny_pricing quote payload', () => {
  test('sends the service-local time with the Madrid summer offset', () => {
    expect(buildNannyQuotePayload('2026-07-10', '10:00', 120)).toEqual({
      action: 'quote',
      when: '2026-07-10 10:00:00+02:00',
      time_zone: 'Europe/Madrid',
      duration_min: 120,
      options: [],
    })
  })

  test('sends the service-local time with the Madrid winter offset', () => {
    expect(buildNannyQuotePayload('2026-01-10', '10:00', 120)).toEqual({
      action: 'quote',
      when: '2026-01-10 10:00:00+01:00',
      time_zone: 'Europe/Madrid',
      duration_min: 120,
      options: [],
    })
  })
  
  test('sends the selected duration to the server', () => {
    expect(buildNannyQuotePayload('2026-01-10', '10:00', 131).duration_min).toBe(131)
  })

  test('rejects incomplete server calculations instead of displaying them as a quote', () => {
    expect(parseNannyPricingEnvelope({
      status: 'success',
      data: { formula: 'base_price', price: '30', options: {}, calculationType: 'complete' },
    }).price).toBe('30')
    expect(() => parseNannyPricingEnvelope({
      status: 'success',
      data: { formula: 'base_price', price: '30', options: {}, calculationType: 'incomplete' },
    })).toThrow('полный расчёт цены по длительности')
  })
})
