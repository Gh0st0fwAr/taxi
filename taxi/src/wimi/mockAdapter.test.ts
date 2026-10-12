import {
  calculateBaseQuoteCents,
  createDemoOrder,
  validateBookingDraft,
  WimiBookingDraft,
} from './mockAdapter'

const draft: WimiBookingDraft = {
  address: 'Calle Mayor 1, Málaga',
  date: '2030-05-10',
  startTime: '10:00',
  durationMinutes: 120,
  childrenCount: 1,
  childrenAges: '4',
  notes: '',
}

describe('WIMI demo booking rules', () => {
  test('calculates base quote in integer cents and applies the minimum only to base time', () => {
    expect(calculateBaseQuoteCents(60)).toBe(1500)
    expect(calculateBaseQuoteCents(90)).toBe(2250)
    expect(calculateBaseQuoteCents(120)).toBe(3000)
    expect(calculateBaseQuoteCents(130)).toBe(3250)
    expect(calculateBaseQuoteCents(0)).toBe(0)
  })

  test('rejects a start before 06:00 and after 22:00', () => {
    expect(validateBookingDraft({ ...draft, startTime: '05:59' })).toContain(
      'Начало заказа должно быть с 06:00 до 22:00 включительно.',
    )
    expect(validateBookingDraft({ ...draft, startTime: '22:01' })).toContain(
      'Начало заказа должно быть с 06:00 до 22:00 включительно.',
    )
  })

  test('requires the 120-minute minimum and does not allow a booking past midnight', () => {
    expect(validateBookingDraft({ ...draft, durationMinutes: 110 })).toContain(
      'Минимальная длительность заказа — 120 минут.',
    )
    expect(validateBookingDraft({ ...draft, startTime: '21:00', durationMinutes: 180 })).toContain(
      'Заказ должен завершиться не позднее 00:00.',
    )
  })

  test('creates only a local demo order object after validation', () => {
    const order = createDemoOrder(draft, new Date('2030-05-01T10:00:00.000Z'))
    expect(order.id).toMatch(/^WIMI-DEMO-/)
    expect(order.status).toBe('CREATED')
    expect(order.estimatedTotalCents).toBe(3000)
    expect(order.address).toBe(draft.address)
  })

  test('does not create an order from an invalid draft', () => {
    expect(() => createDemoOrder({ ...draft, address: ' ' })).toThrow(
      'Укажите адрес оказания услуги.',
    )
  })
})
