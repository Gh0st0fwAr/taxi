declare const describe: (name: string, fn: () => void) => void
declare const test: (name: string, fn: () => void) => void
declare const expect: (actual: unknown) => any

import { buildNannyQuotePayload } from './nannyPricingPayload'

describe('nanny_pricing quote payload', () => {
  test('sends the service-local time with the Madrid summer offset', () => {
    expect(buildNannyQuotePayload('2026-07-10', '10:00')).toEqual({
      action: 'quote',
      when: '2026-07-10 10:00:00+02:00',
      time_zone: 'Europe/Madrid',
      options: [],
    })
  })

  test('sends the service-local time with the Madrid winter offset', () => {
    expect(buildNannyQuotePayload('2026-01-10', '10:00')).toEqual({
      action: 'quote',
      when: '2026-01-10 10:00:00+01:00',
      time_zone: 'Europe/Madrid',
      options: [],
    })
  })
})
