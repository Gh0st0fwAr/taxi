// The production TypeScript build also type-checks files under src. Keep the
// Jest globals locally typed because this repo does not install @types/jest.
declare const describe: (name: string, fn: () => void) => void
declare const test: (name: string, fn: () => void) => void
declare const expect: (actual: unknown) => any

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
const fixedNow = new Date(2030, 4, 1, 9, 0, 0)

describe('WIMI demo booking rules', () => {
  test('rounds any started 10-minute block up in integer cents', () => {
    expect(calculateBaseQuoteCents(10)).toBe(250)
    expect(calculateBaseQuoteCents(11)).toBe(500)
    expect(calculateBaseQuoteCents(30)).toBe(750)
    expect(calculateBaseQuoteCents(60)).toBe(1500)
    expect(calculateBaseQuoteCents(90)).toBe(2250)
    expect(calculateBaseQuoteCents(120)).toBe(3000)
    expect(calculateBaseQuoteCents(121)).toBe(3250)
    expect(calculateBaseQuoteCents(129)).toBe(3250)
    expect(calculateBaseQuoteCents(130)).toBe(3250)
    expect(calculateBaseQuoteCents(131)).toBe(3500)
    expect(calculateBaseQuoteCents(149)).toBe(3750)
    expect(calculateBaseQuoteCents(150)).toBe(3750)
    expect(calculateBaseQuoteCents(151)).toBe(4000)
    expect(calculateBaseQuoteCents(179)).toBe(4500)
    expect(calculateBaseQuoteCents(180)).toBe(4500)
    expect(calculateBaseQuoteCents(0)).toBe(0)
    expect(calculateBaseQuoteCents(-10)).toBe(0)
    expect(calculateBaseQuoteCents(Number.NaN)).toBe(0)
    expect(calculateBaseQuoteCents(Number.POSITIVE_INFINITY)).toBe(0)
  })

  test('rejects blank address and malformed or impossible dates', () => {
    expect(validateBookingDraft({ ...draft, address: '   ' }, fixedNow)).toContain('Укажите адрес оказания услуги.')
    for (const date of ['', '2030-2-01', '2030-02-30', 'not-a-date']) {
      expect(validateBookingDraft({ ...draft, date }, fixedNow)).toContain('Укажите корректную дату.')
    }
  })

  test('rejects past dates and permits a future date', () => {
    expect(validateBookingDraft({ ...draft, date: '2030-04-30' }, fixedNow)).toContain('Дата заказа не может быть в прошлом.')
    expect(validateBookingDraft(draft, fixedNow)).toEqual([])
  })

  test('rejects a start time in the past or equal to now on the current date', () => {
    const now = new Date(2030, 4, 10, 10, 0, 0)
    const today = '2030-05-10'
    expect(validateBookingDraft({ ...draft, date: today, startTime: '09:59' }, now)).toContain('Выберите время в будущем.')
    expect(validateBookingDraft({ ...draft, date: today, startTime: '10:00' }, now)).toContain('Выберите время в будущем.')
    expect(validateBookingDraft({ ...draft, date: today, startTime: '10:01' }, now)).toEqual([])
  })

  test('rejects invalid times and starts outside the booking window', () => {
    for (const startTime of ['6:00', '24:00', '12:60', 'xx:yy', '05:59', '22:01']) {
      expect(validateBookingDraft({ ...draft, startTime }, fixedNow).length).toBeGreaterThan(0)
    }
    expect(validateBookingDraft({ ...draft, startTime: '22:00' }, fixedNow)).toContain(
      'Начало в 22:00 не позволяет выполнить минимальную длительность до полуночи.',
    )
    expect(validateBookingDraft({ ...draft, startTime: '06:00' }, fixedNow)).toEqual([])
  })

  test('enforces minimum duration and midnight boundary', () => {
    expect(validateBookingDraft({ ...draft, durationMinutes: 119 }, fixedNow)).toContain('Минимальная длительность заказа — 120 минут.')
    expect(validateBookingDraft({ ...draft, startTime: '21:00', durationMinutes: 180 }, fixedNow)).toEqual([])
    expect(validateBookingDraft({ ...draft, startTime: '21:00', durationMinutes: 190 }, fixedNow)).toContain('Заказ должен завершиться не позднее 00:00.')
    for (const durationMinutes of [0, -120, 120.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(validateBookingDraft({ ...draft, durationMinutes }, fixedNow)).toContain('Минимальная длительность заказа — 120 минут.')
    }
  })

  test('validates children count at both boundaries', () => {
    expect(validateBookingDraft({ ...draft, childrenCount: 1 }, fixedNow)).toEqual([])
    expect(validateBookingDraft({ ...draft, childrenCount: 8 }, fixedNow)).toEqual([])
    for (const childrenCount of [0, 9, 1.5, Number.NaN]) {
      expect(validateBookingDraft({ ...draft, childrenCount }, fixedNow)).toContain('Укажите количество детей от 1 до 8.')
    }
  })

  test('creates a local demo order with expected fields and integer quote', () => {
    const now = new Date('2030-05-01T10:00:00.000Z')
    const order = createDemoOrder(draft, now)
    expect(order.id).toMatch(/^WIMI-DEMO-/)
    expect(order.status).toBe('CREATED')
    expect(order.createdAt).toBe(now.toISOString())
    expect(order.estimatedTotalCents).toBe(3000)
    expect(order.address).toBe(draft.address)
    expect(order.childrenCount).toBe(1)
    expect(order.notes).toBe('')
  })

  test('rounds any started 10-minute block up and rejects invalid drafts on create', () => {
    expect(createDemoOrder({ ...draft, durationMinutes: 121 }, fixedNow).estimatedTotalCents).toBe(3250)
    expect(createDemoOrder({ ...draft, durationMinutes: 129 }, fixedNow).estimatedTotalCents).toBe(3250)
    expect(createDemoOrder({ ...draft, durationMinutes: 130 }, fixedNow).estimatedTotalCents).toBe(3250)
    expect(createDemoOrder({ ...draft, durationMinutes: 131 }, fixedNow).estimatedTotalCents).toBe(3500)
    expect(createDemoOrder({ ...draft, durationMinutes: 149 }, fixedNow).estimatedTotalCents).toBe(3750)
    expect(createDemoOrder({ ...draft, durationMinutes: 150 }, fixedNow).estimatedTotalCents).toBe(3750)
    expect(() => createDemoOrder({ ...draft, address: ' ' }, fixedNow)).toThrow('Укажите адрес оказания услуги.')
  })
})
